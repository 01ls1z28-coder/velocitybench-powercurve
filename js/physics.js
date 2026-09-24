/**
 * VelocityBench PowerCurve — geared RPM physics (¼-mile + run-to-Vmax)
 *
 * Faithful JS port of CarTestClone Physics/PhysicsEngine.cs:
 *   mechRpm = wheelRpm * gearRatio * finalDrive
 *   wheelTorque = engineTQ(rpm) * gear * FD * (1 - loss)
 *   shift at shiftRpm with delay; converter stall/flash; traction clamp
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
    PDK_7: { name: 'Porsche PDK 7-spd', gears: [3.91, 2.29, 1.58, 1.19, 0.97, 0.83, 0.67], finalDrive: 3.09, loss: 10 },
    GR6_DCT: { name: 'Nissan GR6 DCT', gears: [4.056, 2.301, 1.595, 1.248, 1.000, 0.795], finalDrive: 3.70, loss: 10 },
    Getrag_R34: { name: 'Getrag 6-spd (R34 GT-R)', gears: [3.214, 1.925, 1.302, 1.000, 0.752, 0.634], finalDrive: 3.545, loss: 14 },
    Aisin_6: { name: 'Aisin/Getrag V160 6-spd', gears: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], finalDrive: 3.133, loss: 12 },
    DCT_7_AMG: { name: 'Tremec TR-9070 DCT 7', gears: [3.14, 2.05, 1.43, 1.10, 0.86, 0.68, 0.56], finalDrive: 3.73, loss: 10 },
    Ford_10R80: { name: 'Ford 10R80 10-spd Auto', gears: [4.696, 2.985, 2.146, 1.769, 1.520, 1.275, 1.000, 0.854, 0.689, 0.636], finalDrive: 3.15, loss: 15 },
    GM_10L90: { name: 'GM 10L90 10-spd Auto', gears: [4.70, 2.99, 2.15, 1.80, 1.52, 1.28, 1.00, 0.85, 0.69, 0.64], finalDrive: 2.85, loss: 15 },
    Tremec_TR9080_8DCT: { name: 'Tremec TR-9080 8DCT', gears: [2.91, 1.76, 1.22, 0.88, 0.65, 0.51, 0.40, 0.33], finalDrive: 5.20, loss: 10 },
    Bike_Sport_6: { name: 'Sportbike 6-spd (liter)', gears: [2.600, 2.158, 1.882, 1.650, 1.476, 1.304], finalDrive: 3.96, loss: 12 },
    Bike_Hyper_6: { name: 'Hyperbike 6-spd', gears: [2.562, 1.934, 1.526, 1.285, 1.125, 1.041], finalDrive: 3.81, loss: 12 },
    EV_Single: { name: 'EV Single-Speed', gears: [1.00], finalDrive: 9.0, loss: 8 }
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
        tq = tqAtPeakHp * (1.0 - 0.22 * w - 0.28 * w * w);
      }
      curve[r] = Math.max(10, tq);
    }
    // Pin exact peaks for HP consistency
    curve[peakTqRpm] = peakTq;
    curve[peakHpRpm] = tqAtPeakHp;
    if (curve[redline] == null) curve[redline] = Math.max(10, tqAtPeakHp * 0.72);
    return curve;
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
      case 1: return 1.18;  // Drag Radial / Soft compound
      case 2: return 1.45;  // Slick
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
    var launchDriveMult = 1.0; // soft leaves cleaner; aggressive leans on tires
    if (launchMode === 'soft') {
      // Clean leave: lower brake-launch RPM, more grip, slight torque ease
      launchRpm = Math.max(car.isEv ? 200 : 1200, launchRpm - 700);
      slipTarget = 0.04;
      launchDriveMult = car.isEv ? 0.86 : 0.92;
    } else if (launchMode === 'aggressive') {
      // Hot leave: higher RPM, more slip allowance, brief overdrive
      launchRpm = Math.min(redline, launchRpm + (car.isEv ? 1200 : 800));
      slipTarget = 0.18;
      launchDriveMult = car.isEv ? 1.08 : 1.04;
    } else if (launchMode === 'custom') {
      if (env.customLaunchRpm > 0) launchRpm = env.customLaunchRpm;
      if (env.customSlipTarget > 0) slipTarget = env.customSlipTarget;
    }

    result.launchRpm = Math.round(launchRpm);
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
    var shifting = false, shiftTimer = 0;
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
        if (shiftTimer <= 0) shifting = false;
      }

      var inLaunch = (t < LAUNCH_HOLD && v < LAUNCH_V_THRESH) || (dist < LAUNCH_DIST_M && t < LAUNCH_HOLD + 0.4);
      var wheelRpm = tireRadius > 0 ? (v / (2 * Math.PI * tireRadius)) * 60.0 : 0;

      if (!shifting) {
        if (car.hasAftermarketConverter) {
          /**
           * Aftermarket stall converter (realistic-lite):
           * - Stall RPM = engine speed against a stalled/near-stalled turbine (brake launch).
           * - Flash RPM = brief free-rev peak as the converter unloads off the line.
           * - Slip decays with road speed toward lockup (~1:1 by ~50 mph).
           * Stock path (ATC off) keeps classic launchRpm hold.
           */
          var stall = Number(car.stallRpm) || 2800;
          var flash = Number(car.flashRpm) || Math.max(stall + 400, 3500);
          if (flash < stall) flash = stall;
          var gNow = gears[Math.min(gear, gears.length) - 1];
          var mechRpm = wheelRpm * gNow * finalDrive;
          var mphNow = v * MPS_TO_MPH;
          // Lockup progress: 0 at standstill → 1 by ~50 mph
          var lockup = clamp(mphNow / 50.0, 0, 1);
          // Flash pulse: peaks in first ~0.20 s while still very slow
          var flashPulse = 0;
          if (t < 0.35 && mphNow < 18) {
            // Longer flash window so Flash RPM is audible in 60ft / 0-60
            flashPulse = Math.sin((Math.min(t, 0.35) / 0.35) * Math.PI);
          }
          var target = stall + (flash - stall) * flashPulse;
          // Blend toward mechanical RPM as converter couples / locks
          rpm = target * (1 - lockup) + mechRpm * lockup;
          // Never fall below stall while still heavily slipped (< ~25 mph)
          if (mphNow < 25 && rpm < stall) rpm = stall;
          // Soft ceiling: don't wildly exceed flash during flash window
          if (flashPulse > 0.05 && rpm > flash) rpm = flash;
        } else if (inLaunch) {
          rpm = launchRpm;
        } else {
          rpm = wheelRpm * gears[gear - 1] * finalDrive;
        }
      }

      if (!shifting && rpm >= shiftRpm && gear < gears.length) {
        gear++;
        shifting = true;
        shiftTimer = shiftTime;
        result.totalShifts++;
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
      var whTQ = shifting ? 0 : engTQ * gRatio * finalDrive;
      var mph = v * MPS_TO_MPH;

      if (!shifting && car.hasAftermarketConverter) {
        // Torque multiplication from converter slip: ~2.1× at stall → 1.0 at lockup
        var mech = wheelRpm * gRatio * finalDrive;
        var slipR = rpm > 0 ? Math.max(0, (rpm - mech) / rpm) : 0;
        // Higher stall → more slip capacity at leave → more multiply (capped)
        var stallN = Number(car.stallRpm) || 2800;
        var stallBoost = clamp((stallN - 2200) / 2800, 0, 1) * 0.25;
        var tMult = 1.0 + Math.min(1.35, slipR * (2.2 + stallBoost));
        // Extra fade with road speed (mechanical lockup / coupling)
        if (mph > 15.0) {
          var fade = Math.min(1.0, Math.max(0, (mph - 15.0) / 40.0));
          tMult = 1.0 + (tMult - 1.0) * (1.0 - fade);
        }
        whTQ *= tMult;
      }

      var driveF = tireRadius > 0 ? whTQ / tireRadius : 0;
      if (mph < 30.0) driveF *= FORCE_LT30;
      if (mph > 60.0) driveF *= FORCE_GT60;
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
      if (inLaunch) {
        if (launchMode === 'soft') mu = muBase * 1.20;
        else if (launchMode === 'aggressive') mu = muBase * 0.78;
        else if (launchMode === 'custom') {
          mu = muBase * clamp(1.0 + (0.10 - slipTarget) * 1.5, 0.7, 1.3);
        }
      }
      if (mph < 20.0) mu *= GRIP_LT20;
      else if (mph < 40.0) mu *= GRIP_20_40;
      else if (mph < 60.0) mu *= GRIP_40_60;

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
      var applied = driveF;
      var spinPct = 0;
      if (applied > tracLim && tracLim > 0) {
        var slip = (applied - tracLim) / applied;
        spinSum += slip;
        spinN++;
        spinPct = slip * 100.0;
        applied = tracLim;
      }

      // forceScale is retired as a calibration knob — always 1.0 (garage must bake fs=1).
      applied *= CalibrationFactor;

      var net = applied - dragF - rollF;
      // Allow negative net after launch so aero can balance at Vmax
      if (net < 0 && !hit1320 && v < 5.0) net = 0;
      var a = net / mass;
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
    return result;
  }

  var API = {
    runQuarterMile: runQuarterMile,
    resolveSpeedLimiterMph: resolveSpeedLimiterMph,
    getTorqueAtRpm: getTorqueAtRpm,
    synthesizeTorqueCurve: synthesizeTorqueCurve,
    peakHpFromCurve: peakHpFromCurve,
    suggestedWeightDistribution: suggestedWeightDistribution,
    resolveWeightDistribution: resolveWeightDistribution,
    computeDensityAltitude: computeDensityAltitude,
    airDensityFromDA: airDensityFromDA,
    boostTorqueMult: boostTorqueMult,
    hybridAssistTorqueLbFt: hybridAssistTorqueLbFt,
    FactoryTransmissions: FactoryTransmissions,
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
