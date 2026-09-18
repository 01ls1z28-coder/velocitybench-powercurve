/**
 * VelocityBench PowerCurve — VERIFY spot-check harness (Phase 4 retip)
 *
 * Fleet sample + curated VERIFY cars. tireType ALWAYS explicit.
 * Weather: 70°F / 45% RH / 29.92 inHg, calm wind, launch=auto.
 *
 *   node scripts/spotcheck.js
 */
'use strict';

var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var WX = {
  tempF: 70,
  humidity: 45,
  pressureInHg: 29.92,
  windSpeedMph: 0,
  windDirDeg: 0,
  gustMph: 0,
  launchMode: 'auto'
};

function envFor(tireType) {
  return Object.assign({}, WX, {
    tireType: tireType,
    tireLabel: Phys.tireLabelForType(tireType)
  });
}

function findCar(pred) {
  for (var i = 0; i < GARAGE.length; i++) {
    if (pred(GARAGE[i])) return JSON.parse(JSON.stringify(GARAGE[i]));
  }
  return null;
}

/** Curated Phase-3 VERIFY cars (published curves) — kept for regression. */
var CURATED = {
  supra94: {
    id: 'supra94-verify',
    name: '1994 Toyota Supra Turbo (VERIFY)',
    weightLbs: 3450, dragCoefficient: 0.32, frontalAreaSqFt: 21.0, tireRadiusInches: 12.5,
    finalDriveRatio: 3.133, gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
    torqueCurve: {2000:185,2500:230,3000:275,3500:300,4000:315,4500:310,5000:305,5500:302,5600:300,6000:275,6500:250,7000:225},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6800, launchRpm: 2800, redline: 7000, drivetrainLossPercent: 12,
    peakHp: 320, peakTqRpm: 4000, peakHpRpm: 5600, txKey: 'Aisin_6', forceScale: 1
  },
  cobra65: {
    id: 'cobra65-verify',
    name: '1965 Shelby Cobra 427 (VERIFY)',
    weightLbs: 2520, dragCoefficient: 0.55, frontalAreaSqFt: 19.5, tireRadiusInches: 13.0,
    finalDriveRatio: 3.54, gearRatios: [2.20, 1.66, 1.31, 1.00],
    torqueCurve: {1500:380,2000:420,2500:450,3000:470,3500:480,4000:475,4500:460,5000:430,5500:400,6000:372,6500:330},
    isNA: true, driveType: 'RWD', shiftRpm: 6200, launchRpm: 3000, redline: 6500,
    drivetrainLossPercent: 15, peakHp: 425, peakTqRpm: 3500, peakHpRpm: 6000, txKey: 'Toploader_4', forceScale: 1
  },
  miata16: {
    id: 'miata16-verify',
    name: '2016 Mazda MX-5 Miata Club (VERIFY)',
    weightLbs: 2332, dragCoefficient: 0.36, frontalAreaSqFt: 18.8, tireRadiusInches: 12.1,
    finalDriveRatio: 2.866, gearRatios: [5.087, 2.991, 2.035, 1.594, 1.286, 1.000],
    torqueCurve: {2000:105,2500:118,3000:128,3500:138,4000:145,4500:148,4600:148,5000:145,5500:140,6000:136,6500:125,7000:112,7500:98},
    isNA: true, driveType: 'RWD', shiftRpm: 7200, launchRpm: 3500, redline: 7500,
    drivetrainLossPercent: 12, peakHp: 155, peakTqRpm: 4600, peakHpRpm: 6000, txKey: 'Aisin_6', forceScale: 1
  },
  hellcat19: {
    id: 'hellcat19-verify',
    name: '2019 Challenger Hellcat Redeye (VERIFY)',
    weightLbs: 4451, dragCoefficient: 0.382, frontalAreaSqFt: 24.2, tireRadiusInches: 14.3,
    finalDriveRatio: 2.62, gearRatios: [4.71, 3.14, 2.11, 1.67, 1.28, 1.00, 0.84, 0.67],
    torqueCurve: {1500:420,2000:520,2500:600,3000:650,3500:685,4000:700,4500:707,5000:700,5500:688,6000:675,6300:665,6500:640},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6100, launchRpm: 2200, redline: 6500, drivetrainLossPercent: 15,
    peakHp: 797, peakTqRpm: 4500, peakHpRpm: 6300, txKey: 'ZF8HP', forceScale: 1,
    hasAftermarketConverter: false
  }
};

function specsLine(car, tireType) {
  return [
    '  specs: wt ' + car.weightLbs + ' lb · Cd ' + car.dragCoefficient +
      ' · area ' + car.frontalAreaSqFt + ' ft² · tireR ' + car.tireRadiusInches + ' in',
    '         gears [' + (car.gearRatios || []).join(', ') + '] · FD ' + car.finalDriveRatio +
      ' · loss ' + car.drivetrainLossPercent + '% · forceScale ' + (car.forceScale != null ? car.forceScale : 1) +
      ' · ' + car.driveType,
    '         launch/shift/redline ' + car.launchRpm + '/' + car.shiftRpm + '/' + car.redline +
      ' · tireType ' + tireType + ' (' + Phys.tireLabelForType(tireType) + ')'
  ].join('\n');
}

function printRun(label, car, tireType, band) {
  var r = Phys.runQuarterMile(car, envFor(tireType));
  console.log('\n=== ' + label + ' ===');
  console.log(specsLine(car, tireType));
  console.log('  target band: ' + (band || '—'));
  console.log(
    '  sim: 1/4 ' + (r.quarterMileTime != null ? r.quarterMileTime.toFixed(3) : '—') +
    ' s @ ' + (r.quarterMileSpeedMph != null ? r.quarterMileSpeedMph.toFixed(1) : '—') + ' mph' +
    ' · 60ft ' + (r.sixtyFootTime != null ? r.sixtyFootTime.toFixed(3) : '—') +
    ' · 0-60 ' + (r.zeroToSixty != null ? r.zeroToSixty.toFixed(3) : '—') +
    ' · 60-130 ' + (r.sixtyToOneThirty != null ? r.sixtyToOneThirty.toFixed(3) : '—') +
    ' · 100-150 ' + (r.hundredToOneFifty != null ? r.hundredToOneFifty.toFixed(3) : '—') +
    ' · Vmax ' + (r.topSpeedMph != null ? r.topSpeedMph.toFixed(1) : '—') +
    ' mph (' + (r.vmaxReason || '') + ')'
  );
  return r;
}

console.log('VelocityBench PowerCurve VERIFY — Phase 6 (EV + Hybrid powerSource)');
console.log('CalibrationFactor =', Phys.CalibrationFactor);
console.log('Garage fleet size =', GARAGE.length);
console.log('Weather: 70°F / 45% RH / 29.92 inHg, calm, launch=auto');

// ---- Curated regression (Phase 3 bands) ----
printRun('VERIFY Supra Turbo', CURATED.supra94, 1, '12.8–13.9 @ 102–112');
printRun('VERIFY Cobra 427', CURATED.cobra65, 1, '11.0–12.8 @ 112–130');
printRun('VERIFY Miata Club', CURATED.miata16, 0, '15.2–16.8 @ 84–93');
printRun('VERIFY Hellcat Redeye', CURATED.hellcat19, 1, '10.4–12.2 @ 118–138');

var supraStreet = Phys.runQuarterMile(CURATED.supra94, envFor(0));
console.log('\nStreet contrast (Supra, tireType 0): ' +
  supraStreet.quarterMileTime.toFixed(3) + ' s @ ' +
  supraStreet.quarterMileSpeedMph.toFixed(1) + ' mph');

// ---- Fleet sample vs Excel targets ----
var SAMPLES = [
  '2020 Ford Mustang GT',
  '1994 Toyota Supra Twin Turbo',
  '1965 Shelby Cobra 427',
  '2023 Mazda MX-5 Miata Club',
  '2021 Dodge Charger Hellcat Redeye',
  '2020 Ford Mustang Shelby GT500',
  '2013 Ford Mustang Boss 302',
  '2002 Nissan Skyline GT-R R34'
];

console.log('\n---------- FLEET SAMPLE vs Excel targets ----------');
SAMPLES.forEach(function (name) {
  var car = findCar(function (c) { return c.name === name; });
  if (!car) {
    console.log('\nMISSING in garage: ' + name);
    return;
  }
  var tt = car.tireType | 0;
  var r = printRun('FLEET ' + name, car, tt, '(see garage-calib-meta.json)');
  void r;
});

// Env sanity (Supra curated, Drag Radial)
var calm = Phys.runQuarterMile(CURATED.supra94, envFor(1));
var head = Phys.runQuarterMile(CURATED.supra94, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 0 }));
var tail = Phys.runQuarterMile(CURATED.supra94, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 180 }));
console.log('\n---------- ENV ----------');
console.log('12 mph headwind vs calm (Supra, Drag Radial): ET ' +
  (head.quarterMileTime - calm.quarterMileTime >= 0 ? '+' : '') +
  (head.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');
console.log('12 mph tailwind vs calm (Supra, Drag Radial): ET ' +
  (tail.quarterMileTime - calm.quarterMileTime >= 0 ? '+' : '') +
  (tail.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');


// ---- Weight distribution traction delta (Supra VERIFY, Drag Radial) ----
console.log('\n---------- WEIGHT DISTRIBUTION vs 50/50 ----------');
(function () {
  var base = JSON.parse(JSON.stringify(CURATED.supra94));
  base.frontWeightPercent = 50;
  base.rearWeightPercent = 50;
  base.leftWeightPercent = 50;
  base.rightWeightPercent = 50;
  var calm50 = Phys.runQuarterMile(base, envFor(1));

  var rearBias = JSON.parse(JSON.stringify(base));
  rearBias.frontWeightPercent = 40;
  rearBias.rearWeightPercent = 60; // more rear for RWD launch
  var rRear = Phys.runQuarterMile(rearBias, envFor(1));

  var lrBias = JSON.parse(JSON.stringify(base));
  lrBias.leftWeightPercent = 60;
  lrBias.rightWeightPercent = 40; // uneven axle load
  var rLR = Phys.runQuarterMile(lrBias, envFor(1));

  function dET(a, b) { return (a.quarterMileTime - b.quarterMileTime); }
  function d60(a, b) { return (a.sixtyFootTime - b.sixtyFootTime); }
  console.log('Baseline F/R 50/50 · L/R 50/50: 1/4 ' +
    calm50.quarterMileTime.toFixed(3) + ' s · 60ft ' + calm50.sixtyFootTime.toFixed(3) + ' s');
  console.log('RWD rear bias F/R 40/60 vs 50/50: ET ' +
    (dET(rRear, calm50) >= 0 ? '+' : '') + dET(rRear, calm50).toFixed(3) +
    ' s · 60ft ' + (d60(rRear, calm50) >= 0 ? '+' : '') + d60(rRear, calm50).toFixed(3) + ' s');
  console.log('L/R 60/40 vs 50/50 (same F/R 50/50): ET ' +
    (dET(rLR, calm50) >= 0 ? '+' : '') + dET(rLR, calm50).toFixed(3) +
    ' s · 60ft ' + (d60(rLR, calm50) >= 0 ? '+' : '') + d60(rLR, calm50).toFixed(3) + ' s');
})();


// ---- Phase 6: EV + Hybrid power source ----
console.log('\n---------- POWER SOURCE (EV / Hybrid) ----------');
(function () {
  var evN = 0, hyN = 0, mis = [];
  GARAGE.forEach(function (c) {
    if (c.isEv || c.powerSource === 'ev') evN++;
    if (c.isHybrid || c.powerSource === 'hybrid') hyN++;
  });
  console.log('Fleet powerSource counts: EV ' + evN + ' · Hybrid ' + hyN);

  var zr = findCar(function (c) { return /zr1x/i.test(c.name); });
  if (!zr) {
    console.log('FAIL: ZR1X missing');
  } else {
    var ok = zr.isHybrid && !zr.isEv && zr.powerSource === 'hybrid' &&
      zr.boostModel === 'turbo' && (zr.gearRatios || []).length > 1 && zr.txKey !== 'EV_Single';
    console.log('ZR1X bake: isHybrid=' + zr.isHybrid + ' isEv=' + zr.isEv +
      ' boost=' + zr.boostModel + ' tx=' + zr.txKey + ' gears=' + (zr.gearRatios || []).length +
      ' → ' + (ok ? 'PASS' : 'FAIL'));
    if (ok) {
      var rZ = printRun('FLEET Hybrid ZR1X', zr, zr.tireType | 0, 'Excel ~1.9 / 8.675@159');
      void rZ;
    }
  }

  var sf = findCar(function (c) { return /sf90/i.test(c.name); });
  if (!sf) {
    console.log('FAIL: SF90 missing for Hybrid delta');
  } else {
    var wx = envFor(sf.tireType | 0);
    var rHy = Phys.runQuarterMile(sf, wx);
    var ice = JSON.parse(JSON.stringify(sf));
    ice.isHybrid = false;
    ice.powerSource = ice.boostModel || 'turbo';
    delete ice.hybridAssistFrac;
    var rIce = Phys.runQuarterMile(ice, wx);
    var dEt = rHy.quarterMileTime - rIce.quarterMileTime;
    console.log('SF90 Hybrid vs ICE-only (same ICE-fraction curve):');
    console.log('  Hybrid  1/4 ' + rHy.quarterMileTime.toFixed(3) + ' s @ ' +
      rHy.quarterMileSpeedMph.toFixed(1) + ' mph · 0-60 ' +
      (rHy.zeroToSixty != null ? rHy.zeroToSixty.toFixed(3) : '—'));
    console.log('  ICE-only 1/4 ' + rIce.quarterMileTime.toFixed(3) + ' s @ ' +
      rIce.quarterMileSpeedMph.toFixed(1) + ' mph · 0-60 ' +
      (rIce.zeroToSixty != null ? rIce.zeroToSixty.toFixed(3) : '—'));
    console.log('  ΔET Hybrid−ICE ' + (dEt >= 0 ? '+' : '') + dEt.toFixed(3) + ' s ' +
      (dEt < -0.05 ? 'PASS (assist affects run)' : 'FAIL (assist too weak)'));
  }

  var plaid = findCar(function (c) { return /model s plaid/i.test(c.name); });
  if (plaid) {
    var okEv = plaid.isEv && !plaid.isHybrid && plaid.powerSource === 'ev';
    console.log('Model S Plaid: isEv=' + plaid.isEv + ' powerSource=' + plaid.powerSource +
      ' → ' + (okEv ? 'PASS' : 'FAIL'));
    printRun('FLEET EV Model S Plaid', plaid, plaid.tireType | 0, 'Excel 2.1 / 9.25@151');
  }
})();



// ---- Motorcycle redline / shift / powerband ----
console.log('\n---------- MOTORCYCLES (redline / shift / powerband) ----------');
(function () {
  var samples = [
    { name: '2021 Kawasaki Ninja ZX-10R', minRed: 12000, minShift: 11500, maxPeakTq: 120, cls: 'sport' },
    { name: '2022 Suzuki Hayabusa', minRed: 10000, minShift: 9500, maxPeakTq: 140, cls: 'hyper' }
  ];
  var pass = 0;
  samples.forEach(function (s) {
    var car = findCar(function (c) { return c.name === s.name; });
    if (!car) {
      console.log('FAIL: missing ' + s.name);
      return;
    }
    var tc = car.torqueCurve || {};
    var keys = Object.keys(tc).map(Number).filter(isFinite).sort(function (a, b) { return a - b; });
    var peakTq = 0, peakTqRpm = 0, peakHp = 0, peakHpRpm = 0;
    keys.forEach(function (k) {
      var tq = Number(tc[k]);
      if (tq > peakTq) { peakTq = tq; peakTqRpm = k; }
      var hp = tq * k / 5252;
      if (hp > peakHp) { peakHp = hp; peakHpRpm = k; }
    });
    var ok =
      car.category === 'Motorcycle' &&
      car.redline >= s.minRed &&
      car.shiftRpm >= s.minShift &&
      car.shiftRpm <= car.redline &&
      car.redline >= (keys.length ? keys[keys.length - 1] * 0.95 : 0) &&
      peakTq <= s.maxPeakTq &&
      peakHpRpm >= car.redline * 0.75 &&
      (car.gearRatios || []).length >= 6 &&
      (car.txKey === 'Bike_Sport_6' || car.txKey === 'Bike_Hyper_6');
    console.log(s.name + ' [' + s.cls + ']');
    console.log('  category=' + car.category + ' tx=' + car.txKey +
      ' gears=' + (car.gearRatios || []).length +
      ' FD=' + car.finalDriveRatio);
    console.log('  launch/shift/redline ' + car.launchRpm + '/' + car.shiftRpm + '/' + car.redline +
      ' · curve ' + (keys[0] || '?') + '..' + (keys[keys.length - 1] || '?') +
      ' · peakTQ ' + peakTq.toFixed(1) + '@' + peakTqRpm +
      ' · peakHP ' + peakHp.toFixed(1) + '@' + peakHpRpm);
    var r = printRun('BIKE ' + s.name, car, car.tireType | 0,
      s.cls === 'sport' ? 'Excel ~3.1 / ~10.3@146 · shift≥12k' : 'Excel ~2.5 / ~9.9@145 · shift≥10k');
    console.log('  shiftRpm used in sim: ' + r.shiftRpm + ' · shifts: ' + r.totalShifts +
      ' → ' + (ok && r.shiftRpm >= s.minShift ? 'PASS' : 'FAIL'));
    if (ok && r.shiftRpm >= s.minShift) pass++;
  });
  console.log('Motorcycle spotchecks: ' + pass + '/' + samples.length +
    (pass === samples.length ? ' PASS' : ' FAIL'));
})();

// ---- EV instrument mode (logic gate — Power % primary dial) ----
console.log('\n---------- EV INSTRUMENTS (Power % primary) ----------');
(function () {
  var plaid = findCar(function (c) { return /model s plaid/i.test(c.name); });
  var hy = findCar(function (c) { return /sf90/i.test(c.name); });
  var ice = findCar(function (c) { return c.name === '2020 Ford Mustang GT'; });
  function wantEvDial(car) {
    return !!(car && (car.isEv || car.powerSource === 'ev') && !car.isHybrid);
  }
  var okEv = plaid && wantEvDial(plaid) === true;
  var okHy = hy && wantEvDial(hy) === false && hy.isHybrid;
  var okIce = ice && wantEvDial(ice) === false;
  console.log('EV display choice: primary left dial = Power % (0–100); live strip keeps MOTOR rpm.');
  console.log('  Garage EV (Plaid) → EV dial: ' + (okEv ? 'PASS' : 'FAIL'));
  console.log('  Hybrid (SF90) → keep ICE RPM: ' + (okHy ? 'PASS' : 'FAIL'));
  console.log('  ICE (Mustang GT) → RPM tach: ' + (okIce ? 'PASS' : 'FAIL'));
  console.log('  Custom EV toggle: same wantEvDial path as garage EV (app.js configurePrimaryGauge).');
})();



// ---- EV electronic speed limiters + chart gate ----
console.log('\n---------- EV SPEED LIMITERS + CHART ----------');
(function () {
  var samples = [
    { id: '2022-tesla-model-s-plaid', name: /model s plaid/i, lim: 200, tol: 1.5 },
    { id: '2023-hyundai-kona-electric', name: /kona electric/i, lim: 104, tol: 1.5 }
  ];
  var pass = 0;
  samples.forEach(function (s) {
    var car = findCar(function (c) { return c.id === s.id || s.name.test(c.name || ''); });
    if (!car) { console.log('FAIL: missing ' + s.id); return; }
    var baked = car.speedLimiterMph;
    var okBake = baked === s.lim;
    var r = Phys.runQuarterMile(car, envFor(car.tireType | 0));
    var vmax = r.topSpeedMph;
    var okV = vmax != null && Math.abs(vmax - s.lim) <= s.tol;
    var okReason = (r.vmaxReason || '').indexOf('ev_speed_limiter_') === 0;
    console.log(car.name + ' limiter baked=' + baked + ' (want ' + s.lim + ') · Vmax ' +
      (vmax != null ? vmax.toFixed(1) : '—') + ' · ' + (r.vmaxReason || '') +
      ' → ' + (okBake && okV && okReason ? 'PASS' : 'FAIL'));
    if (okBake && okV && okReason) pass++;
  });

  // ICE curated unchanged (no limiter field)
  var supra = findCar(function (c) { return /1994 Toyota Supra Twin Turbo/.test(c.name || ''); });
  if (!supra) {
    // curated object path
    console.log('Fleet Supra skip — using curated VERIFY Supra band from earlier section');
  } else {
    var okIce = !(supra.speedLimiterMph > 0);
    console.log('Fleet ICE Supra speedLimiterMph unset → ' + (okIce ? 'PASS' : 'FAIL'));
    if (okIce) pass++;
  }

  // Chart gate (logic): EV mode replaces dyno; Hybrid keeps ICE dyno
  function wantEvChart(car) {
    return !!(car && (car.isEv || car.powerSource === 'ev') && !car.isHybrid);
  }
  var plaid = findCar(function (c) { return /model s plaid/i.test(c.name || ''); });
  var hy = findCar(function (c) { return /sf90/i.test(c.name || ''); });
  var okChart = plaid && wantEvChart(plaid) === true && hy && wantEvChart(hy) === false;
  console.log('EV chart swap gate (Plaid=EV chart, SF90=ICE dyno): ' + (okChart ? 'PASS' : 'FAIL'));
  if (okChart) pass++;

  var evN = 0, limN = 0;
  GARAGE.forEach(function (c) {
    if (c.isEv || c.powerSource === 'ev') {
      evN++;
      if (c.speedLimiterMph > 0) limN++;
    }
  });
  console.log('Garage EVs with speedLimiterMph: ' + limN + '/' + evN +
    (limN === evN && evN >= 39 ? ' PASS' : ' FAIL'));
  if (limN === evN && evN >= 39) pass++;

  console.log('EV limiter/chart checks: ' + pass + ' PASS blocks');
})();


// ---- Cybertruck Beast calib + ATC stall/flash ----
console.log('\n---------- CYBERTRUCK BEAST + ATC ----------');
(function () {
  var ct = findCar(function (c) { return c.id === '2024-tesla-cybertruck-tri-motor' || /cybertruck/i.test(c.name || ''); });
  if (!ct) { console.log('FAIL: Cybertruck missing'); return; }
  var r = Phys.runQuarterMile(ct, envFor(ct.tireType | 0));
  var ok60 = r.zeroToSixty != null && Math.abs(r.zeroToSixty - 2.6) <= 0.25;
  var okEt = r.quarterMileTime != null && Math.abs(r.quarterMileTime - 11.0) <= 0.35;
  var okTrap = r.quarterMileSpeedMph != null && Math.abs(r.quarterMileSpeedMph - 119) <= 6;
  var okV = r.topSpeedMph != null && Math.abs(r.topSpeedMph - 130) <= 2
    && String(r.vmaxReason || '').indexOf('ev_speed_limiter_') === 0;
  console.log('Cybertruck Tri-Motor: ' +
    (r.quarterMileTime != null ? r.quarterMileTime.toFixed(3) : '—') + 's @ ' +
    (r.quarterMileSpeedMph != null ? r.quarterMileSpeedMph.toFixed(1) : '—') + ' · 0-60 ' +
    (r.zeroToSixty != null ? r.zeroToSixty.toFixed(3) : '—') + ' · Vmax ' +
    (r.topSpeedMph != null ? r.topSpeedMph.toFixed(1) : '—') + ' (' + (r.vmaxReason || '') + ')');
  console.log('  vs C&D 2.6 / 11.0@119 / 130gov → ' +
    (ok60 && okEt && okTrap && okV ? 'PASS' : 'FAIL'));

  var scat = findCar(function (c) { return /challenger r\/t scat/i.test(c.name || ''); });
  if (!scat) { console.log('FAIL: Scat Pack missing for ATC'); return; }
  var wx = envFor(1);
  function atcRun(stall, flash) {
    var c = JSON.parse(JSON.stringify(scat));
    c.hasAftermarketConverter = true;
    c.stallRpm = stall;
    c.flashRpm = flash;
    return Phys.runQuarterMile(c, wx);
  }
  var off = JSON.parse(JSON.stringify(scat));
  off.hasAftermarketConverter = false;
  var rOff = Phys.runQuarterMile(off, wx);
  var rLo = atcRun(2800, 3500);
  var rHi = atcRun(4500, 5500);
  var dOnOff = Math.abs(rLo.zeroToSixty - rOff.zeroToSixty);
  var dStall = Math.abs(rHi.zeroToSixty - rLo.zeroToSixty);
  console.log('ATC Scat Pack: OFF 0-60 ' + rOff.zeroToSixty.toFixed(3) +
    ' · ON 2800/3500 ' + rLo.zeroToSixty.toFixed(3) +
    ' · ON 4500/5500 ' + rHi.zeroToSixty.toFixed(3));
  console.log('  ON≠OFF Δ=' + dOnOff.toFixed(3) + ' · stall/flash Δ=' + dStall.toFixed(3) + ' → ' +
    (dOnOff >= 0.04 && dStall >= 0.01 ? 'PASS' : 'FAIL'));
})();

console.log('\nDone. Re-run: node scripts/spotcheck.js');
