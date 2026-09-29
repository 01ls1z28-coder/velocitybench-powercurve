'use strict';
/**
 * Peak HP uniform torqueCurve scale — app-path smoke (mirrors js/app.js helpers).
 * Garage car: 2020-ford-mustang-gt (NOT Z28). Local only.
 */
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function cloneTorqueCurve(curve) {
  if (!curve) return null;
  var out = {};
  Object.keys(curve).forEach(function (k) {
    var v = Number(curve[k]);
    if (isFinite(v)) out[k] = v;
  });
  return out;
}
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

var state = { peakHpBaseline: null, curveAtBaseline: null, car: null };
function stashPeakHpBaseline(car, peakHpOpt) {
  var hp = peakHpOpt != null ? peakHpOpt
    : (car && (car.peakHp || Phys.peakHpFromCurve(car.torqueCurve || {}) || 450));
  state.peakHpBaseline = Math.round(Number(hp) || 0);
  state.curveAtBaseline = (car && car.torqueCurve) ? cloneTorqueCurve(car.torqueCurve) : null;
}
function scaleCurveForPeakHpChange(peakHp) {
  var baseline = state.peakHpBaseline;
  if (!(baseline > 0) || peakHp === baseline) return null;
  var src = state.curveAtBaseline;
  if (!src || !Object.keys(src).length) return null;
  var scaled = scaleTorqueCurveMap(src, peakHp / baseline);
  state.peakHpBaseline = peakHp;
  state.curveAtBaseline = cloneTorqueCurve(scaled);
  if (state.car) {
    state.car.torqueCurve = scaled;
    state.car.peakHp = peakHp;
  }
  return scaled;
}
function livePreviewPeakHpScale(peakHp) {
  var baseline = state.peakHpBaseline;
  var src = state.curveAtBaseline;
  if (!(baseline > 0) || !src || !Object.keys(src).length) return;
  var scaled = (peakHp === baseline) ? cloneTorqueCurve(src) : scaleTorqueCurveMap(src, peakHp / baseline);
  state.car.torqueCurve = scaled;
  state.car.peakHp = peakHp;
}
function readCarFromForm(peakHp) {
  var base = state.car || {};
  var car = Object.assign({}, base, {
    peakHp: peakHp,
    torqueCurve: base.torqueCurve ? cloneTorqueCurve(base.torqueCurve) : null,
    forceScale: 1
  });
  if (!car.torqueCurve) {
    car.torqueCurve = Phys.synthesizeTorqueCurve(peakHp, car.peakTqRpm, car.redline, car.peakHpRpm);
    stashPeakHpBaseline(car, peakHp);
  } else {
    var scaled = scaleCurveForPeakHpChange(peakHp);
    if (scaled) car.torqueCurve = scaled;
  }
  state.car = car;
  return car;
}

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
  launchMode: 'auto', tireType: 2, tireLabel: 'Slick'
};

var src = null;
for (var i = 0; i < GARAGE.length; i++) {
  if (GARAGE[i].id === '2020-ford-mustang-gt') { src = GARAGE[i]; break; }
}
if (!src) throw new Error('2020-ford-mustang-gt missing');
if (!src.torqueCurve || Object.keys(src.torqueCurve).length < 8) {
  throw new Error('Mustang GT missing baked torqueCurve');
}

var fs = require('fs');
var appSrc = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
['scaleTorqueCurveMap', 'stashPeakHpBaseline', 'scaleCurveForPeakHpChange', 'livePreviewPeakHpScale']
  .forEach(function (name) {
    if (appSrc.indexOf('function ' + name) < 0) throw new Error('MISSING from app.js: ' + name);
  });
if (appSrc.indexOf('peakHp * 0.12') >= 0) throw new Error('Custom Builder >12% resynth still present');

var baseHp = Math.round(Number(src.peakHp) || 0);
function fresh() {
  state.car = clone(src);
  state.car.forceScale = 1;
  stashPeakHpBaseline(state.car, baseHp);
}
fresh();
var stock = Phys.runQuarterMile(readCarFromForm(baseHp), Object.assign({}, WX));
fresh();
livePreviewPeakHpScale(baseHp + 100);
var plus = Phys.runQuarterMile(readCarFromForm(baseHp + 100), Object.assign({}, WX));
fresh();
livePreviewPeakHpScale(baseHp - 50);
var minus = Phys.runQuarterMile(readCarFromForm(baseHp - 50), Object.assign({}, WX));

// Custom Builder >12% → uniform scale (not resynth)
fresh();
var custom = {
  name: 'Custom Builder', id: 'custom',
  weightLbs: 3800, dragCoefficient: 0.35, frontalAreaSqFt: 22.5, tireRadiusInches: 13.2,
  finalDriveRatio: 3.73, gearRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
  peakHp: 450, peakTqRpm: 4200, peakHpRpm: 6200, redline: 6800,
  isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000,
  drivetrainLossPercent: 15, forceScale: 1,
  torqueCurve: Phys.synthesizeTorqueCurve(450, 4200, 6800, 6200)
};
state.car = clone(custom);
stashPeakHpBaseline(state.car, 450);
var baseCurve = cloneTorqueCurve(state.car.torqueCurve);
var scaled600 = scaleCurveForPeakHpChange(600);
var keys = Object.keys(baseCurve).map(Number).sort(function (a, b) { return a - b; });
var ratios = keys.slice(0, 8).map(function (k) { return scaled600[k] / baseCurve[k]; });
ratios.forEach(function (r) {
  if (Math.abs(r - 600 / 450) > 1e-6) throw new Error('Custom >12% not uniform scale: ' + r);
});

// ATC/Z28 stock preserved when Peak HP not edited (regression lock)
var z28 = null;
for (var zi = 0; zi < GARAGE.length; zi++) {
  if (GARAGE[zi].id === '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals') {
    z28 = clone(GARAGE[zi]); break;
  }
}
if (!z28) throw new Error('Z28 ATC missing');
z28.forceScale = 1;
var zStock = Phys.runQuarterMile(z28, Object.assign({}, WX, { tireType: 2, tireLabel: 'Slick' }));

var dPlus = plus.quarterMileTime - stock.quarterMileTime;
var dMinus = minus.quarterMileTime - stock.quarterMileTime;
var dTrapPlus = plus.quarterMileSpeedMph - stock.quarterMileSpeedMph;
var dTrapMinus = minus.quarterMileSpeedMph - stock.quarterMileSpeedMph;

console.log('car\t2020 Ford Mustang GT\tpeakHp\t' + baseHp + '\tcurveKeys\t' + Object.keys(src.torqueCurve).length);
console.log('path\tapp.js scaleCurveForPeakHpChange + livePreviewPeakHpScale');
console.log(['case', 'ET', 'trap', 'ΔET', 'Δtrap'].join('\t'));
console.log(['stock', stock.quarterMileTime.toFixed(3), stock.quarterMileSpeedMph.toFixed(2), '—', '—'].join('\t'));
console.log(['+100 Peak HP uniform scale', plus.quarterMileTime.toFixed(3), plus.quarterMileSpeedMph.toFixed(2), dPlus.toFixed(3), dTrapPlus.toFixed(2)].join('\t'));
console.log(['−50 Peak HP uniform scale', minus.quarterMileTime.toFixed(3), minus.quarterMileSpeedMph.toFixed(2), dMinus.toFixed(3), dTrapMinus.toFixed(2)].join('\t'));
console.log('Custom 450→600 scale ratios (first8)\t' + ratios.map(function (r) { return r.toFixed(6); }).join(',') + '\texpect\t' + (600 / 450).toFixed(6));
console.log('Z28 ATC stock (untouched)\t' + zStock.quarterMileTime.toFixed(3) + '@' + zStock.quarterMileSpeedMph.toFixed(2) +
  '\t60-130\t' + (zStock.sixtyToOneThirty != null ? zStock.sixtyToOneThirty.toFixed(3) : '—'));

if (!(dPlus < -0.15)) throw new Error('+100 must improve ET, got ΔET=' + dPlus);
if (!(dTrapPlus > 2)) throw new Error('+100 must raise trap, got Δtrap=' + dTrapPlus);
if (!(dMinus > 0.10)) throw new Error('−50 must slow ET, got ΔET=' + dMinus);
if (!(dTrapMinus < -1)) throw new Error('−50 must lower trap, got Δtrap=' + dTrapMinus);
if (Math.abs(zStock.quarterMileTime - 11.56) > 0.08) throw new Error('Z28 stock ET drifted');
if (Math.abs(zStock.quarterMileSpeedMph - 119) > 1.5) throw new Error('Z28 stock trap drifted');
console.log('PASS Mustang GT Peak HP app-path gates (+ Custom uniform + Z28 lock)');
