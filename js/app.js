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

  var SAMPLE_CARS = [
    {
      id: 'cobra65',
      name: '1965 Shelby Cobra 427',
      category: 'Classic Muscle',
      weightLbs: 2450, dragCoefficient: 0.52, frontalAreaSqFt: 20.5, tireRadiusInches: 13.5,
      finalDriveRatio: 3.54, gearRatios: [2.32, 1.61, 1.23, 1.00],
      torqueCurve: {1500:360,2000:400,2500:440,3000:470,3500:500,4000:520,4500:535,5000:540,5500:525,6000:500,6500:460},
      isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000, redline: 6500,
      drivetrainLossPercent: 15, peakHp: 425, txKey: 'Toploader_4'
    },
    {
      id: 'charger70',
      name: '1970 Dodge Charger R/T 440',
      category: 'Classic Muscle',
      weightLbs: 4100, dragCoefficient: 0.50, frontalAreaSqFt: 24.0, tireRadiusInches: 14.0,
      finalDriveRatio: 3.55, gearRatios: [2.45, 1.45, 1.00],
      torqueCurve: {1500:380,2000:420,2500:460,3000:480,3500:490,4000:500,4500:505,5000:500,5500:480,6000:450,6500:410},
      isNA: true, driveType: 'RWD', shiftRpm: 5500, launchRpm: 2500, redline: 5800,
      drivetrainLossPercent: 18, peakHp: 375, txKey: 'TH400_3', hasAftermarketConverter: true, stallRpm: 2800, flashRpm: 3200
    },
    {
      id: 'supra94',
      name: '1994 Toyota Supra Turbo',
      category: 'JDM',
      weightLbs: 3450, dragCoefficient: 0.33, frontalAreaSqFt: 21.8, tireRadiusInches: 13.1,
      finalDriveRatio: 3.27, gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
      torqueCurve: {2000:180,2500:220,3000:260,3500:300,4000:330,4500:350,5000:360,5500:365,6000:360,6500:345,7000:320},
      isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
      shiftRpm: 6800, launchRpm: 2800, redline: 7000, drivetrainLossPercent: 12, peakHp: 320, txKey: 'Aisin_6'
    },
    {
      id: 'r34',
      name: '2002 Nissan Skyline GT-R R34',
      category: 'JDM',
      weightLbs: 3400, dragCoefficient: 0.33, frontalAreaSqFt: 22.0, tireRadiusInches: 13.0,
      finalDriveRatio: 3.545, gearRatios: [4.056, 2.301, 1.595, 1.248, 1.000, 0.795],
      torqueCurve: {2500:180,3000:210,3500:250,4000:280,4500:300,5000:315,5500:325,6000:330,6500:325,7000:310,7500:290},
      isFI: true, isNA: false, driveType: 'AWD', shiftRpm: 7600, launchRpm: 3500, redline: 8000,
      drivetrainLossPercent: 12, peakHp: 276, txKey: 'GR6_DCT'
    },
    {
      id: 'boss302',
      name: '2013 Mustang Boss 302',
      category: 'Modern Muscle',
      weightLbs: 3632, dragCoefficient: 0.36, frontalAreaSqFt: 22.7, tireRadiusInches: 13.2,
      finalDriveRatio: 3.73, gearRatios: [3.66, 2.43, 1.69, 1.32, 1.00, 0.65],
      torqueCurve: {2000:230,2500:250,3000:270,3500:290,4000:310,4500:325,5000:335,5500:345,6000:350,6500:345,7000:330},
      isNA: true, driveType: 'RWD', shiftRpm: 7400, launchRpm: 3200, redline: 7500,
      drivetrainLossPercent: 12, peakHp: 444, txKey: 'Getrag_MT82'
    },
    {
      id: 'miata16',
      name: '2016 Mazda MX-5 Miata Club',
      category: 'Sports Cars',
      weightLbs: 2340, dragCoefficient: 0.31, frontalAreaSqFt: 19.0, tireRadiusInches: 12.4,
      finalDriveRatio: 2.87, gearRatios: [5.09, 2.99, 2.05, 1.59, 1.29, 1.00],
      torqueCurve: {2000:100,2500:110,3000:120,3500:125,4000:130,4500:135,5000:140,5500:142,6000:140,6500:135,7000:130},
      isNA: true, driveType: 'RWD', shiftRpm: 7200, launchRpm: 3500, redline: 7500,
      drivetrainLossPercent: 12, peakHp: 155, txKey: 'Aisin_6'
    },
    {
      id: 'hellcat19',
      name: '2019 Challenger Hellcat Redeye',
      category: 'Modern Muscle',
      weightLbs: 4445, dragCoefficient: 0.37, frontalAreaSqFt: 24.5, tireRadiusInches: 13.8,
      finalDriveRatio: 2.62, gearRatios: [4.71, 3.14, 2.10, 1.67, 1.29, 1.00, 0.84, 0.67],
      peakHp: 797, peakTqRpm: 4000, peakHpRpm: 6200, redline: 6300,
      isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
      shiftRpm: 6100, launchRpm: 2200, drivetrainLossPercent: 15, txKey: 'ZF8HP',
      hasAftermarketConverter: false
    },
    {
      id: 'gt50020',
      name: '2020 Mustang Shelby GT500',
      category: 'Modern Muscle',
      weightLbs: 4170, dragCoefficient: 0.35, frontalAreaSqFt: 23.5, tireRadiusInches: 13.6,
      finalDriveRatio: 3.73, gearRatios: [3.25, 2.31, 1.55, 1.14, 0.87, 0.68, 0.56],
      peakHp: 760, peakTqRpm: 4500, peakHpRpm: 7300, redline: 7500,
      isFI: true, isNA: false, driveType: 'RWD', shiftRpm: 7500, launchRpm: 3000,
      drivetrainLossPercent: 10, txKey: 'DCT_7_AMG'
    },
    {
      id: '911ts',
      name: '2020 Porsche 911 Turbo S (992)',
      category: 'Supercars',
      weightLbs: 3640, dragCoefficient: 0.33, frontalAreaSqFt: 22.0, tireRadiusInches: 13.3,
      finalDriveRatio: 3.02, gearRatios: [3.91, 2.29, 1.58, 1.19, 0.97, 0.83, 0.67],
      peakHp: 640, peakTqRpm: 2500, peakHpRpm: 6750, redline: 7200,
      isFI: true, isNA: false, driveType: 'AWD', shiftRpm: 7000, launchRpm: 3500,
      drivetrainLossPercent: 10, txKey: 'PDK_7'
    },
    {
      id: 'custom',
      name: 'Custom Builder',
      category: 'Custom',
      weightLbs: 3800, dragCoefficient: 0.35, frontalAreaSqFt: 22.5, tireRadiusInches: 13.2,
      finalDriveRatio: 3.73, gearRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
      peakHp: 450, peakTqRpm: 4200, peakHpRpm: 6200, redline: 6800,
      isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000,
      drivetrainLossPercent: 15, txKey: 'TR6060_6'
    }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var state = { car: null, lastResult: null, anim: null };

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
    SAMPLE_CARS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'garage-item'; b.dataset.id = c.id;
      b.innerHTML = c.name + '<small>' + c.category + ' · ' + (c.peakHp || '?') + ' hp · ' + c.weightLbs + ' lb</small>';
      b.onclick = function () { applyCarToForm(JSON.parse(JSON.stringify(c))); };
      list.appendChild(b);
    });
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
      tireLabel: ['Street', 'Drag Radial', 'Slick'][parseInt($('tireType').value, 10) || 0]
    };
  }

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  function drawPowerCurve(powerCurve) {
    var canvas = $('powerChart');
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
    if (!powerCurve || !powerCurve.length) {
      ctx.fillStyle = '#667084';
      ctx.font = '12px Segoe UI';
      ctx.fillText('Run a simulation to plot HP / TQ vs RPM', 16, h / 2);
      return;
    }
    var pad = { l: 44, r: 16, t: 16, b: 28 };
    var maxRpm = powerCurve[powerCurve.length - 1].rpm;
    var maxHp = 0, maxTq = 0;
    powerCurve.forEach(function (p) {
      if (p.horsepower > maxHp) maxHp = p.horsepower;
      if (p.torque > maxTq) maxTq = p.torque;
    });
    maxHp *= 1.1; maxTq *= 1.1;
    function x(rpm) { return pad.l + ((rpm - powerCurve[0].rpm) / (maxRpm - powerCurve[0].rpm || 1)) * (w - pad.l - pad.r); }
    function yHp(v) { return h - pad.b - (v / maxHp) * (h - pad.t - pad.b); }
    function yTq(v) { return h - pad.b - (v / maxTq) * (h - pad.t - pad.b); }

    ctx.strokeStyle = 'rgba(215,196,160,0.2)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      var yy = pad.t + ((h - pad.t - pad.b) * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
    }

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

    ctx.fillStyle = '#9aa6b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('RPM', w / 2, h - 6);
    ctx.fillStyle = '#c8ff4a'; ctx.fillText('HP', pad.l, 12);
    ctx.fillStyle = '#4cc9f0'; ctx.fillText('TQ', pad.l + 28, 12);
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
      ['Peak HP', fmt(r.peakHorsepower, 0)],
      ['Peak G', fmt(r.peakG, 2)]
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
    var scale = Math.min(1, 8000 / duration); // speed up long runs a bit for UI
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

  window.addEventListener('resize', function () {
    rpmGauge._resize();
    speedGauge._resize();
    if (state.lastResult) drawPowerCurve(state.lastResult.powerCurve);
  });

  populateTxPresets();
  renderGarage();
  applyCarToForm(JSON.parse(JSON.stringify(SAMPLE_CARS[2]))); // Supra default
  drawPowerCurve([]);
})();
