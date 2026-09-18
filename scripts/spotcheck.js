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

console.log('VelocityBench PowerCurve VERIFY — Phase 4');
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

console.log('\nDone. Re-run: node scripts/spotcheck.js');
