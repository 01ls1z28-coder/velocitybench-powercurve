/**
 * VelocityBench PowerCurve — VERIFY spot-check harness
 *
 * Loads garage sample vehicles (mirrors js/app.js SAMPLE_CARS) with the SAME
 * weather as VERIFY.md: 70°F / 45% RH / 29.92 inHg, calm wind, launch=auto.
 * Tire: Drag Radial (UI default) for power cars; Street for Miata (as VERIFY).
 *
 *   node scripts/spotcheck.js
 *
 * Note: omitting tireType in physics defaults to Street (case 0) and yields
 * slower ETs (~13.23@109 Supra, etc.). VERIFY / this harness set tireType
 * explicitly to match the UI default (Drag Radial = 1).
 */
'use strict';

var Phys = require('../js/physics.js');

var CARS = {
  supra94: {
    id: 'supra94',
    name: '1994 Toyota Supra Turbo',
    weightLbs: 3450, dragCoefficient: 0.33, frontalAreaSqFt: 21.8, tireRadiusInches: 13.1,
    finalDriveRatio: 3.27, gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
    torqueCurve: {2000:180,2500:220,3000:260,3500:300,4000:330,4500:350,5000:360,5500:365,6000:360,6500:345,7000:320},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6800, launchRpm: 2800, redline: 7000, drivetrainLossPercent: 12, peakHp: 320, txKey: 'Aisin_6'
  },
  cobra65: {
    id: 'cobra65',
    name: '1965 Shelby Cobra 427',
    weightLbs: 2450, dragCoefficient: 0.52, frontalAreaSqFt: 20.5, tireRadiusInches: 13.5,
    finalDriveRatio: 3.54, gearRatios: [2.32, 1.61, 1.23, 1.00],
    torqueCurve: {1500:360,2000:400,2500:440,3000:470,3500:500,4000:520,4500:535,5000:540,5500:525,6000:500,6500:460},
    isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000, redline: 6500,
    drivetrainLossPercent: 15, peakHp: 425, txKey: 'Toploader_4'
  },
  miata16: {
    id: 'miata16',
    name: '2016 Mazda MX-5 Miata Club',
    weightLbs: 2340, dragCoefficient: 0.31, frontalAreaSqFt: 19.0, tireRadiusInches: 12.4,
    finalDriveRatio: 2.87, gearRatios: [5.09, 2.99, 2.05, 1.59, 1.29, 1.00],
    torqueCurve: {2000:100,2500:110,3000:120,3500:125,4000:130,4500:135,5000:140,5500:142,6000:140,6500:135,7000:130},
    isNA: true, driveType: 'RWD', shiftRpm: 7200, launchRpm: 3500, redline: 7500,
    drivetrainLossPercent: 12, peakHp: 155, txKey: 'Aisin_6'
  },
  hellcat19: {
    id: 'hellcat19',
    name: '2019 Challenger Hellcat Redeye',
    weightLbs: 4445, dragCoefficient: 0.37, frontalAreaSqFt: 24.5, tireRadiusInches: 13.8,
    finalDriveRatio: 2.62, gearRatios: [4.71, 3.14, 2.10, 1.67, 1.29, 1.00, 0.84, 0.67],
    peakHp: 797, peakTqRpm: 4000, peakHpRpm: 6200, redline: 6300,
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6100, launchRpm: 2200, drivetrainLossPercent: 15, txKey: 'ZF8HP',
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

function line(label, r) {
  return label + ': ' + r.quarterMileTime.toFixed(3) + 's @ ' +
    r.quarterMileSpeedMph.toFixed(1) + ' mph, 60ft ' + r.sixtyFootTime.toFixed(3) +
    ', ' + r.totalShifts + ' shifts';
}

console.log('CalibrationFactor =', Phys.CalibrationFactor);
console.log('FactoryTransmissions wired:', Object.keys(Phys.FactoryTransmissions).length, 'presets');
console.log('Weather: 70°F / 45% RH / 29.92 inHg, calm, launch=auto');
console.log('');

var spots = [
  ['supra94', 1, '1994 Supra Turbo (Drag Radial)'],
  ['cobra65', 1, '1965 Cobra 427 (Drag Radial)'],
  ['miata16', 0, '2016 MX-5 Miata (Street)'],
  ['hellcat19', 1, '2019 Hellcat Redeye (Drag Radial)']
];

spots.forEach(function (s) {
  console.log(line(s[2], run(s[0], s[1])));
});

console.log('');
console.log('--- Environmental / model (tip) ---');
var supra = JSON.parse(JSON.stringify(CARS.supra94));
var calm = Phys.runQuarterMile(supra, envFor(1));
var head = Phys.runQuarterMile(supra, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 0 }));
var tail = Phys.runQuarterMile(supra, Object.assign(envFor(1), { windSpeedMph: 12, windDirDeg: 180 }));
console.log('12 mph headwind vs calm (Supra): ET ' +
  ((head.quarterMileTime - calm.quarterMileTime) >= 0 ? '+' : '') +
  (head.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');
console.log('12 mph tailwind vs calm (Supra): ET ' +
  (tail.quarterMileTime - calm.quarterMileTime).toFixed(3) + ' s');

var na = JSON.parse(JSON.stringify(CARS.supra94));
na.isFI = false;
na.isNA = true;
na.boostModel = 'na';
na.boostPsi = 0;
var da0 = Phys.runQuarterMile(na, Object.assign(envFor(1), { densityAltitudeFtInput: 0 }));
var da5 = Phys.runQuarterMile(na, Object.assign(envFor(1), { densityAltitudeFtInput: 5000 }));
console.log('NA Supra-curve DA 0 → 5000 ft: ET +' +
  (da5.quarterMileTime - da0.quarterMileTime).toFixed(3) + ' s');

var boosted = JSON.parse(JSON.stringify(na));
boosted.boostModel = 'turbo';
boosted.boostPsi = 12;
boosted.isFI = true;
boosted.isNA = false;
var naR = Phys.runQuarterMile(na, envFor(1));
var fiR = Phys.runQuarterMile(boosted, envFor(1));
console.log('NA Supra-curve + turbo 12 psi: ET ' +
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
console.log('Extremes 1 hp/20 lb and 15000 hp/120000 lb: finish=' + t1.finished + '/' + t2.finished);
