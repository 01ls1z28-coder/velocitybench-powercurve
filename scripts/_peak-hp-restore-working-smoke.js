'use strict';
/**
 * Peak HP restore smoke — pre-da81539 >12% resynthesize path (1f53b39).
 * Generic garage: 2020-ford-mustang-gt. NOT Jorge Z28 as Peak HP case.
 * forceScale=1. Documents LIVE label-only ΔET=0 vs restored sequential-RUN ΔET.
 *
 * Sequential app path (matches readCarFromForm + state.car = car after RUN):
 *   1) apply Peak HP path at label → stock
 *   2) from that car, apply Peak HP path at label±Δ → mod
 */
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

function clone(o) { return JSON.parse(JSON.stringify(o)); }

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
  launchMode: 'auto', tireType: 2, tireLabel: 'Slick'
};

function find(id) {
  for (var i = 0; i < GARAGE.length; i++) {
    if (GARAGE[i].id === id) return clone(GARAGE[i]);
  }
  throw new Error('missing ' + id);
}

/** LIVE e539984: Peak HP label never touches garage curve. */
function applyLabelOnly(car, peakHp) {
  var c = clone(car);
  c.peakHp = peakHp;
  c.forceScale = 1;
  return c;
}

/**
 * Restored pre-da81539 readCarFromForm Peak HP path @ 1f53b39.
 * Mutates from whatever torqueCurve is currently on the car (post-RUN state).
 */
function applyRestoredPeakHpPath(car, peakHp) {
  var c = clone(car);
  c.peakHp = peakHp;
  c.forceScale = 1;
  var redline = Number(c.redline) || 6800;
  if (c.torqueCurve) {
    var curveHp = Phys.peakHpFromCurve(c.torqueCurve);
    if (Math.abs(curveHp - peakHp) > peakHp * 0.12) {
      c.torqueCurve = Phys.synthesizeTorqueCurve(
        peakHp, c.peakTqRpm, redline, c.peakHpRpm
      );
    }
  } else {
    c.torqueCurve = Phys.synthesizeTorqueCurve(
      peakHp, c.peakTqRpm, redline, c.peakHpRpm
    );
  }
  return c;
}

function run(c) {
  return Phys.runQuarterMile(c, Object.assign({}, WX));
}

function fmt(n, d) {
  if (n == null || !isFinite(n)) return '—';
  return Number(n).toFixed(d != null ? d : 3);
}

var mustang = find('2020-ford-mustang-gt');
mustang.forceScale = 1;
if (!mustang.torqueCurve || Object.keys(mustang.torqueCurve).length < 8) {
  throw new Error('Mustang GT missing baked torqueCurve');
}
var baseHp = Math.round(Number(mustang.peakHp) || 0);
var curveHp0 = Phys.peakHpFromCurve(mustang.torqueCurve);
if (!(baseHp > 100)) throw new Error('bad peakHp ' + baseHp);

// --- BEFORE: LIVE e539984 label-only ---
var liveStock = run(clone(mustang));
var livePlus = run(applyLabelOnly(mustang, baseHp + 100));
var liveDET = livePlus.quarterMileTime - liveStock.quarterMileTime;

// --- AFTER: sequential restored path ---
// Step1: first RUN at label (may wipe if label≠curve >12%)
var afterStockCar = applyRestoredPeakHpPath(mustang, baseHp);
var afterStock = run(afterStockCar);
// Step2: Peak HP +100 from post-RUN car (state.car = afterStockCar)
var afterPlusCar = applyRestoredPeakHpPath(afterStockCar, baseHp + 100);
var afterPlus = run(afterPlusCar);
// Step2b: Peak HP −50 from post-RUN stock car
var afterMinusCar = applyRestoredPeakHpPath(afterStockCar, baseHp - 50);
var afterMinus = run(afterMinusCar);

var dPlus = afterPlus.quarterMileTime - afterStock.quarterMileTime;
var dMinus = afterMinus.quarterMileTime - afterStock.quarterMileTime;
var dTrapPlus = afterPlus.quarterMileSpeedMph - afterStock.quarterMileSpeedMph;
var dTrapMinus = afterMinus.quarterMileSpeedMph - afterStock.quarterMileSpeedMph;
var d060Plus = afterPlus.zeroToSixty - afterStock.zeroToSixty;
var d060Minus = afterMinus.zeroToSixty - afterStock.zeroToSixty;

console.log('car\t2020 Ford Mustang GT\tlabelPeakHp\t' + baseHp +
  '\tgarageCurveHp\t' + curveHp0.toFixed(1) +
  '\tcurveKeys\t' + Object.keys(mustang.torqueCurve).length);
console.log('restoredFromSHA\t1f53b39\tpath\t|curveHp-peakHp|>12% → synthesizeTorqueCurve (pre-da81539)');
console.log('rejectedSHA\tfc4a72b\t(uniform scale — Jorge: STOP defending; Peak HP was perfect before)');
console.log('forceScale\t1');
console.log(['case', 'stockET@trap', 'modET@trap', 'ΔET', 'Δtrap', 'Δ0-60'].join('\t'));
console.log([
  'BEFORE e539984 label-only +100',
  fmt(liveStock.quarterMileTime, 3) + '@' + fmt(liveStock.quarterMileSpeedMph, 2),
  fmt(livePlus.quarterMileTime, 3) + '@' + fmt(livePlus.quarterMileSpeedMph, 2),
  fmt(liveDET, 3),
  '0.00',
  '0.000'
].join('\t'));
console.log([
  'AFTER restore sequential +100',
  fmt(afterStock.quarterMileTime, 3) + '@' + fmt(afterStock.quarterMileSpeedMph, 2),
  fmt(afterPlus.quarterMileTime, 3) + '@' + fmt(afterPlus.quarterMileSpeedMph, 2),
  fmt(dPlus, 3),
  fmt(dTrapPlus, 2),
  fmt(d060Plus, 3)
].join('\t'));
console.log([
  'AFTER restore sequential −50',
  fmt(afterStock.quarterMileTime, 3) + '@' + fmt(afterStock.quarterMileSpeedMph, 2),
  fmt(afterMinus.quarterMileTime, 3) + '@' + fmt(afterMinus.quarterMileSpeedMph, 2),
  fmt(dMinus, 3),
  fmt(dTrapMinus, 2),
  fmt(d060Minus, 3)
].join('\t'));
console.log('afterStockCurveHp\t' + Phys.peakHpFromCurve(afterStockCar.torqueCurve).toFixed(1) +
  '\tafterPlusCurveHp\t' + Phys.peakHpFromCurve(afterPlusCar.torqueCurve).toFixed(1) +
  '\tafterMinusCurveHp\t' + Phys.peakHpFromCurve(afterMinusCar.torqueCurve).toFixed(1));

// Z28 ATC regression lock — Peak HP NOT edited
var z28 = null;
for (var i = 0; i < GARAGE.length; i++) {
  if (/camaro.*z28/i.test(GARAGE[i].name || '') && GARAGE[i].hasAftermarketConverter) {
    z28 = clone(GARAGE[i]);
    break;
  }
}
if (z28) {
  z28.forceScale = 1;
  z28.tireType = 2;
  var z = run(z28);
  console.log('Z28 ATC stock (no Peak HP edit)\t' +
    fmt(z.quarterMileTime, 3) + '@' + fmt(z.quarterMileSpeedMph, 2) +
    '\t60-130\t' + fmt(z.sixtyToOneThirty, 3) +
    '\t(untouched lock ~11.56@119 / 60-130~10.9)');
}

// Gates
if (!(Math.abs(liveDET) < 0.02)) {
  throw new Error('LIVE label-only should ΔET≈0, got ' + liveDET);
}
if (!(dPlus < -0.10)) {
  throw new Error('restored sequential +100 must improve ET, got ΔET=' + dPlus);
}
if (!(dTrapPlus > 1.0)) {
  throw new Error('restored sequential +100 must raise trap, got Δtrap=' + dTrapPlus);
}
if (!(dMinus > 0.05)) {
  throw new Error('restored sequential −50 must slow ET, got ΔET=' + dMinus);
}
if (!(afterPlusCar.forceScale === 1 && afterStockCar.forceScale === 1)) {
  throw new Error('forceScale must stay 1');
}
console.log('PASS Peak HP restore-working gates (Mustang GT sequential; Z28 not Peak HP smoke)');
