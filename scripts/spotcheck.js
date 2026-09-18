/**
 * VelocityBench PowerCurve — VERIFY spot-check harness (Phase 3 ADDENDUM)
 *
 * Mirrors garage sample cars from js/app.js for the four VERIFY vehicles.
 * Weather: 70°F / 45% RH / 29.92 inHg, calm wind, launch=auto.
 * Prints BOTH times AND the key specs used (tireType explicit) so Seraph can verify.
 *
 *   node scripts/spotcheck.js
 */
'use strict';

var Phys = require('../js/physics.js');

var CARS = {
  supra94: {
    id: 'supra94',
    name: '1994 Toyota Supra Turbo',
    weightLbs: 3450, dragCoefficient: 0.32, frontalAreaSqFt: 21.0, tireRadiusInches: 12.5,
    finalDriveRatio: 3.133, gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
    torqueCurve: {2000:185,2500:230,3000:275,3500:300,4000:315,4500:310,5000:305,5500:302,5600:300,6000:275,6500:250,7000:225},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6800, launchRpm: 2800, redline: 7000, drivetrainLossPercent: 12,
    peakHp: 320, peakTqRpm: 4000, peakHpRpm: 5600, txKey: 'Aisin_6'
  },
  cobra65: {
    id: 'cobra65',
    name: '1965 Shelby Cobra 427',
    weightLbs: 2520, dragCoefficient: 0.55, frontalAreaSqFt: 19.5, tireRadiusInches: 13.0,
    finalDriveRatio: 3.54, gearRatios: [2.20, 1.66, 1.31, 1.00],
    torqueCurve: {1500:380,2000:420,2500:450,3000:470,3500:480,4000:475,4500:460,5000:430,5500:400,6000:372,6500:330},
    isNA: true, driveType: 'RWD', shiftRpm: 6200, launchRpm: 3000, redline: 6500,
    drivetrainLossPercent: 15, peakHp: 425, peakTqRpm: 3500, peakHpRpm: 6000, txKey: 'Toploader_4'
  },
  miata16: {
    id: 'miata16',
    name: '2016 Mazda MX-5 Miata Club',
    weightLbs: 2332, dragCoefficient: 0.36, frontalAreaSqFt: 18.8, tireRadiusInches: 12.1,
    finalDriveRatio: 2.866, gearRatios: [5.087, 2.991, 2.035, 1.594, 1.286, 1.000],
    torqueCurve: {2000:105,2500:118,3000:128,3500:138,4000:145,4500:148,4600:148,5000:145,5500:140,6000:136,6500:125,7000:112,7500:98},
    isNA: true, driveType: 'RWD', shiftRpm: 7200, launchRpm: 3500, redline: 7500,
    drivetrainLossPercent: 12, peakHp: 155, peakTqRpm: 4600, peakHpRpm: 6000, txKey: 'Aisin_6'
  },
  hellcat19: {
    id: 'hellcat19',
    name: '2019 Challenger Hellcat Redeye',
    weightLbs: 4451, dragCoefficient: 0.382, frontalAreaSqFt: 24.2, tireRadiusInches: 14.3,
    finalDriveRatio: 2.62, gearRatios: [4.71, 3.14, 2.11, 1.67, 1.28, 1.00, 0.84, 0.67],
    torqueCurve: {1500:420,2000:520,2500:600,3000:650,3500:685,4000:700,4500:707,5000:700,5500:688,6000:675,6300:665,6500:640},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6100, launchRpm: 2200, redline: 6500, drivetrainLossPercent: 15,
    peakHp: 797, peakTqRpm: 4500, peakHpRpm: 6300, txKey: 'ZF8HP',
    hasAftermarketConverter: false
  }
};

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
    tireLabel: ['Street', 'Drag Radial', 'Slick'][tireType]
  });
}

function run(id, tireType) {
  var car = JSON.parse(JSON.stringify(CARS[id]));
  return Phys.runQuarterMile(car, envFor(tireType));
}

function curvePeaks(curve) {
  var keys = Object.keys(curve).map(Number);
  var pt = 0, pr = 0, ph = 0, phr = 0;
  keys.forEach(function (r) {
    var t = Number(curve[r]);
    var h = (t * r) / 5252;
    if (t > pt) { pt = t; pr = r; }
    if (h > ph) { ph = h; phr = r; }
  });
  return { tq: pt, tqRpm: pr, hp: ph, hpRpm: phr };
}

function specsLine(car, tireType) {
  var tireLabel = ['Street', 'Drag Radial', 'Slick'][tireType];
  return [
    '  specs: wt ' + car.weightLbs + ' lb · Cd ' + car.dragCoefficient +
      ' · area ' + car.frontalAreaSqFt + ' ft² · tireR ' + car.tireRadiusInches + ' in',
    '         gears [' + car.gearRatios.join(', ') + '] · FD ' + car.finalDriveRatio +
      ' · loss ' + car.drivetrainLossPercent + '% · ' + car.driveType,
    '         launch/shift/redline ' + car.launchRpm + '/' + car.shiftRpm + '/' + car.redline +
      ' · tireType ' + tireType + ' (' + tireLabel + ')' +
      (car.boostPsi ? ' · boost ' + car.boostPsi + ' psi' : ' · boost off (curve includes FI)')
  ].join('\n');
}

console.log('CalibrationFactor =', Phys.CalibrationFactor);
console.log('FactoryTransmissions wired:', Object.keys(Phys.FactoryTransmissions).length, 'presets');
console.log('Weather: 70°F / 45% RH / 29.92 inHg, calm, launch=auto');
console.log('Vmax caps: speed', Phys.constants.VMAX_SPEED_CAP_MPH, 'mph · dist',
  Phys.constants.VMAX_DIST_CAP_FT, 'ft · time', Phys.constants.MAX_T, 's');
console.log('');

console.log('--- Curve peaks (HP = TQ×RPM/5252) ---');
Object.keys(CARS).forEach(function (id) {
  var c = CARS[id];
  var p = curvePeaks(c.torqueCurve);
  console.log(id + ': peak TQ ' + p.tq.toFixed(0) + ' @ ' + p.tqRpm +
    ' · peak HP ' + p.hp.toFixed(1) + ' @ ' + p.hpRpm +
    ' (label peakHp=' + c.peakHp + ')');
});
console.log('');

var spots = [
  ['supra94', 1, 'Drag Radial', '1994 Supra Turbo'],
  ['cobra65', 1, 'Drag Radial', '1965 Cobra 427'],
  ['miata16', 0, 'Street', '2016 MX-5 Miata'],
  ['hellcat19', 1, 'Drag Radial', '2019 Hellcat Redeye']
];

console.log('--- Quarter-mile + Vmax (times AND specs) ---');
spots.forEach(function (s) {
  var car = CARS[s[0]];
  var r = run(s[0], s[1]);
  console.log(s[3] + ' [' + s[2] + ']: ' + r.quarterMileTime.toFixed(3) + 's @ ' +
    r.quarterMileSpeedMph.toFixed(1) + ' mph, 60ft ' + r.sixtyFootTime.toFixed(3) +
    ', ' + r.totalShifts + ' shifts | Vmax ' + r.topSpeedMph.toFixed(1) + ' mph (' +
    r.vmaxReason + ')');
  console.log(specsLine(car, s[1]));
});

console.log('');
console.log('--- Environmental / model (tip) ---');
var supra = JSON.parse(JSON.stringify(CARS.supra94));
var calm = Phys.runQuarterMile(supra, envFor(1));
var head = Phys.runQuarterMile(supra, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 0 }));
var tail = Phys.runQuarterMile(supra, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 180 }));
console.log('12 mph headwind vs calm (Supra, Drag Radial): ET ' +
  ((head.quarterMileTime - calm.quarterMileTime) >= 0 ? '+' : '') +
  (head.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');
console.log('12 mph tailwind vs calm (Supra, Drag Radial): ET ' +
  (tail.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');

var na = JSON.parse(JSON.stringify(CARS.supra94));
na.isFI = false; na.isNA = true; na.boostModel = 'na'; na.boostPsi = 0;
var da0 = Phys.runQuarterMile(na, Object.assign(envFor(1), { densityAltitudeFtInput: 0 }));
var da5 = Phys.runQuarterMile(na, Object.assign(envFor(1), { densityAltitudeFtInput: 5000 }));
console.log('NA Supra-curve DA 0 → 5000 ft (Drag Radial): ET +' +
  (da5.quarterMileTime - da0.quarterMileTime).toFixed(3) + ' s');

var boosted = JSON.parse(JSON.stringify(na));
boosted.boostModel = 'turbo'; boosted.boostPsi = 12; boosted.isFI = true; boosted.isNA = false;
var naR = Phys.runQuarterMile(na, envFor(1));
var fiR = Phys.runQuarterMile(boosted, envFor(1));
console.log('NA Supra-curve + turbo 12 psi (Drag Radial): ET ' +
  (fiR.quarterMileTime - naR.quarterMileTime).toFixed(3) + ' s');

var tiny = {
  name: '1hp/20lb', weightLbs: 20, peakHp: 1, peakTqRpm: 4000, peakHpRpm: 6000, redline: 7000,
  gearRatios: [2.66, 1.78, 1.30, 1.00], finalDriveRatio: 3.73, dragCoefficient: 0.35,
  frontalAreaSqFt: 10, tireRadiusInches: 12, isNA: true, driveType: 'RWD',
  shiftRpm: 6500, launchRpm: 3000, drivetrainLossPercent: 15
};
var huge = {
  name: '15000hp/120000lb', weightLbs: 120000, peakHp: 15000, peakTqRpm: 4000, peakHpRpm: 6000, redline: 7000,
  gearRatios: [2.66, 1.78, 1.30, 1.00], finalDriveRatio: 3.73, dragCoefficient: 0.5,
  frontalAreaSqFt: 40, tireRadiusInches: 18, isNA: true, driveType: 'RWD',
  shiftRpm: 6500, launchRpm: 3000, drivetrainLossPercent: 15
};
var t1 = Phys.runQuarterMile(tiny, envFor(1));
var t2 = Phys.runQuarterMile(huge, envFor(1));
console.log('Extremes 1 hp/20 lb and 15000 hp/120000 lb: finish=' + t1.finished + '/' + t2.finished +
  ' vmax=' + t1.topSpeedMph.toFixed(0) + '/' + t2.topSpeedMph.toFixed(0) + ' mph');

var street = Phys.runQuarterMile(JSON.parse(JSON.stringify(CARS.supra94)), envFor(0));
console.log('Supra Street tire (tireType 0) contrast: ' +
  street.quarterMileTime.toFixed(3) + 's @ ' + street.quarterMileSpeedMph.toFixed(1) + ' mph');
