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

  // Phase 4: fleet from js/garage-data.js (333 cars) + Custom Builder.
  // Curated torque curves / gearing baked in where available; rest synthesized.
  var CUSTOM_BUILDER = {
    id: 'custom',
    name: 'Custom Builder',
    category: 'Custom',
    weightLbs: 3800, dragCoefficient: 0.35, frontalAreaSqFt: 22.5, tireRadiusInches: 13.2,
    finalDriveRatio: 3.73, gearRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
    peakHp: 450, peakTqRpm: 4200, peakHpRpm: 6200, redline: 6800,
    isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000,
    drivetrainLossPercent: 15, txKey: 'TR6060_6', tireType: 1, forceScale: 1,
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
    curveEdited: false
  };

  var rpmGauge = new window.VBPowerCurveGauges.BrassGauge($('rpmGauge'), {
    min: 0, max: 8000, label: 'RPM', redline: 6500
  });
  var speedGauge = new window.VBPowerCurveGauges.BrassGauge($('speedGauge'), {
    min: 0, max: 260, label: 'MPH', unit: '', redline: 200, dial: 'speed'
  });
  rpmGauge.start();
  speedGauge.start();

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

  function updateTxPresetVisibility(car) {
    var field = $('txPresetField');
    var sel = $('txPreset');
    if (!sel) return;
    var custom = isCustomBuilder(car);
    if (field) field.classList.toggle('tx-hidden', !custom);
    sel.disabled = !custom;
    if (!custom) {
      // Clear selection so a factory TX name is never shown as if it were this car's gearbox
      sel.selectedIndex = -1;
      // Keep a blank option so the control isn't stuck on a mismatched label if briefly shown
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
  }

  var RPM_GRID = 100;   // dense mesh — matches baked torque samples
  var RPM_MAJOR = 200;  // major handles every 2 grid steps (250 not divisible by 100)

  /** Build editable HP/TQ series on a 100-RPM grid from a torque curve map. */
  function powerCurveFromTorqueCurve(curve, redline) {
    if (!curve) return [];
    var keys = Object.keys(curve).map(Number).filter(function (k) { return isFinite(k); });
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
      var tq = Phys.getTorqueAtRpm ? Phys.getTorqueAtRpm(curve, rpm) : null;
      if (tq == null || !isFinite(tq) || tq <= 0) {
        // local interpolate fallback — never leave a hole that floors to ~5
        tq = Number(curve[rpm]);
        if (!isFinite(tq) || tq <= 0) tq = Number(curve[String(rpm)]);
        if (!isFinite(tq) || tq <= 0) {
          var lo = null, hi = null;
          for (var i = 0; i < keys.length; i++) {
            if (keys[i] <= rpm) lo = keys[i];
            if (keys[i] >= rpm) { hi = keys[i]; break; }
          }
          if (lo == null) tq = Number(curve[keys[0]]);
          else if (hi == null || hi === lo) tq = Number(curve[lo]);
          else {
            var t1 = Number(curve[lo]), t2 = Number(curve[hi]);
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
    state.powerCurve = powerCurveFromTorqueCurve(car.torqueCurve, car.redline);
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
   * EV selected → lock/disable ICE induction (NA/Turbo/SC/Twin) + boost PSI.
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
    var boost = $('boostPsi');
    if (boost) {
      boost.disabled = isEv || (lockGarage && isEv);
      if (isEv) boost.value = '0';
    }
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

  function updateWeightSumHints() {
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
    $('boostPsi').value = car.boostPsi || 0;
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
    $('flashRpm').value = car.flashRpm || 3500;
    if ($('tireType') && car.tireType != null) $('tireType').value = String(car.tireType | 0);
    configurePrimaryGauge(car);
    highlightGarage(car.id);
    // Show baked (or working) dyno curve immediately — dense 100-RPM mesh, editable bullets
    syncEvChartMode(car);
    syncPowerCurveFromCar(car);
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
    var redline = clampNum($('redline').value, 2000, 16000, 6800);
    var shiftRpm = clampNum($('shiftRpm').value, 1500, redline, 6500);
    var ind = inductionValue();
    var base = state.car || {};
    var car = {
      name: $('carName').value || 'Custom',
      weightLbs: clampNum($('weightLbs').value, 20, 120000, 3800),
      dragCoefficient: clampNum($('cd').value, 0.15, 1.2, 0.35),
      frontalAreaSqFt: clampNum($('area').value, 4, 80, 22.5),
      tireRadiusInches: clampNum($('tireRadius').value, 8, 24, 13.2),
      finalDriveRatio: clampNum($('finalDrive').value, 1.5, 10, 3.73),
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
      boostPsi: (ind === 'na' || ind === 'ev') ? 0 : clampNum($('boostPsi').value, 0, 80, 0),
      hybridAssistFrac: ind === 'hybrid'
        ? (base.hybridAssistFrac != null ? Number(base.hybridAssistFrac) : 0.22)
        : undefined,
      hasAftermarketConverter: $('converter').value === '1',
      stallRpm: clampNum($('stallRpm').value, 1200, 7000, 2800),
      flashRpm: clampNum($('flashRpm').value, 1500, 8000, 3500),
      forceScale: 1, // retired calib knob — physics ignores; garage bakes 1.0
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
      })()
    };
    var w = readWeightDistributionFromForm(base);
    car.frontWeightPercent = w.frontWeightPercent;
    car.rearWeightPercent = w.rearWeightPercent;
    car.leftWeightPercent = w.leftWeightPercent;
    car.rightWeightPercent = w.rightWeightPercent;
    // Peak HP label must NEVER wipe garage / dyno torqueCurve on RUN.
    // Garage hybrids/FI often have label peakHp (system) ≠ curve-only peak; the old
    // |curveHp-peakHp|>12% path resynthesized ZR1X and fantasy-fast 8.39@175.
    // Keep existing curve unless absent. Custom Builder may resynthesize only when
    // there is no curve yet, or user has not dyno-edited and explicitly wants Peak HP.
    if (!car.torqueCurve) {
      car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, redline, car.peakHpRpm);
    } else if (isCustomBuilder(car) && !state.curveEdited) {
      var curveHp = Phys.peakHpFromCurve(car.torqueCurve);
      if (curveHp > 0 && Math.abs(curveHp - peakHp) > peakHp * 0.12) {
        car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, redline, car.peakHpRpm);
      }
    }
    // else: garage or dyno-edited curve stays authoritative; physics uses the curve
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
    return {
      tempF: clampNum($('tempF').value, -40, 140, 70),
      humidity: clampNum($('humidity').value, 0, 100, 45),
      pressureInHg: clampNum($('pressure').value, 20, 32, 29.92),
      densityAltitudeFtInput: daRaw === '' ? null : clampNum(daRaw, -2000, 15000, 0),
      windSpeedMph: clampNum($('windMph').value, 0, 80, 0),
      windDirDeg: clampNum($('windDir').value, 0, 360, 0),
      gustMph: clampNum($('gustMph').value, 0, 60, 0),
      tireType: parseInt($('tireType').value, 10) || 0,
      launchMode: $('launchMode').value,
      tireLabel: (Phys.tireLabelForType
        ? Phys.tireLabelForType(parseInt($('tireType').value, 10) || 0)
        : ['Street', 'Drag Radial', 'Slick'][parseInt($('tireType').value, 10) || 0])
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
    var peakHp = 0, peakTq = 0, peakHpRpm = 0, peakTqRpm = 0;
    powerCurve.forEach(function (p) {
      if (p.horsepower > peakHp) { peakHp = p.horsepower; peakHpRpm = p.rpm; }
      if (p.torque > peakTq) { peakTq = p.torque; peakTqRpm = p.rpm; }
    });
    peakEl.textContent =
      Math.round(peakHp) + ' hp @ ' + Math.round(peakHpRpm) +
      ' · ' + Math.round(peakTq) + ' lb-ft @ ' + Math.round(peakTqRpm);
    var pt = samplePowerAtRpm(powerCurve, cursorRpm != null ? cursorRpm : peakHpRpm);
    if (!pt) { curEl.textContent = '—'; return; }
    curEl.textContent =
      Math.round(pt.rpm) + ' rpm · ' +
      pt.horsepower.toFixed(0) + ' hp · ' +
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
    powerCurve.forEach(function (p) {
      if (p.horsepower > maxHp) maxHp = p.horsepower;
      if (p.torque > maxTq) maxTq = p.torque;
    });
    maxHp = Math.max(50, maxHp * 1.12);
    maxTq = Math.max(50, maxTq * 1.12);
    if (state.drag && state.drag.axisMaxTq) {
      maxTq = state.drag.axisMaxTq;
      maxHp = state.drag.axisMaxHp || maxHp;
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
      var px = x(p.rpm), py = yHp(p.horsepower);
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

  function drawSpeedPath(timeline, result) {
    var canvas = $('speedChart');
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 600;
    var h = canvas.clientHeight || 160;
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
      return;
    }
    var pad = { l: 44, r: 16, t: 18, b: 28 };
    var maxFt = timeline[timeline.length - 1].feet || 1320;
    var maxMph = 0;
    timeline.forEach(function (p) { if (p.mph > maxMph) maxMph = p.mph; });
    maxMph = Math.max(60, maxMph * 1.08);
    function x(ft) { return pad.l + (ft / maxFt) * (w - pad.l - pad.r); }
    function y(mph) { return h - pad.b - (mph / maxMph) * (h - pad.t - pad.b); }

    ctx.strokeStyle = 'rgba(215,196,160,0.2)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var yy = pad.t + ((h - pad.t - pad.b) * i) / 3;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }

    // Quarter-mile markers
    var marks = [60, 330, 660, 1000, 1320];
    ctx.setLineDash([4, 4]);
    marks.forEach(function (ft) {
      if (ft > maxFt) return;
      var xx = x(ft);
      ctx.strokeStyle = 'rgba(76,201,240,0.35)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, h - pad.b); ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.beginPath();
    timeline.forEach(function (p, i) {
      var px = x(p.feet), py = y(p.mph);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = '#c8ff4a'; ctx.lineWidth = 2.2; ctx.stroke();

    if (result && result.topSpeedMph) {
      var tx = x(result.topSpeedFeet || maxFt);
      var ty = y(result.topSpeedMph);
      ctx.fillStyle = '#ff3355';
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8d7b0';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('Vmax ' + result.topSpeedMph.toFixed(0), Math.min(tx + 6, w - 70), Math.max(ty - 6, 14));
    }

    ctx.fillStyle = '#9aa6b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('ft →', w / 2, h - 6);
    ctx.fillStyle = '#c8ff4a'; ctx.fillText('MPH', pad.l, 12);
  }

  function renderSlip(r, car) {
    var lines = [];
    lines.push('────────────────────────────────');
    lines.push('   VELOCITYBENCH POWERCURVE');
    lines.push('      QUARTER-MILE TIME SLIP');
    lines.push('────────────────────────────────');
    lines.push('Car:  ' + (car.name || r.carName || '—'));
    lines.push('Date: ' + new Date().toLocaleString());
    lines.push('DA:   ' + Math.round(r.densityAltitudeFeet) + ' ft   Air: ' + Math.round(r.airTempF) + ' °F');
    lines.push('Tire: ' + (r.tireDescription || '—'));
    lines.push('────────────────────────────────');
    lines.push('  R/T     ' + fmt(r.reactionTime, 3));
    lines.push('  60 ft   ' + fmt(r.sixtyFootTime, 3));
    lines.push('  330 ft  ' + fmt(r.threeThirtyTime, 3));
    lines.push('  1/8     ' + fmt(r.eighthMileTime, 3) + '  @ ' + fmt(r.eighthMileSpeedMph, 1) + ' mph');
    lines.push('  1000 ft ' + fmt(r.thousandFootTime, 3));
    lines.push('  1/4     ' + fmt(r.quarterMileTime, 3) + '  @ ' + fmt(r.quarterMileSpeedMph, 1) + ' mph');
    lines.push('────────────────────────────────');
    lines.push('  0-60    ' + fmt(r.zeroToSixty, 3) + ' s');
    lines.push('  0-100   ' + fmt(r.zeroToHundred, 3) + ' s');
    lines.push('  60-130  ' + fmt(r.sixtyToOneThirty, 3) + ' s');
    lines.push('  100-150 ' + fmt(r.hundredToOneFifty, 3) + ' s');
    lines.push('────────────────────────────────');
    lines.push('  TOP SPD ' + fmt(r.topSpeedMph, 1) + ' mph');
    lines.push('          @ ' + fmt(r.topSpeedTime, 2) + ' s / ' + fmt(r.topSpeedFeet, 0) + ' ft');
    if (r.vmaxReason) lines.push('  Vmax    ' + String(r.vmaxReason).replace(/_/g, ' '));
    lines.push('────────────────────────────────');
    lines.push('  Shifts  ' + (r.totalShifts || 0) + '   Launch ' + r.launchRpm + ' → Shift ' + r.shiftRpm);
    lines.push('  Peak    ' + fmt(r.peakHorsepower, 0) + ' hp  /  ' + fmt(r.peakTorque, 0) + ' lb-ft');
    lines.push('  Peak G  ' + fmt(r.peakG, 2) + '   Wheelspin ' + fmt(r.wheelspinPercent, 1) + '%');
    lines.push('────────────────────────────────');
    lines.push('Gears: ' + (r.gearsUsed || []).map(function (g) { return g.toFixed(2); }).join(', '));
    lines.push('FD:    ' + fmt(r.finalDrive, 2));
    lines.push('────────────────────────────────');
    lines.push('Estimate only — not track certified.');
    $('slip').textContent = lines.join('\n');
  }


  /** Populate calib/source transparency panel from VB_POWERCURVE_CALIB_META (existing fleet meta). */
  function renderCalibPanel() {
    var meta = (typeof window !== 'undefined' && window.VB_POWERCURVE_CALIB_META) || null;
    var body = $('calibPanelBody');
    if (!body) return;
    if (!meta || !meta.stats) {
      body.innerHTML = '<p class="calib-caveat">Compiled estimates — not lab-certified · not track-certified. Fleet meta unavailable.</p>';
      return;
    }
    var s = meta.stats;
    var tol = meta.tol || {};
    function pct(n, d) {
      if (d == null || !d) return '—';
      return ((100 * n) / d).toFixed(1) + '%';
    }
    function hit(label, n, d) {
      return '<div class="calib-hit"><span class="k">' + label + '</span>'
        + '<span class="v">' + n + '/' + d + '</span>'
        + '<span class="pct">' + pct(n, d) + '</span></div>';
    }
    if ($('calibCaveat')) {
      $('calibCaveat').textContent = meta.caveat
        || 'Compiled estimates — not lab-certified · not dyno-certified · not track-certified.';
    }
    if ($('calibHits')) {
      $('calibHits').innerHTML = [
        hit('¼ ET', s.et, s.nEt),
        hit('Trap', s.trap, s.nTrap),
        hit('0–60', s.z60, s.nZ60),
        hit('60–130', s.z60130, s.n60130),
        hit('all4', s.all4, s.nEt)
      ].join('');
    }
    if ($('calibMetaLine')) {
      var tolBits = 'Excel TOL ±' + (tol.et != null ? tol.et + 's ET' : '—')
        + ' · ±' + (tol.trap != null ? tol.trap + ' mph trap' : '—')
        + ' · ±' + (tol.z60 != null ? tol.z60 + 's 0–60' : '—');
      $('calibMetaLine').textContent = 'Tip ' + (meta.tip || '—')
        + ' · ' + (meta.knobs || 'loss/launch/tire · forceScale=1')
        + ' · ' + tolBits;
    }
    if ($('calibHonest')) {
      var n = meta.honestMissCount != null ? meta.honestMissCount : 14;
      $('calibHonest').textContent = meta.honestMissNote
        || (n + ' honest-miss cars left untouched (no Cd/wt/curve cheat).');
    }
    if ($('calibSource')) {
      $('calibSource').innerHTML = 'Source: <code>' + (meta.sourcePath || 'scripts/garage-calib-meta.json')
        + '</code> (baked subset — no new physics).';
    }
  }

  function renderMetrics(r) {
    var items = [
      ['1/4 ET', fmt(r.quarterMileTime, 3) + ' s'],
      ['Trap', fmt(r.quarterMileSpeedMph, 1) + ' mph'],
      ['60 ft', fmt(r.sixtyFootTime, 3) + ' s'],
      ['0–60', fmt(r.zeroToSixty, 2) + ' s'],
      ['60–130', fmt(r.sixtyToOneThirty, 2) + ' s'],
      ['100–150', fmt(r.hundredToOneFifty, 2) + ' s'],
      ['Top Speed', fmt(r.topSpeedMph, 1) + ' mph'],
      ['Peak HP', fmt(r.peakHorsepower, 0)]
    ];
    $('metrics').innerHTML = items.map(function (it) {
      return '<div class="metric"><div class="k">' + it[0] + '</div><div class="v">' + it[1] + '</div></div>';
    }).join('');
  }

  function animateRun(result) {
    if (state.anim) cancelAnimationFrame(state.anim);
    var tl = result.timeline || [];
    if (!tl.length) {
      rpmGauge.setValue(0);
      speedGauge.setValue(0);
      return;
    }
    var t0 = performance.now();
    var duration = (tl[tl.length - 1].t || 1) * 1000;
    // Phase 4: playback ALWAYS real-time (scale=1) so gauges match sim clock.
    var scale = 1;
    function frame(now) {
      var elapsed = (now - t0) * scale;
      var tSec = elapsed / 1000;
      var pt = tl[0];
      for (var i = 0; i < tl.length; i++) {
        if (tl[i].t <= tSec) pt = tl[i];
        else break;
      }
      // EV: left dial = power % from curve@RPM / peakHp; live strip still shows motor RPM
      if (state.evGaugeMode) {
        var peak = state.evPeakHp || 1;
        var hpNow = hpAtRpm(state.car, pt.rpm);
        var pct = Math.max(0, Math.min(100, (hpNow / peak) * 100));
        rpmGauge.setValue(pct);
      } else {
        rpmGauge.setValue(pt.rpm);
      }
      speedGauge.setValue(pt.mph);
      $('liveGear').textContent = String(pt.gear);
      $('liveRpm').textContent = String(Math.round(pt.rpm));
      $('liveMph').textContent = pt.mph.toFixed(1);
      $('liveG').textContent = pt.g.toFixed(2);
      // Scrub dyno cursor with live engine RPM during playback
      if (state.powerCurve && state.powerCurve.length) {
        drawPowerCurve(state.powerCurve, pt.rpm);
      }
      if (elapsed < duration + 200) state.anim = requestAnimationFrame(frame);
    }
    state.anim = requestAnimationFrame(frame);
  }

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
    renderMetrics(result);
    // Keep dense 100-RPM editable series authoritative — never replace with sparse result keys
    if (!state.curveEdited) {
      state.powerCurve = powerCurveFromTorqueCurve(car.torqueCurve, car.redline);
    } else {
      // Re-commit ensures car.torqueCurve stays dense after readCarFromForm
      commitEditedCurveToCar();
    }
    drawPowerCurve(state.powerCurve, state.cursorRpm);
    drawSpeedPath(result.timeline, result);
    // Scale speed gauge to cover Vmax
    if (result.topSpeedMph) {
      // Snap MPH dial max to a clean 20 mph step (majors every 20, mids every 10)
      speedGauge.setMax(Math.max(200, Math.ceil((result.topSpeedMph + 20) / 20) * 20));
    }
    animateRun(result);
  }

  $('txPreset').addEventListener('change', function () {
    var tx = Phys.FactoryTransmissions[$('txPreset').value];
    if (!tx) return;
    renderGears(tx.gears.slice());
    $('finalDrive').value = tx.finalDrive;
    $('lossPct').value = tx.loss;
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
  // Rescale ICE tach when redline / shift inputs change (bike high-redline support)
  ['redline', 'shiftRpm'].forEach(function (id) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('change', function () {
      if (!state.car || state.evGaugeMode) return;
      state.car.redline = clampNum($('redline').value, 2000, 16000, state.car.redline || 6800);
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
  var filterEl = $('garageFilter');
  if (filterEl) {
    filterEl.addEventListener('input', function () {
      garageFilterText = filterEl.value || '';
      renderGarage();
    });
  }
  renderGarage();
  renderCalibPanel();
  var defaultCar = SAMPLE_CARS.find(function (c) { return /Supra Twin Turbo/i.test(c.name); })
    || SAMPLE_CARS.find(function (c) { return c.id !== 'custom'; })
    || SAMPLE_CARS[0];
  applyCarToForm(JSON.parse(JSON.stringify(defaultCar)));
  drawPowerCurve([]);
  drawSpeedPath([], null);
})();
