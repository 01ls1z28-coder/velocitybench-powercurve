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
    drivetrainLossPercent: 15, txKey: 'TR6060_6', tireType: 1, forceScale: 1
  };

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
  var state = { car: null, lastResult: null, anim: null, powerCurve: [], cursorRpm: null, chartGeom: null };

  var rpmGauge = new window.VBPowerCurveGauges.BrassGauge($('rpmGauge'), {
    min: 0, max: 8000, label: 'RPM', redline: 6500
  });
  var speedGauge = new window.VBPowerCurveGauges.BrassGauge($('speedGauge'), {
    min: 0, max: 250, label: 'MPH', unit: '', redline: 200
  });
  rpmGauge.start();
  speedGauge.start();

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

  function applyCarToForm(car) {
    state.car = car;
    $('carName').value = car.name || '';
    var hp = car.peakHp || Phys.peakHpFromCurve(car.torqueCurve || {}) || 450;
    $('peakHp').value = Math.round(hp);
    $('weightLbs').value = car.weightLbs;
    $('cd').value = car.dragCoefficient;
    $('area').value = car.frontalAreaSqFt;
    $('tireRadius').value = car.tireRadiusInches;
    $('driveType').value = car.driveType || 'RWD';
    $('finalDrive').value = car.finalDriveRatio;
    $('lossPct').value = car.drivetrainLossPercent != null ? car.drivetrainLossPercent : 15;
    $('launchRpm').value = car.launchRpm || 3000;
    $('shiftRpm').value = car.shiftRpm || 6500;
    $('redline').value = car.redline || 6800;
    $('shiftTime').value = car.shiftTimeSeconds != null ? car.shiftTimeSeconds : 0.10;
    $('boostPsi').value = car.boostPsi || 0;
    if (car.txKey && Phys.FactoryTransmissions[car.txKey]) $('txPreset').value = car.txKey;
    renderGears(car.gearRatios || []);
    var ind = car.isFI ? (car.boostModel === 'supercharger' ? 'supercharger' : 'turbo') : 'na';
    if (car.boostModel === 'twincharge') ind = 'twincharge';
    var radio = document.querySelector('input[name="ind"][value="' + ind + '"]');
    if (radio) radio.checked = true;
    $('converter').value = car.hasAftermarketConverter ? '1' : '0';
    $('stallRpm').value = car.stallRpm || 2800;
    $('flashRpm').value = car.flashRpm || 3500;
    if ($('tireType') && car.tireType != null) $('tireType').value = String(car.tireType | 0);
    rpmGauge.setMax(Math.max(8000, (car.redline || 7000) * 1.05));
    rpmGauge.redline = car.shiftRpm || 6500;
    highlightGarage(car.id);
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
      b.innerHTML = c.name + '<small>' + (c.category || 'Garage') + ' · ' + (c.peakHp || '?') + ' hp · ' + c.weightLbs + ' lb</small>';
      b.onclick = function () { applyCarToForm(JSON.parse(JSON.stringify(c))); };
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
      frontalAreaSqFt: clampNum($('area').value, 8, 80, 22.5),
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
      isNA: ind === 'na',
      isFI: ind !== 'na',
      boostModel: ind === 'na' ? 'na' : ind,
      boostPsi: ind === 'na' ? 0 : clampNum($('boostPsi').value, 0, 80, 0),
      hasAftermarketConverter: $('converter').value === '1',
      stallRpm: clampNum($('stallRpm').value, 1200, 7000, 2800),
      flashRpm: clampNum($('flashRpm').value, 1500, 8000, 3500),
      forceScale: base.forceScale != null ? Number(base.forceScale) : 1,
      tireType: parseInt($('tireType').value, 10) || 0,
      isEv: !!base.isEv,
      torqueCurve: base.torqueCurve || null
    };
    // If user changed peak HP significantly vs curve peak, resynthesize
    if (car.torqueCurve) {
      var curveHp = Phys.peakHpFromCurve(car.torqueCurve);
      if (Math.abs(curveHp - peakHp) > peakHp * 0.12) {
        car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, redline, car.peakHpRpm);
      }
    } else {
      car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, redline, car.peakHpRpm);
    }
    // Dyno curves already include boost — don't double-apply for garage FI cars unless boostPsi set
    if (base.torqueCurve && (car.boostPsi <= 0 || base.boostPsi === 0)) {
      car.boostModel = 'na';
      car.boostPsi = 0;
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

  function drawPowerCurve(powerCurve, cursorRpm) {
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
    function x(rpm) {
      return pad.l + ((rpm - minRpm) / (maxRpm - minRpm || 1)) * (w - pad.l - pad.r);
    }
    function yHp(v) { return h - pad.b - (v / maxHp) * (h - pad.t - pad.b); }
    function yTq(v) { return h - pad.b - (v / maxTq) * (h - pad.t - pad.b); }
    state.chartGeom = { pad: pad, w: w, h: h, minRpm: minRpm, maxRpm: maxRpm, x: x };

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
      rpmGauge.setValue(pt.rpm);
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
    renderSlip(result, car);
    renderMetrics(result);
    drawPowerCurve(result.powerCurve);
    drawSpeedPath(result.timeline, result);
    // Scale speed gauge to cover Vmax
    if (result.topSpeedMph) {
      speedGauge.setMax(Math.max(200, Math.ceil(result.topSpeedMph / 25) * 25 + 25));
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

  $('btnRun').addEventListener('click', runSim);
  $('btnReset').addEventListener('click', function () {
    if (state.car) applyCarToForm(JSON.parse(JSON.stringify(state.car)));
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

  (function wireDynoScrub() {
    var canvas = $('powerChart');
    if (!canvas) return;
    canvas.style.cursor = 'crosshair';
    canvas.addEventListener('mousemove', function (ev) {
      var rpm = rpmFromPointer(ev);
      if (rpm == null) return;
      state.cursorRpm = rpm;
      drawPowerCurve(state.powerCurve, rpm);
    });
    canvas.addEventListener('mouseleave', function () {
      if (state.powerCurve && state.powerCurve.length) {
        // Snap cursor readout back to peak HP point
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
    if (state.lastResult) {
      drawPowerCurve(state.lastResult.powerCurve, state.cursorRpm);
      drawSpeedPath(state.lastResult.timeline, state.lastResult);
    }
  });

  populateTxPresets();
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
  drawPowerCurve([]);
  drawSpeedPath([], null);
})();
