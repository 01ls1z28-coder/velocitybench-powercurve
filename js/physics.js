/**
 * VelocityBench PowerCurve — geared RPM physics (¼-mile + run-to-Vmax)
 *
 * Faithful JS port of CarTestClone Physics/PhysicsEngine.cs:
 *   mechRpm = wheelRpm * gearRatio * finalDrive
 *   wheelTorque = engineTQ(rpm) * gear * FD * (1 - loss)
 *   shift at shiftRpm with delay; converter stall/flash; soft traction +
 *   driveline compliance + continuous ATC/TQ envelope (Dragy tip-spike g);
 *   soft shift V-notch → engage tip-spike; no stair/square g segments
 *
 * VB extensions: weather/DA, wind+gusts, FI boost models, EV + Hybrid power sources,
 * F/R + L/R weight distribution (axle normals, transfer, open/LSD traction), editable factory TX ratios.
 * Hybrid: ICE crank TQ + separate electric-motor assist band (not cosmetic).
 * Estimates — not track certified.
 */
(function (global) {
  'use strict';

  var FEET_TO_M = 0.3048;
  var MPH_TO_MPS = 0.44704;
  var MPS_TO_MPH = 2.23694;
  var G = 9.80665;
  var RHO0 = 1.225;

  var DIST_60 = 60 * FEET_TO_M;
  var DIST_330 = 330 * FEET_TO_M;
  var DIST_660 = 660 * FEET_TO_M;
  var DIST_1000 = 1000 * FEET_TO_M;
  var DIST_1320 = 1320 * FEET_TO_M;
  var DIST_MILE = 5280 * FEET_TO_M;

  var DEFAULT_LOSS_PCT = 15.0;
  var DEFAULT_WB_FT = 8.5;
  var DEFAULT_CG_FT = 1.5;
  var DEFAULT_REAR_PCT = 55.0;
  var DEFAULT_LEFT_PCT = 50.0;
  var DEFAULT_MU = 1.1;

  /**
   * Suggested static weight bias from layout / drive (UI + garage bake).
   * Front-engine RWD keeps rear≈55 so existing fleet calibration stays put.
   */
  function suggestedWeightDistribution(car) {
    car = car || {};
    var layout = String(car.engineLayout || 'Front').toLowerCase();
    var drive = String(car.driveType || 'RWD').toUpperCase();
    var rear = DEFAULT_REAR_PCT;
    var n = String(car.name || car.category || '').toLowerCase();
    var isBike = car.category === 'Motorcycle' || /ninja|hayabusa|yamaha yzf|suzuki gsx|honda cbr|ducati|bmw s1000|motorcycle|bike\b|panigale/.test(n);
    if (isBike) rear = 52; // slight rear bias with rider
    if (layout === 'mid') rear = 55;           // ~45/55
    else if (layout === 'rear') rear = 62;     // ~38/62
    else if (layout === 'dual') rear = 50;     // ~50/50 pack split
    else if (drive === 'FWD') rear = 40;       // ~60/40
    else if (drive === 'AWD') rear = 55;       // slight rear bias
    else rear = 55;                            // FR RWD — calib-safe (~50/50 + rear bias)
    var left = DEFAULT_LEFT_PCT;
    if (car.leftWeightPercent != null && isFinite(Number(car.leftWeightPercent))) {
      left = clamp(Number(car.leftWeightPercent), 20, 80);
    }
    rear = clamp(rear, 20, 80);
    return {
      frontWeightPercent: 100 - rear,
      rearWeightPercent: rear,
      leftWeightPercent: left,
      rightWeightPercent: 100 - left
    };
  }

  /** Resolve F/R % for traction; prefers explicit car fields, else historical 55 rear. */
  function resolveWeightDistribution(car) {
    car = car || {};
    var rear, left;
    if (car.rearWeightPercent != null && isFinite(Number(car.rearWeightPercent))) {
      rear = Number(car.rearWeightPercent);
    } else if (car.frontWeightPercent != null && isFinite(Number(car.frontWeightPercent))) {
      rear = 100 - Number(car.frontWeightPercent);
    } else {
      // Unset → historical default (NOT layout guess) so spotcheck/fleet stay stable
      rear = DEFAULT_REAR_PCT;
    }
    if (car.leftWeightPercent != null && isFinite(Number(car.leftWeightPercent))) {
      left = Number(car.leftWeightPercent);
    } else if (car.rightWeightPercent != null && isFinite(Number(car.rightWeightPercent))) {
      left = 100 - Number(car.rightWeightPercent);
    } else {
      left = DEFAULT_LEFT_PCT;
    }
    rear = clamp(rear, 20, 80);
    left = clamp(left, 20, 80);
    return {
      frontWeightPercent: 100 - rear,
      rearWeightPercent: rear,
      leftWeightPercent: left,
      rightWeightPercent: 100 - left
    };
  }

  // Softened vs C# 2.55/1.16 for track realism (VERIFY.md)
  var GRIP_LT20 = 1.35;
  var GRIP_20_40 = 1.15;
  var GRIP_40_60 = 1.05;
  var FORCE_LT30 = 2.05;
  var FORCE_GT60 = 1.10;

  var DEFAULT_LAUNCH_RPM = 3000;
  var DEFAULT_SHIFT_RPM = 6500;
  var DEFAULT_SHIFT_TIME = 0.10;
  // Launch-mode window: early rollout (~60 ft / ~40 mph), not just first ~2 mph.
  // Soft/auto/aggressive must produce meaningful, realistic deltas on CT/ZR1X-class cars.
  var LAUNCH_V_THRESH = 18.0;   // m/s ≈ 40 mph
  var LAUNCH_HOLD = 2.2;        // seconds of launch-mode influence
  var LAUNCH_DIST_M = 18.3;     // ≈ 60 ft
  var MAX_T = 180.0;            // allow long accel runs to Vmax
  var DT = 0.001;
  /** Safety caps for run-to-Vmax (documented in VERIFY.md). */
  var VMAX_SPEED_CAP_MPH = 250.0;
  var VMAX_DIST_CAP_FT = 26400.0; // 5 miles
  var VMAX_A_THRESH = 0.05;       // m/s^2 — equilibrium detect
  var VMAX_HOLD_S = 0.50;         // sustained low-a before declaring Vmax

  /** Global drive-force scale. Tuned via VERIFY spot-checks. */
  var CalibrationFactor = 0.95;

  /**
   * Shift-coast residual HOLE floor by transmission family.
   * Soft release → brief floor → post-shift engage tip-spike. ATC uses a SHALLOW
   * residual (slight notch, not a deep well) + mid-shift recover climb, then
   * spikes up on engage (Dragy C — KEEP). Between-shift tippy envelope from
   * soft traction + driveline + ATC/TQ dynamics (not fake IMU). forceScale=1.
   * Aero + rolling resistance still apply honestly; velocity integration unchanged.
   */
  var SHIFT_RESIDUAL_DRIVE = {
    manual: 0.10,     // clutch open — mostly coast (0.05–0.15 band)
    automatic: 0.52,  // ATC/TC slight notch (NOT deep 0.30 well) — Dragy soft dip
    dct: 0.60,        // dual-clutch overlap (0.45–0.75); also sequential / bike
    ev: 0.85          // near-seamless (0.70–0.95); rare multi-speed EV shifts
  };

  /**
   * Resolve shift-drive family from car.transmission, isEv, and txKey / preset hints.
   * Returns: 'manual' | 'dct' | 'automatic' | 'ev'
   */
  function resolveShiftDriveFamily(car) {
    if (!car) return 'automatic';
    if (car.isEv || car.powerSource === 'ev') return 'ev';
    var tx = String(car.transmission || '').trim().toLowerCase();
    var key = String(car.txKey || '');
    var keyL = key.toLowerCase();
    var preset = FactoryTransmissions[key];
    var pname = preset && preset.name ? String(preset.name).toLowerCase() : '';
    var blob = tx + ' ' + keyL + ' ' + pname;

    // Manual / MT-like (explicit label, or bare txKey on empty transmission)
    if (/^manual\b|stick|h-?pattern|\bmt\b/.test(tx)) return 'manual';
    if (!tx && /^(tr6060|tremec_t56|tremec_tr3650|tremec_t45|tremec_tr3160|mt82|getrag_mt82|muncie|toploader|a833|t5_|karkraft|toyota_t50|toyota_w58|toyota_it6|mazda_5|mazda_6mt|nissan_fs5w71|nissan_fs6r31a|nissan_z_6|mazda_miata|honda_s2000|honda_ctr|honda_nsx|honda_5mt|toyota_fa86|getrag_r34|getrag_420g|bmw_getrag|aisin_6|aisin_ay6|subaru_6mt|mitsubishi_|porsche_cgt|ford_ricardo|lambo_manual|aston_graziano|cima_6|saleen_ricardo|hyundai_6mt)/i.test(key)) {
      return 'manual';
    }

    // DCT / PDK / DSG / SSG / dual-clutch / sequential (bikes) / AMT e-gear
    if (/dct|pdk|dsg|ssg|dual|sequential|ldf|isr|e-?gear|\bf1\b|stronic|speedshift\s*dct|tremec_tr90/.test(blob) ||
        /^(pdk_|porsche_pdk|amg_speedshift_dct|vw_dq500|audi_stronic|gr6_dct|dct_7|tremec_tr9070|tremec_tr9080|ferrari_|mclaren_|lambo_|bugatti_|bmw_m_dct|bike_)/i.test(key)) {
      return 'dct';
    }

    // Automatic / AT / ZF / MCT / torque-converter
    if (/auto|automatic|\bat\b|zf|mct|torque\s*converter|converter|10r80|10l90|4l60|700r4|6l80|6r80|nag1|th400|th350|200-?4r|2004r|a340|chrysler_727|ford_c[46]|cruise/.test(blob)) {
      return 'automatic';
    }

    return 'automatic'; // fallback
  }

  function shiftResidualFraction(family) {
    var f = SHIFT_RESIDUAL_DRIVE[family];
    return f != null ? f : SHIFT_RESIDUAL_DRIVE.automatic;
  }

  /**
   * Fraction of shiftTime spent releasing into the residual hole.
   * After release, torque HOLDS at the hole until shiftTime ends; engagement
   * push is a separate post-shift smoothstep (clutch bite / TC fill / DCT lock).
   * Keeps mid-shift impulse near the residual model (ET/trap honesty) while
   * removing square a/g cliffs.
   */
  var SHIFT_RELEASE_FRACTION = {
    manual: 0.42,     // clutch out
    automatic: 0.55,  // ATC shifts fast — brief soft notch, little flat hold
    dct: 0.30,        // overlap — quicker to hole
    ev: 0.25          // near-seamless
  };

  /** Post-shift engagement ramp duration (seconds) by TX family. */
  var SHIFT_ENGAGE_TIME = {
    manual: 0.070,    // clutch bite
    automatic: 0.040, // ATC TC / clutch-pack fill + tip spike
    dct: 0.035,       // overlap complete
    ev: 0.020         // inverter slew
  };

  /**
   * Engage tip-spike overshoot vs engaged TQ (0 = none).
   * ATC: brief push ABOVE next-gear settle (Dragy spike-on-engage), then settle.
   */
  var SHIFT_ENGAGE_OVERSHOOT = {
    manual: 0.06,     // clutch bite tip
    automatic: 0.22,  // ATC slam / TC fill spike (slight notch then SPIKE)
    dct: 0.04,        // mild overlap tip
    ev: 0.00          // seamless
  };

  function shiftReleaseFraction(family) {
    var f = SHIFT_RELEASE_FRACTION[family];
    return f != null ? f : SHIFT_RELEASE_FRACTION.automatic;
  }

  function shiftEngageTime(family) {
    var t = SHIFT_ENGAGE_TIME[family];
    return t != null ? t : SHIFT_ENGAGE_TIME.automatic;
  }

  function shiftEngageOvershoot(family) {
    var o = SHIFT_ENGAGE_OVERSHOOT[family];
    return o != null ? o : SHIFT_ENGAGE_OVERSHOOT.automatic;
  }

  /** Hermite smoothstep on [0,1] — C1 continuous clutch/TC blend. */
  function smoothstep01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  /**
   * Mid-shift release: p=0 → lastDrive; soft dip to hole at releaseEnd.
   * Optional recoverStart/recoverTQ: ATC V-notch climbs off the floor before
   * shift-end (no deep flat well). Post-shift tip spike via shiftEngageTorque.
   */
  function shiftReleaseTorque(p, lastDriveWhTQ, holeTQ, releaseEnd, recoverStart, recoverTQ) {
    var re = releaseEnd;
    if (re < 0.12) re = 0.12;
    if (re > 0.85) re = 0.85;
    var rs = recoverStart;
    if (rs == null || !(rs > re) || rs >= 1) {
      if (p >= re) return holeTQ;
      var u0 = smoothstep01(p / re);
      return lastDriveWhTQ + (holeTQ - lastDriveWhTQ) * u0;
    }
    if (p <= re) {
      var u1 = smoothstep01(p / re);
      return lastDriveWhTQ + (holeTQ - lastDriveWhTQ) * u1;
    }
    if (p < rs) return holeTQ;
    var span = 1 - rs;
    if (span < 1e-6) return holeTQ;
    var u2 = smoothstep01((p - rs) / span);
    return holeTQ + (recoverTQ - holeTQ) * u2;
  }

  /**
   * Post-shift engagement: e=0 → fromTQ; e=1 → engagedWhTQ.
   * Optional tip overshoot: half-sine peaks mid-engage ABOVE engaged TQ
   * (ATC Dragy spike-on-engage), then settles to engaged at e=1.
   */
  function shiftEngageTorque(e, fromTQ, engagedWhTQ, overshoot) {
    var u = smoothstep01(e);
    var os = overshoot > 0 ? overshoot : 0;
    var tip = os > 0 ? Math.sin(Math.PI * e) : 0;
    var target = engagedWhTQ * (1 + os * tip);
    return fromTQ + (target - fromTQ) * u;
  }

  /**
   * Grip vs mph — LIVE band anchors with narrow smoothstep blends across former
   * 20/40/60 cliffs so launch/mid g is continuous (kills square stairs — A/E).
   */
  function gripMultSmooth(mph) {
    function blend(loMph, hiMph, loG, hiG) {
      if (mph <= loMph) return loG;
      if (mph >= hiMph) return hiG;
      return loG + (hiG - loG) * smoothstep01((mph - loMph) / (hiMph - loMph));
    }
    // Full-span slopes — NO mid-band flats (those paint launch stairs while grip-limited).
    // Brief 0–8 mph hold keeps leave mu near LIVE GRIP_LT20 (ET honesty).
    if (mph < 8) return GRIP_LT20;
    if (mph < 28) return blend(8, 28, GRIP_LT20, GRIP_20_40);
    if (mph < 48) return blend(28, 48, GRIP_20_40, GRIP_40_60);
    if (mph < 70) return blend(48, 70, GRIP_40_60, 1.0);
    return 1.0;
  }

  /**
   * Drive-force scale vs mph — LIVE FORCE_LT30 / FORCE_GT60 with blends at 30/60
   * so force does not cliff (continuous taper with speed — A/E).
   */
  function driveForceMultSmooth(mph) {
    function blend(loMph, hiMph, loG, hiG) {
      if (mph <= loMph) return loG;
      if (mph >= hiMph) return hiG;
      return loG + (hiG - loG) * smoothstep01((mph - loMph) / (hiMph - loMph));
    }
    // Full-span slopes — kill 34–56 flat FORCE shelf (square stair on g).
    if (mph < 16) return FORCE_LT30;
    if (mph < 38) return blend(16, 38, FORCE_LT30, 1.0);
    if (mph < 75) return blend(38, 75, 1.0, FORCE_GT60);
    return FORCE_GT60;
  }

  /**
   * Soft tire traction knee — asymptote above tracLim so launch tips then settles
   * (Dragy sharp launch spike character — D) instead of a flat brick-wall g shelf.
   */
  function softTractionForce(driveF, tracLim, overshootFrac) {
    if (tracLim <= 1e-9) return 0;
    if (driveF <= tracLim) return driveF;
    var over = overshootFrac != null ? overshootFrac : 0.12;
    if (over < 0) over = 0;
    if (over > 0.28) over = 0.28;
    var ceil = tracLim * (1 + over);
    var excess = driveF - tracLim;
    var span = Math.max(tracLim * 0.45, 1);
    var soft = tracLim + (ceil - tracLim) * (excess / (excess + span));
    // Spill headroom so TQ/ATC tips still move applied (no flat ceil shelf).
    var head = Math.min(driveF, ceil * 1.08) - soft;
    if (head > 0) soft += 0.10 * head;
    return soft;
  }

  var FactoryTransmissions = {
    TH400_3: { name: 'GM TH400 3-spd', gears: [2.48, 1.48, 1.00], finalDrive: 3.73, loss: 18 },
    Muncie_M21: { name: 'Muncie M21 4-spd', gears: [2.20, 1.64, 1.28, 1.00], finalDrive: 3.70, loss: 12 },
    Toploader_4: { name: 'Ford Toploader 4-spd', gears: [2.20, 1.66, 1.31, 1.00], finalDrive: 3.54, loss: 12 },
    A833_4: { name: 'Chrysler A833 4-spd', gears: [2.66, 1.91, 1.39, 1.00], finalDrive: 3.55, loss: 12 },
    T5_5: { name: 'BorgWarner T5 5-spd', gears: [2.95, 1.94, 1.34, 1.00, 0.63], finalDrive: 3.73, loss: 13 },
    // Phase2 classics: OEM-distinct 4/5spd (prefer existing Toploader/Muncie/A833/T5 unless OEM needs distinct)
    KarKraft_T44_4: { name: 'Kar Kraft T-44 4-spd (GT40 MkII)', gears: [2.22, 1.43, 1.19, 1.00], finalDrive: 2.77, loss: 12 },
    Toyota_T50_5: { name: 'Toyota T50 5-spd (AE86)', gears: [3.587, 2.022, 1.384, 1.000, 0.861], finalDrive: 4.30, loss: 13 },
    Toyota_W58_5: { name: 'Toyota W58 5-spd (Supra/MR2)', gears: [3.285, 1.894, 1.275, 1.000, 0.783], finalDrive: 3.73, loss: 13 },
    Mazda_5M: { name: 'Mazda 5-spd (RX-7 GSL-SE)', gears: [3.622, 2.181, 1.419, 1.000, 0.758], finalDrive: 3.909, loss: 13 },
    Nissan_FS5W71_5: { name: 'Nissan FS5W71C 5-spd (Skyline)', gears: [3.321, 1.902, 1.308, 1.000, 0.838], finalDrive: 4.111, loss: 13 },
    TR6060_6: { name: 'Tremec TR-6060 6-spd', gears: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], finalDrive: 3.73, loss: 12 },
    Getrag_MT82: { name: 'Getrag MT-82 6-spd', gears: [3.66, 2.43, 1.69, 1.32, 1.00, 0.65], finalDrive: 3.73, loss: 12 },
    ZF8HP: { name: 'ZF 8HP Auto', gears: [4.71, 3.14, 2.11, 1.67, 1.28, 1.00, 0.84, 0.67], finalDrive: 3.15, loss: 15 },
    // Phase3 Euro DCT marque presets (published-leaning). PDK_7 kept as Carrera-class alias.
    PDK_7: { name: 'Porsche PDK 7-spd (alias)', gears: [3.91, 2.29, 1.65, 1.30, 1.08, 0.88, 0.62], finalDrive: 3.44, loss: 10 },
    Porsche_PDK_7: { name: 'Porsche PDK 7-spd (Carrera)', gears: [3.91, 2.29, 1.65, 1.30, 1.08, 0.88, 0.62], finalDrive: 3.44, loss: 10 },
    Porsche_PDK_7_GT: { name: 'Porsche PDK 7-spd (GT)', gears: [3.75, 2.38, 1.72, 1.34, 1.11, 0.96, 0.84], finalDrive: 3.97, loss: 10 },
    AMG_SPEEDSHIFT_DCT_7: { name: 'AMG SPEEDSHIFT DCT 7', gears: [3.40, 2.19, 1.63, 1.29, 1.03, 0.84, 0.72], finalDrive: 3.67, loss: 10 },
    AMG_SPEEDSHIFT_MCT_7: { name: 'AMG SPEEDSHIFT MCT 7', gears: [4.377, 2.859, 1.921, 1.368, 1.000, 0.820, 0.728], finalDrive: 2.82, loss: 12 },
    VW_DQ500_7: { name: 'VW DQ500 7DSG', gears: [3.562, 2.526, 1.678, 1.022, 0.788, 0.761, 0.635], finalDrive: 4.059, loss: 10 },
    Audi_STronic_7: { name: 'Audi S-tronic DL501 7', gears: [3.692, 2.150, 1.406, 1.025, 0.787, 0.625, 0.519], finalDrive: 4.093, loss: 10 },
    GR6_DCT: { name: 'Nissan GR6 DCT', gears: [4.056, 2.301, 1.595, 1.248, 1.000, 0.795], finalDrive: 3.70, loss: 10 },
    Getrag_R34: { name: 'Getrag 6-spd (R34 GT-R)', gears: [3.214, 1.925, 1.302, 1.000, 0.752, 0.634], finalDrive: 3.545, loss: 14 },
    Aisin_6: { name: 'Aisin/Getrag V160 6-spd', gears: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], finalDrive: 3.133, loss: 12 },
    // Phase6 Euro supercar DCT marque presets (published-leaning). Legacy DCT_7_AMG kept empty of fleet after Phase6 remap.
    Ferrari_DCT_7: { name: 'Ferrari Getrag F1 DCT 7', gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], finalDrive: 5.14, loss: 10 },
    Ferrari_DCT_8: { name: 'Ferrari Magna 8DCT (SF90)', gears: [3.61, 2.34, 1.74, 1.40, 1.07, 0.87, 0.77, 0.67], finalDrive: 4.51, loss: 10 },
    Ferrari_F1_6: { name: 'Ferrari F1 6-spd AMT', gears: [3.29, 2.16, 1.61, 1.27, 1.03, 0.82], finalDrive: 4.30, loss: 12 },
    McLaren_SSG_7: { name: 'McLaren SSG 7DCT', gears: [3.98, 2.61, 1.91, 1.48, 1.16, 0.91, 0.69], finalDrive: 3.31, loss: 10 },
    Lambo_LDF_7: { name: 'Lamborghini LDF 7DCT', gears: [3.133, 2.083, 1.575, 1.244, 0.979, 0.788, 0.677], finalDrive: 4.89, loss: 10 },
    Lambo_ISR_7: { name: 'Lamborghini ISR 7 AMT', gears: [3.909, 2.438, 1.810, 1.458, 1.185, 0.967, 0.844], finalDrive: 2.867, loss: 12 },
    Lambo_EGear_6: { name: 'Lamborghini e-gear 6 AMT (Gallardo)', gears: [3.31, 2.05, 1.46, 1.14, 0.94, 0.78], finalDrive: 3.08, loss: 12 },
    Lambo_EGear_V12_6: { name: 'Lamborghini e-gear 6 AMT (Murciélago)', gears: [3.091, 2.105, 1.565, 1.241, 1.065, 0.939], finalDrive: 2.53, loss: 12 },
    Bugatti_DSG_7: { name: 'Bugatti DSG 7DCT', gears: [3.18, 2.26, 1.67, 1.29, 1.06, 0.88, 0.80], finalDrive: 3.64, loss: 10 },
    BMW_M_DCT_7: { name: 'BMW M DCT 7 (GS7D36SG)', gears: [4.806, 2.583, 1.701, 1.277, 1.000, 0.844, 0.671], finalDrive: 3.462, loss: 10 },
    // Legacy key kept for any residual Tremec clone; GT500 = Tremec_TR9070_7DCT; Phase6 remaps Euro supercars off this
    DCT_7_AMG: { name: 'Tremec TR-9070 DCT 7 (legacy key)', gears: [3.14, 2.05, 1.43, 1.10, 0.86, 0.68, 0.56], finalDrive: 3.73, loss: 10 },
    Tremec_TR9070_7DCT: { name: 'Tremec TR-9070 DCT 7', gears: [3.14, 2.05, 1.43, 1.10, 0.86, 0.68, 0.56], finalDrive: 3.73, loss: 10 },
    Ford_10R80: { name: 'Ford 10R80 10-spd Auto', gears: [4.696, 2.985, 2.146, 1.769, 1.520, 1.275, 1.000, 0.854, 0.689, 0.636], finalDrive: 3.15, loss: 15 },
    GM_10L90: { name: 'GM 10L90 10-spd Auto', gears: [4.70, 2.99, 2.15, 1.80, 1.52, 1.28, 1.00, 0.85, 0.69, 0.64], finalDrive: 2.85, loss: 15 },
    Tremec_TR9080_8DCT: { name: 'Tremec TR-9080 8DCT', gears: [2.91, 1.76, 1.22, 0.88, 0.65, 0.51, 0.40, 0.33], finalDrive: 5.20, loss: 10 },
    Bike_Sport_6: { name: 'Sportbike 6-spd (liter)', gears: [2.600, 2.158, 1.882, 1.650, 1.476, 1.304], finalDrive: 3.96, loss: 12 },
    Bike_Hyper_6: { name: 'Hyperbike 6-spd', gears: [2.562, 1.934, 1.526, 1.285, 1.125, 1.041], finalDrive: 3.81, loss: 12 },
    EV_Single: { name: 'EV Single-Speed', gears: [1.00], finalDrive: 9.0, loss: 8 },
    // Phase 4 EV / oddball — published-leaning (Tesla manuals / Porsche Newsroom / Koenigsegg KDD)
    Tesla_EV_Plaid: { name: 'Tesla Plaid single-speed', gears: [1.00], finalDrive: 7.56, loss: 8 },
    Tesla_EV_Cybertruck: { name: 'Tesla Cybertruck single-speed', gears: [1.00], finalDrive: 15.02, loss: 8 },
    Porsche_Taycan_2: { name: 'Porsche Taycan 2-spd rear', gears: [1.925, 1.00], finalDrive: 8.05, loss: 8 },
    Koenigsegg_KDD: { name: 'Koenigsegg Direct Drive', gears: [1.00], finalDrive: 2.73, loss: 8 },
    // Phase 5 residual ZF8/TR6060 filler — published-leaning OEM autos + JDM manuals
    GM_4L60E: { name: 'GM 4L60-E 4-spd Auto', gears: [3.06, 1.63, 1.00, 0.70], finalDrive: 3.42, loss: 16 },
    GM_4L65E: { name: 'GM 4L65-E 4-spd Auto', gears: [3.06, 1.63, 1.00, 0.70], finalDrive: 3.42, loss: 16 },
    GM_2004R: { name: 'GM THM 200-4R 4-spd Auto', gears: [2.74, 1.57, 1.00, 0.67], finalDrive: 3.42, loss: 16 },
    GM_6L80: { name: 'GM 6L80 6-spd Auto', gears: [4.027, 2.364, 1.532, 1.152, 0.852, 0.667], finalDrive: 3.27, loss: 15 },
    Chrysler_NAG1_5: { name: 'Chrysler NAG1/W5A580 5-spd Auto', gears: [3.59, 2.19, 1.41, 1.00, 0.83], finalDrive: 3.06, loss: 15 },
    Mazda_Miata_5: { name: 'Mazda Miata NA 5-spd', gears: [3.136, 1.888, 1.330, 1.000, 0.814], finalDrive: 4.30, loss: 13 },
    Honda_S2000_6: { name: 'Honda S2000 6-spd (AP1)', gears: [3.133, 2.045, 1.481, 1.161, 0.970, 0.810], finalDrive: 4.756, loss: 12 },
    Toyota_FA86_6: { name: 'Toyota/Subaru FA86 6-spd', gears: [3.626, 2.188, 1.541, 1.213, 1.000, 0.767], finalDrive: 4.10, loss: 12 },
    // Phase 7 OEM boxes — T56 vs TR-6060, classic GM autos, Ford MT era, JDM/Euro manuals
    Tremec_T56: { name: 'Tremec T56 6-spd', gears: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], finalDrive: 3.42, loss: 12 },
    GM_TH350: { name: 'GM TH350 3-spd', gears: [2.52, 1.52, 1.00], finalDrive: 3.42, loss: 18 },
    GM_700R4: { name: 'GM 700R4 4-spd Auto', gears: [3.06, 1.63, 1.00, 0.70], finalDrive: 3.42, loss: 16 },
    Tremec_TR3650: { name: 'Tremec TR-3650 5-spd', gears: [3.38, 2.00, 1.32, 1.00, 0.68], finalDrive: 3.55, loss: 13 },
    Tremec_T45: { name: 'Tremec T45 5-spd', gears: [3.37, 1.99, 1.33, 1.00, 0.67], finalDrive: 3.27, loss: 13 },
    Tremec_TR3160: { name: 'Tremec TR-3160 6-spd', gears: [3.25, 2.23, 1.61, 1.24, 1.00, 0.63], finalDrive: 3.73, loss: 12 },
    Aisin_AY6: { name: 'Aisin AY6 6-spd (Camaro V6)', gears: [4.48, 2.58, 1.63, 1.19, 1.00, 0.75], finalDrive: 3.27, loss: 12 },
    Honda_CTR_6: { name: 'Honda Civic Type R 6-spd', gears: [3.625, 2.115, 1.529, 1.125, 0.911, 0.735], finalDrive: 4.111, loss: 12 },
    Honda_NSX_5: { name: 'Honda NSX 5-spd', gears: [3.071, 1.727, 1.230, 0.967, 0.771], finalDrive: 4.062, loss: 12 },
    Honda_5MT: { name: 'Honda 5-spd (Prelude/Integra era)', gears: [3.230, 1.900, 1.250, 0.909, 0.702], finalDrive: 4.40, loss: 13 },
    Subaru_6MT: { name: 'Subaru 6MT (STI)', gears: [3.636, 2.235, 1.521, 1.137, 0.971, 0.756], finalDrive: 3.90, loss: 14 },
    Mitsubishi_5MT: { name: 'Mitsubishi 5MT (Evo VIII)', gears: [2.928, 1.950, 1.407, 1.031, 0.720], finalDrive: 4.529, loss: 14 },
    Mitsubishi_6MT: { name: 'Mitsubishi 6MT (Evo X)', gears: [2.909, 1.944, 1.434, 1.100, 0.868, 0.693], finalDrive: 4.583, loss: 14 },
    Nissan_FS6R31A: { name: 'Nissan FS6R31A 6-spd (350Z)', gears: [3.794, 2.324, 1.624, 1.271, 1.000, 0.794], finalDrive: 3.538, loss: 12 },
    Nissan_Z_6: { name: 'Nissan Z 6-spd (RZ34)', gears: [3.794, 2.324, 1.624, 1.271, 1.000, 0.794], finalDrive: 3.538, loss: 12 },
    Mazda_6MT: { name: 'Mazda 6-spd (RX-8)', gears: [3.760, 2.269, 1.645, 1.187, 1.000, 0.843], finalDrive: 4.444, loss: 12 },
    BMW_Getrag_6: { name: 'BMW Getrag 420G 6-spd', gears: [4.227, 2.528, 1.669, 1.226, 1.000, 0.828], finalDrive: 3.62, loss: 12 },
    Porsche_CGT_6: { name: 'Porsche Carrera GT 6-spd', gears: [3.20, 1.87, 1.36, 1.07, 0.90, 0.75], finalDrive: 4.44, loss: 12 },
    Ford_Ricardo_6: { name: 'Ford GT Ricardo 6-spd', gears: [2.611, 1.708, 1.233, 0.943, 0.767, 0.625], finalDrive: 3.36, loss: 12 },
    Lambo_Manual_5: { name: 'Lamborghini Diablo 5-spd', gears: [2.31, 1.52, 1.12, 0.88, 0.68], finalDrive: 3.73, loss: 12 },
    Aston_Graziano_6: { name: 'Aston Martin Graziano 6-spd', gears: [3.15, 1.94, 1.41, 1.09, 0.88, 0.70], finalDrive: 3.91, loss: 12 },
    CIMA_6: { name: 'CIMA 6-spd (Koenigsegg CCX)', gears: [2.88, 1.77, 1.27, 1.00, 0.83, 0.69], finalDrive: 3.36, loss: 12 },
    Saleen_Ricardo_6: { name: 'Saleen S7 Ricardo 6-spd', gears: [2.86, 1.76, 1.25, 0.96, 0.78, 0.64], finalDrive: 3.60, loss: 12 },
    Toyota_iT6: { name: 'Toyota iT6 6-spd (GR Corolla)', gears: [3.538, 2.238, 1.535, 1.163, 0.878, 0.661], finalDrive: 4.294, loss: 12 },
    Hyundai_6MT: { name: 'Hyundai/Kia 6MT (Genesis Coupe)', gears: [3.818, 2.294, 1.624, 1.271, 1.000, 0.794], finalDrive: 3.727, loss: 12 },
    Audi_Getrag_6: { name: 'Audi/Getrag 6MT (RS4 B7)', gears: [3.667, 2.211, 1.520, 1.133, 0.919, 0.778], finalDrive: 3.82, loss: 12 },
    Ford_6R80: { name: 'Ford 6R80 6-spd Auto', gears: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69], finalDrive: 3.31, loss: 15 },
    Ford_C6: { name: 'Ford C6 3-spd Auto', gears: [2.46, 1.46, 1.00], finalDrive: 3.00, loss: 18 },
    Ford_C4: { name: 'Ford C4 3-spd Auto', gears: [2.46, 1.46, 1.00], finalDrive: 3.00, loss: 18 },
    Chrysler_727: { name: 'Chrysler TorqueFlite 727 3-spd', gears: [2.45, 1.45, 1.00], finalDrive: 3.23, loss: 18 },
    Toyota_A340E: { name: 'Toyota A340E 4-spd Auto', gears: [2.804, 1.531, 1.000, 0.705], finalDrive: 3.27, loss: 16 },
    ZF_6HP: { name: 'ZF 6HP Auto', gears: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69], finalDrive: 3.46, loss: 15 }
  };

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function airDensityFromDA(daFt) {
    return RHO0 * Math.exp(-daFt / 145366.45);
  }

  function computeDensityAltitude(tempF, humidityPct, pressureInHg) {
    var tempC = (tempF - 32.0) * 5.0 / 9.0;
    var tempK = tempC + 273.15;
    var pHpa = pressureInHg * 33.8639;
    var es = 6.1078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    var e = es * (humidityPct / 100.0);
    void (tempK * (1.0 + 0.61 * (e / pHpa)));
    var pAlt = (1.0 - Math.pow(pHpa / 1013.25, 0.190284)) * 145366.45;
    return pAlt + 118.8 * (tempC - (15.0 - 0.0019812 * pAlt));
  }

  function getTorqueAtRpm(curve, rpm) {
    if (!curve) return 0;
    var keys, map = {};
    if (Array.isArray(curve)) {
      keys = [];
      for (var i = 0; i < curve.length; i++) {
        var pt = curve[i];
        var r = Number(pt.rpm != null ? pt.rpm : pt[0]);
        var t = pt.tq != null ? pt.tq : (pt.torque != null ? pt.torque : pt[1]);
        if (!isFinite(r)) continue;
        keys.push(r);
        map[r] = t;
      }
      keys.sort(function (a, b) { return a - b; });
    } else {
      keys = Object.keys(curve).map(Number).filter(function (k) { return isFinite(k); });
      keys.sort(function (a, b) { return a - b; });
      map = curve;
    }
    if (!keys.length) return 0;
    rpm = Number(rpm);
    if (!isFinite(rpm)) return 0;
    function tAt(k) {
      var v = Number(map[k]);
      if (!isFinite(v)) v = Number(map[String(Math.round(k))]);
      return isFinite(v) ? v : 0;
    }
    if (rpm <= keys[0]) return tAt(keys[0]);
    if (rpm >= keys[keys.length - 1]) return tAt(keys[keys.length - 1]);
    for (var j = 0; j < keys.length - 1; j++) {
      var r1 = keys[j], r2 = keys[j + 1];
      if (rpm >= r1 && rpm <= r2) {
        var t1 = tAt(r1), t2 = tAt(r2);
        if (!isFinite(t1) && !isFinite(t2)) return 0;
        if (!isFinite(t1)) return t2;
        if (!isFinite(t2)) return t1;
        if (r2 === r1) return t1;
        return t1 + (t2 - t1) * ((rpm - r1) / (r2 - r1));
      }
    }
    // Nearest-neighbor fallback — never drop mid-range samples to 0
    var best = keys[0], bestD = Math.abs(rpm - keys[0]);
    for (var n = 1; n < keys.length; n++) {
      var d = Math.abs(rpm - keys[n]);
      if (d < bestD) { bestD = d; best = keys[n]; }
    }
    return tAt(best);
  }


  /**
   * Peak-TQ RPM from baked curve (fallback when car.peakTqRpm missing).
   */
  function peakTqRpmFromCurve(curve) {
    if (!curve) return 0;
    var bestR = 0, bestT = -1;
    var keys = Array.isArray(curve)
      ? curve.map(function (pt) { return Number(pt.rpm != null ? pt.rpm : pt[0]); })
      : Object.keys(curve).map(Number);
    for (var i = 0; i < keys.length; i++) {
      var r = keys[i];
      if (!isFinite(r)) continue;
      var t = getTorqueAtRpm(curve, r);
      if (t > bestT) { bestT = t; bestR = r; }
    }
    return bestR;
  }

  /**
   * Leave / brake-launch target RPM.
   * launchRpm is the intended leave; absurd ICE values (idle / near-zero) seed
   * toward the peak-TQ band so stock slip→lockup has a sane tach start.
   * EV keeps launchRpm as-is (motor rpm for TQ; Power % dial uses timeline rpm).
   */
  function resolveLeaveRpm(car, launchRpm, redline, curve) {
    var lr = Number(launchRpm);
    if (!isFinite(lr) || lr < 0) lr = DEFAULT_LAUNCH_RPM;
    redline = Number(redline) || DEFAULT_SHIFT_RPM;
    if (car && car.isEv) {
      return clamp(lr, 0, Math.max(redline, lr));
    }
    var peakTq = Number(car && car.peakTqRpm);
    if (!(peakTq > 0)) peakTq = peakTqRpmFromCurve(curve);
    if (!(peakTq > 0)) peakTq = Math.min(4000, redline * 0.55);
    // Absurd leave (calib leftovers / idle): seed ~0.9× peak-TQ band
    if (lr < 1000) {
      lr = Math.round(clamp(peakTq * 0.9, 1800, Math.min(redline - 200, peakTq)));
    }
    return clamp(lr, 800, redline);
  }

  function synthesizeTorqueCurve(peakHp, peakTqRpm, redline, peakHpRpm) {
    peakHp = clamp(Number(peakHp) || 300, 1, 15000);
    peakTqRpm = clamp(Number(peakTqRpm) || 4000, 800, 12000);
    redline = clamp(Number(redline) || 6500, 2000, 16000);
    peakHpRpm = clamp(
      Number(peakHpRpm) || Math.min(redline * 0.92, peakTqRpm + 1500),
      peakTqRpm, redline
    );
    // Peak TQ from published HP@RPM via HP = TQ*RPM/5252 (consistent by construction)
    var tqAtPeakHp = (peakHp * 5252) / peakHpRpm;
    // Typical NA/FI engines make ~8–18% more TQ at peak-TQ RPM than at peak-HP RPM
    var peakTq = tqAtPeakHp * 1.12;
    var curve = {};
    for (var r = 1000; r <= redline; r += 100) {
      var tq;
      if (r <= peakTqRpm) {
        var u = r / peakTqRpm;
        // Rising flank — soft start then fill (dyno-like, not a flat blob)
        tq = peakTq * (0.48 + 0.52 * Math.pow(u, 0.72));
      } else if (r <= peakHpRpm) {
        var v = (r - peakTqRpm) / Math.max(1, peakHpRpm - peakTqRpm);
        // TQ falls gradually so HP keeps climbing to peakHpRpm
        tq = peakTq + (tqAtPeakHp - peakTq) * (0.25 * v + 0.75 * v * v);
      } else {
        var w = (r - peakHpRpm) / Math.max(1, redline - peakHpRpm);
        // Past peak HP: stronger continuous fall so HP keeps dropping to redline
        tq = tqAtPeakHp * (1.0 - 0.34 * w - 0.28 * w * w);
      }
      curve[r] = Math.max(10, tq);
    }
    // Pin exact peaks — redline from fall formula (~0.38× tqAtPeakHp → HP well below peak)
    curve[peakTqRpm] = peakTq;
    curve[peakHpRpm] = tqAtPeakHp;
    curve[redline] = Math.max(10, tqAtPeakHp * (1.0 - 0.34 - 0.28));
    return sanitizeTorqueCurvePostPeak(curve, peakHpRpm);
  }

  function peakHpFromCurve(curve) {
    var keys = Object.keys(curve).map(Number);
    var peak = 0;
    for (var i = 0; i < keys.length; i++) {
      var hp = (Number(curve[keys[i]]) * keys[i]) / 5252;
      if (hp > peak) peak = hp;
    }
    return peak;
  }

  /**
   * Real dyno past peak HP: HP must keep falling toward redline — no uptick and
   * no flat plateau at the tip. Preserves natural declining samples; when the
   * bake would rise or flatten, continue the established negative slope.
   */
  function sanitizeTorqueCurvePostPeak(curve, peakHpRpmOpt) {
    if (!curve || typeof curve !== 'object') return curve;
    var keys = Object.keys(curve).map(Number).filter(function (k) { return isFinite(k); });
    keys.sort(function (a, b) { return a - b; });
    if (keys.length < 3) return curve;
    var peakHp = 0;
    var peakRpm = keys[0];
    var i;
    for (i = 0; i < keys.length; i++) {
      var hp0 = (Number(curve[keys[i]]) * keys[i]) / 5252;
      if (hp0 > peakHp) {
        peakHp = hp0;
        peakRpm = keys[i];
      }
    }
    var pinned = Number(peakHpRpmOpt);
    if (isFinite(pinned) && pinned > 0) {
      var pinHp = (Number(curve[pinned]) * pinned) / 5252;
      if (!isFinite(pinHp)) pinHp = (Number(curve[String(Math.round(pinned))]) * pinned) / 5252;
      if (isFinite(pinHp) && pinHp >= peakHp * 0.97) {
        peakRpm = pinned;
        peakHp = pinHp;
      }
    }
    var redline = keys[keys.length - 1];
    var span = Math.max(1, redline - peakRpm);
    // Default fall ~25% of peak HP across peak→redline if no slope established yet
    var fallPerRpm = -(peakHp * 0.25) / span;
    var prevHp = peakHp;
    var prevR = peakRpm;
    var haveSlope = false;
    for (i = 0; i < keys.length; i++) {
      var r = keys[i];
      if (r <= peakRpm) continue;
      var tq = Number(curve[r]);
      if (!isFinite(tq)) continue;
      var hp = (tq * r) / 5252;
      var dr = r - prevR;
      if (dr <= 0) continue;
      // Strictly decreasing: reject rise OR flat (within 0.15 hp)
      if (hp >= prevHp - 0.15) {
        var cont = prevHp + fallPerRpm * dr;
        // Keep a meaningful drop (≥0.4 hp per 100 rpm) so tip never shelves
        var minDrop = Math.max(0.004 * dr, peakHp * 0.00008 * dr);
        if (!(cont < prevHp - minDrop)) cont = prevHp - minDrop;
        // Floor: do not crater below ~55% of peak (still a real dyno fall)
        var floorHp = peakHp * 0.55;
        if (cont < floorHp) cont = floorHp;
        if (cont >= prevHp) cont = prevHp - minDrop;
        curve[r] = Math.max(5, (cont * 5252) / r);
        hp = (curve[r] * r) / 5252;
      } else {
        // Honest declining sample — adopt its slope for later extrapolation
        fallPerRpm = (hp - prevHp) / dr;
        // Keep slope negative and not absurdly steep
        if (fallPerRpm > -1e-6) fallPerRpm = -(peakHp * 0.25) / span;
        if (fallPerRpm < -(peakHp * 0.55) / span) fallPerRpm = -(peakHp * 0.55) / span;
        haveSlope = true;
      }
      prevHp = hp;
      prevR = r;
    }
    return curve;
  }

  /**
   * Scale torque map so curve peak HP cannot exceed peakHpCap (tiny rounding slack).
   * Returns same object if already within cap or cap invalid.
   */
  function capTorqueCurveToPeakHp(curve, peakHpCap) {
    if (!curve || !(peakHpCap > 0)) return curve;
    var peak = peakHpFromCurve(curve);
    if (!(peak > 0) || peak <= peakHpCap * 1.002) return curve;
    var scale = peakHpCap / peak;
    var keys = Object.keys(curve);
    for (var i = 0; i < keys.length; i++) {
      var v = Number(curve[keys[i]]);
      if (!isFinite(v)) continue;
      curve[keys[i]] = Math.max(5, v * scale);
    }
    return curve;
  }

  /** FI boost on torque. Use only when curve is NA baseline; dyno curves already include boost. */
  function boostTorqueMult(model, boostPsi, rpm, redline, ambientInHg) {
    model = String(model || 'na').toLowerCase();
    if (model === 'na' || model === 'none' || model === 'ev') return 1.0;
    boostPsi = clamp(Number(boostPsi) || 0, 0, 80);
    if (boostPsi <= 0) return 1.0;
    var atmPsi = (Number(ambientInHg) || 29.92) * 0.491154;
    var pr = (atmPsi + boostPsi) / atmPsi;
    var ideal = 1.0 + (pr - 1.0) * 0.88;
    var spool = 1.0;
    var r = Number(rpm) || 0;
    var red = Math.max(3000, Number(redline) || 6500);
    if (model === 'turbo') {
      var a = red * 0.28, b = red * 0.55;
      if (r <= a) spool = 0.15;
      else if (r >= b) spool = 1.0;
      else spool = 0.15 + 0.85 * ((r - a) / (b - a));
    } else if (model === 'twincharge') {
      var a2 = red * 0.18, b2 = red * 0.42;
      if (r <= a2) spool = 0.55;
      else if (r >= b2) spool = 1.0;
      else spool = 0.55 + 0.45 * ((r - a2) / (b2 - a2));
    } else {
      spool = clamp(0.7 + 0.3 * (r / red), 0.7, 1.0);
    }
    return 1.0 + (ideal - 1.0) * spool;
  }


  /**
   * Hybrid electric assist (lb-ft added to ICE crank TQ before drivetrain loss).
   * Documented model — separate motor assist, not a second FI boost curve:
   *   peakAssist ≈ hybridAssistFrac × (peakHp×5252/peakHpRpm)  (default frac 0.22)
   *   full assist ≤ 0.40×redline; linear fade to ~27% of peak by 0.85×redline; hold after.
   * Garage hybrids bake an ICE-fraction dyno (~82% of published system HP) so ICE+assist
   * lands near the published combined figure. Custom Builder: toggling Hybrid vs NA on the
   * same ICE curve changes ET (assist on/off).
   */
  function hybridAssistTorqueLbFt(rpm, car) {
    if (!car || !car.isHybrid || car.isEv) return 0;
    var peakHp = Number(car.peakHp) || 400;
    var peakHpRpm = Math.max(1000, Number(car.peakHpRpm) || 6000);
    var red = Math.max(peakHpRpm, Number(car.redline) || 7000);
    var tqRef = (peakHp * 5252) / peakHpRpm;
    var fracPeak = car.hybridAssistFrac != null ? Number(car.hybridAssistFrac) : 0.22;
    if (!isFinite(fracPeak) || fracPeak < 0) fracPeak = 0.22;
    var peakAssist = tqRef * fracPeak;
    var lo = red * 0.40;
    var hi = red * 0.85;
    var r = Number(rpm) || 0;
    var shape;
    if (r <= lo) shape = 1.0;
    else if (r >= hi) shape = 0.27;
    else shape = 1.0 + (0.27 - 1.0) * ((r - lo) / Math.max(1, hi - lo));
    return peakAssist * shape;
  }

  function weatherTorqueFactor(opts, daFt, rho) {
    if (opts.isEv) return 1.0;
    var df = rho / RHO0;
    var dak = daFt / 1000.0;
    // Hybrid: ICE still density-sensitive; e-motor share softens DA vs pure NA (between NA and FI).
    if (opts.isHybrid) {
      return (0.70 + 0.30 * df) * 1.00 * Math.max(0.35, 1.0 - 0.022 * Math.max(0, dak));
    }
    if (opts.isNA && !opts.isFI) {
      return df * 0.985 * Math.max(0.30, 1.0 - 0.03 * Math.max(0, dak));
    }
    if (opts.isFI && !opts.isNA) {
      return (0.55 + 0.45 * df) * 1.015 * Math.max(0.40, 1.0 - 0.015 * Math.max(0, dak));
    }
    return df;
  }

  /** windDirDeg 0 = headwind. Gusts oscillate along track. */
  function relativeAirspeedMps(vMps, windMph, windDirDeg, gustMph, tSec) {
    var wind = Number(windMph) || 0;
    var gust = Number(gustMph) || 0;
    var dir = (((Number(windDirDeg) || 0) % 360) + 360) % 360;
    var longFrac = Math.cos((dir * Math.PI) / 180);
    var gustWave = gust > 0 ? gust * Math.sin(tSec * 2.7 + 0.4) * 0.65 : 0;
    return Math.max(0, vMps + (wind + gustWave) * longFrac * MPH_TO_MPS);
  }

  /** Tire ladder: 0 Street/AllSeason, 1 Drag Radial/Soft, 2 Slick,
   *  3 Summer (between Street & Drag), 4 UHP (near Drag). VERIFY uses 0/1/2. */
  function tireGripForType(tireType) {
    switch (tireType | 0) {
      case 0: return 0.95;  // Street / All-season
      case 3: return 1.05;  // Summer
      case 4: return 1.12;  // UHP
      case 1: return 1.30;  // Drag Radial / Soft compound (was 1.18 — closer to slick)
      case 2: return 1.38;  // Slick (was 1.45 — modest advantage over drag radial)
      default: return DEFAULT_MU;
    }
  }

  var TIRE_LABELS = {
    0: 'Street',
    1: 'Drag Radial',
    2: 'Slick',
    3: 'Summer',
    4: 'UHP'
  };
  function tireLabelForType(tireType) {
    return TIRE_LABELS[tireType | 0] || TIRE_LABELS[0];
  }

  function emptyResult(car, env) {
    return {
      carName: (car && car.name) || '',
      reactionTime: 0,
      sixtyFootTime: 0,
      threeThirtyTime: 0,
      eighthMileTime: 0,
      eighthMileSpeedMph: 0,
      thousandFootTime: 0,
      quarterMileTime: 0,
      quarterMileSpeedMph: 0,
      zeroToSixty: null,
      zeroToHundred: null,
      sixtyToOneThirty: null,
      hundredToOneFifty: null,
      peakG: 0,
      peakHorsepower: 0,
      peakTorque: 0,
      wheelspinPercent: 0,
      totalShifts: 0,
      shifts: [],
      densityAltitudeFeet: 0,
      airTempF: (env && env.tempF) != null ? env.tempF : 70,
      launchRpm: 0,
      shiftRpm: 0,
      tireDescription: (env && env.tireLabel) || '',
      timeline: [],
      powerCurve: [],
      gearsUsed: [],
      finalDrive: 0,
      finished: false,
      airDensity: RHO0,
      weatherFactor: 1,
      topSpeedMph: 0,
      topSpeedTime: 0,
      topSpeedFeet: 0,
      vmaxReached: false,
      vmaxReason: '',
      halfMileTime: null,
      halfMileSpeedMph: null,
      mileTime: null,
      mileSpeedMph: null
    };
  }

  /**
   * @param {object} car
   * @param {object} [env]
   */

  /**
   * Published electronic top-speed limiter (mph).
   * Field: speedLimiterMph (alias topSpeedMph).
   * Enforced for EVs always when set; for Hybrids when a published limiter was baked;
   * Custom EV uses the same path when the user sets a limit.
   */
  function resolveSpeedLimiterMph(car) {
    if (!car) return 0;
    var raw = car.speedLimiterMph != null ? car.speedLimiterMph : car.topSpeedMph;
    var lim = Number(raw);
    if (!(lim > 0) || !isFinite(lim)) return 0;
    var isEv = !!(car.isEv || car.powerSource === 'ev');
    var isHybrid = !!(car.isHybrid || car.powerSource === 'hybrid');
    if (isEv || isHybrid) return lim;
    return 0;
  }

  function runQuarterMile(car, env) {
    env = env || {};
    var result = emptyResult(car, env);

    var gears = (car.gearRatios || []).map(Number).filter(function (g) { return g > 0; });
    if (!gears.length) return result;

    var weightLbs = clamp(Number(car.weightLbs) || 3500, 20, 120000);
    var mass = weightLbs * 0.453592;
    var tireRadius = (Number(car.tireRadiusInches) || 13.0) * 0.0254;
    var frontalArea = (Number(car.frontalAreaSqFt) || 22.0) * 0.092903;
    var cd = Number(car.dragCoefficient) || 0.35;
    var finalDrive = Number(car.finalDriveRatio) || 3.73;
    var loss = (car.drivetrainLossPercent != null ? Number(car.drivetrainLossPercent) : DEFAULT_LOSS_PCT) / 100.0;
    var shiftTime = car.shiftTimeSeconds != null ? Number(car.shiftTimeSeconds) : DEFAULT_SHIFT_TIME;
    var shiftRpm = car.shiftRpm != null ? Number(car.shiftRpm) : DEFAULT_SHIFT_RPM;
    var launchRpm = car.launchRpm != null ? Number(car.launchRpm) : DEFAULT_LAUNCH_RPM;
    var wheelbaseM = (Number(car.wheelbaseFeet) || DEFAULT_WB_FT) * FEET_TO_M;
    var cgHeightM = (Number(car.cgHeightFeet) || DEFAULT_CG_FT) * FEET_TO_M;
    var wDist = resolveWeightDistribution(car);
    var frontPct = wDist.frontWeightPercent;
    var rearPct = wDist.rearWeightPercent;
    var leftPct = wDist.leftWeightPercent;
    var muBase = env.tireGrip != null ? Number(env.tireGrip) : tireGripForType(env.tireType);
    var driveType = String(car.driveType || 'RWD').toUpperCase();
    if (driveType === 'AWD') muBase *= 1.25;

    var curve = car.torqueCurve;
    if (!curve || (typeof curve === 'object' && !Array.isArray(curve) && !Object.keys(curve).length)) {
      curve = synthesizeTorqueCurve(car.peakHp || car.horsepower, car.peakTqRpm, car.redline, car.peakHpRpm);
    }

    var tempF = env.tempF != null ? Number(env.tempF) : 70;
    var humidity = env.humidity != null ? Number(env.humidity) : 50;
    var pressureInHg = env.pressureInHg != null ? Number(env.pressureInHg) : 29.92;
    var daFt;
    if (env.densityAltitudeFtInput != null && !isNaN(Number(env.densityAltitudeFtInput))) {
      daFt = Number(env.densityAltitudeFtInput);
    } else if (car.isEv) {
      daFt = 0;
    } else {
      daFt = computeDensityAltitude(tempF, humidity, pressureInHg);
    }
    var rho = car.isEv ? RHO0 : airDensityFromDA(daFt);
    var wx = weatherTorqueFactor(
      {
        isEv: !!car.isEv,
        isHybrid: !!car.isHybrid,
        isNA: !!(car.isNA || (!car.isFI && !car.isEv && !car.isHybrid)),
        isFI: !!car.isFI
      },
      daFt, rho
    );

    var windMph = Number(env.windSpeedMph) || 0;
    var windDir = Number(env.windDirDeg) || 0;
    var gustMph = Number(env.gustMph) || 0;
    var boostModel = car.boostModel || 'na';
    var boostPsi = Number(car.boostPsi) || 0;
    var redline = Number(car.redline) || shiftRpm;

    var launchMode = env.launchMode || 'auto';
    var slipTarget = 0.10;
    var launchDriveMult = 1.0;
    // Soft = cooler leave/tach (NOT mu-cheat fastest). Aggressive = hotter ATC flash-stall
    // + full drive (on slicks often quicker if grip holds — NOT systematically slowest).
    // Auto = identity. slipTarget is live for Soft/Agg/Custom (mu + traction band).
    var launchStallBias = 0;
    var launchFlashSpanScale = 1.0;
    var launchFlashTimeScale = 1.0;
    var launchFlashMphScale = 1.0;
    if (launchMode === 'soft') {
      // Lower leave, muted converter flash/stall, mild drive ease — cooler tach
      launchRpm = Math.max(car.isEv ? 200 : 1100, launchRpm - 800);
      slipTarget = 0.06;
      launchDriveMult = car.isEv ? 0.86 : 0.875;
      launchStallBias = -500;
      launchFlashSpanScale = 0.40;
      launchFlashTimeScale = 0.50;
      launchFlashMphScale = 0.68;
    } else if (launchMode === 'aggressive') {
      // Higher leave, hotter flash-stall ceiling, full+ drive — slicks often quicker
      launchRpm = Math.min(redline, launchRpm + (car.isEv ? 1400 : 1000));
      slipTarget = 0.15;
      launchDriveMult = car.isEv ? 1.12 : 1.11;
      launchStallBias = 400;
      launchFlashSpanScale = 1.52;
      launchFlashTimeScale = 1.30;
      launchFlashMphScale = 1.25;
    } else if (launchMode === 'custom') {
      if (env.customLaunchRpm > 0) launchRpm = env.customLaunchRpm;
      if (env.customSlipTarget > 0) slipTarget = env.customSlipTarget;
    }
    // slipTarget → narrow mu (Soft ~1.03 max). Aggressive forced to full grip (1.0)
    // so hot leave is NOT systematically slowest via mu kneecap.
    var launchMuMult = 1.0;
    if (launchMode === 'soft' || launchMode === 'custom') {
      launchMuMult = clamp(1.0 + (0.10 - slipTarget) * 0.6, 0.96, 1.04);
    } else if (launchMode === 'aggressive') {
      launchMuMult = 1.0; // full grip; slipTarget used in traction keep band
    }

    // Effective leave target (absurd ICE launchRpm → peak-TQ band)
    var leaveRpm = resolveLeaveRpm(car, launchRpm, redline, curve);
    launchRpm = leaveRpm; // soft/aggressive/custom already applied above
    result.launchRpm = Math.round(leaveRpm);
    result.shiftRpm = Math.round(shiftRpm);
    result.densityAltitudeFeet = daFt;
    result.airTempF = tempF;
    result.airDensity = rho;
    result.weatherFactor = wx;
    result.gearsUsed = gears.slice();
    result.finalDrive = finalDrive;

    var keys = Object.keys(curve).map(Number).filter(function (k) { return isFinite(k); });
    keys.sort(function (a, b) { return a - b; });
    if (keys.length) {
      var r0 = Math.floor(keys[0] / 100) * 100;
      if (r0 < keys[0]) r0 += 100;
      var r1 = Math.max(keys[keys.length - 1], redline);
      for (var rk = r0; rk <= r1 + 0.01; rk += 100) {
        var rpmK = Math.round(rk);
        var tq0 = getTorqueAtRpm(curve, rpmK);
        if (!car.isEv) {
          tq0 *= boostTorqueMult(boostModel, boostPsi, rpmK, redline, pressureInHg);
          tq0 += hybridAssistTorqueLbFt(rpmK, car);
        }
        result.powerCurve.push({ rpm: rpmK, torque: tq0, horsepower: (tq0 * rpmK) / 5252 });
      }
    }

    var v = 0, dist = 0, t = 0, rpm = launchRpm, gear = 1;
    var launchLocked = false; // after first catch, always follow mechRpm (preserve shift drops)
    var prevSpinPct = 0; // prior-step wheelspin % — shapes stock flash/dip (vehicle-varying)
    var shifting = false, shiftTimer = 0;
    // ATC post-upshift hang: engine RPM floor after unlock-on-shift (0 = inactive).
    // Launch flash/stall/mph-lockup path is untouched when this is 0.
    // Seed remembers the post-shift floor; hang soft-climbs continuously toward shiftRpm while slipping.
    var tcPostShiftHangRpm = 0;
    var tcPostShiftHangSeed = 0;
    var tcPostShiftMechSeed = 0; // turbine at unlock; hang lerps seed→shift with mech progress
    var shiftFamily = resolveShiftDriveFamily(car);
    var shiftResidualFrac = shiftResidualFraction(shiftFamily);
    var shiftReleaseFrac = shiftReleaseFraction(shiftFamily);
    var shiftEngageDur = shiftEngageTime(shiftFamily);
    var shiftEngageOS = shiftEngageOvershoot(shiftFamily);
    var lastDriveWhTQ = 0; // last applied (post-ATC) wheel torque — shift blend source
    var engageTimer = 0;   // post-shift soft engage countdown
    var engageFromTQ = 0;  // TQ at shift-end (notch/recover) — engage blend start
    // Driveline compliance tracks POST-TRACTION tire force (g ↔ TRACTION % hand-in-hand).
    // Underdamped half-shaft / converter — tips on launch/engage/TQ/traction events only.
    // No decorative IMU jitter decoupled from tire force.
    var dlForce = 0;
    var dlVel = 0;
    var dlSeeded = false;
    var DL_WN = 110.0;   // rad/s ≈ 17.5 Hz — snappy tips on traction/engage/TQ
    var DL_ZETA = 0.38;  // underdamped: rings on real events, settles without stairs
    var driveFLp = 0;
    var driveFLpSeeded = false;
    var peakEngTQRef = 0;
    if (curve) {
      if (Array.isArray(curve)) {
        for (var ci = 0; ci < curve.length; ci++) {
          var ct = Number(curve[ci] && (curve[ci].torque != null ? curve[ci].torque : curve[ci].tq));
          if (ct > peakEngTQRef) peakEngTQRef = ct;
        }
      } else {
        Object.keys(curve).forEach(function (k) {
          var ct = Number(curve[k]);
          if (ct > peakEngTQRef) peakEngTQRef = ct;
        });
      }
    }
    if (peakEngTQRef < 50) peakEngTQRef = 400;
    var shiftProbe = env.shiftCoastProbe ? { family: shiftFamily, residual: shiftResidualFrac, release: shiftReleaseFrac, engageS: shiftEngageDur, overshoot: shiftEngageOS, n: 0, sumA: 0, minA: Infinity, sumWhTQ: 0, minWhTQ: Infinity } : null;
    var spinSum = 0, spinN = 0, prevA = 0;
    var hit60 = false, hit330 = false, hit660 = false, hit1000 = false, hit1320 = false;
    var hitHalf = false, hitMile = false;
    var qmT = null, qmMph = null;
    var t060 = null, t0100 = null, t60_130 = null, t100_150 = null;
    var at60 = null, at100 = null;
    var peakG = 0, peakHP = 0, peakTQ = 0;
    var sampleAcc = 0;
    var rollBase = 0.015 * mass * G;
    var vmaxHold = 0;
    var vmaxDone = false;
    var vmaxReason = '';
    var peakMph = 0, peakMphT = 0, peakMphFt = 0;
    var distCapM = VMAX_DIST_CAP_FT * FEET_TO_M;
    var speedLimiterMph = resolveSpeedLimiterMph(car);
    // When an OEM/custom limiter is set, it becomes the operative Vmax (Nevera-class may exceed the 250 safety).
    var operativeCapMph = speedLimiterMph > 0 ? speedLimiterMph : VMAX_SPEED_CAP_MPH;
    var speedCapMps = operativeCapMph * MPH_TO_MPS;
    var limiterMps = speedLimiterMph > 0 ? speedLimiterMph * MPH_TO_MPS : 0;

    // Continue past 1320 ft to mechanical/aero Vmax (or OEM limiter / safety cap)
    while (!vmaxDone && t <= MAX_T) {
      if (shifting) {
        shiftTimer -= DT;
        if (shiftTimer <= 0) {
          shifting = false;
          // Arm post-shift engagement from torque at shift-end (ATC may have recovered above hole).
          engageFromTQ = (shiftFamily === 'automatic')
            ? (lastDriveWhTQ * Math.max(shiftResidualFrac, 0.70))
            : (lastDriveWhTQ * shiftResidualFrac);
          engageTimer = shiftEngageDur;
        }
      }

      var inLaunch = (t < LAUNCH_HOLD && v < LAUNCH_V_THRESH) || (dist < LAUNCH_DIST_M && t < LAUNCH_HOLD + 0.4);
      var wheelRpm = tireRadius > 0 ? (v / (2 * Math.PI * tireRadius)) * 60.0 : 0;

      if (!shifting) {
        var gNow = gears[Math.min(gear, gears.length) - 1];
        var mechRpm = wheelRpm * gNow * finalDrive;
        var mphNow = v * MPS_TO_MPH;
        if (car.hasAftermarketConverter) {
          /**
           * Aftermarket stall converter (realistic-lite):
           * - Stall RPM = engine speed against a stalled/near-stalled turbine (brake launch).
           * - Flash RPM = brief free-rev peak as the converter unloads off the line
           *   (high-stall default scales well above stall — Circle D 4400 → ~6400).
           * - Slip decays with road speed toward lockup (~1:1 by ~50 mph).
           * - Post-upshift ONLY: unlock/slip hang lerps seed→shiftRpm with turbine
           *   progress (smooth tach all the way to next shift); stall 1500–5500
           *   scales gap/slip/multiply (low=larger gap/less slip; high=smaller gap/more
           *   slip + torque-multiply); mph-gated unlock + postFade keep 60-130 ~10.9.
           */
          var stall = Number(car.stallRpm) || 2800;
          stall = Math.max(1200, stall + launchStallBias);
          // Stall factor spans real converter band 1500→5500 (not clamped flat below 2200).
          // High-stall ATC flash ceiling scales with stall; Circle D 4400 → ~6400-class.
          // Explicit car.flashRpm still wins; stock/non-ATC path never enters here.
          // Soft/Aggressive modulate stall + flash span; Auto bias0/span1 = prior path.
          var stallFacFlash = clamp((stall - 1500) / 4000, 0, 1);
          var flash = Number(car.flashRpm) || Math.max(stall + Math.round(400 + stallFacFlash * 2150), stall + 200);
          if (flash < stall) flash = stall;
          var flashSpan = Math.max(0, flash - stall);
          flash = stall + flashSpan * launchFlashSpanScale;
          if (flash > Math.max(shiftRpm, stall)) flash = Math.max(shiftRpm, stall);
          if (flash < stall) flash = stall;
          if (tcPostShiftHangRpm > 0) {
            // Inter-shift open-converter climb: seed keeps ~1200-class drop, then hang
            // RPM lerps seed→shiftRpm as turbine/mech progresses toward shiftRpm.
            // Tach rises continuously/evenly all the way to the next shift (no
            // fast-then-slow kink, no seed+520 plateau). Slip decays as mech catches.
            var mechSpan = shiftRpm - tcPostShiftMechSeed;
            var hangSpan = shiftRpm - tcPostShiftHangSeed;
            var prog = (mechSpan > 80)
              ? clamp((mechRpm - tcPostShiftMechSeed) / mechSpan, 0, 1)
              : 1;
            // Stall slip ease: high stall lags lerp (tach hangs / more open-converter feel).
            // Low stall lag=0 — less slip comes from larger unload (hang seed closer to mech).
            // Circle D 4400 lag = 0 (identity with continuous-climb tip).
            var stallHang = Number(car.stallRpm) || 2800;
            var stallFacHang = clamp((stallHang - 1500) / 4000, 0, 1);
            var lag = clamp(0.00 + (stallFacHang - 0.725) * 0.22, 0, 0.20); // 0@4400; high stall lags more
            var progEff = prog * (1.0 - lag);
            var targetHang = tcPostShiftHangSeed + Math.max(0, hangSpan) * progEff;
            if (targetHang < tcPostShiftHangRpm) targetHang = tcPostShiftHangRpm; // no mid-gear sag
            // Soft slew so discrete mech steps do not stair-step the gauge
            var maxStep = (480 + stallFacHang * 60) * DT; // ~480–540 rpm/s slew cap
            var delta = targetHang - tcPostShiftHangRpm;
            if (delta > maxStep) delta = maxStep;
            if (delta < 0) delta = 0;
            tcPostShiftHangRpm = tcPostShiftHangRpm + delta;
            if (tcPostShiftHangRpm > shiftRpm) tcPostShiftHangRpm = shiftRpm;
            if (mechRpm >= tcPostShiftHangRpm - 25) {
              tcPostShiftHangRpm = 0;
              tcPostShiftHangSeed = 0;
              tcPostShiftMechSeed = 0;
              rpm = mechRpm;
            } else {
              rpm = Math.max(mechRpm, tcPostShiftHangRpm);
            }
          } else {
            // Lockup progress: 0 at standstill → 1 by stall-scaled mph.
            // Anchored at ~50 mph for Circle D 4400 (Auto launch identity); low stall
            // couples earlier, high stall stays open longer (real converter behavior).
            var lockMph = 50 + (stallFacFlash - 0.725) * 28; // 50@4400; ~30@1500; ~58@5500
            if (lockMph < 28) lockMph = 28;
            if (lockMph > 70) lockMph = 70;
            var lockup = clamp(mphNow / lockMph, 0, 1);
            // Flash pulse: peaks early while slow (window mode-scaled; Auto = 0.55s/28mph)
            var flashPulse = 0;
            var flashWinT = 0.55 * launchFlashTimeScale;
            var flashWinMph = 28.0 * launchFlashMphScale;
            if (flashWinT < 0.15) flashWinT = 0.15;
            if (t < flashWinT && mphNow < flashWinMph) {
              // High-stall ATC: wider flash window so Circle-D-class flash is visible on tach
              flashPulse = Math.sin((Math.min(t, flashWinT) / flashWinT) * Math.PI);
            }
            var target = stall + (flash - stall) * flashPulse;
            // Soft couples earlier (cooler peak); Aggressive holds flash vs early lockup.
            // Auto hold=0 → identical prior blend.
            var lockEff = lockup;
            if (flashPulse > 0.05) {
              var hold = 0.0;
              if (launchMode === 'aggressive') hold = 0.55 * flashPulse;
              else if (launchMode === 'soft') hold = -0.30 * flashPulse;
              lockEff = clamp(lockup * (1.0 - hold), 0, 1);
            }
            rpm = target * (1 - lockEff) + mechRpm * lockEff;
            // Never fall below stall while still heavily slipped (< ~25 mph)
            if (mphNow < 25 && rpm < stall) rpm = stall;
            // Soft ceiling: don't wildly exceed flash during flash window
            if (flashPulse > 0.05 && rpm > flash) rpm = flash;
          }
        } else {
          /**
           * Stock slip→lockup (ATC off) — continuous launch tach (no couple=0 hard hold):
           * - Seed at leaveRpm; once rolling, tach MUST move (flash / dip / crawl / flare).
           * - AT: mild flash above leave (spin-scaled), then open-converter crawl with mph
           *   while still slipping — matches stall→acceleration→coupling (not frozen leave).
           * - MT: clutch-bite dip toward mech when hooked; wheelspin flares toward shift.
           * - EV: fast couple to mech (no converter drama).
           * - After first lock (mech caught leave / clutch fade): always follow mechRpm,
           *   including post-shift (must NOT re-hold leave).
           * - Shaped by prevSpin + leave/shift headroom so strong vs weak launchers differ.
           * - ATC flash/stall path above is untouched.
           */
          if (launchLocked) {
            rpm = mechRpm;
          } else {
            var isManual = /^manual$/i.test(String(car.transmission || '').trim());
            var isEvStock = !!(car.isEv || car.powerSource === 'ev');
            var stall = leaveRpm;
            var spinN = clamp((typeof prevSpinPct === 'number' ? prevSpinPct : 0) / 100.0, 0, 1);
            var headroom = Math.max(200, shiftRpm - stall);

            if (isEvStock) {
              // EV: near-immediate mech follow once rolling
              var evCouple = Math.max(
                clamp(mphNow / 8.0, 0, 1),
                clamp(mechRpm / Math.max(stall, 1), 0, 1)
              );
              rpm = stall * (1 - evCouple) + Math.max(mechRpm, stall) * evCouple;
              if (evCouple >= 0.85 || mechRpm >= stall) {
                launchLocked = true;
                rpm = mechRpm;
              }
            } else {
              // Mild stock flash ceiling (well below ATC Circle-D class unless spinning hard)
              var flashAdd;
              if (isManual) {
                flashAdd = headroom * (0.08 + 0.55 * spinN);
              } else {
                // Spin-scaled flash stall — stronger launchers (more wheelspin) flash higher
                flashAdd = Math.min(headroom * 0.40, 280 + 720 * spinN);
              }
              var flash = Math.min(shiftRpm, stall + Math.max(120, flashAdd));

              var lockMph = isManual ? 28.0 : 45.0;
              var flashWinT = isManual ? 0.40 : 0.48;
              var flashWinMph = isManual ? 20.0 : 26.0;
              var flashPulse = 0;
              if (flashWinT > 0.05 && t < flashWinT && mphNow < flashWinMph) {
                flashPulse = Math.sin((Math.min(t, flashWinT) / flashWinT) * Math.PI);
              }

              // Open-converter / clutch-slip engine target (moves as soon as rolling)
              var openRpm;
              if (isManual && spinN < 0.15) {
                // Bite dip under load when hooked (HPA) — modest street dip, recovers via crawl
                var dipTo = Math.max(mechRpm, stall * 0.85);
                openRpm = stall + (dipTo - stall) * (0.40 * flashPulse);
              } else {
                // AT flash / MT spin flare above leave
                openRpm = stall + (flash - stall) * flashPulse;
              }

              // Acceleration-phase crawl with mph — continuous tach motion while slipped
              // (no re-freeze at leave after flash). Weak cars crawl slower (same formula,
              // less mph progress); strong cars flash higher via spinN then crawl.
              var mphProg = clamp(mphNow / Math.max(lockMph, 1), 0, 1);
              var crawlGain = isManual ? 0.24 : 0.42;
              var crawl = stall + headroom * crawlGain * mphProg;
              if (crawl > stall + headroom * 0.55) crawl = stall + headroom * 0.55;
              openRpm = Math.max(openRpm, crawl);
              if (openRpm > shiftRpm) openRpm = shiftRpm;
              if (openRpm < 900) openRpm = 900;

              if (mechRpm >= stall) {
                // Turbine/road caught leave — lock and follow mech (shift drops preserved)
                launchLocked = true;
                rpm = mechRpm;
              } else if (isManual) {
                // Clutch fade: blend open → mech (allows real bog if dumped hard)
                var clutch = Math.max(clamp(mphNow / 28.0, 0, 1), clamp(t / 0.55, 0, 1));
                rpm = openRpm * (1 - clutch) + mechRpm * clutch;
                if (rpm < 900) rpm = 900;
                if (clutch >= 0.85 && mechRpm >= stall * 0.92) {
                  launchLocked = true;
                  rpm = mechRpm;
                }
              } else {
                // AT open converter: tach tracks openRpm (flash/crawl) while slipped.
                // Soft-blend toward mech as turbine nears leave (no cliff at catch).
                var catchProg = clamp(mechRpm / Math.max(stall, 1), 0, 1);
                var blend = catchProg > 0.65
                  ? clamp((catchProg - 0.65) / 0.35, 0, 1)
                  : 0;
                var nearCouple = clamp(
                  (mphNow - lockMph * 0.78) / Math.max(lockMph * 0.22, 1),
                  0, 1
                );
                blend = Math.max(blend, nearCouple * 0.45);
                rpm = openRpm * (1 - blend) + mechRpm * blend;
                // Stall floor while still heavily open (fluid converter)
                if (blend < 0.40 && rpm < stall) rpm = stall;
              }
            }
          }
        }
      }

      if (!shifting && rpm >= shiftRpm && gear < gears.length) {
        gear++;
        shifting = true;
        shiftTimer = shiftTime;
        engageTimer = 0; // new shift preempts any in-flight engage ramp
        result.totalShifts++;
        // Record shift marker for SPEED VS DISTANCE chart (gear # + MPH @ distance/time)
        result.shifts.push({
          gear: gear,
          mph: +(v * MPS_TO_MPH).toFixed(1),
          feet: +(dist / FEET_TO_M).toFixed(1),
          t: +t.toFixed(3)
        });
        // ATC only: unlock on upshift — seed hang floor so post-shift tach stays in
        // powerband (~characteristic unload below shift RPM) instead of locked-ratio dump.
        // Stall gap/slip: low stall → larger RPM drop (less slip); high stall → smaller
        // drop / higher hang (more slip + multiply). Circle D 4400 ~1200-class drop.
        if (car.hasAftermarketConverter) {
          var stallU = Number(car.stallRpm) || 2800;
          // Anchor unload ~1294 @ 4400 (1200±300). Invert vs stallFac so:
          //   1500 → larger gap / tighter couple; 5500 → smaller gap / looser hang.
          var stallFac = clamp((stallU - 1500) / 4000, 0, 1);
          var unload = 1294 - (stallFac - 0.725) * 800; // ~1874@1500, ~1294@4400, ~1074@5500
          if (unload < 850) unload = 850;
          if (unload > 2100) unload = 2100;
          tcPostShiftHangSeed = Math.max(0, rpm - unload);
          tcPostShiftHangRpm = tcPostShiftHangSeed;
          var gNew = gears[Math.min(gear, gears.length) - 1];
          tcPostShiftMechSeed = Math.max(0, wheelRpm * gNew * finalDrive);
        }
      }

      var engTQ = getTorqueAtRpm(curve, rpm);
      // EV: no ICE FI boost path. Hybrid: ICE boost (if any) + motor assist band.
      if (!car.isEv) {
        engTQ *= boostTorqueMult(boostModel, boostPsi, rpm, redline, pressureInHg);
        engTQ += hybridAssistTorqueLbFt(rpm, car);
      }
      engTQ *= wx;
      engTQ *= (1.0 - loss);

      var gRatio = gears[Math.min(gear, gears.length) - 1];
      var fullWhTQ = engTQ * gRatio * finalDrive;
      var mph = v * MPS_TO_MPH;

      // Engaged (next-gear) wheel torque — includes ATC multiply so shift-end blend
      // matches the first post-shift tick (no cliff when shifting clears).
      var engagedWhTQ = fullWhTQ;
      if (car.hasAftermarketConverter) {
        // Torque multiplication from converter slip: ~2.1× at stall → 1.0 at lockup.
        // Stall 1500→5500 scales multiply; Circle D 4400 anchored to LIVE leave/unlock math.
        // Computed every tick (incl. mid-shift) so engagement endpoint stays continuous.
        var mech = wheelRpm * gRatio * finalDrive;
        var slipR = rpm > 0 ? Math.max(0, (rpm - mech) / rpm) : 0;
        // Load-breathing residual TC slip when coupled — deterministic from crank TQ
        // load (not random). Changes tMult → driveF → traction path → g tips with TQ.
        if (tcPostShiftHangRpm <= 0 && mph > 12) {
          // TQ load → tMult → driveF → g (continuous between-shift tips; tire path).
          var load = clamp(engTQ / peakEngTQRef, 0.20, 1.20);
          var breath = 0.018 + 0.055 * load * load; // ~1.8–8% slip floor
          if (slipR < breath) slipR = breath;
        }
        var stallN = Number(car.stallRpm) || 2800;
        var stallFacN = clamp((stallN - 1500) / 4000, 0, 1);
        // LIVE used stallBoost≈0.196 @4400 ((4400-2200)/2800*0.25). Keep that at 4400;
        // widen endpoints so 1500 is tighter and 5500 is looser.
        var stallBoost = 0.196 + (stallFacN - 0.725) * 0.55; // ~0@1500, 0.196@4400, ~0.35@5500
        if (stallBoost < 0) stallBoost = 0;
        var tMult = 1.0 + Math.min(1.35, slipR * (2.2 + stallBoost));
        if (mph > 15.0) {
          // Extra fade with road speed; high stall fades later, low stall earlier.
          var fadeSpan = 40.0 + (stallFacN - 0.725) * 40.0; // 40@4400 identity
          if (fadeSpan < 22) fadeSpan = 22;
          if (fadeSpan > 62) fadeSpan = 62;
          var fade = Math.min(1.0, Math.max(0, (mph - 15.0) / fadeSpan));
          tMult = 1.0 + (tMult - 1.0) * (1.0 - fade);
        }
        if (tcPostShiftHangRpm > 0) {
          // Mild parent unlock (preserves 60ft / 0-60) + mph-gated extra multiply
          // for trap; postFade softens past ~125 mph so 60-130 does not overshoot.
          // stallUnlock=1 exactly at Circle D 4400; scales endpoints only.
          var baseAdd = Math.min(0.055, slipR * 0.22);
          var speedGate = clamp((mph - 62.0) / 40.0, 0, 1);
          var postFade = 0.05 + 0.95 * clamp((125.0 - mph) / 8.0, 0, 1);
          var stallUnlock = 1.06 + (stallFacN - 0.725) * 1.20; // ~1.06@4400 (trap nudge); endpoints diverge
          if (stallUnlock < 0.12) stallUnlock = 0.12;
          if (stallUnlock > 1.50) stallUnlock = 1.50;
          var extraAdd = Math.min(0.28, slipR * 0.85) * speedGate * postFade * stallUnlock;
          var unlockCeil = 0.07 + (0.36 - 0.07) * speedGate * postFade * stallUnlock;
          tMult = 1.0 + Math.min(unlockCeil, (tMult - 1.0) + baseAdd + extraAdd);
        }
        engagedWhTQ = fullWhTQ * tMult;
      }

      var whTQ;
      if (shifting) {
        // Soft release into residual; ATC V-notch recovers before shift-end (no deep flat well).
        var shiftDur = shiftTime > 1e-6 ? shiftTime : 1e-6;
        var pShift = 1 - clamp(shiftTimer / shiftDur, 0, 1);
        var holeTQ = lastDriveWhTQ * shiftResidualFrac;
        var recoverStart = null;
        var recoverTQ = holeTQ;
        if (shiftFamily === 'automatic') {
          // Pure V-notch — recover right after release (no flat hole / square well).
          recoverStart = Math.min(0.96, shiftReleaseFrac + 0.02);
          recoverTQ = lastDriveWhTQ * Math.max(shiftResidualFrac, 0.70);
        }
        whTQ = shiftReleaseTorque(pShift, lastDriveWhTQ, holeTQ, shiftReleaseFrac, recoverStart, recoverTQ);
      } else if (engageTimer > 0) {
        // Post-shift clutch/TC/DCT engage ramp + optional tip spike above engaged TQ.
        var engDur = shiftEngageDur > 1e-6 ? shiftEngageDur : 1e-6;
        var pEng = 1 - clamp(engageTimer / engDur, 0, 1);
        whTQ = shiftEngageTorque(pEng, engageFromTQ, engagedWhTQ, shiftEngageOS);
        engageTimer -= DT;
        if (engageTimer <= 0) {
          engageTimer = 0;
          lastDriveWhTQ = engagedWhTQ;
        }
      } else {
        whTQ = engagedWhTQ;
        // Store *applied* drive (post-ATC) so the next shift starts continuous.
        lastDriveWhTQ = engagedWhTQ;
      }

      var driveF = tireRadius > 0 ? whTQ / tireRadius : 0;
      // Smooth FORCE bands — kill 30/60 square stairs; continuous taper with speed (A/E).
      driveF *= driveForceMultSmooth(mph);
      if (inLaunch && launchDriveMult !== 1.0) driveF *= launchDriveMult;

      var airV = relativeAirspeedMps(v, windMph, windDir, gustMph, t);
      var dragF = 0.5 * rho * cd * frontalArea * airV * airV;
      var rollF = v > 0.05 ? rollBase : 0;

      // Longitudinal weight transfer: nose up under accel → load rear, unload front
      var wXfer = (mass * prevA * cgHeightM) / wheelbaseM;
      var nFront = mass * G * (frontPct / 100.0) - wXfer;
      var nRear = mass * G * (rearPct / 100.0) + wXfer;
      var nMin = mass * G * 0.08;
      if (nFront < nMin) nFront = nMin;
      if (nRear < nMin) nRear = nMin;

      var mu = muBase;
      if (inLaunch && launchMuMult !== 1.0) {
        mu = muBase * launchMuMult;
      }
      // Smooth GRIP bands — kill 20/40/60 cliffs so mu/tracLim (and g) are continuous (A/E).
      mu *= gripMultSmooth(mph);

      /**
       * Per-axle traction with L/R split.
       * 50/50 → same as mu*nAxle. Bias toward open-diff (limited by light wheel) so
       * uneven L/R meaningfully cuts launch grip; load sensitivity softens the heavy side.
       */
      function axleTractionLimit(nAxle, muAx, leftP) {
        var nL = nAxle * (leftP / 100.0);
        var nR = nAxle * (1.0 - leftP / 100.0);
        var nRef = Math.max(1e-6, nAxle * 0.5);
        function sideForce(n) {
          // Load sensitivity: µ_eff falls as load rises above the balanced half-axle
          var sens = Math.pow(nRef / Math.max(n, nRef * 0.12), 0.14);
          return muAx * n * clamp(sens, 0.72, 1.18);
        }
        var fL = sideForce(nL);
        var fR = sideForce(nR);
        var locked = fL + fR;
        var open = 2.0 * Math.min(fL, fR);
        // Street LSD blend (~60% locked). AWD axles slightly more locked.
        var lockFrac = driveType === 'AWD' ? 0.72 : 0.60;
        return open * (1.0 - lockFrac) + locked * lockFrac;
      }

      var tracLim;
      if (driveType === 'AWD') {
        // Both axles contribute; F/R static + transfer sets each axle's normal
        tracLim = axleTractionLimit(nFront, mu, leftPct) + axleTractionLimit(nRear, mu, leftPct);
      } else if (driveType === 'FWD') {
        tracLim = axleTractionLimit(nFront, mu, leftPct);
      } else {
        // RWD — drive axle is rear (gains load under accel)
        tracLim = axleTractionLimit(nRear, mu, leftPct);
      }
      // Traction and G-Force go hand in hand (Jorge): longitudinal g is driven by the
      // SAME tire-force path as TRACTION % / slip. When grip limits, applied (and g)
      // notches with it; when grip recovers, applied (and g) push recovers.
      // Soft knee = sharp launch tip then settle (D); no brick-wall shelf; no fake IMU.
      var appliedCmd = driveF;
      var spinPct = 0;
      if (tracLim > 0 && driveF > 0) {
        // Pre-compute slip so launch tip cannot invent grip while already spinning.
        var slipPre = driveF > tracLim ? (driveF - tracLim) / driveF : 0;
        var tip = Math.exp(-t / 0.080);
        // Overshoot only when hooked; dies with slip (Dragy: spin → no tall g spike).
        var overshoot = (0.006 + 0.055 * tip) * (1.0 - clamp(slipPre, 0, 1));
        if (launchMode === 'aggressive') overshoot = (0.008 + 0.070 * tip) * (1.0 - 0.85 * clamp(slipPre, 0, 1));
        else if (launchMode === 'soft') overshoot = (0.002 + 0.030 * tip) * (1.0 - clamp(slipPre, 0, 1));
        appliedCmd = softTractionForce(driveF, tracLim, overshoot);
        if (!driveFLpSeeded) { driveFLp = driveF; driveFLpSeeded = true; }
        driveFLp += (driveF - driveFLp) * Math.min(1, 16.0 * DT);
        if (driveF > tracLim) {
          var slip = slipPre;
          spinSum += slip;
          spinN++;
          spinPct = slip * 100.0;
          // Kinetic µ: traction and g go together — heavy spin → lower long. force.
          // ~65% slip → kin≈0.84 → launch peak ~1.15–1.25g (Dragy), not invented 1.37+.
          var kin = 1.0 - 0.22 * Math.pow(clamp(slip, 0, 1), 0.75);
          appliedCmd *= kin;
          // Traction-fight chatter (deterministic): noisy valleys while spinning.
          var chatter = 0.048 * Math.sin(t * 78.0 + slip * 11.0)
            + 0.026 * Math.sin(t * 143.0 - slip * 7.0);
          appliedCmd *= (1.0 + chatter * kin);
          // Hard ceiling at kinetic grip — never invent above tracLim*kin*(1+tiny tip).
          var kinCeil = tracLim * kin * (1.0 + Math.min(0.05, overshoot + 0.02));
          // Mean-neutral AC ripple inside the kinetic envelope only.
          appliedCmd += 0.38 * (driveF - driveFLp) * kin;
          var acHi = Math.min(driveF, kinCeil * 1.02);
          var acLo = tracLim * kin * 0.82;
          if (appliedCmd > acHi) appliedCmd = acHi;
          if (appliedCmd < acLo) appliedCmd = acLo;
          if (appliedCmd > kinCeil) appliedCmd = kinCeil;
          if (launchMode === 'aggressive' && slip <= Math.max(0.20, slipTarget * 1.6)) {
            var band = Math.max(0.20, slipTarget * 1.6);
            var keep = clamp(1.0 - slip / band, 0.35, 0.80);
            appliedCmd = appliedCmd + (Math.min(driveF, kinCeil) - appliedCmd) * keep * 0.22;
            if (appliedCmd > kinCeil) appliedCmd = kinCeil;
          }
        }
      }

      prevSpinPct = spinPct;

      // forceScale is retired as a calibration knob — always 1.0 (garage must bake fs=1).
      appliedCmd *= CalibrationFactor;

      // Underdamped driveline tracks POST-TRACTION command — tips on traction/engage/TQ
      // changes only. Cap relative to appliedCmd so g cannot invent peaks above tire force.
      if (!dlSeeded) {
        dlForce = appliedCmd;
        dlVel = 0;
        dlSeeded = true;
      }
      var dlErr = appliedCmd - dlForce;
      var dlAcc = DL_WN * DL_WN * dlErr - 2.0 * DL_ZETA * DL_WN * dlVel;
      dlVel += dlAcc * DT;
      dlForce += dlVel * DT;
      if (dlForce < 0 && appliedCmd >= 0) dlForce = 0;
      // Tight cap — driveline ring must not invent g above commanded tire force
      var dlCap = appliedCmd >= 0 ? appliedCmd * 1.035 : appliedCmd;
      if (appliedCmd >= 0 && dlForce > dlCap) {
        dlForce = dlCap;
        if (dlVel > 0) dlVel *= 0.45;
      }
      var applied = dlForce;

      var net = applied - dragF - rollF;
      // Allow negative net after launch so aero can balance at Vmax
      if (net < 0 && !hit1320 && v < 5.0) net = 0;
      var a = net / mass;
      if (shiftProbe && shifting) {
        shiftProbe.n++;
        shiftProbe.sumA += a;
        if (a < shiftProbe.minA) shiftProbe.minA = a;
        shiftProbe.sumWhTQ += whTQ;
        if (whTQ < shiftProbe.minWhTQ) shiftProbe.minWhTQ = whTQ;
      }
      prevA = a;

      v += a * DT;
      if (v < 0) v = 0;
      // EV / Hybrid electronic speed limiter — hard clamp (not aero equilibrium)
      if (limiterMps > 0 && v > limiterMps) {
        v = limiterMps;
        a = 0;
        prevA = 0;
      }
      dist += v * DT;
      t += DT;

      mph = v * MPS_TO_MPH;
      var feet = dist / FEET_TO_M;
      var gForce = a / G;
      if (gForce > peakG) peakG = gForce;
      var instHp = (engTQ * rpm) / 5252;
      if (instHp > peakHP) peakHP = instHp;
      if (engTQ > peakTQ) peakTQ = engTQ;
      if (mph > peakMph) {
        peakMph = mph;
        peakMphT = t;
        peakMphFt = feet;
      }

      if (!hit60 && dist >= DIST_60) { result.sixtyFootTime = t; hit60 = true; }
      if (!hit330 && dist >= DIST_330) { result.threeThirtyTime = t; hit330 = true; }
      if (!hit660 && dist >= DIST_660) {
        result.eighthMileTime = t;
        result.eighthMileSpeedMph = mph;
        hit660 = true;
      }
      if (!hit1000 && dist >= DIST_1000) { result.thousandFootTime = t; hit1000 = true; }
      if (!hit1320 && dist >= DIST_1320) {
        hit1320 = true;
        qmT = t;
        qmMph = mph;
      }
      if (!hitHalf && dist >= DIST_MILE * 0.5) {
        hitHalf = true;
        result.halfMileTime = t;
        result.halfMileSpeedMph = mph;
      }
      if (!hitMile && dist >= DIST_MILE) {
        hitMile = true;
        result.mileTime = t;
        result.mileSpeedMph = mph;
      }

      if (mph >= 60 && t060 == null) t060 = t;
      if (mph >= 100 && t0100 == null) t0100 = t;
      if (mph >= 60 && at60 == null) at60 = t;
      if (mph >= 130 && t60_130 == null && at60 != null) t60_130 = t - at60;
      if (mph >= 100 && at100 == null) at100 = t;
      if (mph >= 150 && t100_150 == null && at100 != null) t100_150 = t - at100;

      // Quick metrics mode (calib): stop after QM + optional speed windows, no Vmax crawl
      if (env.quickMetrics && hit1320) {
        var need130 = env.needSixtyToOneThirty !== false;
        var need150 = !!env.needHundredToOneFifty;
        var got130 = !need130 || t60_130 != null;
        var got150 = !need150 || t100_150 != null;
        if (got130 && got150) {
          vmaxDone = true;
          vmaxReason = 'quick_metrics';
        } else if (t > (qmT || 0) + 50.0) {
          // Won't reach requested window (aero-limited) — stop for calib speed
          vmaxDone = true;
          vmaxReason = 'quick_metrics_timeout';
        }
      }

      // Vmax / safety-cap detection (only after quarter-mile markers recorded)
      if (hit1320 && !env.quickMetrics) {
        if (speedLimiterMph > 0 && v >= limiterMps - 1e-6) {
          vmaxDone = true;
          vmaxReason = 'ev_speed_limiter_' + speedLimiterMph + 'mph';
        } else if (v >= speedCapMps) {
          vmaxDone = true;
          vmaxReason = 'speed_cap_' + VMAX_SPEED_CAP_MPH + 'mph';
        } else if (dist >= distCapM) {
          vmaxDone = true;
          vmaxReason = 'dist_cap_' + VMAX_DIST_CAP_FT + 'ft';
        } else if (a < VMAX_A_THRESH) {
          vmaxHold += DT;
          if (vmaxHold >= VMAX_HOLD_S) {
            vmaxDone = true;
            vmaxReason = 'aero_mech_equilibrium';
          }
        } else {
          vmaxHold = 0;
        }
      }
      if (t >= MAX_T) {
        vmaxDone = true;
        if (!vmaxReason) vmaxReason = 'time_cap_' + MAX_T + 's';
      }

      if (!env.quickMetrics) {
        sampleAcc += DT;
        var sampleEvery = hit1320 ? 0.05 : 0.02;
        if (sampleAcc >= sampleEvery) {
          sampleAcc = 0;
          result.timeline.push({
            t: +t.toFixed(3),
            mph: +mph.toFixed(2),
            feet: +feet.toFixed(1),
            rpm: Math.round(rpm),
            gear: gear,
            g: +gForce.toFixed(3),
            wheelspin: +spinPct.toFixed(1)
          });
        }
      }
    }

    if (qmT != null) {
      result.quarterMileTime = qmT;
      result.quarterMileSpeedMph = qmMph;
    } else {
      result.quarterMileTime = t;
      result.quarterMileSpeedMph = v * MPS_TO_MPH;
    }
    if (spinN > 0) result.wheelspinPercent = (spinSum / spinN) * 100.0;
    result.zeroToSixty = t060;
    result.zeroToHundred = t0100;
    result.sixtyToOneThirty = t60_130;
    result.hundredToOneFifty = t100_150;
    result.peakG = peakG;
    result.peakHorsepower = peakHP;
    result.peakTorque = peakTQ;
    result.finished = hit1320;
    result.topSpeedMph = peakMph;
    result.topSpeedTime = peakMphT;
    result.topSpeedFeet = peakMphFt;
    result.vmaxReached = vmaxDone && vmaxReason.indexOf('equilibrium') >= 0;
    result.vmaxReason = vmaxReason || (hit1320 ? 'incomplete' : 'did_not_finish_quarter');
    if (shiftProbe) {
      result.shiftCoastProbe = {
        family: shiftProbe.family,
        residual: shiftProbe.residual,
        release: shiftProbe.release,
        engageS: shiftProbe.engageS,
        samples: shiftProbe.n,
        minAccel: shiftProbe.n ? shiftProbe.minA : null,
        avgAccel: shiftProbe.n ? shiftProbe.sumA / shiftProbe.n : null,
        minWhTQ: shiftProbe.n ? shiftProbe.minWhTQ : null,
        avgWhTQ: shiftProbe.n ? shiftProbe.sumWhTQ / shiftProbe.n : null
      };
    }
    return result;
  }

  var API = {
    runQuarterMile: runQuarterMile,
    resolveSpeedLimiterMph: resolveSpeedLimiterMph,
    getTorqueAtRpm: getTorqueAtRpm,
    synthesizeTorqueCurve: synthesizeTorqueCurve,
    peakHpFromCurve: peakHpFromCurve,
    sanitizeTorqueCurvePostPeak: sanitizeTorqueCurvePostPeak,
    capTorqueCurveToPeakHp: capTorqueCurveToPeakHp,
    suggestedWeightDistribution: suggestedWeightDistribution,
    resolveWeightDistribution: resolveWeightDistribution,
    computeDensityAltitude: computeDensityAltitude,
    airDensityFromDA: airDensityFromDA,
    boostTorqueMult: boostTorqueMult,
    hybridAssistTorqueLbFt: hybridAssistTorqueLbFt,
    FactoryTransmissions: FactoryTransmissions,
    SHIFT_RESIDUAL_DRIVE: SHIFT_RESIDUAL_DRIVE,
    SHIFT_RELEASE_FRACTION: SHIFT_RELEASE_FRACTION,
    SHIFT_ENGAGE_TIME: SHIFT_ENGAGE_TIME,
    SHIFT_ENGAGE_OVERSHOOT: SHIFT_ENGAGE_OVERSHOOT,
    resolveShiftDriveFamily: resolveShiftDriveFamily,
    shiftResidualFraction: shiftResidualFraction,
    shiftReleaseFraction: shiftReleaseFraction,
    shiftEngageTime: shiftEngageTime,
    shiftEngageOvershoot: shiftEngageOvershoot,
    smoothstep01: smoothstep01,
    shiftReleaseTorque: shiftReleaseTorque,
    shiftEngageTorque: shiftEngageTorque,
    gripMultSmooth: gripMultSmooth,
    driveForceMultSmooth: driveForceMultSmooth,
    softTractionForce: softTractionForce,
    tireGripForType: tireGripForType,
    tireLabelForType: tireLabelForType,
    TIRE_LABELS: TIRE_LABELS,
    get CalibrationFactor() { return CalibrationFactor; },
    set CalibrationFactor(v) { CalibrationFactor = Number(v) || CalibrationFactor; },
    constants: {
      HYBRID_ICE_FRAC: 0.82,
      HYBRID_ASSIST_FRAC: 0.22,
      DEFAULT_LAUNCH_RPM: DEFAULT_LAUNCH_RPM,
      DEFAULT_SHIFT_RPM: DEFAULT_SHIFT_RPM,
      DEFAULT_SHIFT_TIME: DEFAULT_SHIFT_TIME,
      RHO0: RHO0,
      DT: DT,
      MAX_T: MAX_T,
      VMAX_SPEED_CAP_MPH: VMAX_SPEED_CAP_MPH,
      VMAX_DIST_CAP_FT: VMAX_DIST_CAP_FT,
      VMAX_A_THRESH: VMAX_A_THRESH,
      VMAX_HOLD_S: VMAX_HOLD_S
    }
  };

  global.VelocityBenchPowerCurve = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
