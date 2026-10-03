/**
 * VelocityBench PowerCurve — UI controller
 */
(function () {
  'use strict';

  var Phys = window.VelocityBenchPowerCurve;
  if (!Phys) {
    console.error('Physics engine missing');
    return;
  }

  // Phase 4: fleet from js/garage-data.js (316 public cars; unsourced parked) + Custom Builder.
  // Curated torque curves / gearing baked in where available; rest synthesized.
  var CUSTOM_BUILDER = {
    id: 'custom',
    name: 'Custom Builder',
    category: 'Custom',
    weightLbs: 3800, dragCoefficient: 0.35, frontalAreaSqFt: 22.5, tireRadiusInches: 13.2,
    finalDriveRatio: 3.73, gearRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
    peakHp: 450, peakTqRpm: 4200, peakHpRpm: 6200, redline: 6800,
    isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000,
    drivetrainLossPercent: 15, txKey: 'TR6060_6', tireType: 0, forceScale: 1,
    engineLayout: 'Front',
    frontWeightPercent: 45, rearWeightPercent: 55,
    leftWeightPercent: 50, rightWeightPercent: 50,
    powerSource: 'na', isEv: false, isHybrid: false, boostModel: 'na'
  };

  /** Garage EV/Hybrid lock — Custom Builder can still change power source freely. */
  var garagePowerLocked = false;

  function loadGarageFleet() {
    var raw = (typeof window !== 'undefined' && window.VB_POWERCURVE_GARAGE) || [];
    var list = raw.map(function (c) { return c; });
    // Ensure Custom Builder is always available at end
    if (!list.some(function (c) { return c.id === 'custom'; })) list.push(CUSTOM_BUILDER);
    return list;
  }

  var SAMPLE_CARS = loadGarageFleet();
  var garageFilterText = '';

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    car: null,
    presetCar: null, // pristine garage/custom snapshot for Reset
    lastResult: null,
    anim: null,
    powerCurve: [],
    cursorRpm: null,
    chartGeom: null,
    drag: null, // { rpm, pointerId }
    curveEdited: false,
    peakHpBaseline: null,   // Peak HP when curveAtBaseline was snapped
    curveAtBaseline: null,  // torqueCurve snapshot for continuous Peak HP scale
    // Playback state machine (real-time scale=1 per Phase 4)
    playbackPlaying: false,
    playbackPaused: false,
    playbackT0: 0,              // performance.now() when current play segment started
    playbackElapsedOffset: 0,   // ms already elapsed before this play segment (pause resume)
    playbackDurationMs: 0,
    // SPEED VS DISTANCE chart view — default full run to Vmax; zoom sets window
    speedChartView: { xMinFt: 0, xMaxFt: null }, // null xMax = full domain
    speedChartCursor: null, // { feet, mph, t } synced to playback sample
    speedChartGeom: null,   // last draw hit-test: { pad, xMin, xMax, w, h, plotW }
    speedChartDrag: null,   // { pointerId, startX, originMin, originMax, moved }
    speedChartLastTap: 0
  };

  /** Wheel Spin logo ON when timeline sample wheelspin ≥ this % */
  var SPIN_WARN_THRESHOLD = 8;

  var rpmGauge = new window.VBPowerCurveGauges.BrassGauge($('rpmGauge'), {
    overlayOnly: false, // full live dial — no snip wallpaper needles
    min: 0, max: 8000, label: 'RPM', redline: 6500
  });
  var speedGauge = new window.VBPowerCurveGauges.BrassGauge($('speedGauge'), {
    overlayOnly: false,
    min: 0, max: 200, label: 'MPH', unit: '', redline: 180, dial: 'speed'
  });
  rpmGauge.start();
  speedGauge.start();
  try { window.__pcGauges = { rpm: rpmGauge, speed: speedGauge }; } catch (eG) {}
  function syncHubReadouts() {
    var rv = $('rpmHubValue');
    var sv = $('speedHubValue');
    // Same source as BrassGauge needle + canvas digital (this.display)
    if (rv) rv.textContent = String(Math.round(rpmGauge.display));
    if (sv) sv.textContent = String(Math.round(speedGauge.display));
  }

  function cloneTorqueCurve(curve) {
    if (!curve) return null;
    var out = {};
    Object.keys(curve).forEach(function (k) {
      var v = Number(curve[k]);
      if (isFinite(v)) out[k] = v;
    });
    return out;
  }

  /** Continuous proportional scale — preserves shape; floors at 5 lb-ft. Every HP. */
  function scaleTorqueCurveMap(curve, scale) {
    if (!curve || !(scale > 0) || !isFinite(scale)) return curve || null;
    var out = {};
    Object.keys(curve).forEach(function (k) {
      var v = Number(curve[k]);
      if (!isFinite(v)) return;
      out[k] = Math.max(5, v * scale);
    });
    return out;
  }

  /** Stash Peak HP baseline + curve snapshot (applyCar / dyno commit / synth). */
  function stashPeakHpBaseline(car, peakHpOpt) {
    var hp = peakHpOpt != null ? peakHpOpt
      : (car && (car.peakHp || (Phys.peakHpFromCurve && Phys.peakHpFromCurve(car.torqueCurve || {})) || 450));
    state.peakHpBaseline = Math.round(Number(hp) || 0);
    state.curveAtBaseline = (car && car.torqueCurve) ? cloneTorqueCurve(car.torqueCurve) : null;
  }

  /**
   * Peak HP → force for EVERY garage car + Custom: continuously scale the stashed
   * torqueCurve (preserve shape). Never wipe / resynthesize an existing curve.
   * ±1 HP and small Δ move force. Returns scaled map or null if no scale applied.
   */
  function scaleCurveForPeakHpChange(peakHp, redline) {
    var baseline = state.peakHpBaseline;
    if (!(baseline > 0) || peakHp === baseline) return null;
    var src = state.curveAtBaseline;
    if (!src || !Object.keys(src).length) return null;
    var scale = peakHp / baseline;
    var scaled = scaleTorqueCurveMap(src, scale);
    state.peakHpBaseline = peakHp;
    state.curveAtBaseline = cloneTorqueCurve(scaled);
    if (state.car) {
      state.car.torqueCurve = scaled;
      state.car.peakHp = peakHp;
    }
    if (!state.drag) {
      state.powerCurve = powerCurveFromTorqueCurve(scaled, redline, peakHp);
      drawPowerCurve(state.powerCurve, state.cursorRpm);
    }
    return scaled;
  }


  /** True when active power source is full EV (not Hybrid). */
  function isEvMode(car) {
    car = car || state.car;
    if (!car) return inductionValue() === 'ev';
    if (inductionValue() === 'ev') return true;
    return !!(car.isEv || car.powerSource === 'ev');
  }

  /** Nice tach ceiling from redline / curve max. */
  function niceRpmGaugeMax(redline, curveMax) {
    var r = Math.max(Number(redline) || 7000, Number(curveMax) || 0);
    var pad = Math.max(r * 1.02, r + 200);
    var step = pad >= 12000 ? 2000 : 1000;
    return Math.ceil(pad / step) * step;
  }

  function curveRpmMax(curve) {
    if (!curve) return 0;
    var keys = Object.keys(curve).map(Number).filter(isFinite);
    if (!keys.length) return 0;
    return Math.max.apply(null, keys);
  }

  /**
   * ICE: LFA RPM tach scaled to vehicle redline (bikes → 14k+).
   * EV: replace tach with Power % dial (0–100). Hybrid keeps ICE RPM.
   * Documented choice: Power % primary (not motor-rpm tach) — clearer EV instrument swap.
   */
  function configurePrimaryGauge(car) {
    car = car || state.car || {};
    var labelEl = $('livePrimaryLabel');
    if (isEvMode(car)) {
      rpmGauge.configure({ mode: 'powerPct', label: 'PWR' });
      if (labelEl) labelEl.textContent = 'MOTOR';
      state.evGaugeMode = true;
      state.evPeakHp = Math.max(
        1,
        Number(car.peakHp) || Phys.peakHpFromCurve(car.torqueCurve || {}) || 1
      );
    } else {
      var red = Number(car.redline) || Number(car.shiftRpm) || 7000;
      var cMax = curveRpmMax(car.torqueCurve);
      var max = niceRpmGaugeMax(red, cMax);
      rpmGauge.configure({ mode: 'rpm', redline: red, max: max, label: 'RPM' });
      if (labelEl) labelEl.textContent = 'RPM';
      state.evGaugeMode = false;
      state.evPeakHp = null;
    }
  }

  /** Instantaneous engine/motor HP from baked curve @ RPM. */
  function hpAtRpm(car, rpm) {
    if (!car || !car.torqueCurve) return 0;
    var tq = Phys.getTorqueAtRpm
      ? Phys.getTorqueAtRpm(car.torqueCurve, rpm)
      : Number(car.torqueCurve[Math.round(rpm)]);
    if (!isFinite(tq) || tq <= 0) return 0;
    return (tq * rpm) / 5252;
  }

  function fmt(n, d) {
    if (n == null || !isFinite(n)) return '—';
    return Number(n).toFixed(d != null ? d : 3);
  }

  function populateTxPresets() {
    var sel = $('txPreset');
    sel.innerHTML = '';
    var txs = Phys.FactoryTransmissions;
    Object.keys(txs).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = txs[k].name;
      sel.appendChild(o);
    });
  }


  function isCustomBuilder(car) {
    return !!(car && (car.id === 'custom' || /custom builder/i.test(car.name || '')));
  }

  /**
   * Human label for a car's baked factory TX.
   * Jorge rule: if OEM box identity is unsure, car.txFactoryLabel === '' → blank
   * (do not guess Tremec/ZF/Aisin names). Ratios/FD stay on the car object.
   * When txFactoryLabel is undefined, fall back to FactoryTransmissions[txKey].name.
   */
  function resolveTxDisplayName(car) {
    if (!car) return null;
    if (Object.prototype.hasOwnProperty.call(car, 'txFactoryLabel')) {
      var forced = car.txFactoryLabel;
      if (forced == null || forced === '') return null; // blank / hide
      return String(forced);
    }
    if (!car.txKey) return null;
    var tx = Phys.FactoryTransmissions[car.txKey];
    if (!tx) return null;
    return tx.name || car.txKey;
  }

  function updateTxFactoryLabel(car) {
    var field = $('txFactoryLabelField');
    var label = $('txFactoryLabel');
    var keyEl = $('txFactoryKey');
    if (!field || !label) return;
    var custom = isCustomBuilder(car);
    // Custom Builder uses the editable preset dropdown; garage cars get a read-only name.
    field.classList.toggle('tx-hidden', !!custom);
    if (custom) {
      label.textContent = '—';
      label.classList.remove('is-unknown');
      if (keyEl) { keyEl.hidden = true; keyEl.textContent = ''; }
      return;
    }
    var name = resolveTxDisplayName(car);
    var blankForced = !!(car && Object.prototype.hasOwnProperty.call(car, 'txFactoryLabel') &&
      (car.txFactoryLabel == null || car.txFactoryLabel === ''));
    if (name) {
      label.textContent = name;
      label.classList.remove('is-unknown');
      if (keyEl) {
        keyEl.hidden = false;
        keyEl.textContent = 'preset · ' + car.txKey;
      }
    } else if (blankForced) {
      // Jorge rule: unsure OEM identity → blank label (no guessed Tremec/ZF/Aisin name)
      label.textContent = '';
      label.classList.add('is-unknown');
      if (keyEl) { keyEl.hidden = true; keyEl.textContent = ''; }
    } else {
      label.textContent = 'Custom / unknown gears';
      label.classList.add('is-unknown');
      if (keyEl) {
        keyEl.hidden = !car || !car.txKey;
        keyEl.textContent = car && car.txKey ? ('txKey · ' + car.txKey) : '';
      }
    }
  }

  function updateTxPresetVisibility(car) {
    var field = $('txPresetField');
    var sel = $('txPreset');
    if (!sel) return;
    var custom = isCustomBuilder(car);
    if (field) field.classList.toggle('tx-hidden', !custom);
    sel.disabled = !custom;
    if (!custom) {
      // Garage: hide dropdown; factory name is shown via #txFactoryLabel (bake is right).
      sel.selectedIndex = -1;
      if (!sel.querySelector('option[value=""]')) {
        var blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '— car gears —';
        blank.disabled = true;
        sel.insertBefore(blank, sel.firstChild);
      }
      sel.value = '';
    } else if (car && car.txKey && Phys.FactoryTransmissions[car.txKey]) {
      sel.value = car.txKey;
    }
    updateTxFactoryLabel(car);
  }

  var RPM_GRID = 100;   // dense mesh — matches baked torque samples
  var RPM_MAJOR = 200;  // major handles every 2 grid steps (250 not divisible by 100)

  /** Build editable HP/TQ series on a 100-RPM grid from a torque curve map. */
  function powerCurveFromTorqueCurve(curve, redline, peakHpCap) {
    if (!curve) return [];
    // Work on a shallow copy so sanitize/cap do not surprise callers mid-edit
    var map = {};
    Object.keys(curve).forEach(function (k) {
      var v = Number(curve[k]);
      if (isFinite(v)) map[k] = v;
    });
    // EV motor curves are flat/shelf shaped — ICE post-peak sanitize pins peakHpRpm
    // and crushes high-rpm HP (M3P Peak 466 bug). Physics already skips sanitize for isEv.
    if (Phys.sanitizeTorqueCurvePostPeak && !(state.car && (state.car.isEv || state.car.powerSource === 'ev'))) {
      Phys.sanitizeTorqueCurvePostPeak(map, state.car && state.car.peakHpRpm);
    }
    if (peakHpCap > 0 && Phys.capTorqueCurveToPeakHp) {
      Phys.capTorqueCurveToPeakHp(map, peakHpCap);
    }
    var keys = Object.keys(map).map(Number).filter(function (k) { return isFinite(k); });
    keys.sort(function (a, b) { return a - b; });
    if (!keys.length) return [];
    var minR = keys[0];
    var maxR = Math.max(keys[keys.length - 1], redline || keys[keys.length - 1]);
    // Snap grid to RPM_GRID (100) starting at nearest <= minR
    var start = Math.floor(minR / RPM_GRID) * RPM_GRID;
    if (start < minR && start + RPM_GRID <= maxR) start += RPM_GRID;
    if (start < 500) start = Math.max(500, start);
    var out = [];
    var prevTq = null;
    for (var r = start; r <= maxR + 0.01; r += RPM_GRID) {
      var rpm = Math.round(r);
      var tq = Phys.getTorqueAtRpm ? Phys.getTorqueAtRpm(map, rpm) : null;
      if (tq == null || !isFinite(tq) || tq <= 0) {
        // local interpolate fallback — never leave a hole that floors to ~5
        tq = Number(map[rpm]);
        if (!isFinite(tq) || tq <= 0) tq = Number(map[String(rpm)]);
        if (!isFinite(tq) || tq <= 0) {
          var lo = null, hi = null;
          for (var i = 0; i < keys.length; i++) {
            if (keys[i] <= rpm) lo = keys[i];
            if (keys[i] >= rpm) { hi = keys[i]; break; }
          }
          if (lo == null) tq = Number(map[keys[0]]);
          else if (hi == null || hi === lo) tq = Number(map[lo]);
          else {
            var t1 = Number(map[lo]), t2 = Number(map[hi]);
            if (!isFinite(t1)) t1 = t2;
            if (!isFinite(t2)) t2 = t1;
            tq = t1 + (t2 - t1) * ((rpm - lo) / (hi - lo));
          }
        }
      }
      if (!isFinite(tq) || tq <= 0) tq = prevTq != null ? prevTq : 5;
      tq = Math.max(5, tq);
      prevTq = tq;
      out.push({ rpm: rpm, torque: tq, horsepower: (tq * rpm) / 5252 });
    }
    // Ensure exact peakHpRpm knot is on the editable series (garage pins often off 100-grid)
    var pinRpm = state.car && Number(state.car.peakHpRpm);
    if (isFinite(pinRpm) && pinRpm >= minR && pinRpm <= maxR) {
      var pinTq = Phys.getTorqueAtRpm ? Phys.getTorqueAtRpm(map, pinRpm) : Number(map[pinRpm]);
      if (isFinite(pinTq) && pinTq > 0) {
        var inserted = false;
        for (var pi = 0; pi < out.length; pi++) {
          if (Math.abs(out[pi].rpm - pinRpm) < 0.5) {
            out[pi].torque = Math.max(5, pinTq);
            out[pi].horsepower = (out[pi].torque * out[pi].rpm) / 5252;
            inserted = true;
            break;
          }
          if (out[pi].rpm > pinRpm) {
            out.splice(pi, 0, {
              rpm: Math.round(pinRpm),
              torque: Math.max(5, pinTq),
              horsepower: (Math.max(5, pinTq) * pinRpm) / 5252
            });
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          out.push({
            rpm: Math.round(pinRpm),
            torque: Math.max(5, pinTq),
            horsepower: (Math.max(5, pinTq) * pinRpm) / 5252
          });
        }
      }
    }
    // Cap series peak to vehicle Peak HP parameter (tiny rounding slack)
    if (peakHpCap > 0) {
      var seriesPeak = 0;
      out.forEach(function (p) { if (p.horsepower > seriesPeak) seriesPeak = p.horsepower; });
      if (seriesPeak > peakHpCap * 1.002) {
        var s = peakHpCap / seriesPeak;
        out.forEach(function (p) {
          p.torque = Math.max(5, p.torque * s);
          p.horsepower = (p.torque * p.rpm) / 5252;
        });
      }
    }
    return out;
  }

  /** Dense numeric-key torque map from the authoritative editable series (all 100-RPM samples). */
  function torqueCurveFromPowerCurve(powerCurve) {
    var map = {};
    (powerCurve || []).forEach(function (p) {
      if (!p || !isFinite(p.rpm)) return;
      var rpm = Math.round(Number(p.rpm));
      var tq = Number(p.torque);
      if (!isFinite(tq)) return;
      map[rpm] = Math.max(5, tq);
    });
    return map;
  }

  function syncPowerCurveFromCar(car) {
    if (!car || !car.torqueCurve) {
      state.powerCurve = [];
      drawPowerCurve([]);
      return;
    }
    // Only rebuild the editable series from the car when not mid-drag
    if (state.drag) return;
    // Kill fake redline uptick on ICE curves only. EV: do NOT mutate torqueCurve —
    // sanitize + wrong peakHpRpm pin crushed Model 3 Perf 519→507 shelf (Peak 466).
    if (Phys.sanitizeTorqueCurvePostPeak && !(car.isEv || car.powerSource === 'ev')) {
      Phys.sanitizeTorqueCurvePostPeak(car.torqueCurve, car.peakHpRpm);
    }
    var cap = Number(car.peakHp);
    // Display series capped to Peak HP param; do not rescale fleet force curves here
    state.powerCurve = powerCurveFromTorqueCurve(car.torqueCurve, car.redline, cap);
    drawPowerCurve(state.powerCurve, state.cursorRpm);
  }

  function commitEditedCurveToCar() {
    if (!state.car || !state.powerCurve.length) return;
    // state.powerCurve is authoritative while editing — write a dense integer-key map
    state.car.torqueCurve = torqueCurveFromPowerCurve(state.powerCurve);
    // Keep peakHp label aligned with edited curve peak
    var peak = 0;
    state.powerCurve.forEach(function (p) {
      if (p.horsepower > peak) peak = p.horsepower;
    });
    if (peak > 0) {
      state.car.peakHp = Math.round(peak);
      var hpEl = $('peakHp');
      if (hpEl) hpEl.value = String(Math.round(peak));
      // Dyno edit becomes the new Peak HP baseline (no accidental rescaling on RUN)
      stashPeakHpBaseline(state.car, Math.round(peak));
    }
    state.curveEdited = true;
  }

  /**
   * Snapshot-based sculpt brush: primary bullet moves by delta, neighbors follow
   * with distance falloff so the dense 100-RPM polyline stays dyno-realistic
   * (no knife-edge spike / flat valley of untouched minors).
   * Majors (every 200 RPM) use a wider brush; minors a lighter local blend.
   * Always floors at 5 lb-ft — never collapses neighbors toward zero.
   */
  function sculptCurveFromDrag(idx, newTq, snapshot, isMajor) {
    var pc = state.powerCurve;
    if (!pc || !snapshot || idx < 0 || idx >= pc.length) return;
    var base = snapshot[idx];
    if (!isFinite(base)) base = pc[idx].torque;
    var delta = newTq - base;
    // Majors: ±2 samples (±200 RPM); minors: ±1 sample (±100 RPM) on 100-RPM mesh
    var radius = isMajor ? 2 : 1;
    for (var i = 0; i < pc.length; i++) {
      var d = Math.abs(i - idx);
      var tq;
      if (d === 0) {
        tq = newTq;
      } else if (d > radius) {
        // Restore from snapshot outside brush so mid-drag scrubbing is stable
        tq = snapshot[i];
        if (!isFinite(tq)) continue;
      } else {
        // Cosine falloff: 1 at d=0 edge, 0 at d=radius+epsilon
        var w = 0.5 * (1 + Math.cos(Math.PI * d / (radius + 1)));
        var snap = snapshot[i];
        if (!isFinite(snap)) snap = pc[i].torque;
        tq = snap + delta * w;
      }
      if (!isFinite(tq)) continue;
      tq = Math.max(5, tq);
      pc[i].torque = tq;
      pc[i].horsepower = (tq * pc[i].rpm) / 5252;
    }
  }

  /** When a major is dragged, re-lerp minors between adjacent majors so the
   *  100-RPM mesh fills the curve instead of leaving a valley of stale points. */
  function interpolateMinorsBetweenMajors(centerIdx) {
    var pc = state.powerCurve;
    if (!pc || centerIdx < 0 || centerIdx >= pc.length) return;
    function isMajorAt(i) {
      return Math.round(pc[i].rpm) % RPM_MAJOR === 0;
    }
    var left = centerIdx, right = centerIdx;
    while (left > 0 && !isMajorAt(left - 1)) left--;
    if (left > 0 && isMajorAt(left - 1)) left = left - 1;
    else left = centerIdx; // no left major — only fill toward right
    while (right < pc.length - 1 && !isMajorAt(right + 1)) right++;
    if (right < pc.length - 1 && isMajorAt(right + 1)) right = right + 1;
    else right = centerIdx;
    // Fill left segment [leftMajor .. center] and right [center .. rightMajor]
    function lerpSpan(a, b) {
      if (b <= a + 1) return;
      var tqA = pc[a].torque, tqB = pc[b].torque;
      for (var i = a + 1; i < b; i++) {
        var t = (i - a) / (b - a);
        var tq = Math.max(5, tqA + (tqB - tqA) * t);
        pc[i].torque = tq;
        pc[i].horsepower = (tq * pc[i].rpm) / 5252;
      }
    }
    if (left < centerIdx) lerpSpan(left, centerIdx);
    if (centerIdx < right) lerpSpan(centerIdx, right);
  }

  function renderGears(ratios) {
    var ed = $('gearsEditor');
    ed.innerHTML = '';
    (ratios || []).forEach(function (g, i) {
      var inp = document.createElement('input');
      inp.type = 'number'; inp.step = '0.001'; inp.value = g;
      inp.title = 'Gear ' + (i + 1);
      inp.dataset.gearIndex = String(i);
      ed.appendChild(inp);
    });
    var add = document.createElement('button');
    add.type = 'button'; add.className = 'btn'; add.textContent = '+ Gear';
    add.style.fontSize = '11px'; add.style.padding = '6px';
    add.onclick = function () {
      var cur = readGears();
      cur.push(1.0);
      renderGears(cur);
    };
    ed.appendChild(add);
  }

  function readGears() {
    var inputs = $('gearsEditor').querySelectorAll('input[data-gear-index]');
    var out = [];
    inputs.forEach(function (inp) {
      var v = parseFloat(inp.value);
      if (isFinite(v) && v > 0) out.push(v);
    });
    return out;
  }

  function inductionValue() {
    var el = document.querySelector('input[name="ind"]:checked');
    return el ? el.value : 'na';
  }

  var ICE_INDUCTION = { na: 1, turbo: 1, supercharger: 1, twincharge: 1 };

  function setInductionRadio(value) {
    var radio = document.querySelector('input[name="ind"][value="' + value + '"]');
    if (radio) radio.checked = true;
  }

  /**
   * EV selected → lock/disable ICE induction (NA/Turbo/SC/Twin).
   * Garage EV/Hybrid cars also lock the power-source radios to the baked mode.
   */
  function syncInductionUi(opts) {
    opts = opts || {};
    var ind = inductionValue();
    var isEv = ind === 'ev' || !!opts.forceEv;
    var isHybrid = ind === 'hybrid' || !!opts.forceHybrid;
    var lockGarage = !!garagePowerLocked;
    document.querySelectorAll('input[name="ind"]').forEach(function (inp) {
      var v = inp.value;
      var disable = false;
      if (lockGarage) {
        // Garage car: only the baked power source stays selectable
        var want = opts.lockedValue || (opts.forceEv ? 'ev' : (opts.forceHybrid ? 'hybrid' : ind));
        disable = v !== want;
      } else if (isEv) {
        // Custom / user EV: ICE modes unavailable
        disable = !!ICE_INDUCTION[v] || v === 'hybrid';
      } else {
        disable = false;
      }
      inp.disabled = disable;
      if (inp.parentElement) inp.parentElement.classList.toggle('is-locked', disable);
    });
    var hint = $('inductionLockHint');
    if (hint) {
      if (isEv) {
        hint.hidden = false;
        hint.textContent = lockGarage
          ? 'Garage EV — induction locked (NA/Turbo/SC/Twin unavailable).'
          : 'EV selected — ICE induction locked (NA/Turbo/SC/Twin unavailable).';
      } else if (lockGarage && isHybrid) {
        hint.hidden = false;
        hint.textContent = 'Garage Hybrid — power source locked (ICE + electric assist).';
      } else {
        hint.hidden = true;
      }
    }
  }

  function syncWeightFieldsFromCar(car) {
    var sug = Phys.suggestedWeightDistribution
      ? Phys.suggestedWeightDistribution(car)
      : { frontWeightPercent: 45, rearWeightPercent: 55, leftWeightPercent: 50, rightWeightPercent: 50 };
    var resolved = Phys.resolveWeightDistribution
      ? Phys.resolveWeightDistribution(car)
      : sug;
    // Prefer baked/explicit car fields; else layout/drive suggestion
    var use = (car.rearWeightPercent != null || car.frontWeightPercent != null) ? resolved : sug;
    if ($('frontWeightPct')) $('frontWeightPct').value = String(Math.round(use.frontWeightPercent));
    if ($('rearWeightPct')) $('rearWeightPct').value = String(Math.round(use.rearWeightPercent));
    if ($('leftWeightPct')) $('leftWeightPct').value = String(Math.round(use.leftWeightPercent));
    if ($('rightWeightPct')) $('rightWeightPct').value = String(Math.round(use.rightWeightPercent));
    updateWeightSumHints();
  }

  var _weightVizSyncing = false;

  function formatCornerPct(n) {
    if (!isFinite(n)) return '—';
    var r = Math.round(n * 10) / 10;
    return (Math.abs(r - Math.round(r)) < 0.05) ? String(Math.round(r)) : r.toFixed(1);
  }

  function cornerPercentsFromAxes(front, left) {
    var f = clampNum(front, 20, 80, 45);
    var l = clampNum(left, 20, 80, 50);
    var r = 100 - f;
    var rt = 100 - l;
    return {
      fl: f * l / 100,
      fr: f * rt / 100,
      rl: r * l / 100,
      rr: r * rt / 100,
      front: f,
      rear: r,
      left: l,
      right: rt
    };
  }

  function setAxisWeightFields(front, left, opts) {
    opts = opts || {};
    var c = cornerPercentsFromAxes(front, left);
    _weightVizSyncing = true;
    try {
      if ($('frontWeightPct')) $('frontWeightPct').value = String(Math.round(c.front));
      if ($('rearWeightPct')) $('rearWeightPct').value = String(Math.round(c.rear));
      if ($('leftWeightPct')) $('leftWeightPct').value = String(Math.round(c.left));
      if ($('rightWeightPct')) $('rightWeightPct').value = String(Math.round(c.right));
      syncWeightVisualFromAxes(c.front, c.left, { skipInputs: opts.skipCornerInputs });
    } finally {
      _weightVizSyncing = false;
    }
    updateWeightSumHints({ skipVisual: true });
  }

  function syncWeightVisualFromAxes(front, left, opts) {
    opts = opts || {};
    var c = cornerPercentsFromAxes(front, left);
    var map = [
      ['cornerFlPct', 'wheelFillFl', 'fl', c.fl],
      ['cornerFrPct', 'wheelFillFr', 'fr', c.fr],
      ['cornerRlPct', 'wheelFillRl', 'rl', c.rl],
      ['cornerRrPct', 'wheelFillRr', 'rr', c.rr]
    ];
    map.forEach(function (row) {
      var inp = $(row[0]);
      var fill = $(row[1]);
      var pad = document.querySelector('.wheel-pad.' + row[2]);
      var pct = row[3];
      if (inp && !opts.skipInputs) {
        if (document.activeElement !== inp) inp.value = formatCornerPct(pct);
      }
      // Equal share is 25%; map ~10–40% into fill height 18–88%
      var h = 18 + Math.max(0, Math.min(1, (pct - 10) / 30)) * 70;
      if (fill) fill.style.height = h.toFixed(1) + '%';
      if (pad) {
        if (pct >= 27) pad.classList.add('is-heavy');
        else pad.classList.remove('is-heavy');
      }
    });
    var cg = $('weightCg');
    var car = $('weightCar');
    if (cg && car) {
      // x: left-heavy → left side (left% 80 at 18%, left% 20 at 82%)
      // y: front-heavy → top (front% 80 at 18%, front% 20 at 82%)
      var xPct = 18 + ((80 - c.left) / 60) * 64;
      var yPct = 18 + ((80 - c.front) / 60) * 64;
      cg.style.left = xPct.toFixed(2) + '%';
      cg.style.top = yPct.toFixed(2) + '%';
      cg.setAttribute('aria-valuenow', String(Math.round(c.front)));
      cg.setAttribute('aria-valuetext',
        'Front ' + Math.round(c.front) + '%, Left ' + Math.round(c.left) + '%');
    }
  }

  function syncWeightVisualFromForm() {
    var f = Number($('frontWeightPct') && $('frontWeightPct').value);
    var l = Number($('leftWeightPct') && $('leftWeightPct').value);
    if (!isFinite(f)) f = 45;
    if (!isFinite(l)) l = 50;
    syncWeightVisualFromAxes(f, l);
  }

  function applyCornerEdit(corner, rawVal) {
    var f = Number($('frontWeightPct') && $('frontWeightPct').value);
    var l = Number($('leftWeightPct') && $('leftWeightPct').value);
    if (!isFinite(f)) f = 45;
    if (!isFinite(l)) l = 50;
    var target = clampNum(rawVal, 4, 64, 25);
    // Map corner edit onto the matching axle/side while keeping the other axis fixed.
    if (corner === 'fl') {
      // Prefer axle (front) when left is usable; else side.
      if (l > 0.5) f = clampNum(target * 100 / l, 20, 80, f);
      else l = clampNum(target * 100 / Math.max(f, 1), 20, 80, l);
    } else if (corner === 'fr') {
      var rt = 100 - l;
      if (rt > 0.5) f = clampNum(target * 100 / rt, 20, 80, f);
      else l = 100 - clampNum(target * 100 / Math.max(f, 1), 20, 80, 50);
    } else if (corner === 'rl') {
      var r = 100 - f;
      if (l > 0.5) {
        r = clampNum(target * 100 / l, 20, 80, r);
        f = 100 - r;
      } else {
        l = clampNum(target * 100 / Math.max(r, 1), 20, 80, l);
      }
    } else if (corner === 'rr') {
      var r2 = 100 - f;
      var rt2 = 100 - l;
      if (rt2 > 0.5) {
        r2 = clampNum(target * 100 / rt2, 20, 80, r2);
        f = 100 - r2;
      } else {
        l = 100 - clampNum(target * 100 / Math.max(r2, 1), 20, 80, 50);
      }
    }
    f = clampNum(f, 20, 80, 45);
    l = clampNum(l, 20, 80, 50);
    setAxisWeightFields(f, l);
  }

  function updateWeightSumHints(opts) {
    opts = opts || {};
    var f = Number($('frontWeightPct') && $('frontWeightPct').value);
    var r = Number($('rearWeightPct') && $('rearWeightPct').value);
    var l = Number($('leftWeightPct') && $('leftWeightPct').value);
    var rt = Number($('rightWeightPct') && $('rightWeightPct').value);
    var fr = $('weightFrHint');
    var lr = $('weightLrHint');
    if (fr) {
      var s = (isFinite(f) ? f : 0) + (isFinite(r) ? r : 0);
      fr.textContent = 'F/R sum ' + Math.round(s) + '%';
      fr.style.color = Math.abs(s - 100) < 0.6 ? '' : '#ff6b6b';
    }
    if (lr) {
      var s2 = (isFinite(l) ? l : 0) + (isFinite(rt) ? rt : 0);
      lr.textContent = 'L/R sum ' + Math.round(s2) + '%';
      lr.style.color = Math.abs(s2 - 100) < 0.6 ? '' : '#ff6b6b';
    }
    if (!opts.skipVisual) syncWeightVisualFromForm();
  }

  function readWeightDistributionFromForm(base) {
    var sug = Phys.suggestedWeightDistribution
      ? Phys.suggestedWeightDistribution(base || {})
      : { frontWeightPercent: 45, rearWeightPercent: 55, leftWeightPercent: 50, rightWeightPercent: 50 };
    var front = clampNum($('frontWeightPct') && $('frontWeightPct').value, 20, 80, sug.frontWeightPercent);
    var rear = clampNum($('rearWeightPct') && $('rearWeightPct').value, 20, 80, sug.rearWeightPercent);
    var left = clampNum($('leftWeightPct') && $('leftWeightPct').value, 20, 80, sug.leftWeightPercent);
    var right = clampNum($('rightWeightPct') && $('rightWeightPct').value, 20, 80, sug.rightWeightPercent);
    // Normalize pairs to 100 (rear/right absorb remainder)
    var fr = front + rear;
    if (fr > 0 && Math.abs(fr - 100) > 0.01) {
      rear = 100 - front;
    }
    var lr = left + right;
    if (lr > 0 && Math.abs(lr - 100) > 0.01) {
      right = 100 - left;
    }
    rear = clampNum(rear, 20, 80, 55);
    front = 100 - rear;
    right = clampNum(100 - left, 20, 80, 50);
    left = 100 - right;
    return {
      frontWeightPercent: front,
      rearWeightPercent: rear,
      leftWeightPercent: left,
      rightWeightPercent: right
    };
  }

  function applyCarToForm(car, opts) {
    opts = opts || {};
    state.car = car;
    if (!opts.keepPreset) {
      state.presetCar = JSON.parse(JSON.stringify(car));
      state.curveEdited = false;
    }
    $('carName').value = car.name || '';
    var hp = car.peakHp || Phys.peakHpFromCurve(car.torqueCurve || {}) || 450;
    $('peakHp').value = Math.round(hp);
    $('weightLbs').value = car.weightLbs;
    $('cd').value = car.dragCoefficient;
    $('area').value = car.frontalAreaSqFt;
    $('tireRadius').value = car.tireRadiusInches;
    $('driveType').value = car.driveType || 'RWD';
    syncWeightFieldsFromCar(car);
    $('finalDrive').value = car.finalDriveRatio;
    $('lossPct').value = car.drivetrainLossPercent != null ? car.drivetrainLossPercent : 15;
    $('launchRpm').value = car.launchRpm || 3000;
    $('shiftRpm').value = car.shiftRpm || 6500;
    $('redline').value = car.redline || 6800;
    $('shiftTime').value = car.shiftTimeSeconds != null ? car.shiftTimeSeconds : 0.10;
    if ($('speedLimiterMph')) {
      var limV = car.speedLimiterMph != null ? car.speedLimiterMph : car.topSpeedMph;
      $('speedLimiterMph').value = (limV != null && Number(limV) > 0) ? Math.round(Number(limV)) : '';
    }
    renderGears(car.gearRatios || []);
    updateTxPresetVisibility(car);
    // Power source / induction: EV + Hybrid are first-class; ICE uses baked boostModel
    var custom = isCustomBuilder(car);
    garagePowerLocked = !custom && (!!car.isEv || !!car.isHybrid || car.powerSource === 'ev' || car.powerSource === 'hybrid');
    var ind = 'na';
    if (car.isEv || car.powerSource === 'ev') ind = 'ev';
    else if (car.isHybrid || car.powerSource === 'hybrid') ind = 'hybrid';
    else if (car.powerSource === 'supercharger' || car.boostModel === 'supercharger') ind = 'supercharger';
    else if (car.powerSource === 'twincharge' || car.boostModel === 'twincharge') ind = 'twincharge';
    else if (car.powerSource === 'turbo' || car.boostModel === 'turbo' || car.isFI) ind = 'turbo';
    else ind = 'na';
    setInductionRadio(ind);
    syncInductionUi({
      forceEv: ind === 'ev',
      forceHybrid: ind === 'hybrid',
      lockedValue: garagePowerLocked ? ind : null
    });
    $('converter').value = car.hasAftermarketConverter ? '1' : '0';
    $('stallRpm').value = car.stallRpm || 2800;
    if ($('tireType') && car.tireType != null) $('tireType').value = String(car.tireType | 0);
    // Factory-reset: every new vehicle selection forces Unprepped (sticky prep across cars was the bug).
    if ($('trackPrep')) $('trackPrep').value = 'unprepped';
    configurePrimaryGauge(car);
    highlightGarage(car.id);
    // Show baked (or working) dyno curve immediately — dense 100-RPM mesh, editable bullets
    syncEvChartMode(car);
    syncPowerCurveFromCar(car);
    // Peak HP baseline for continuous curve scale (all garage + Custom; no wipe)
    stashPeakHpBaseline(car, Math.round(hp));
  }

  function highlightGarage(id) {
    document.querySelectorAll('.garage-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.id === id);
    });
  }

  function renderGarage() {
    var list = $('garageList');
    list.innerHTML = '';
    var q = (garageFilterText || '').toLowerCase().trim();
    var shown = 0;
    SAMPLE_CARS.forEach(function (c) {
      if (q) {
        var hay = ((c.name || '') + ' ' + (c.category || '') + ' ' + (c.peakHp || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return;
      }
      shown++;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'garage-item'; b.dataset.id = c.id;
      var psTag = c.isEv || c.powerSource === 'ev' ? 'EV'
        : (c.isHybrid || c.powerSource === 'hybrid' ? 'Hybrid'
        : (c.boostModel === 'supercharger' ? 'SC'
        : (c.boostModel === 'turbo' || c.isFI ? 'Turbo' : 'NA')));
      b.innerHTML = c.name + '<small>' + (c.category || 'Garage') + ' · ' + psTag + ' · ' + (c.peakHp || '?') + ' hp · ' + c.weightLbs + ' lb</small>';
      b.onclick = function () { applyCarToForm(JSON.parse(JSON.stringify(c))); /* resets preset + curve */ };
      list.appendChild(b);
    });
    if (!shown) {
      var empty = document.createElement('div');
      empty.className = 'garage-item';
      empty.textContent = 'No matches';
      empty.style.cursor = 'default';
      list.appendChild(empty);
    }
  }

  function readCarFromForm() {
    var peakHp = clampNum($('peakHp').value, 1, 15000, 450);
    var redline = clampNum($('redline').value, 2000, 28000, 6800); // EV tip: Cybertruck ~27k motor RPM @ FD 15.02
    var shiftRpm = clampNum($('shiftRpm').value, 1500, redline, 6500);
    var ind = inductionValue();
    var base = state.car || {};
    var car = {
      name: $('carName').value || 'Custom',
      weightLbs: clampNum($('weightLbs').value, 20, 120000, 3800),
      dragCoefficient: clampNum($('cd').value, 0.15, 1.2, 0.35),
      frontalAreaSqFt: clampNum($('area').value, 4, 80, 22.5),
      tireRadiusInches: clampNum($('tireRadius').value, 8, 24, 13.2),
      finalDriveRatio: clampNum($('finalDrive').value, 1.5, 20, 3.73), // Phase4: Cybertruck FD 15.02
      gearRatios: readGears(),
      drivetrainLossPercent: clampNum($('lossPct').value, 0, 35, 15),
      launchRpm: clampNum($('launchRpm').value, 800, redline, 3000),
      shiftRpm: shiftRpm,
      redline: redline,
      shiftTimeSeconds: clampNum($('shiftTime').value, 0.01, 1.0, 0.10),
      driveType: $('driveType').value,
      peakHp: peakHp,
      peakTqRpm: base.peakTqRpm || Math.round(redline * 0.55),
      peakHpRpm: base.peakHpRpm || Math.round(redline * 0.88),
      powerSource: ind,
      isEv: ind === 'ev',
      isHybrid: ind === 'hybrid',
      isNA: ind === 'na',
      isFI: ind === 'turbo' || ind === 'supercharger' || ind === 'twincharge' ||
        (ind === 'hybrid' && !!(base.isFI || base.boostModel === 'turbo' || base.boostModel === 'supercharger')),
      boostModel: (function () {
        if (ind === 'ev') return 'na';
        if (ind === 'hybrid') {
          // Keep underlying ICE induction from garage bake (e.g. ZR1X turbo)
          if (base.boostModel && base.boostModel !== 'na' && base.boostModel !== 'ev') return base.boostModel;
          return 'na';
        }
        if (ind === 'na') return 'na';
        return ind;
      })(),
      boostPsi: 0, // Boost PSI UI removed — garage dynos already include boost; multiplier was wiped on RUN
      hybridAssistFrac: ind === 'hybrid'
        ? (base.hybridAssistFrac != null ? Number(base.hybridAssistFrac) : 0.22)
        : undefined,
      hasAftermarketConverter: $('converter').value === '1',
      stallRpm: clampNum($('stallRpm').value, 1200, 7000, 2800),
      // Flash RPM UI removed — physics derives flash from stall when ATC is on
      forceScale: 1, // retired calib knob — physics ignores; garage bakes 1.0
      txKey: base.txKey || undefined, // keep baked factory TX key so gear-editor label survives RUN
      // Preserve Jorge blank-name flag ('' = hide guessed OEM label; ratios/FD stay on car)
      txFactoryLabel: Object.prototype.hasOwnProperty.call(base, 'txFactoryLabel') ? base.txFactoryLabel : undefined,
      tireType: parseInt($('tireType').value, 10) || 0,
      engineLayout: (ind === 'ev' && (base.driveType === 'AWD' || $('driveType').value === 'AWD'))
        ? (base.engineLayout === 'Mid' ? 'Mid' : 'Dual')
        : (base.engineLayout || 'Front'),
      torqueCurve: base.torqueCurve || null,
      speedLimiterMph: (function () {
        var el = $('speedLimiterMph');
        if (!el || el.value === '' || el.value == null) return undefined;
        var n = Number(el.value);
        if (!(n > 0) || !isFinite(n)) return undefined;
        return Math.min(300, Math.max(1, Math.round(n)));
      })(),
      // Preserve per-car EV factory TC / AWD launch bake (garage Excel match).
      // Dropping these made Pages RUN ignore evLaunch* → M3P ~3.49/11.9 vs Excel 2.9/11.0.
      evLaunchDriveMult: base.evLaunchDriveMult,
      evLaunchMuMult: base.evLaunchMuMult,
      evLaunchSlipTarget: base.evLaunchSlipTarget,
      category: base.category,
      cgHeightFeet: base.cgHeightFeet,
      cgHeightPublished: base.cgHeightPublished
    };
    var w = readWeightDistributionFromForm(base);
    car.frontWeightPercent = w.frontWeightPercent;
    car.rearWeightPercent = w.rearWeightPercent;
    car.leftWeightPercent = w.leftWeightPercent;
    car.rightWeightPercent = w.rightWeightPercent;
    // Peak HP → force for EVERY garage car + Custom Builder.
    // Continuous proportional scale of existing torqueCurve (preserve shape).
    // Every HP counts (±1 and small Δ). Never wipe / resynthesize an existing curve.
    // Synthesize ONLY when curve is absent (blank Custom). Dyno drag-edit restashes
    // baseline via commitEditedCurveToCar so RUN does not re-scale an edited curve.
    if (!car.torqueCurve) {
      car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, redline, car.peakHpRpm);
      stashPeakHpBaseline(car, peakHp);
    } else {
      var scaled = scaleCurveForPeakHpChange(peakHp, redline);
      if (scaled) car.torqueCurve = scaled;
    }
    // ICE only — EV shelf curves must not be post-peak sanitized (see syncPowerCurveFromCar).
    if (car.torqueCurve && Phys.sanitizeTorqueCurvePostPeak && !car.isEv) {
      Phys.sanitizeTorqueCurvePostPeak(car.torqueCurve, car.peakHpRpm);
    }
    // Dyno curves already include boost — don't double-apply for garage FI cars unless boostPsi set
    // Keep hybrid/EV powerSource identity; only clear FI boostModel multiplier when PSI is 0.
    if (base.torqueCurve && (car.boostPsi <= 0 || base.boostPsi === 0)) {
      if (car.isEv) {
        car.boostModel = 'na';
        car.boostPsi = 0;
      } else if (car.isHybrid) {
        // Retain underlying ICE boostModel label; PSI stays 0 so boostTorqueMult is identity
        car.boostPsi = 0;
      } else {
        car.boostModel = 'na';
        car.boostPsi = 0;
      }
    }
    return car;
  }

  function readEnv() {
    var daRaw = $('daFt').value;
    var tireType = parseInt($('tireType').value, 10) || 0;
    var trackPrepEl = $('trackPrep');
    var trackPrep = trackPrepEl ? trackPrepEl.value : 'unprepped';
    if (Phys.normalizeTrackPrep) trackPrep = Phys.normalizeTrackPrep(trackPrep);
    var tireLab = Phys.tireLabelForType
      ? Phys.tireLabelForType(tireType)
      : ({0:'Street',1:'Drag Radial',2:'Slick',3:'Summer',4:'UHP',5:'R-Compound'}[tireType] || 'Street');
    var prepLab = Phys.trackPrepLabel ? Phys.trackPrepLabel(trackPrep) : trackPrep;
    var dwEl = $('driverWeightLbs');
    return {
      tempF: clampNum($('tempF').value, -40, 140, 59),
      humidity: clampNum($('humidity').value, 0, 100, 45),
      pressureInHg: clampNum($('pressure').value, 20, 32, 29.92),
      densityAltitudeFtInput: daRaw === '' ? null : clampNum(daRaw, -2000, 15000, 0),
      windSpeedMph: clampNum($('windMph').value, 0, 80, 0),
      windDirDeg: clampNum($('windDir').value, 0, 360, 0),
      gustMph: clampNum($('gustMph').value, 0, 60, 0),
      tireType: tireType,
      trackPrep: trackPrep,
      launchMode: $('launchMode').value,
      tireLabel: tireLab + ' · ' + prepLab,
      // Sticky env field (like temp) — default 200; not wiped on car load
      driverWeightLbs: clampNum(dwEl ? dwEl.value : 200, 0, 500, 200)
    };
  }

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function niceStep(maxVal, targetTicks) {
    if (!(maxVal > 0)) return 1;
    var raw = maxVal / Math.max(1, targetTicks);
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / pow;
    var nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * pow;
  }

  function samplePowerAtRpm(powerCurve, rpm) {
    if (!powerCurve || !powerCurve.length) return null;
    if (rpm <= powerCurve[0].rpm) return powerCurve[0];
    var last = powerCurve[powerCurve.length - 1];
    if (rpm >= last.rpm) return last;
    for (var i = 0; i < powerCurve.length - 1; i++) {
      var a = powerCurve[i], b = powerCurve[i + 1];
      if (rpm >= a.rpm && rpm <= b.rpm) {
        var u = (rpm - a.rpm) / Math.max(1e-9, b.rpm - a.rpm);
        return {
          rpm: rpm,
          torque: a.torque + (b.torque - a.torque) * u,
          horsepower: a.horsepower + (b.horsepower - a.horsepower) * u
        };
      }
    }
    return last;
  }

  function updateDynoReadout(powerCurve, cursorRpm) {
    var peakEl = $('dynoPeak');
    var curEl = $('dynoCursor');
    if (!peakEl || !curEl) return;
    if (!powerCurve || !powerCurve.length) {
      peakEl.textContent = '—';
      curEl.textContent = '—';
      return;
    }
    var cap = Number(state.car && state.car.peakHp);
    if (!(cap > 0)) cap = null;
    var peakHp = 0, peakTq = 0, peakHpRpm = 0, peakTqRpm = 0;
    powerCurve.forEach(function (p) {
      var hp = p.horsepower;
      if (cap != null && hp > cap) hp = cap;
      if (hp > peakHp) { peakHp = hp; peakHpRpm = p.rpm; }
      if (p.torque > peakTq) { peakTq = p.torque; peakTqRpm = p.rpm; }
    });
    peakEl.textContent =
      Math.round(peakHp) + ' hp @ ' + Math.round(peakHpRpm) +
      ' · ' + Math.round(peakTq) + ' lb-ft @ ' + Math.round(peakTqRpm);
    var pt = samplePowerAtRpm(powerCurve, cursorRpm != null ? cursorRpm : peakHpRpm);
    if (!pt) { curEl.textContent = '—'; return; }
    var curHp = pt.horsepower;
    if (cap != null && curHp > cap) curHp = cap;
    curEl.textContent =
      Math.round(pt.rpm) + ' rpm · ' +
      curHp.toFixed(0) + ' hp · ' +
      pt.torque.toFixed(0) + ' lb-ft';
  }


  /** Toggle primary chart: ICE editable dyno vs EV power-delivery vs speed. */
  function syncEvChartMode(car) {
    car = car || state.car;
    var ev = isEvMode(car);
    var label = $('powerChartLabel');
    var title = $('instrumentsTitle');
    if (title) {
      title.textContent = ev
        ? 'Instruments · EV Power Delivery · Speed Path'
        : 'Instruments · Dyno · Speed Path';
    }
    if (label) {
      label.textContent = ev
        ? 'EV power delivery vs speed · motor kW + Power% vs mph (curve × gearing) · hover scrub · not an ICE dyno'
        : 'HP / TQ vs RPM · drag TQ bullets (majors every 200 rpm · 100-RPM mesh) · HP≈TQ×RPM/5252 · hover scrub';
    }
    state.evChartMode = !!ev;
    if (ev) {
      drawEvPowerDeliveryChart(car, state.evCursorMph);
    } else if (state.powerCurve && state.powerCurve.length) {
      drawPowerCurve(state.powerCurve, state.cursorRpm);
    }
  }

  /** Theoretical EV power vs road speed from motor curve + single-speed ratio. */
  function buildEvPowerDeliverySeries(car) {
    car = car || state.car || {};
    var curve = car.torqueCurve || {};
    var gears = car.gearRatios || [1];
    var gear = Number(gears[0]) || 1;
    var fd = Number(car.finalDriveRatio) || 9;
    var tireIn = Number(car.tireRadiusInches) || 13.2;
    var tireM = tireIn * 0.0254;
    var redline = Number(car.redline) || 14000;
    var peakHp = Math.max(
      1,
      Number(car.peakHp) || (Phys.peakHpFromCurve ? Phys.peakHpFromCurve(curve) : 1) || 1
    );
    var lim = Number(car.speedLimiterMph) || Number(car.topSpeedMph) || 0;
    var maxMph = lim > 0 ? lim : Math.min(220, Math.max(120, peakHp / 4));
    var pts = [];
    for (var mph = 0; mph <= maxMph + 0.01; mph += 2) {
      var v = mph * 0.44704;
      var wheelRpm = tireM > 0 ? (v / (2 * Math.PI * tireM)) * 60 : 0;
      var motorRpm = Math.min(redline, wheelRpm * gear * fd);
      var tq = 0;
      if (Phys.getTorqueAtRpm) tq = Phys.getTorqueAtRpm(curve, motorRpm) || 0;
      else if (Phys.torqueAtRpm) tq = Phys.torqueAtRpm(curve, motorRpm) || 0;
      else {
        var key = Math.round(motorRpm / 100) * 100;
        tq = Number(curve[key]) || Number(curve[String(key)]) || 0;
      }
      if (!(tq > 0)) tq = 0;
      var hp = (tq * motorRpm) / 5252;
      var kw = hp * 0.7457;
      var pct = Math.max(0, Math.min(100, (hp / peakHp) * 100));
      pts.push({ mph: mph, rpm: motorRpm, torque: tq, horsepower: hp, kw: kw, powerPct: pct });
    }
    return { points: pts, peakHp: peakHp, maxMph: maxMph, limiterMph: lim > 0 ? lim : null };
  }

  function updateEvDeliveryReadout(series, cursorMph) {
    var peakEl = $('dynoPeak');
    var curEl = $('dynoCursor');
    if (!peakEl || !curEl) return;
    if (!series || !series.points || !series.points.length) {
      peakEl.textContent = '—';
      curEl.textContent = '—';
      return;
    }
    var peak = series.points[0];
    for (var i = 1; i < series.points.length; i++) {
      if (series.points[i].kw > peak.kw) peak = series.points[i];
    }
    peakEl.textContent =
      Math.round(peak.kw) + ' kW (' + Math.round(peak.horsepower) + ' hp) @ ' +
      Math.round(peak.mph) + ' mph · peak ' + Math.round(series.peakHp) + ' hp';
    var mph = cursorMph != null ? cursorMph : peak.mph;
    var pt = series.points[0];
    for (var j = 0; j < series.points.length; j++) {
      if (Math.abs(series.points[j].mph - mph) < Math.abs(pt.mph - mph)) pt = series.points[j];
    }
    curEl.textContent =
      Math.round(pt.mph) + ' mph · ' +
      pt.kw.toFixed(0) + ' kW · ' +
      pt.powerPct.toFixed(0) + '% · ' +
      Math.round(pt.rpm) + ' motor rpm';
  }

  function drawEvPowerDeliveryChart(car, cursorMph) {
    var canvas = $('powerChart');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 600;
    var h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, h);

    var series = buildEvPowerDeliverySeries(car);
    state.evDeliverySeries = series;
    state.chartGeom = null;
    state.evChartMode = true;

    if (!series.points.length) {
      ctx.fillStyle = '#667084';
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.fillText('EV power delivery vs speed — select an EV or Custom → EV', 16, h / 2);
      updateEvDeliveryReadout(null, null);
      return;
    }

    var pad = { l: 48, r: 48, t: 22, b: 32 };
    var maxMph = series.maxMph || series.points[series.points.length - 1].mph;
    var maxKw = 0;
    series.points.forEach(function (p) { if (p.kw > maxKw) maxKw = p.kw; });
    maxKw = Math.max(40, maxKw * 1.12);

    function xMph(mph) {
      return pad.l + (mph / Math.max(1, maxMph)) * (w - pad.l - pad.r);
    }
    function yKw(v) {
      return h - pad.b - (v / maxKw) * (h - pad.t - pad.b);
    }
    function yPct(v) {
      return h - pad.b - (v / 100) * (h - pad.t - pad.b);
    }

    state.evChartGeom = { pad: pad, w: w, h: h, maxMph: maxMph, maxKw: maxKw, x: xMph };

    ctx.font = '10px ui-monospace, monospace';
    ctx.lineWidth = 1;
    var gi;
    for (gi = 0; gi <= 4; gi++) {
      var kv = (maxKw * gi) / 4;
      var yy = yKw(kv);
      ctx.strokeStyle = 'rgba(215,196,160,0.18)';
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillStyle = '#c8ff4a';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(kv)), pad.l - 6, yy + 3);
    }
    ctx.textAlign = 'left';
    for (gi = 0; gi <= 100; gi += 25) {
      var yp = yPct(gi);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText(gi + '%', w - pad.r + 6, yp + 3);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa6b8';
    var mphStep = maxMph > 180 ? 40 : (maxMph > 100 ? 20 : 10);
    for (var m = 0; m <= maxMph + 0.01; m += mphStep) {
      var xx = xMph(m);
      ctx.strokeStyle = 'rgba(215,196,160,0.12)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, h - pad.b); ctx.stroke();
      ctx.fillText(String(Math.round(m)), xx, h - 8);
    }

    ctx.beginPath();
    series.points.forEach(function (pt, idx) {
      var px = xMph(pt.mph), py = yPct(pt.powerPct);
      if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = 'rgba(76,201,240,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    series.points.forEach(function (pt, idx) {
      var px = xMph(pt.mph), py = yKw(pt.kw);
      if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#c8ff4a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (series.limiterMph) {
      var lx = xMph(series.limiterMph);
      ctx.strokeStyle = 'rgba(255,107,107,0.85)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(lx, pad.t); ctx.lineTo(lx, h - pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff6b6b';
      ctx.textAlign = 'center';
      ctx.fillText('Limiter ' + Math.round(series.limiterMph), lx, pad.t + 10);
    }

    var cMph = cursorMph != null ? cursorMph : state.evCursorMph;
    if (cMph == null) {
      cMph = series.points.reduce(function (b, p) {
        return p.kw > b.kw ? p : b;
      }, series.points[0]).mph;
    }
    cMph = Math.max(0, Math.min(maxMph, cMph));
    state.evCursorMph = cMph;
    var cx = xMph(cMph);
    ctx.strokeStyle = 'rgba(232,215,176,0.85)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, h - pad.b); ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#c8ff4a';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('kW', pad.l, 12);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillText('Power %', pad.l + 28, 12);
    ctx.fillStyle = '#9aa6b8';
    ctx.textAlign = 'right';
    ctx.fillText('mph →', w - pad.r, 12);

    updateEvDeliveryReadout(series, cMph);
  }

  function mphFromPointer(ev) {
    var canvas = $('powerChart');
    var g = state.evChartGeom;
    if (!canvas || !g) return null;
    var rect = canvas.getBoundingClientRect();
    var clientX = ev.clientX;
    if (clientX == null && ev.touches && ev.touches[0]) clientX = ev.touches[0].clientX;
    if (clientX == null && ev.changedTouches && ev.changedTouches[0]) clientX = ev.changedTouches[0].clientX;
    var mx = clientX - rect.left;
    var frac = (mx - g.pad.l) / Math.max(1, g.w - g.pad.l - g.pad.r);
    frac = Math.max(0, Math.min(1, frac));
    return frac * g.maxMph;
  }

  function drawPowerCurve(powerCurve, cursorRpm) {
    // EV: replace ICE dyno (TQ bullets vs RPM) with power delivery vs speed
    if (isEvMode(state.car)) {
      drawEvPowerDeliveryChart(state.car, state.evCursorMph);
      return;
    }
    state.evChartMode = false;
    var canvas = $('powerChart');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 600;
    var h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, h);
    state.powerCurve = powerCurve || [];
    if (cursorRpm != null) state.cursorRpm = cursorRpm;
    if (!powerCurve || !powerCurve.length) {
      ctx.fillStyle = '#667084';
      ctx.font = '12px Segoe UI';
      ctx.fillText('Run a simulation to plot HP / TQ vs RPM', 16, h / 2);
      state.chartGeom = null;
      updateDynoReadout([], null);
      return;
    }
    var pad = { l: 48, r: 48, t: 22, b: 32 };
    var minRpm = powerCurve[0].rpm;
    var maxRpm = powerCurve[powerCurve.length - 1].rpm;
    var maxHp = 0, maxTq = 0;
    var peakCap = Number(state.car && state.car.peakHp);
    powerCurve.forEach(function (p) {
      var hpPlot = p.horsepower;
      // Chart / peaks respect vehicle Peak HP (tiny rounding only)
      if (peakCap > 0 && hpPlot > peakCap) hpPlot = peakCap;
      if (hpPlot > maxHp) maxHp = hpPlot;
      if (p.torque > maxTq) maxTq = p.torque;
    });
    // Shared numeric scale so HP = TQ×RPM/5252 crosses at ~5252 on the chart
    var axisMax = Math.max(50, Math.max(maxHp, maxTq) * 1.12);
    maxHp = axisMax;
    maxTq = axisMax;
    if (state.drag && state.drag.axisMaxTq) {
      // Keep scrub axes locked + shared so crossover identity holds while editing
      var dragAxis = Math.max(state.drag.axisMaxTq, state.drag.axisMaxHp || 0);
      maxTq = dragAxis;
      maxHp = dragAxis;
    }
    function x(rpm) {
      return pad.l + ((rpm - minRpm) / (maxRpm - minRpm || 1)) * (w - pad.l - pad.r);
    }
    function yHp(v) { return h - pad.b - (v / maxHp) * (h - pad.t - pad.b); }
    function yTq(v) { return h - pad.b - (v / maxTq) * (h - pad.t - pad.b); }
    state.chartGeom = { pad: pad, w: w, h: h, minRpm: minRpm, maxRpm: maxRpm, maxTq: maxTq, maxHp: maxHp, x: x, yTq: yTq, yHp: yHp };

    // Grid + numeric axis ticks
    ctx.font = '10px ui-monospace, monospace';
    ctx.lineWidth = 1;
    var hpStep = niceStep(maxHp, 4);
    for (var hv = 0; hv <= maxHp + 0.01; hv += hpStep) {
      var yy = yHp(hv);
      ctx.strokeStyle = 'rgba(215,196,160,0.18)';
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillStyle = '#c8ff4a';
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(hv)), pad.l - 6, yy + 3);
    }
    var tqStep = niceStep(maxTq, 4);
    ctx.textAlign = 'left';
    for (var tv = 0; tv <= maxTq + 0.01; tv += tqStep) {
      var yyt = yTq(tv);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText(String(Math.round(tv)), w - pad.r + 6, yyt + 3);
    }
    var rpmStep = niceStep(maxRpm - minRpm, 5);
    var rpmStart = Math.ceil(minRpm / rpmStep) * rpmStep;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa6b8';
    for (var rv = rpmStart; rv <= maxRpm + 0.01; rv += rpmStep) {
      var xx = x(rv);
      ctx.strokeStyle = 'rgba(215,196,160,0.12)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, h - pad.b); ctx.stroke();
      ctx.fillText(String(Math.round(rv)), xx, h - 8);
    }

    // TQ then HP curves
    ctx.beginPath();
    powerCurve.forEach(function (p, i) {
      var px = x(p.rpm), py = yTq(p.torque);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2; ctx.stroke();

    ctx.beginPath();
    powerCurve.forEach(function (p, i) {
      // Always plot HP from TQ identity; cap at vehicle Peak HP
      var hpDraw = (p.torque * p.rpm) / 5252;
      if (peakCap > 0 && hpDraw > peakCap) hpDraw = peakCap;
      var px = x(p.rpm), py = yHp(hpDraw);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#c8ff4a'; ctx.lineWidth = 2.5; ctx.stroke();


    // Editable TQ bullets on the dense 100-RPM mesh (major every 200 for visibility)
    var handles = [];
    powerCurve.forEach(function (p, i) {
      var rpm = Math.round(p.rpm);
      if (rpm % RPM_GRID !== 0) return;
      var hx = x(p.rpm), hy = yTq(p.torque);
      var major = rpm % RPM_MAJOR === 0;
      handles.push({ rpm: rpm, torque: p.torque, x: hx, y: hy, index: i, major: major });
      ctx.beginPath();
      ctx.arc(hx, hy, major ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = major ? 'rgba(76,201,240,0.95)' : 'rgba(76,201,240,0.55)';
      ctx.fill();
      if (major) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(232,215,176,0.9)';
        ctx.stroke();
      }
    });
    state.chartGeom.handles = handles;

    // Cursor scrubber
    var cRpm = cursorRpm != null ? cursorRpm : state.cursorRpm;
    if (cRpm == null) cRpm = powerCurve.reduce(function (best, p) {
      return p.horsepower > best.horsepower ? p : best;
    }, powerCurve[0]).rpm;
    cRpm = Math.max(minRpm, Math.min(maxRpm, cRpm));
    var cPt = samplePowerAtRpm(powerCurve, cRpm);
    var cx = x(cRpm);
    ctx.strokeStyle = 'rgba(232,215,176,0.85)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, h - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    if (cPt) {
      ctx.fillStyle = '#c8ff4a';
      ctx.beginPath(); ctx.arc(cx, yHp(cPt.horsepower), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath(); ctx.arc(cx, yTq(cPt.torque), 3.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#c8ff4a'; ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('HP', pad.l, 12);
    ctx.fillStyle = '#4cc9f0'; ctx.fillText('TQ lb-ft', pad.l + 28, 12);
    ctx.fillStyle = '#9aa6b8'; ctx.textAlign = 'right';
    ctx.fillText('RPM →', w - pad.r, 12);
    ctx.textAlign = 'left';

    updateDynoReadout(powerCurve, cRpm);
  }

  function resetSpeedChartView() {
    state.speedChartView = { xMinFt: 0, xMaxFt: null };
  }

  /** Full-run X domain (feet) — path to Vmax, not a hard 2640-only window. */
  function speedChartFullDomainFt(timeline, result) {
    var runEnd = 0;
    if (timeline && timeline.length) {
      runEnd = Number(timeline[timeline.length - 1].feet) || 0;
    }
    var vmaxFt = (result && result.topSpeedFeet != null) ? Number(result.topSpeedFeet) : 0;
    var maxFt = Math.max(runEnd, vmaxFt, 60);
    // Small pad past end so Vmax tip isn't glued to the right edge
    return Math.max(60, maxFt * 1.02);
  }

  function speedChartWindow(timeline, result) {
    var full = speedChartFullDomainFt(timeline, result);
    var v = state.speedChartView || { xMinFt: 0, xMaxFt: null };
    var xMin = Math.max(0, Number(v.xMinFt) || 0);
    var xMax = (v.xMaxFt == null || !isFinite(Number(v.xMaxFt))) ? full : Number(v.xMaxFt);
    if (xMax <= xMin + 20) xMax = Math.min(full, xMin + 20);
    if (xMax > full) xMax = full;
    if (xMin > xMax - 20) xMin = Math.max(0, xMax - 20);
    var zoomed = (xMin > 0.5) || (xMax < full - 1);
    return { xMin: xMin, xMax: xMax, full: full, zoomed: zoomed };
  }

  /** Classic marks + denser early set when zoomed into ≤¼-mi detail. */
  function speedChartTickMarks(xMin, xMax, zoomed) {
    var classic = [0, 60, 330, 660, 1000, 1320, 2640, 3960, 5280, 7920, 10560, 14520];
    var span = xMax - xMin;
    var marks;
    if (zoomed && span <= 1500) {
      // Dense detail ticks for early ¼-mi zoom
      marks = [];
      var step = span <= 400 ? 50 : (span <= 800 ? 100 : 165);
      var start = Math.floor(xMin / step) * step;
      for (var t = start; t <= xMax + 0.5; t += step) {
        if (t >= xMin - 0.5) marks.push(Math.round(t));
      }
      // Always include classic anchors that fall inside
      classic.forEach(function (ft) {
        if (ft >= xMin - 0.5 && ft <= xMax + 0.5 && marks.indexOf(ft) < 0) marks.push(ft);
      });
      marks.sort(function (a, b) { return a - b; });
    } else if (!zoomed || span > 3000) {
      // Full Vmax / wide view — classic + extras that fit without crowding
      marks = classic.filter(function (ft) {
        return ft >= xMin - 0.5 && ft <= xMax + 0.5;
      });
      if (marks.indexOf(0) < 0 && xMin <= 0) marks.unshift(0);
      // Ensure end mark near domain
      var endApprox = Math.round(xMax);
      if (marks.length && Math.abs(marks[marks.length - 1] - endApprox) > span * 0.04) {
        marks.push(endApprox);
      }
    } else {
      marks = classic.filter(function (ft) {
        return ft >= xMin - 0.5 && ft <= xMax + 0.5;
      });
      if (!marks.length || marks[0] > xMin + 1) marks.unshift(Math.round(xMin));
      if (marks[marks.length - 1] < xMax - 1) marks.push(Math.round(xMax));
    }
    return marks;
  }

  /**
   * Display-only dense, shape-preserving stroke through TRUE physics g samples.
   * Fritsch-Carlson monotone Hermite interpolation keeps every physics sample
   * as an exact knot, preserves real launch/shift extrema, and cannot overshoot
   * the adjacent true-sample envelope.
   */
  function densifyGStroke(feetArr, gArr, xs, ys, xFn, yGFn, factor) {
    var n = gArr.length;
    if (!n) return 0;
    var fac = factor == null ? 32 : Math.max(1, factor);
    var slopes = new Array(n);
    var sec = new Array(Math.max(0, n - 1));
    var i;
    for (i = 0; i < n; i++) slopes[i] = 0;
    for (i = 0; i < n - 1; i++) {
      var dx = feetArr[i + 1] - feetArr[i];
      sec[i] = Math.abs(dx) > 1e-9 ? (gArr[i + 1] - gArr[i]) / dx : 0;
    }
    if (n > 1) {
      slopes[0] = sec[0];
      slopes[n - 1] = sec[n - 2];
    }
    for (i = 1; i < n - 1; i++) {
      if (sec[i - 1] * sec[i] <= 0) {
        slopes[i] = 0;
      } else {
        var h0 = feetArr[i] - feetArr[i - 1];
        var h1 = feetArr[i + 1] - feetArr[i];
        slopes[i] = (3 * (h0 + h1)) /
          ((2 * h1 + h0) / sec[i - 1] + (2 * h0 + h1) / sec[i]);
      }
    }
    // Fritsch-Carlson limiter: every interval stays between its true knots.
    for (i = 0; i < n - 1; i++) {
      if (Math.abs(sec[i]) < 1e-12) {
        slopes[i] = 0;
        slopes[i + 1] = 0;
        continue;
      }
      var a = slopes[i] / sec[i];
      var b = slopes[i + 1] / sec[i];
      var norm = a * a + b * b;
      if (norm > 9) {
        var scale = 3 / Math.sqrt(norm);
        slopes[i] = scale * a * sec[i];
        slopes[i + 1] = scale * b * sec[i];
      }
    }

    var k = 0;
    xs[k] = xFn(feetArr[0]);
    ys[k] = yGFn(gArr[0]);
    k++;
    for (i = 0; i < n - 1; i++) {
      var f0 = feetArr[i], f1 = feetArr[i + 1];
      var g0 = gArr[i], g1 = gArr[i + 1];
      var h = f1 - f0;
      for (var step = 1; step <= fac; step++) {
        var u = step / fac;
        var g;
        if (Math.abs(h) < 1e-9) {
          g = g1;
        } else {
          var u2 = u * u, u3 = u2 * u;
          var h00 = 2 * u3 - 3 * u2 + 1;
          var h10 = u3 - 2 * u2 + u;
          var h01 = -2 * u3 + 3 * u2;
          var h11 = u3 - u2;
          g = h00 * g0 + h10 * h * slopes[i] +
            h01 * g1 + h11 * h * slopes[i + 1];
          // Defensive clamp: no display-only peak beyond the local true envelope.
          var lo = g0 < g1 ? g0 : g1;
          var hi = g0 > g1 ? g0 : g1;
          g = Math.max(lo, Math.min(hi, g));
        }
        var feet = f0 + u * h;
        xs[k] = xFn(feet);
        ys[k] = yGFn(g);
        k++;
      }
    }
    return k;
  }

  function drawSpeedPath(timeline, result) {
    var canvas = $('speedChart');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 600;
    var h = canvas.clientHeight || 200;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, w, h);
    if (!timeline || !timeline.length) {
      ctx.fillStyle = '#667084';
      ctx.font = '12px Segoe UI';
      ctx.fillText('Speed vs distance appears after a run', 16, h / 2);
      state.speedChartGeom = null;
      return;
    }
    // Room for MPH (L), g (R), ft + time (B), legend (T)
    var pad = { l: 42, r: 44, t: 24, b: 42 };
    var win = speedChartWindow(timeline, result);
    var xMin = win.xMin;
    var xMax = win.xMax;
    var spanFt = Math.max(20, xMax - xMin);

    // Clip / interpolate samples to the view window
    var plot = [];
    for (var ci = 0; ci < timeline.length; ci++) {
      var cp = timeline[ci];
      var ft = cp.feet;
      if (ft < xMin) {
        // keep walking; may interpolate at xMin when we cross
        if (ci + 1 < timeline.length && timeline[ci + 1].feet >= xMin) {
          var nx = timeline[ci + 1];
          var sp0 = nx.feet - cp.feet;
          if (sp0 > 1e-6) {
            var u0 = (xMin - cp.feet) / sp0;
            plot.push({
              feet: xMin,
              mph: cp.mph + u0 * (nx.mph - cp.mph),
              t: cp.t + u0 * (nx.t - cp.t),
              gear: nx.gear,
              g: (typeof cp.g === 'number' && typeof nx.g === 'number')
                ? cp.g + u0 * (nx.g - cp.g)
                : (typeof nx.g === 'number' ? nx.g : cp.g)
            });
          }
        }
        continue;
      }
      if (ft <= xMax) {
        plot.push(cp);
      } else {
        if (plot.length) {
          var prev = timeline[ci - 1] || plot[plot.length - 1];
          var span = cp.feet - prev.feet;
          if (span > 1e-6) {
            var u = (xMax - prev.feet) / span;
            plot.push({
              feet: xMax,
              mph: prev.mph + u * (cp.mph - prev.mph),
              t: prev.t + u * (cp.t - prev.t),
              gear: cp.gear,
              g: (typeof prev.g === 'number' && typeof cp.g === 'number')
                ? prev.g + u * (cp.g - prev.g)
                : (typeof cp.g === 'number' ? cp.g : prev.g)
            });
          }
        }
        break;
      }
    }
    if (!plot.length) plot = timeline.slice(0, 1);

    var maxMph = 0;
    var maxG = 0.01;
    var minG = 0;
    var hasStoredG = false;
    for (var i = 0; i < plot.length; i++) {
      var p = plot[i];
      if (p.mph > maxMph) maxMph = p.mph;
      if (typeof p.g === 'number') {
        hasStoredG = true;
        if (p.g > maxG) maxG = p.g;
        if (p.g < minG) minG = p.g;
      }
    }
    if (result && result.topSpeedMph && result.topSpeedMph > maxMph) {
      maxMph = result.topSpeedMph;
    }
    var gSeries = new Array(plot.length);
    for (var gi = 0; gi < plot.length; gi++) {
      if (hasStoredG && typeof plot[gi].g === 'number') {
        gSeries[gi] = plot[gi].g;
      } else if (gi === 0) {
        gSeries[gi] = 0;
      } else {
        var dt = plot[gi].t - plot[gi - 1].t;
        if (dt > 1e-6) {
          var dvMph = plot[gi].mph - plot[gi - 1].mph;
          gSeries[gi] = (dvMph * 1.46667 / dt) / 32.174;
        } else {
          gSeries[gi] = gSeries[gi - 1] || 0;
        }
        if (gSeries[gi] > maxG) maxG = gSeries[gi];
        if (gSeries[gi] < minG) minG = gSeries[gi];
      }
    }
    maxMph = Math.max(60, maxMph * 1.08);
    var gLo = Math.min(0, minG) - 0.05;
    var gHi = Math.max(0.5, maxG * 1.15);
    function x(ft) { return pad.l + ((ft - xMin) / spanFt) * (w - pad.l - pad.r); }
    function yMph(mph) { return h - pad.b - (mph / maxMph) * (h - pad.t - pad.b); }
    function yG(g) { return h - pad.b - ((g - gLo) / (gHi - gLo)) * (h - pad.t - pad.b); }

    state.speedChartGeom = {
      pad: pad, xMin: xMin, xMax: xMax, full: win.full,
      w: w, h: h, plotW: w - pad.l - pad.r, zoomed: win.zoomed
    };

    // Horizontal grid
    ctx.strokeStyle = 'rgba(215,196,160,0.18)';
    ctx.lineWidth = 1;
    for (var hi = 0; hi < 4; hi++) {
      var yy = pad.t + ((h - pad.t - pad.b) * hi) / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }

    var marks = speedChartTickMarks(xMin, xMax, win.zoomed);

    function timeAtFeet(ft) {
      if (!timeline.length) return null;
      if (ft <= timeline[0].feet) return timeline[0].t;
      for (var ti = 1; ti < timeline.length; ti++) {
        if (timeline[ti].feet >= ft) {
          var a = timeline[ti - 1], b = timeline[ti];
          var spn = b.feet - a.feet;
          if (spn < 1e-6) return b.t;
          var uu = (ft - a.feet) / spn;
          return a.t + uu * (b.t - a.t);
        }
      }
      return timeline[timeline.length - 1].t;
    }

    ctx.setLineDash([4, 4]);
    marks.forEach(function (ft) {
      if (ft === 0 && xMin <= 0) return;
      var xx = x(ft);
      if (xx < pad.l - 1 || xx > w - pad.r + 1) return;
      ctx.strokeStyle = 'rgba(76,201,240,0.32)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, h - pad.b); ctx.stroke();
    });
    ctx.setLineDash([]);

    // g-force overlay — dense orange Dragy-like stroke through TRUE samples.
    // No Hann, jitter, or invented peaks: only shape-preserving interpolation.
    var gFeet = new Array(plot.length);
    for (var gf = 0; gf < plot.length; gf++) gFeet[gf] = plot[gf].feet;
    var densFac = 32;
    var gMaxPts = plot.length < 1 ? 0 : (plot.length - 1) * densFac + 1;
    var gXs = new Array(gMaxPts);
    var gYs = new Array(gMaxPts);
    var gN = densifyGStroke(gFeet, gSeries, gXs, gYs, x, yG, densFac);
    ctx.beginPath();
    if (gN > 0) {
      ctx.moveTo(gXs[0], gYs[0]);
      for (var gj = 1; gj < gN; gj++) ctx.lineTo(gXs[gj], gYs[gj]);
    }
    ctx.strokeStyle = 'rgba(255,180,105,0.9)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (gLo < 0 && gHi > 0) {
      ctx.strokeStyle = 'rgba(255,180,105,0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      var zgy = yG(0);
      ctx.beginPath(); ctx.moveTo(pad.l, zgy); ctx.lineTo(w - pad.r, zgy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Speed curve (primary green)
    ctx.beginPath();
    plot.forEach(function (pt, idx) {
      var px = x(pt.feet), py = yMph(pt.mph);
      if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#c8ff4a'; ctx.lineWidth = 2.2; ctx.stroke();

    // Shift MPH markers inside view
    var shifts = (result && result.shifts && result.shifts.length) ? result.shifts.slice() : [];
    if (!shifts.length) {
      var prevGear = plot[0].gear;
      for (var si = 1; si < plot.length; si++) {
        if (plot[si].gear > prevGear) {
          shifts.push({
            gear: plot[si].gear,
            mph: plot[si].mph,
            feet: plot[si].feet,
            t: plot[si].t
          });
          prevGear = plot[si].gear;
        } else if (plot[si].gear < prevGear) {
          prevGear = plot[si].gear;
        }
      }
    }
    shifts.forEach(function (sh, sIdx) {
      if (sh.feet == null || sh.feet < xMin - 0.5 || sh.feet > xMax + 0.5) return;
      var sx = x(sh.feet);
      var sy = yMph(sh.mph);
      ctx.strokeStyle = 'rgba(255,180,70,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, h - pad.b); ctx.stroke();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx + 4.5, sy);
      ctx.lineTo(sx, sy + 5);
      ctx.lineTo(sx - 4.5, sy);
      ctx.closePath();
      ctx.fill();
      var label = 'G' + sh.gear + ' ' + Math.round(sh.mph);
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = '#ffd089';
      var lw = ctx.measureText(label).width;
      var lx = Math.min(Math.max(sx - lw / 2, pad.l), w - pad.r - lw);
      var above = (sIdx % 2 === 0);
      var ly = above
        ? Math.max(sy - 10, pad.t + 10)
        : Math.min(sy + 14, h - pad.b - 28);
      ctx.fillText(label, lx, ly);
    });

    // Vmax red tip — on-curve when inside view; edge cue when beyond window
    if (result && result.topSpeedMph) {
      var vmaxFt = result.topSpeedFeet;
      var vmaxBeyond = !(vmaxFt != null) || vmaxFt > xMax + 0.5 || vmaxFt < xMin - 0.5;
      var tx, ty;
      ctx.fillStyle = '#ff3355';
      if (vmaxBeyond && vmaxFt != null && vmaxFt > xMax) {
        tx = w - pad.r;
        ty = yMph(result.topSpeedMph);
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx - 10, ty);
        ctx.lineTo(tx - 2, ty);
        ctx.stroke();
        ctx.fillStyle = '#e8d7b0';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        var vmaxLab = 'Vmax ' + result.topSpeedMph.toFixed(0);
        var labY = Math.max(ty - 8, pad.t + 10);
        ctx.fillText(vmaxLab, tx - 6, labY);
        ctx.fillStyle = '#9aa6b8';
        ctx.font = '8px ui-monospace, monospace';
        ctx.fillText('@ ' + Math.round(vmaxFt) + ' ft', tx - 6, labY + 11);
        ctx.textAlign = 'left';
      } else if (!vmaxBeyond && vmaxFt != null) {
        tx = x(vmaxFt);
        ty = yMph(result.topSpeedMph);
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8d7b0';
        ctx.font = '10px ui-monospace, monospace';
        var vmaxLab2 = 'Vmax ' + result.topSpeedMph.toFixed(0);
        ctx.fillText(vmaxLab2, Math.min(tx + 6, w - 70), Math.max(ty - 6, 14));
      }
    }

    // Playback progress scrubber — vertical cursor on green curve
    var cur = state.speedChartCursor;
    if (cur && cur.feet != null && isFinite(cur.feet)) {
      var cFt = cur.feet;
      if (cFt >= xMin - 1 && cFt <= xMax + 1) {
        var cx = x(Math.min(Math.max(cFt, xMin), xMax));
        var cMph = (cur.mph != null && isFinite(cur.mph)) ? cur.mph : null;
        var cy = cMph != null ? yMph(cMph) : (h - pad.b);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cx, pad.t); ctx.lineTo(cx, h - pad.b); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#c8ff4a';
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // HUD chip
        var chip = (cMph != null ? Math.round(cMph) + ' mph' : '') +
          (cMph != null ? ' · ' : '') + Math.round(cFt) + ' ft';
        if (cur.t != null && isFinite(cur.t)) chip += ' · ' + cur.t.toFixed(1) + 's';
        ctx.font = '9px ui-monospace, monospace';
        var cw = ctx.measureText(chip).width + 10;
        var chipX = Math.min(Math.max(cx - cw / 2, pad.l), w - pad.r - cw);
        var chipY = Math.max(pad.t + 2, cy - 22);
        ctx.fillStyle = 'rgba(8,10,14,0.82)';
        ctx.strokeStyle = 'rgba(200,255,74,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(chipX, chipY, cw, 14, 3);
        else ctx.rect(chipX, chipY, cw, 14);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8f5c0';
        ctx.textAlign = 'left';
        ctx.fillText(chip, chipX + 5, chipY + 10);
      }
    }

    // X-axis labels
    var plotW = w - pad.l - pad.r;
    var narrow = plotW < 420;
    var minGap = narrow ? 52 : (win.zoomed && spanFt <= 1500 ? 36 : 42);
    var skipOnNarrow = { 330: 1, 1000: 1 };
    var endFt = marks.length ? marks[marks.length - 1] : Math.round(xMax);
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    var shown = [];
    marks.forEach(function (ft) {
      if (narrow && !win.zoomed && skipOnNarrow[ft]) return;
      var xx = x(Math.min(Math.max(ft, xMin), xMax));
      var isAnchor = (ft === 0 || ft === endFt || ft === 1320 || ft === 660 || ft === Math.round(xMin) || ft === Math.round(xMax));
      if (!isAnchor && shown.length) {
        var prevS = shown[shown.length - 1];
        if (Math.abs(xx - prevS.xx) < minGap) return;
      }
      if (isAnchor && shown.length && ft !== 0) {
        var prev2 = shown[shown.length - 1];
        if (Math.abs(xx - prev2.xx) < minGap * 0.85 && prev2.ft !== 0 && prev2.ft !== 1320 && prev2.ft !== 660) {
          shown.pop();
        }
      }
      shown.push({ ft: ft, xx: xx });
    });
    var cleaned = [];
    shown.forEach(function (item) {
      if (!cleaned.length) { cleaned.push(item); return; }
      var prevC = cleaned[cleaned.length - 1];
      if (Math.abs(item.xx - prevC.xx) < minGap * 0.8) {
        var itemAnchor = (item.ft === 0 || item.ft === endFt || item.ft === 1320 || item.ft === 660);
        var prevAnchor = (prevC.ft === 0 || prevC.ft === endFt || prevC.ft === 1320 || prevC.ft === 660);
        if (itemAnchor && !prevAnchor) { cleaned.pop(); cleaned.push(item); return; }
        if (!itemAnchor && prevAnchor) return;
        if (item.ft === endFt) { cleaned.pop(); cleaned.push(item); }
        return;
      }
      cleaned.push(item);
    });
    shown = cleaned;
    shown.forEach(function (item) {
      var ft = item.ft, xx = item.xx;
      ctx.fillStyle = '#9aa6b8';
      ctx.fillText(String(ft), xx, h - pad.b + 12);
      var showTime = !(narrow && !win.zoomed && ft === 60);
      if (showTime) {
        var tt = timeAtFeet(Math.min(Math.max(ft, xMin), xMax));
        if (tt != null) {
          ctx.fillStyle = '#6e7a8c';
          ctx.fillText(tt.toFixed(1) + 's', xx, h - pad.b + 24);
        }
      }
    });
    ctx.textAlign = 'left';

    // Axis / legend
    ctx.fillStyle = '#c8ff4a';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('MPH', pad.l, 14);
    ctx.fillStyle = 'rgba(255,180,105,0.95)';
    ctx.textAlign = 'right';
    ctx.fillText('g', w - pad.r, 14);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,180,105,0.78)';
    ctx.font = '8px ui-monospace, monospace';
    [0, 0.5, 1.0].forEach(function (gv) {
      if (gv < gLo || gv > gHi) return;
      ctx.fillText(gv.toFixed(1), w - pad.r + 4, yG(gv) + 3);
    });
    if (maxG > 1.05) {
      var gTop = Math.floor(maxG * 10) / 10;
      if (gTop > 1.0 && gTop <= gHi) {
        ctx.fillText(gTop.toFixed(1), w - pad.r + 4, yG(gTop) + 3);
      }
    }
    ctx.fillStyle = '#8a9a6a';
    var mphStep = maxMph > 180 ? 40 : 20;
    for (var mv = mphStep; mv < maxMph; mv += mphStep) {
      ctx.fillText(String(mv), 4, yMph(mv) + 3);
    }
    ctx.fillStyle = '#7a8494';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    var hint = win.zoomed
      ? ('zoom ' + Math.round(xMin) + '–' + Math.round(xMax) + ' ft  ·  dbl-click full  ·  drag pan')
      : ('ft → Vmax  ·  click/wheel zoom  ·  scrub follows playback');
    ctx.fillText(hint, (pad.l + w - pad.r) / 2, h - 2);
    ctx.textAlign = 'left';
  }


  function slipLine(label, value) {
    label = String(label);
    value = String(value);
    var width = 36;
    var dots = width - label.length - value.length;
    if (dots < 2) dots = 2;
    var pad = '';
    for (var i = 0; i < dots; i++) pad += '.';
    return '  ' + label + ' ' + pad + ' ' + value;
  }

  function slipTime(n) {
    var v = Number(n);
    if (n == null || !isFinite(v) || v <= 0) return null;
    return v.toFixed(3) + ' s';
  }

  function slipMph(n) {
    var v = Number(n);
    if (n == null || !isFinite(v) || v <= 0) return null;
    return v.toFixed(1);
  }

  /** MPH at a distance from the sim timeline (same samples as the speed chart). */
  function mphNearFeet(r, targetFt) {
    var tl = r && r.timeline;
    if (!tl || !tl.length) return null;
    var prev = null;
    for (var i = 0; i < tl.length; i++) {
      var ft = Number(tl[i].feet);
      var mph = Number(tl[i].mph);
      if (!isFinite(ft) || !isFinite(mph)) continue;
      if (ft >= targetFt) {
        if (!prev || ft === prev.feet) return mph;
        var u = (targetFt - prev.feet) / (ft - prev.feet);
        return prev.mph + (mph - prev.mph) * u;
      }
      prev = { feet: ft, mph: mph };
    }
    return null;
  }

  function engineSlipLabel(car) {
    if (!car) return 'Unspecified';
    if (car.isEv || car.powerSource === 'ev') return 'EV';
    if (car.isHybrid || car.powerSource === 'hybrid') return 'Hybrid';
    var ps = car.powerSource || car.boostModel || '';
    if (ps === 'turbo' || ps === 'supercharger' || ps === 'twincharge' || car.isFI) return 'Forced ind.';
    return 'N/A';
  }

  function stopSlipLabel(reason) {
    var s = String(reason || '');
    if (!s || s === 'incomplete' || s === 'did_not_finish_quarter' || s.indexOf('quick_metrics') === 0) return null;
    if (s === 'aero_mech_equilibrium' || s.indexOf('speed_limiter_') === 0) return 'mech top speed';
    if (s.indexOf('speed_cap_') === 0 || s.indexOf('time_cap_') === 0 || s.indexOf('dist_cap_') === 0) return 'safety limit';
    return null;
  }

  var ZERO_SPEED_MARKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150];

  function renderSlip(r, car) {
    var lines = [];
    var vehicle = (car && car.name) || r.carName || 'Custom setup';
    lines.push('  VELOCITYBENCH TIME SLIP');
    lines.push('  -----------------------');
    lines.push(slipLine('VEHICLE', String(vehicle).slice(0, 24)));
    lines.push(slipLine('PRINTED', new Date().toLocaleString()));
    var ev = car && (car.isEv || car.powerSource === 'ev');
    lines.push(slipLine(ev ? 'MOTOR' : 'ENGINE', engineSlipLabel(car)));
    var txName = resolveTxDisplayName(car);
    if (txName) lines.push(slipLine('TRANS', String(txName).slice(0, 24)));
    var dwEl = $('driverWeightLbs');
    var dw = dwEl ? Number(dwEl.value) : 0;
    if (isFinite(dw) && dw > 0) lines.push(slipLine('DRIVER WT', Math.round(dw) + ' lb'));
    if (r.densityAltitudeFeet != null && isFinite(Number(r.densityAltitudeFeet))) {
      lines.push(slipLine('DA', Math.round(Number(r.densityAltitudeFeet)) + ' ft'));
    }
    if (r.tireDescription) lines.push(slipLine('TIRE', String(r.tireDescription).slice(0, 24)));
    lines.push('  -----------------------');

    function mark(label, time, mph) {
      var tStr = slipTime(time);
      if (!tStr) {
        lines.push(slipLine(label, '--'));
        return;
      }
      lines.push(slipLine(label, tStr));
      lines.push(slipLine(label + ' MPH', slipMph(mph) || '--'));
    }

    mark('60 FT', r.sixtyFootTime, mphNearFeet(r, 60));
    mark('330 FT', r.threeThirtyTime, mphNearFeet(r, 330));
    mark('1/8', r.eighthMileTime, r.eighthMileSpeedMph);
    mark('1000 FT', r.thousandFootTime, mphNearFeet(r, 1000));
    mark('1/4', r.finished ? r.quarterMileTime : null, r.finished ? r.quarterMileSpeedMph : null);
    mark('1/2', r.halfMileTime, r.halfMileSpeedMph);
    mark('1 MILE', r.mileTime, r.mileSpeedMph);

    lines.push('  -----------------------');
    function range(label, n) {
      lines.push(slipLine(label, slipTime(n) || '--'));
    }
    range('0-60 MPH', r.zeroToSixty);
    range('0-100 MPH', r.zeroToHundred);
    range('0-130 MPH', r.zeroToOneThirty);
    range('60-130', r.sixtyToOneThirty);
    range('100-150', r.hundredToOneFifty);
    range('100-200 KM/H', r.hundredToTwoHundredKmh);
    range('200-250 KM/H', r.twoHundredToTwoFiftyKmh);

    lines.push('  -----------------------');
    var tl = r.timeline;
    var end = tl && tl.length ? tl[tl.length - 1] : null;
    var runFt = end && isFinite(Number(end.feet)) ? Number(end.feet) : Number(r.topSpeedFeet);
    var runS = end && isFinite(Number(end.t)) ? Number(end.t) : Number(r.topSpeedTime);
    if (isFinite(runFt) && runFt > 0) lines.push(slipLine('RUN DIST', runFt.toFixed(1) + ' ft'));
    if (isFinite(runS) && runS > 0) lines.push(slipLine('RUN TIME', runS.toFixed(2) + ' s'));
    if (slipMph(r.topSpeedMph)) lines.push(slipLine('TOP SPD', slipMph(r.topSpeedMph) + ' mph'));
    var stop = stopSlipLabel(r.vmaxReason);
    if (stop) lines.push(slipLine('STOP', stop));

    lines.push('  -----------------------');
    lines.push('  0-X MPH BREAKDOWN');
    var z = r.zeroToMph || {};
    ZERO_SPEED_MARKS.forEach(function (m) {
      lines.push(slipLine('0-' + m, slipTime(z[m]) || '--'));
    });

    lines.push('  -----------------------');
    lines.push('  Shifts  ' + (r.totalShifts || 0) + '   Launch ' + r.launchRpm + ' → Shift ' + r.shiftRpm);
    lines.push('  Peak    ' + fmt(r.peakHorsepower, 0) + ' hp  /  ' + fmt(r.peakTorque, 0) + ' lb-ft');
    lines.push('  Peak G  ' + fmt(r.peakG, 2) + '   Wheelspin ' + fmt(r.wheelspinPercent, 1) + '%');
    lines.push('  -----------------------');
    lines.push('Gears: ' + (r.gearsUsed || []).map(function (g) { return g.toFixed(2); }).join(', '));
    lines.push('FD:    ' + fmt(r.finalDrive, 2));
    lines.push('  -----------------------');
    lines.push('  Estimates — not lab ET');
    $('slip').textContent = lines.join('\n');
  }

  /** Wheel Spin logo badge — ON when timeline wheelspin ≥ threshold. */
  function setSlipLight(wheelspinPct) {
    var el = $('slipLight');
    if (!el) return;
    if (el.classList.contains('wheel-spin--demo')) return;
    var on = Number(wheelspinPct) >= SPIN_WARN_THRESHOLD;
    el.classList.toggle('on', on);
    el.setAttribute('aria-label', on
      ? ('Wheel Spin ON — ' + Number(wheelspinPct).toFixed(1) + '% wheelspin')
      : 'Wheel Spin off');
  }

  /**
   * Canonical snip TRACTION % segmented meter.
   * Remaining grip = clamp(100 − timeline wheelspin, 0, 100). Soft/Agg/Auto alike.
   */
  function setTractionMeter(wheelspinPct) {
    var meter = $('tractionMeter');
    var segs = meter ? meter.querySelectorAll('.trac-seg') : [];
    var slip = Number(wheelspinPct);
    if (!isFinite(slip) || slip < 0) slip = 0;
    var trac = 100 - slip;
    if (trac < 0) trac = 0;
    if (trac > 100) trac = 100;
    var n = segs.length || 20;
    var lit = Math.round((trac / 100) * n);
    if (trac > 0 && lit < 1) lit = 1;
    if (trac <= 0) lit = 0;
    for (var i = 0; i < segs.length; i++) {
      segs[i].classList.toggle('is-on', i < lit);
    }
    if (meter) {
      meter.classList.toggle('is-low', trac < 70 && trac >= 40);
      meter.classList.toggle('is-critical', trac < 40);
      meter.setAttribute('aria-label',
        'Traction ' + Math.round(trac) + '% remaining · slip ' + slip.toFixed(1) + '%');
    }
  }



  /**
   * Desktop G / Peak G — longitudinal g from timeline sample (same g as speed chart
   * overlay / liveG). Peak = max g seen this run (resets on idle/STOP/new run clear).
   * Format: current 0.82 + secondary "PK 0.91". Hidden on mobile via CSS.
   */
  var instrumentsPeakG = null;
  function setGMeter(pt) {
    var el = $('gMeter');
    var val = $('gMeterValue');
    var peakEl = $('gMeterPeak');
    if (!el || !val || !peakEl) return;
    var g = pt && pt.g != null ? Number(pt.g) : NaN;
    if (!isFinite(g)) {
      val.textContent = '—';
      peakEl.textContent = 'PK —';
      instrumentsPeakG = null;
      el.setAttribute('aria-label', 'G idle');
      return;
    }
    if (instrumentsPeakG == null || g > instrumentsPeakG) instrumentsPeakG = g;
    // Fold timeline samples at/before t so scrub/seek still reports run peak correctly
    var tl = state.lastResult && state.lastResult.timeline;
    var t = pt.t != null ? Number(pt.t) : NaN;
    if (tl && tl.length && isFinite(t)) {
      for (var i = 0; i < tl.length; i++) {
        if (tl[i].t != null && Number(tl[i].t) > t + 1e-9) break;
        var tg = tl[i].g;
        if (typeof tg === 'number' && isFinite(tg) && tg > instrumentsPeakG) {
          instrumentsPeakG = tg;
        }
      }
    }
    val.textContent = g.toFixed(2);
    peakEl.textContent = 'PK ' + instrumentsPeakG.toFixed(2);
    el.setAttribute('aria-label',
      'G ' + g.toFixed(2) + ', peak ' + instrumentsPeakG.toFixed(2) + ' this run');
  }

  /**
   * Desktop ET / Elapsed — sim timeline seconds (same t as gauges/scrubber).
   * Not wall clock. Hidden on mobile via CSS (stack locks preserved).
   * Format: 3-decimal ET feel (e.g. 12.046). Idle/stop → —.
   */
  function setEtClock(pt) {
    var el = $('etClock');
    var val = $('etClockValue');
    if (!el || !val) return;
    var t = pt && pt.t != null ? Number(pt.t) : NaN;
    if (!isFinite(t) || t < 0) {
      val.textContent = '—';
      el.setAttribute('aria-label', 'Elapsed idle');
      return;
    }
    val.textContent = t.toFixed(3);
    el.setAttribute('aria-label', 'Elapsed ' + t.toFixed(3) + ' seconds');
  }

  /**
   * Desktop SHIFT MPH — MPH at last upshift from sim result.shifts (same markers as
   * SPEED VS DISTANCE chart). Updates as timeline t passes each upshift; idle/stop → —.
   * Hidden on mobile via CSS (stack locks preserved).
   */
  function setShiftMph(pt) {
    var el = $('shiftMphMeter');
    var val = $('shiftMphValue');
    if (!el || !val) return;
    if (!pt || pt.t == null || !isFinite(Number(pt.t)) || Number(pt.t) < 0) {
      val.textContent = '—';
      el.setAttribute('aria-label', 'Shift MPH idle');
      return;
    }
    var t = Number(pt.t);
    var mph = null;
    var shifts = state.lastResult && state.lastResult.shifts;
    if (shifts && shifts.length) {
      for (var i = 0; i < shifts.length; i++) {
        var sh = shifts[i];
        if (sh && sh.t != null && isFinite(Number(sh.t)) && Number(sh.t) <= t + 1e-9) {
          if (sh.mph != null && isFinite(Number(sh.mph))) mph = Number(sh.mph);
        }
      }
    } else if (state.lastResult && state.lastResult.timeline && state.lastResult.timeline.length) {
      // Fallback if shifts[] empty: last gear-increase sample at or before t
      var tl = state.lastResult.timeline;
      var prevG = tl[0].gear;
      for (var j = 1; j < tl.length; j++) {
        if (tl[j].t != null && Number(tl[j].t) > t + 1e-9) break;
        if (tl[j].gear > prevG && tl[j].mph != null && isFinite(Number(tl[j].mph))) {
          mph = Number(tl[j].mph);
        }
        prevG = tl[j].gear;
      }
    }
    if (mph == null || !isFinite(mph)) {
      val.textContent = '—';
      el.setAttribute('aria-label', 'Shift MPH — no upshift yet');
      return;
    }
    var rounded = Math.round(mph);
    val.textContent = String(rounded);
    el.setAttribute('aria-label', 'Last upshift at ' + rounded + ' miles per hour');
  }

  function setGearDigit(gear) {
    var el = $('gearDigitValue');
    if (!el) return;
    if (gear == null || gear === '' || gear === '—') {
      el.textContent = '—';
      return;
    }
    el.textContent = String(gear);
  }

  /**
   * Progressive SHIFT LED bar (above Start/Pause/Stop): green → amber → red as RPM
   * approaches shiftRpm; full red flash at/above shift. Cue = car.shiftRpm (fallback
   * redline). Driven from timeline RPM during Soft/Agg/Auto gauge playback alike.
   */
  function setShiftLamp(rpm) {
    var el = $('shiftLedBar');
    if (!el) return;
    var leds = el.querySelectorAll('.shift-led');
    var i;
    el.classList.remove('is-approaching', 'is-shift');
    for (i = 0; i < leds.length; i++) leds[i].classList.remove('is-on');

    var car = state.car;
    var shiftRpm = car && car.shiftRpm != null ? Number(car.shiftRpm) : 0;
    if (!(shiftRpm > 0)) shiftRpm = car && car.redline != null ? Number(car.redline) : 0;
    if (!(shiftRpm > 0) || rpm == null || !isFinite(Number(rpm))) {
      el.setAttribute('aria-label', 'Shift LEDs off');
      return;
    }
    rpm = Number(rpm);
    var n = leds.length || 8;
    // Approach band: last ~500 RPM before shift (or from 92% of shiftRpm, whichever wider)
    var approachStart = Math.min(shiftRpm - 80, Math.max(shiftRpm - 500, shiftRpm * 0.92));
    var span = Math.max(60, shiftRpm - approachStart);

    if (rpm >= shiftRpm) {
      el.classList.add('is-shift');
      for (i = 0; i < n; i++) leds[i].classList.add('is-on');
      el.setAttribute('aria-label', 'Shift now — ' + Math.round(rpm) + ' RPM');
      return;
    }
    if (rpm < approachStart) {
      el.setAttribute('aria-label', 'Shift LEDs off');
      return;
    }
    // Progressive fill across the bar (green → amber → red segments in markup)
    var progress = (rpm - approachStart) / span;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;
    var lit = Math.max(1, Math.ceil(progress * n));
    el.classList.add('is-approaching');
    for (i = 0; i < lit; i++) leds[i].classList.add('is-on');
    el.setAttribute('aria-label',
      'Approaching shift — ' + Math.round(rpm) + ' RPM · ' + lit + '/' + n + ' LEDs');
  }

  function resetLiveReadoutIdle() {
    rpmGauge.setValue(0);
    speedGauge.setValue(0);
    rpmGauge.hubDisplay = null;
    speedGauge.hubDisplay = null;
    if (typeof syncHubReadouts === 'function') syncHubReadouts();
    $('liveGear').textContent = '—';
    $('liveRpm').textContent = '—';
    $('liveMph').textContent = '—';
    $('liveG').textContent = '—';
    setGearDigit(null);
    setSlipLight(0);
    setTractionMeter(0);
    setGMeter(null);
    setEtClock(null);
    setShiftMph(null);
    setShiftLamp(0);
    state.speedChartCursor = null;
    if (state.lastResult && state.lastResult.timeline) {
      drawSpeedPath(state.lastResult.timeline, state.lastResult);
    }
  }

  function syncGaugeRunButtons() {
    var startBtn = $('btnGaugeStart');
    var pauseBtn = $('btnGaugePause');
    var stopBtn = $('btnGaugeStop');
    if (startBtn) {
      var startLabel = startBtn.querySelector('.btn-gauge-run-label');
      if (startLabel) startLabel.textContent = state.playbackPaused ? 'RESUME' : 'START';
      else startBtn.textContent = state.playbackPaused ? 'RESUME' : 'START';
      startBtn.classList.toggle('is-active', state.playbackPlaying && !state.playbackPaused);
      startBtn.title = state.playbackPaused
        ? 'Resume playback from pause point'
        : 'Run sim and play real-time (same as RUN TO TOP SPEED)';
    }
    if (pauseBtn) {
      pauseBtn.disabled = !state.playbackPlaying || state.playbackPaused;
      pauseBtn.classList.toggle('is-active', state.playbackPaused);
    }
    if (stopBtn) {
      stopBtn.disabled = !state.playbackPlaying && !state.playbackPaused && !state.anim;
    }
  }

  function cancelPlaybackRaf() {
    if (state.anim) {
      cancelAnimationFrame(state.anim);
      state.anim = null;
    }
  }

  /**
   * Apply one timeline sample to gauges + live strip + TRACTION/SLIP + SHIFT LEDs.
   * Shared by play / pause (last frame kept) paths.
   */
  function applyTimelinePoint(pt) {
    if (!pt) return;
    if (state.evGaugeMode) {
      var peak = state.evPeakHp || 1;
      var hpNow = hpAtRpm(state.car, pt.rpm);
      var pct = Math.max(0, Math.min(100, (hpNow / peak) * 100));
      rpmGauge.setValue(pct);
    } else {
      rpmGauge.setValue(pt.rpm);
    }
    speedGauge.setValue(pt.mph);
    rpmGauge.hubDisplay = null;
    speedGauge.hubDisplay = null;
    syncHubReadouts();
    $('liveGear').textContent = String(pt.gear);
    setGearDigit(pt.gear);
    $('liveRpm').textContent = String(Math.round(pt.rpm));
    $('liveMph').textContent = pt.mph.toFixed(1);
    $('liveG').textContent = pt.g.toFixed(2);
    if (state.powerCurve && state.powerCurve.length) {
      drawPowerCurve(state.powerCurve, pt.rpm);
    }
    var ws = pt.wheelspin != null ? pt.wheelspin : 0;
    setSlipLight(ws);
    setTractionMeter(ws);
    setGMeter(pt);
    setEtClock(pt);
    setShiftMph(pt);
    setShiftLamp(pt.rpm);
    // Sync SPEED VS DISTANCE scrubber to the same sample
    var prevC = state.speedChartCursor;
    state.speedChartCursor = {
      feet: pt.feet != null ? Number(pt.feet) : null,
      mph: pt.mph != null ? Number(pt.mph) : null,
      t: pt.t != null ? Number(pt.t) : null
    };
    var nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var feetDelta = prevC && prevC.feet != null && state.speedChartCursor.feet != null
      ? Math.abs(state.speedChartCursor.feet - prevC.feet) : 999;
    var due = !state._speedChartLastDrawMs || (nowMs - state._speedChartLastDrawMs) >= 48 || feetDelta >= 4;
    if (due && state.lastResult && state.lastResult.timeline) {
      state._speedChartLastDrawMs = nowMs;
      drawSpeedPath(state.lastResult.timeline, state.lastResult);
    }
  }

  function timelinePointAt(tl, tSec) {
    var pt = tl[0];
    for (var i = 0; i < tl.length; i++) {
      if (tl[i].t <= tSec) pt = tl[i];
      else break;
    }
    return pt;
  }

  /** Phase 4: playback ALWAYS real-time (scale=1) so gauges match sim clock. */
  function playbackFrame(now) {
    var result = state.lastResult;
    if (!result) return;
    var tl = result.timeline || [];
    if (!tl.length) return;
    // Elapsed = prior pause offset + time since this play segment started
    var elapsed = state.playbackElapsedOffset + (now - state.playbackT0);
    var tSec = elapsed / 1000;
    var pt = timelinePointAt(tl, tSec);
    applyTimelinePoint(pt);
    if (elapsed < state.playbackDurationMs + 200) {
      state.anim = requestAnimationFrame(playbackFrame);
    } else {
      // Natural end of run — leave final gauges; clear playing flags
      state.anim = null;
      state.playbackPlaying = false;
      state.playbackPaused = false;
      state.playbackElapsedOffset = state.playbackDurationMs;
      setSlipLight(0);
      setTractionMeter(0);
      setGMeter(null);
      setEtClock(null);
      setShiftMph(null);
      setShiftLamp(0);
      syncGaugeRunButtons();
    }
  }

  function startPlaybackFromBeginning(result) {
    cancelPlaybackRaf();
    var tl = (result && result.timeline) || [];
    if (!tl.length) {
      resetLiveReadoutIdle();
      state.playbackPlaying = false;
      state.playbackPaused = false;
      syncGaugeRunButtons();
      return;
    }
    state.playbackDurationMs = (tl[tl.length - 1].t || 1) * 1000;
    state.playbackElapsedOffset = 0;
    state.playbackT0 = performance.now();
    state.playbackPlaying = true;
    state.playbackPaused = false;
    instrumentsPeakG = null; // new run — Peak G restarts
    syncGaugeRunButtons();
    state.anim = requestAnimationFrame(playbackFrame);
  }

  /** Resume from pause point (keeps gauges where they froze). */
  function resumePlayback() {
    if (!state.lastResult || !state.playbackPaused) return;
    cancelPlaybackRaf();
    state.playbackT0 = performance.now();
    state.playbackPlaying = true;
    state.playbackPaused = false;
    syncGaugeRunButtons();
    state.anim = requestAnimationFrame(playbackFrame);
  }

  function pausePlayback() {
    if (!state.playbackPlaying || state.playbackPaused) return;
    var now = performance.now();
    state.playbackElapsedOffset += (now - state.playbackT0);
    cancelPlaybackRaf();
    state.playbackPlaying = false;
    state.playbackPaused = true;
    // Gauges / live readout / TRACTION+SLIP stay at last applied frame
    syncGaugeRunButtons();
  }

  /**
   * Stop: cancel RAF, reset gauges + live strip to idle (0 / —),
   * clear TRACTION/SLIP + SHIFT LEDs. Keep lastResult / slip / charts.
   */
  function stopPlayback() {
    cancelPlaybackRaf();
    state.playbackPlaying = false;
    state.playbackPaused = false;
    state.playbackElapsedOffset = 0;
    state.playbackT0 = 0;
    resetLiveReadoutIdle();
    syncGaugeRunButtons();
  }

  /** Left-rail #btnRun and center START (when not paused) — run sim then play. */
  function runSim() {
    var car = readCarFromForm();
    var env = readEnv();
    if (!car.gearRatios.length) {
      alert('Add at least one gear ratio.');
      return;
    }
    var result = Phys.runQuarterMile(car, env);
    state.lastResult = result;
    state.car = car;
    configurePrimaryGauge(car);
    renderSlip(result, car);
    // Keep dense 100-RPM editable series authoritative — never replace with sparse result keys
    if (!state.curveEdited) {
      state.powerCurve = powerCurveFromTorqueCurve(car.torqueCurve, car.redline, Number(car.peakHp) || null);
    } else {
      // Re-commit ensures car.torqueCurve stays dense after readCarFromForm
      commitEditedCurveToCar();
    }
    drawPowerCurve(state.powerCurve, state.cursorRpm);
    resetSpeedChartView();
    state.speedChartCursor = null;
    drawSpeedPath(result.timeline, result);
    // Scale speed gauge to cover Vmax
    if (result.topSpeedMph) {
      // Snap MPH dial max to a clean 20 mph step (majors every 20, mids every 10)
      speedGauge.setMax(Math.max(200, Math.ceil((result.topSpeedMph + 20) / 20) * 20));
    }
    startPlaybackFromBeginning(result);
  }

  /** Center START: resume if paused; otherwise full runSim (same as #btnRun). */
  function onGaugeStart() {
    if (state.playbackPaused) {
      resumePlayback();
      return;
    }
    runSim();
  }

  $('txPreset').addEventListener('change', function () {
    var key = $('txPreset').value;
    var tx = Phys.FactoryTransmissions[key];
    if (!tx) return;
    renderGears(tx.gears.slice());
    $('finalDrive').value = tx.finalDrive;
    $('lossPct').value = tx.loss;
    if (state.car) state.car.txKey = key;
  });

  var driveEl = $('driveType');
  if (driveEl) {
    driveEl.addEventListener('change', function () {
      if (!state.car) return;
      state.car.driveType = driveEl.value;
      // Refresh layout-based defaults only when user hasn't customized (near suggested)
      syncWeightFieldsFromCar(Object.assign({}, state.car, { driveType: driveEl.value, rearWeightPercent: null, frontWeightPercent: null }));
    });
  }
  document.querySelectorAll('input[name="ind"]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      if (garagePowerLocked) {
        // Snap back to baked power source
        var want = (state.car && (state.car.isEv || state.car.powerSource === 'ev')) ? 'ev'
          : (state.car && (state.car.isHybrid || state.car.powerSource === 'hybrid')) ? 'hybrid'
          : null;
        if (want) setInductionRadio(want);
      }
      var v = inductionValue();
      if (state.car) {
        state.car.powerSource = v;
        state.car.isEv = v === 'ev';
        state.car.isHybrid = v === 'hybrid';
        if (v === 'ev') {
          state.car.isFI = false;
          state.car.isNA = false;
          state.car.boostModel = 'na';
          if ($('driveType') && $('driveType').value === 'AWD') state.car.engineLayout = 'Dual';
        } else if (v === 'hybrid') {
          state.car.hybridAssistFrac = state.car.hybridAssistFrac != null ? state.car.hybridAssistFrac : 0.22;
        }
      }
      syncInductionUi({
        forceEv: v === 'ev',
        forceHybrid: v === 'hybrid',
        lockedValue: garagePowerLocked ? v : null
      });
      // Custom EV toggle + garage EV both swap primary instrument cluster
      if (state.car) configurePrimaryGauge(state.car);
      syncEvChartMode(state.car);
    });
  });

  $('btnRun').addEventListener('click', runSim);
  if ($('btnGaugeStart')) $('btnGaugeStart').addEventListener('click', onGaugeStart);
  if ($('btnGaugePause')) $('btnGaugePause').addEventListener('click', pausePlayback);
  if ($('btnGaugeStop')) $('btnGaugeStop').addEventListener('click', stopPlayback);
  syncGaugeRunButtons();
  // Rescale ICE tach when redline / shift inputs change (bike high-redline support)
  ['redline', 'shiftRpm'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('change', function () {
      if (!state.car || state.evGaugeMode) return;
      state.car.redline = clampNum($('redline').value, 2000, 28000, state.car.redline || 6800);
      state.car.shiftRpm = clampNum($('shiftRpm').value, 1500, state.car.redline, state.car.shiftRpm || 6500);
      configurePrimaryGauge(state.car);
    });
  });
$('btnReset').addEventListener('click', function () {
    var src = state.presetCar || state.car;
    if (src) applyCarToForm(JSON.parse(JSON.stringify(src)));
  });

  function rpmFromPointer(ev) {
    var canvas = $('powerChart');
    var g = state.chartGeom;
    if (!canvas || !g || !state.powerCurve.length) return null;
    var rect = canvas.getBoundingClientRect();
    var mx = ev.clientX - rect.left;
    var frac = (mx - g.pad.l) / Math.max(1, g.w - g.pad.l - g.pad.r);
    frac = Math.max(0, Math.min(1, frac));
    return g.minRpm + frac * (g.maxRpm - g.minRpm);
  }

  (function wireDynoEditAndScrub() {
    var canvas = $('powerChart');
    if (!canvas) return;
    canvas.style.cursor = 'crosshair';

    // EV delivery scrub (mph) — no ICE TQ bullet drag
    canvas.addEventListener('mousemove', function (ev) {
      if (!(state.evChartMode || isEvMode(state.car))) return;
      if (state.drag) return;
      var mph = mphFromPointer(ev);
      if (mph == null) return;
      state.evCursorMph = mph;
      drawEvPowerDeliveryChart(state.car, mph);
    });

    function clientXY(ev) {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      if (ev.changedTouches && ev.changedTouches[0]) {
        return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
      }
      return { x: ev.clientX, y: ev.clientY };
    }

    function hitHandle(mx, my) {
      if (state.evChartMode || isEvMode(state.car)) return null;
      var g = state.chartGeom;
      if (!g || !g.handles) return null;
      // Prefer major (200-RPM) handles — easier primary controls on a dense 100-RPM mesh
      var bestMajor = null, bestMajorD = 16;
      var bestMinor = null, bestMinorD = 10;
      g.handles.forEach(function (h) {
        var d = Math.hypot(mx - h.x, my - h.y);
        if (h.major) {
          if (d <= 16 && d <= bestMajorD) { bestMajorD = d; bestMajor = h; }
        } else {
          if (d <= 10 && d <= bestMinorD) { bestMinorD = d; bestMinor = h; }
        }
      });
      if (bestMajor) return bestMajor;
      return bestMinor;
    }

    function localXY(ev) {
      var rect = canvas.getBoundingClientRect();
      var c = clientXY(ev);
      return { x: c.x - rect.left, y: c.y - rect.top };
    }

    function torqueFromY(my) {
      var g = state.chartGeom;
      if (!g) return null;
      var plotH = g.h - g.pad.t - g.pad.b;
      var frac = (g.h - g.pad.b - my) / Math.max(1, plotH);
      frac = Math.max(0, Math.min(1.35, frac)); // allow a little overshoot past axis max
      return Math.max(5, frac * g.maxTq);
    }

    function applyDrag(ev) {
      if (!state.drag || !state.powerCurve.length) return;
      var xy = localXY(ev);
      var tq = torqueFromY(xy.y);
      if (tq == null) return;
      // Authoritative edit on state.powerCurve — never rebuild from car mid-drag.
      var idx = state.drag.index;
      if (idx == null || idx < 0 || idx >= state.powerCurve.length) {
        for (var i = 0; i < state.powerCurve.length; i++) {
          if (Math.abs(state.powerCurve[i].rpm - state.drag.rpm) < 1) { idx = i; break; }
        }
      }
      if (idx == null || idx < 0) return;
      var snap = state.drag.snapshot;
      if (!snap || snap.length !== state.powerCurve.length) {
        snap = state.powerCurve.map(function (p) { return p.torque; });
        state.drag.snapshot = snap;
      }
      var isMajor = !!state.drag.major;
      if (isMajor) {
        // Primary major control: move this 200-RPM handle, then re-lerp all
        // 100-RPM minors between adjacent majors so the mesh fills (no valley).
        var pc = state.powerCurve;
        pc[idx].torque = Math.max(5, tq);
        pc[idx].horsepower = (pc[idx].torque * pc[idx].rpm) / 5252;
        interpolateMinorsBetweenMajors(idx);
      } else {
        // Minor: local distance-falloff sculpt from drag-start snapshot
        sculptCurveFromDrag(idx, tq, snap, false);
      }
      state.cursorRpm = state.powerCurve[idx].rpm;
      // Commit dense 100-RPM map to car; keep state.powerCurve authoritative
      commitEditedCurveToCar();
      drawPowerCurve(state.powerCurve, state.cursorRpm);
      if (ev.cancelable) ev.preventDefault();
    }

    function onDown(ev) {
      if (!state.powerCurve.length || !state.chartGeom) return;
      var xy = localXY(ev);
      var h = hitHandle(xy.x, xy.y);
      if (h) {
        state.drag = {
          rpm: h.rpm,
          index: h.index,
          major: !!h.major,
          snapshot: state.powerCurve.map(function (p) { return p.torque; }),
          pointerId: ev.pointerId,
          axisMaxTq: state.chartGeom && state.chartGeom.maxTq,
          axisMaxHp: state.chartGeom && state.chartGeom.maxHp
        };
        canvas.style.cursor = 'ns-resize';
        if (canvas.setPointerCapture && ev.pointerId != null) {
          try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        applyDrag(ev);
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      // Scrub cursor when not on a handle
      var rpm = rpmFromPointer(ev);
      if (rpm == null) return;
      state.cursorRpm = rpm;
      drawPowerCurve(state.powerCurve, rpm);
    }

    function onMove(ev) {
      if (state.drag) {
        applyDrag(ev);
        return;
      }
      if (ev.buttons || (ev.pointers && ev.pointers.length)) return;
      var xy = localXY(ev);
      var h = hitHandle(xy.x, xy.y);
      canvas.style.cursor = h ? 'ns-resize' : 'crosshair';
      var rpm = rpmFromPointer(ev);
      if (rpm == null) return;
      state.cursorRpm = rpm;
      drawPowerCurve(state.powerCurve, rpm);
    }

    function onUp(ev) {
      if (!state.drag) return;
      applyDrag(ev);
      state.drag = null;
      canvas.style.cursor = 'crosshair';
      if (canvas.releasePointerCapture && ev.pointerId != null) {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      }
    }

    // Prefer Pointer Events (mouse + touch + pen)
    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
    } else {
      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', function (ev) {
        if (state.drag) applyDrag(ev);
        else onMove(ev);
      });
      window.addEventListener('mouseup', onUp);
      canvas.addEventListener('touchstart', onDown, { passive: false });
      canvas.addEventListener('touchmove', function (ev) {
        if (state.drag) applyDrag(ev);
      }, { passive: false });
      canvas.addEventListener('touchend', onUp);
    }

    canvas.addEventListener('mouseleave', function () {
      if (state.drag) return;
      if (state.powerCurve && state.powerCurve.length) {
        var peak = state.powerCurve.reduce(function (best, p) {
          return p.horsepower > best.horsepower ? p : best;
        }, state.powerCurve[0]);
        state.cursorRpm = peak.rpm;
        drawPowerCurve(state.powerCurve, peak.rpm);
      }
    });
  })();

  // SPEED VS DISTANCE — zoom / pan / reset (touch-friendly)
  (function bindSpeedChartInteraction() {
    var canvas = $('speedChart');
    if (!canvas) return;

    function clientToFt(clientX) {
      var g = state.speedChartGeom;
      if (!g) return null;
      var rect = canvas.getBoundingClientRect();
      var localX = clientX - rect.left;
      var u = (localX - g.pad.l) / Math.max(1, g.plotW);
      u = Math.max(0, Math.min(1, u));
      return g.xMin + u * (g.xMax - g.xMin);
    }

    function setView(xMin, xMax) {
      var full = state.speedChartGeom ? state.speedChartGeom.full
        : (state.lastResult ? speedChartFullDomainFt(state.lastResult.timeline, state.lastResult) : 2640);
      var minSpan = Math.max(40, full * 0.04);
      xMin = Math.max(0, xMin);
      xMax = Math.min(full, xMax);
      if (xMax - xMin < minSpan) {
        var mid = (xMin + xMax) / 2;
        xMin = Math.max(0, mid - minSpan / 2);
        xMax = Math.min(full, xMin + minSpan);
        xMin = Math.max(0, xMax - minSpan);
      }
      // Snap back to full when nearly covering domain
      if (xMin <= 1 && xMax >= full - 1) {
        resetSpeedChartView();
      } else {
        state.speedChartView = { xMinFt: xMin, xMaxFt: xMax };
      }
      if (state.lastResult) drawSpeedPath(state.lastResult.timeline, state.lastResult);
    }

    function zoomAt(ft, factor) {
      var g = state.speedChartGeom;
      if (!g || ft == null) return;
      var span = g.xMax - g.xMin;
      var newSpan = span * factor;
      var full = g.full;
      var minSpan = Math.max(40, full * 0.04);
      if (newSpan < minSpan) newSpan = minSpan;
      if (newSpan >= full * 0.98) {
        resetSpeedChartView();
        if (state.lastResult) drawSpeedPath(state.lastResult.timeline, state.lastResult);
        return;
      }
      var u = (ft - g.xMin) / Math.max(1e-6, span);
      var xMin = ft - u * newSpan;
      var xMax = xMin + newSpan;
      setView(xMin, xMax);
    }

    function onWheel(ev) {
      if (!state.lastResult) return;
      ev.preventDefault();
      var ft = clientToFt(ev.clientX);
      if (ft == null) return;
      var factor = ev.deltaY > 0 ? 1.18 : (1 / 1.18);
      zoomAt(ft, factor);
    }

    function pointerPos(ev) {
      if (ev.touches && ev.touches.length) {
        return { x: ev.touches[0].clientX, y: ev.touches[0].clientY, id: ev.touches[0].identifier };
      }
      if (ev.changedTouches && ev.changedTouches.length) {
        return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY, id: ev.changedTouches[0].identifier };
      }
      return { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
    }

    function onDown(ev) {
      if (!state.lastResult || !state.speedChartGeom) return;
      var p = pointerPos(ev);
      var g = state.speedChartGeom;
      state.speedChartDrag = {
        pointerId: p.id,
        startX: p.x,
        originMin: g.xMin,
        originMax: g.xMax,
        moved: false,
        zoomed: g.zoomed
      };
      if (canvas.setPointerCapture && ev.pointerId != null && ev.pointerType) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      if (ev.cancelable && (ev.touches || g.zoomed)) ev.preventDefault();
    }

    function onMove(ev) {
      var drag = state.speedChartDrag;
      if (!drag || !state.speedChartGeom) return;
      var p = pointerPos(ev);
      var dx = p.x - drag.startX;
      if (Math.abs(dx) > 4) drag.moved = true;
      if (!drag.zoomed) return; // pan only when zoomed
      var g = state.speedChartGeom;
      var ftPerPx = (drag.originMax - drag.originMin) / Math.max(1, g.plotW);
      var shift = -dx * ftPerPx;
      setView(drag.originMin + shift, drag.originMax + shift);
      // Keep origin for continuous pan from start
      if (ev.cancelable) ev.preventDefault();
    }

    function onUp(ev) {
      var drag = state.speedChartDrag;
      if (!drag) return;
      var p = pointerPos(ev);
      var wasTap = !drag.moved;
      var zoomed = drag.zoomed;
      state.speedChartDrag = null;
      if (canvas.releasePointerCapture && ev.pointerId != null) {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (e) {}
      }
      if (!wasTap || !state.lastResult) return;
      var ft = clientToFt(p.x);
      if (ft == null) return;
      var now = Date.now();
      var isDouble = (now - state.speedChartLastTap < 320);
      state.speedChartLastTap = now;
      // Double-tap / second click: reset to full Vmax when zoomed
      if (isDouble && (zoomed || (state.speedChartGeom && state.speedChartGeom.zoomed))) {
        resetSpeedChartView();
        drawSpeedPath(state.lastResult.timeline, state.lastResult);
        return;
      }
      // Single tap/click when full: zoom in for detail around click
      if (!zoomed) {
        var full = state.speedChartGeom.full;
        var span = Math.max(330, Math.min(1320, full * 0.25));
        setView(ft - span / 2, ft + span / 2);
      }
    }

    function onDblClick(ev) {
      if (!state.lastResult) return;
      ev.preventDefault();
      var g = state.speedChartGeom;
      if (g && g.zoomed) {
        resetSpeedChartView();
        drawSpeedPath(state.lastResult.timeline, state.lastResult);
      } else {
        var ft = clientToFt(ev.clientX);
        if (ft == null) return;
        var full = g ? g.full : speedChartFullDomainFt(state.lastResult.timeline, state.lastResult);
        var span = Math.max(330, Math.min(1320, full * 0.25));
        setView(ft - span / 2, ft + span / 2);
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    if (window.PointerEvent) {
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
    } else {
      canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      canvas.addEventListener('touchstart', onDown, { passive: false });
      canvas.addEventListener('touchmove', onMove, { passive: false });
      canvas.addEventListener('touchend', onUp);
    }
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'crosshair';
    canvas.title = 'Click zoom · wheel zoom · drag pan (when zoomed) · double-click full Vmax';

    // Gate / shot helper
    try {
      window.__pcSpeedChart = {
        reset: function () {
          resetSpeedChartView();
          if (state.lastResult) drawSpeedPath(state.lastResult.timeline, state.lastResult);
        },
        setView: setView,
        zoomAt: zoomAt,
        setCursor: function (feet, mph, t) {
          state.speedChartCursor = { feet: feet, mph: mph, t: t };
          if (state.lastResult) drawSpeedPath(state.lastResult.timeline, state.lastResult);
        },
        getGeom: function () { return state.speedChartGeom; }
      };
    } catch (eEx) {}
  })();

  window.addEventListener('resize', function () {
    rpmGauge._resize();
    speedGauge._resize();
    if (state.powerCurve && state.powerCurve.length) {
      drawPowerCurve(state.powerCurve, state.cursorRpm);
    } else if (state.lastResult) {
      drawPowerCurve(state.lastResult.powerCurve, state.cursorRpm);
    }
    if (state.lastResult) drawSpeedPath(state.lastResult.timeline, state.lastResult);
  });

  populateTxPresets();
  ['frontWeightPct', 'rearWeightPct', 'leftWeightPct', 'rightWeightPct'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (_weightVizSyncing) return;
      // Keep pairs summing to 100 while typing
      if (id === 'frontWeightPct' && $('rearWeightPct')) {
        var f = clampNum(el.value, 20, 80, 45);
        $('rearWeightPct').value = String(Math.round(100 - f));
      } else if (id === 'rearWeightPct' && $('frontWeightPct')) {
        var r = clampNum(el.value, 20, 80, 55);
        $('frontWeightPct').value = String(Math.round(100 - r));
      } else if (id === 'leftWeightPct' && $('rightWeightPct')) {
        var l = clampNum(el.value, 20, 80, 50);
        $('rightWeightPct').value = String(Math.round(100 - l));
      } else if (id === 'rightWeightPct' && $('leftWeightPct')) {
        var rt = clampNum(el.value, 20, 80, 50);
        $('leftWeightPct').value = String(Math.round(100 - rt));
      }
      updateWeightSumHints();
    });
  });

  (function wireWeightDistributionViz() {
    var cornerIds = [
      ['cornerFlPct', 'fl'],
      ['cornerFrPct', 'fr'],
      ['cornerRlPct', 'rl'],
      ['cornerRrPct', 'rr']
    ];
    cornerIds.forEach(function (row) {
      var el = $(row[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        if (_weightVizSyncing) return;
        applyCornerEdit(row[1], el.value);
      });
      el.addEventListener('keydown', function (ev) {
        // Allow arrows inside the number without starting a pad drag
        ev.stopPropagation();
      });
    });

    function pointerPos(ev) {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      if (ev.changedTouches && ev.changedTouches[0]) {
        return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
      }
      return { x: ev.clientX, y: ev.clientY };
    }

    // Drag CG on car silhouette → front/left axes
    var cg = $('weightCg');
    var car = $('weightCar');
    if (cg && car) {
      var cgDrag = null;
      function cgFromClient(clientX, clientY) {
        var rect = car.getBoundingClientRect();
        if (!(rect.width > 0) || !(rect.height > 0)) return null;
        var nx = (clientX - rect.left) / rect.width;
        var ny = (clientY - rect.top) / rect.height;
        nx = Math.max(0.05, Math.min(0.95, nx));
        ny = Math.max(0.05, Math.min(0.95, ny));
        // Invert map used in syncWeightVisualFromAxes
        var left = 80 - ((nx * 100 - 18) / 64) * 60;
        var front = 80 - ((ny * 100 - 18) / 64) * 60;
        return {
          front: clampNum(front, 20, 80, 45),
          left: clampNum(left, 20, 80, 50)
        };
      }
      function onCgMove(ev) {
        if (!cgDrag) return;
        ev.preventDefault();
        var p = pointerPos(ev);
        var axes = cgFromClient(p.x, p.y);
        if (!axes) return;
        setAxisWeightFields(axes.front, axes.left);
      }
      function onCgUp() {
        if (!cgDrag) return;
        cgDrag = null;
        cg.classList.remove('is-dragging');
        window.removeEventListener('pointermove', onCgMove);
        window.removeEventListener('pointerup', onCgUp);
        window.removeEventListener('touchmove', onCgMove);
        window.removeEventListener('touchend', onCgUp);
      }
      function onCgDown(ev) {
        if (ev.target && ev.target.classList && ev.target.classList.contains('wheel-pct')) return;
        ev.preventDefault();
        cgDrag = true;
        cg.classList.add('is-dragging');
        var p = pointerPos(ev);
        var axes = cgFromClient(p.x, p.y);
        if (axes) setAxisWeightFields(axes.front, axes.left);
        window.addEventListener('pointermove', onCgMove, { passive: false });
        window.addEventListener('pointerup', onCgUp);
        window.addEventListener('touchmove', onCgMove, { passive: false });
        window.addEventListener('touchend', onCgUp);
      }
      cg.addEventListener('pointerdown', onCgDown);
      car.addEventListener('pointerdown', function (ev) {
        if (ev.target === cg) return;
        onCgDown(ev);
      });
      cg.addEventListener('keydown', function (ev) {
        var f = Number($('frontWeightPct') && $('frontWeightPct').value);
        var l = Number($('leftWeightPct') && $('leftWeightPct').value);
        if (!isFinite(f)) f = 45;
        if (!isFinite(l)) l = 50;
        var step = ev.shiftKey ? 5 : 1;
        var handled = true;
        if (ev.key === 'ArrowUp') f += step;
        else if (ev.key === 'ArrowDown') f -= step;
        else if (ev.key === 'ArrowLeft') l += step;
        else if (ev.key === 'ArrowRight') l -= step;
        else handled = false;
        if (!handled) return;
        ev.preventDefault();
        setAxisWeightFields(f, l);
      });
    }

    // Vertical drag on a wheel pad nudges that corner (→ axle/side via applyCornerEdit)
    document.querySelectorAll('.wheel-pad').forEach(function (pad) {
      var corner = pad.getAttribute('data-corner');
      if (!corner) return;
      var drag = null;
      function onMove(ev) {
        if (!drag) return;
        ev.preventDefault();
        var p = pointerPos(ev);
        var dy = drag.y - p.y; // up = heavier
        if (Math.abs(dy) < 1) return;
        var next = drag.base + dy * 0.12;
        drag.y = p.y;
        drag.base = next;
        applyCornerEdit(corner, next);
      }
      function onUp() {
        if (!drag) return;
        drag = null;
        pad.classList.remove('is-active');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
      }
      pad.addEventListener('pointerdown', function (ev) {
        if (ev.target && ev.target.classList && ev.target.classList.contains('wheel-pct')) return;
        ev.preventDefault();
        var inp = pad.querySelector('.wheel-pct');
        var base = Number(inp && inp.value);
        if (!isFinite(base)) {
          var cur = cornerPercentsFromAxes(
            Number($('frontWeightPct') && $('frontWeightPct').value),
            Number($('leftWeightPct') && $('leftWeightPct').value)
          );
          base = cur[corner];
        }
        var p = pointerPos(ev);
        drag = { y: p.y, base: base };
        pad.classList.add('is-active');
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
      });
    });

    // Initial paint
    syncWeightVisualFromForm();
  })();
  function livePreviewPeakHpScale() {
    var baseline = state.peakHpBaseline;
    var srcCurve = state.curveAtBaseline;
    if (!(baseline > 0) || !srcCurve || !Object.keys(srcCurve).length) return;
    if (state.drag) return;
    var peakHp = clampNum($('peakHp').value, 1, 15000, baseline);
    var redline = clampNum($('redline').value, 2000, 28000, (state.car && state.car.redline) || 6800);
    var scaled = (peakHp === baseline) ? cloneTorqueCurve(srcCurve) : scaleTorqueCurveMap(srcCurve, peakHp / baseline);
    if (state.car) {
      state.car.torqueCurve = scaled;
      state.car.peakHp = peakHp;
    }
    state.powerCurve = powerCurveFromTorqueCurve(scaled, redline, peakHp);
    drawPowerCurve(state.powerCurve, state.cursorRpm);
  }

  var peakHpEl = $('peakHp');
  if (peakHpEl) {
    peakHpEl.addEventListener('input', livePreviewPeakHpScale);
    peakHpEl.addEventListener('change', livePreviewPeakHpScale);
  }

  var filterEl = $('garageFilter');
  if (filterEl) {
    filterEl.addEventListener('input', function () {
      garageFilterText = filterEl.value || '';
      renderGarage();
    });
  }
  renderGarage();
  var defaultCar = SAMPLE_CARS.find(function (c) { return /Supra Twin Turbo/i.test(c.name); })
    || SAMPLE_CARS.find(function (c) { return c.id !== 'custom'; })
    || SAMPLE_CARS[0];
  applyCarToForm(JSON.parse(JSON.stringify(defaultCar)));
  // Screenshot / gate helper: ?demoDash=1 LIVE mid-run (freeze OFF; needle≡digital≡LEDs)
  try {
    if (/(?:^|[?&])demoDash=1(?:&|$)/.test(location.search || '')) {
      // One source value per gauge → needle angle + digital; LEDs from same RPM
      var DEMO_RPM = 6400; /* mid-high approach → 7/8 stadium stages (G→A→R) for tip shots */
      var DEMO_MPH = 148;
      setGearDigit(3);
      var slipEl = $('slipLight');
      if (slipEl) slipEl.classList.add('wheel-spin--demo', 'on');
      setTractionMeter(18); // ~82% of 20 segs lit
      // G / Peak G demo: current 0.82, peak this run 0.91 (seed peak then current)
      instrumentsPeakG = null;
      setGMeter({ t: 18.19, g: 0.91 });
      setGMeter({ t: 18.19, g: 0.82 });
      // Multi-digit ET proves desktop fit (e.g. Jorge clip on 18.190s)
      setEtClock({ t: 18.19 });
      // Seed Shift MPH demo: pretend lastResult had an upshift at 79 mph before t=18.19
      state.lastResult = state.lastResult || {};
      state.lastResult.shifts = [{ gear: 2, mph: 42.0, feet: 120, t: 2.1 }, { gear: 3, mph: 79.0, feet: 480, t: 5.4 }];
      setShiftMph({ t: 18.19, gear: 3, mph: DEMO_MPH });
      // Ensure shift cue so LED bar tracks DEMO_RPM (not a hardcoded all-on)
      if (!state.car) state.car = Object.assign({}, CUSTOM_BUILDER);
      state.car.shiftRpm = 6500;
      state.car.redline = 6500;
      rpmGauge.stop();
      speedGauge.stop();
      rpmGauge.overlayOnly = false;
      speedGauge.overlayOnly = false;
      speedGauge.dial = 'speed';
      rpmGauge.configure({ mode: 'rpm', redline: 6500, max: 8000, label: 'RPM' });
      speedGauge.setMax(200);
      speedGauge.redline = 200;
      function paintDash() {
        try {
          rpmGauge.overlayOnly = false;
          speedGauge.overlayOnly = false;
          rpmGauge._resize();
          speedGauge._resize();
          // Same source: value=display; hubDisplay cleared so canvas uses display
          rpmGauge.hubDisplay = null;
          speedGauge.hubDisplay = null;
          rpmGauge.value = DEMO_RPM; rpmGauge.display = DEMO_RPM;
          speedGauge.value = DEMO_MPH; speedGauge.display = DEMO_MPH;
          rpmGauge.draw();
          speedGauge.draw();
          syncHubReadouts();
          setShiftLamp(DEMO_RPM);
        } catch (ePaint) { /* ignore */ }
      }
      paintDash();
      requestAnimationFrame(function () {
        paintDash();
        setTimeout(paintDash, 40);
        setTimeout(paintDash, 120);
        setTimeout(paintDash, 280);
        setTimeout(paintDash, 500);
        setTimeout(paintDash, 900);
      });
    }
  } catch (eDemo) { /* ignore */ }
  drawPowerCurve([]);
  drawSpeedPath([], null);
})();
