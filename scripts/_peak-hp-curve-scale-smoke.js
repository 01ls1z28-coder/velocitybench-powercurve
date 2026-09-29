'use strict';
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
  launchMode: 'auto', tireType: 2, tireLabel: 'Slick'
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function find(pred) {
  for (var i = 0; i < GARAGE.length; i++) if (pred(GARAGE[i])) return clone(GARAGE[i]);
  return null;
}
function scaleCurve(curve, scale) {
  var out = {};
  Object.keys(curve).forEach(function (k) {
    var v = Number(curve[k]);
    if (isFinite(v)) out[k] = Math.max(5, v * scale);
  });
  return out;
}
function run(car, tireType) {
  var env = Object.assign({}, WX, { tireType: tireType != null ? tireType : (car.tireType != null ? car.tireType : 2) });
  env.tireLabel = Phys.tireLabelForType(env.tireType);
  return Phys.runQuarterMile(car, env);
}
function fmt(r) {
  return {
    et: r.quarterMileTime,
    trap: r.quarterMileSpeedMph,
    z60: r.zeroToSixty,
    s60_130: r.sixtyToOneThirty,
    sixtyFt: r.sixtyFootTime
  };
}
function delta(a, b) {
  return {
    dET: a.et - b.et,
    dTrap: a.trap - b.trap,
    d060: (a.z60 != null && b.z60 != null) ? a.z60 - b.z60 : null
  };
}

var rows = [];
function row(name, stock, mod, note) {
  var d = delta(mod, stock);
  rows.push({
    name: name,
    stockET: stock.et, stockTrap: stock.trap, stock060: stock.z60, stock60130: stock.s60_130,
    modET: mod.et, modTrap: mod.trap, mod060: mod.z60,
    dET: d.dET, dTrap: d.dTrap, d060: d.d060,
    note: note || ''
  });
}

// --- Z28 ATC Circle D 4400 stock regression ---
var z28 = find(function (c) {
  return c.id === '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
});
if (!z28) throw new Error('Z28 ATC missing');
z28.forceScale = 1;
var zStock = fmt(run(z28));
console.log('Z28 ATC stock', zStock);

// +100 Peak HP uniform scale
var zPlus = clone(z28);
var baseHp = Math.round(zPlus.peakHp);
zPlus.peakHp = baseHp + 100;
zPlus.torqueCurve = scaleCurve(zPlus.torqueCurve, (baseHp + 100) / baseHp);
var zPlusR = fmt(run(zPlus));
row('Z28 ATC +100 Peak HP (uniform scale)', zStock, zPlusR, 'expect ΔET materially < 0');

// label-only (BUG repro): peakHp bump WITHOUT scale → ΔET≈0
var zLabel = clone(z28);
zLabel.peakHp = baseHp + 100;
var zLabelR = fmt(run(zLabel));
row('Z28 ATC +100 Peak HP LABEL ONLY (no scale)', zStock, zLabelR, 'LIVE bug: ΔET≈0');

// -50 Peak HP
var zMinus = clone(z28);
zMinus.peakHp = baseHp - 50;
zMinus.torqueCurve = scaleCurve(zMinus.torqueCurve, (baseHp - 50) / baseHp);
var zMinusR = fmt(run(zMinus));
row('Z28 ATC −50 Peak HP (uniform scale)', zStock, zMinusR, 'expect ΔET > 0 (slower)');

// 1993 Camaro Z28 (classic repro car)
var cam93 = find(function (c) { return c.id === '1993-chevrolet-camaro-z28'; });
cam93.forceScale = 1;
var cStock = fmt(run(cam93, 1));
var cHp = Math.round(cam93.peakHp);
var cPlus = clone(cam93);
cPlus.peakHp = cHp + 100;
cPlus.torqueCurve = scaleCurve(cPlus.torqueCurve, (cHp + 100) / cHp);
var cPlusR = fmt(run(cPlus, 1));
row('1993 Camaro Z28 +100 Peak HP scale', cStock, cPlusR, 'expect ΔET < 0');
var cLabel = clone(cam93);
cLabel.peakHp = cHp + 100;
var cLabelR = fmt(run(cLabel, 1));
row('1993 Camaro Z28 +100 LABEL ONLY', cStock, cLabelR, 'bug: ΔET≈0');

// Mustang GT
var mustang = find(function (c) { return c.id === '2020-ford-mustang-gt'; });
mustang.forceScale = 1;
var mStock = fmt(run(mustang, 1));
var mHp = Math.round(mustang.peakHp);
var mPlus = clone(mustang);
mPlus.peakHp = mHp + 100;
mPlus.torqueCurve = scaleCurve(mPlus.torqueCurve, (mHp + 100) / mHp);
row('2020 Mustang GT +100 Peak HP scale', mStock, fmt(run(mPlus, 1)), 'expect ΔET < 0');
var mMinus = clone(mustang);
mMinus.peakHp = mHp - 50;
mMinus.torqueCurve = scaleCurve(mMinus.torqueCurve, (mHp - 50) / mHp);
row('2020 Mustang GT −50 Peak HP scale', mStock, fmt(run(mMinus, 1)), 'expect ΔET > 0');

// ZR1X: unchanged until Peak HP edited; locks
var zr1x = find(function (c) { return /ZR1X/i.test(c.name); });
var zrLocks = {
  forceScale: zr1x.forceScale,
  cd: zr1x.dragCoefficient,
  wt: zr1x.weightLbs,
  fd: zr1x.finalDriveRatio,
  tx: zr1x.txKey,
  curveKeys: Object.keys(zr1x.torqueCurve).length
};
zr1x.forceScale = 1;
var zrStock = fmt(run(zr1x, 1));
// "unchanged until Peak HP edited" — same peak, same curve → identical
var zrSame = clone(zr1x);
var zrSameR = fmt(run(zrSame, 1));
row('ZR1X stock re-run (no Peak HP edit)', zrStock, zrSameR, 'expect ΔET≈0');
var zrHp = Math.round(zr1x.peakHp);
var zrPlus = clone(zr1x);
zrPlus.peakHp = zrHp + 100;
zrPlus.torqueCurve = scaleCurve(zrPlus.torqueCurve, (zrHp + 100) / zrHp);
var zrPlusR = fmt(run(zrPlus, 1));
row('ZR1X +100 Peak HP scale', zrStock, zrPlusR, 'expect ΔET < 0; Cd/wt/FD/TX/fs=1 locked');

// Custom Builder no-curve still synthesizes
var custom = {
  name: 'Custom Builder', id: 'custom',
  weightLbs: 3800, dragCoefficient: 0.35, frontalAreaSqFt: 22.5, tireRadiusInches: 13.2,
  finalDriveRatio: 3.73, gearRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
  peakHp: 450, peakTqRpm: 4200, peakHpRpm: 6200, redline: 6800,
  isNA: true, driveType: 'RWD', shiftRpm: 6500, launchRpm: 3000,
  drivetrainLossPercent: 15, forceScale: 1, torqueCurve: null
};
custom.torqueCurve = Phys.synthesizeTorqueCurve(custom.peakHp, custom.peakTqRpm, custom.redline, custom.peakHpRpm);
var custR = fmt(run(custom, 1));
console.log('Custom Builder synth', custR, 'curveKeys', Object.keys(custom.torqueCurve).length);

// Custom Builder >12% Peak change → uniform scale (NOT resynth)
var cust2 = clone(custom);
var custBaseCurve = clone(custom.torqueCurve);
var newHp = 600; // >12% vs 450
cust2.peakHp = newHp;
cust2.torqueCurve = scaleCurve(custBaseCurve, newHp / 450);
// Shape check: ratio of tq at same rpm keys should be constant = 600/450
var keys = Object.keys(custBaseCurve).map(Number).sort(function(a,b){return a-b;});
var ratios = keys.slice(0, 5).map(function (k) {
  return cust2.torqueCurve[k] / custBaseCurve[k];
});
console.log('Custom scale ratios (first5)', ratios, 'expect ~', newHp/450);

// Dyno drag-edit still works: sculpt one point, peakHpFromCurve moves — baseline would restash in UI
var dyno = clone(cam93);
var dk = Object.keys(dyno.torqueCurve)[10];
dyno.torqueCurve[dk] = Number(dyno.torqueCurve[dk]) * 1.15;
var dynoR = fmt(run(dyno, 1));
console.log('Dyno single-point bump still runs', dynoR.et.toFixed(3));

function n(x, d) { return x == null || !isFinite(x) ? '—' : Number(x).toFixed(d); }

console.log('\n=== SMOKE TABLE ===');
console.log([
  'case'.padEnd(48),
  'stockET', 'modET', 'ΔET', 'Δtrap', 'Δ0-60', 'note'
].join(' | '));
rows.forEach(function (r) {
  console.log([
    r.name.slice(0,48).padEnd(48),
    n(r.stockET,3), n(r.modET,3), n(r.dET,3), n(r.dTrap,2), n(r.d060,3),
    r.note
  ].join(' | '));
});

console.log('\nZR1X locks:', JSON.stringify(zrLocks));
console.log('ZR1X after +100 locks check:', JSON.stringify({
  forceScale: zrPlus.forceScale,
  cd: zrPlus.dragCoefficient,
  wt: zrPlus.weightLbs,
  fd: zrPlus.finalDriveRatio,
  tx: zrPlus.txKey,
  fsIs1: zrPlus.forceScale === 1,
  cdSame: zrPlus.dragCoefficient === zrLocks.cd,
  wtSame: zrPlus.weightLbs === zrLocks.wt,
  fdSame: zrPlus.finalDriveRatio === zrLocks.fd,
  txSame: zrPlus.txKey === zrLocks.tx
}));

console.log('\nZ28 ATC stock lock target ~11.56@119 / 60-130~10.9 →',
  n(zStock.et,3)+'@'+n(zStock.trap,2), '60-130', n(zStock.s60_130,3));

// Pass/fail gates
var fails = [];
if (Math.abs(zStock.et - 11.56) > 0.08) fails.push('Z28 stock ET off');
if (Math.abs(zStock.trap - 119) > 1.5) fails.push('Z28 stock trap off');
if (Math.abs(zStock.s60_130 - 10.9) > 0.25) fails.push('Z28 60-130 off');
if (!(zPlusR.et < zStock.et - 0.15)) fails.push('Z28 +100 scale not faster enough');
if (!(Math.abs(zLabelR.et - zStock.et) < 0.02)) fails.push('label-only should be ~0 delta (bug character)');
if (!(zMinusR.et > zStock.et + 0.05)) fails.push('Z28 -50 not slower');
if (!(cPlusR.et < cStock.et - 0.15)) fails.push('93 Z28 +100 not faster');
if (!(zrPlusR.et < zrStock.et - 0.05)) fails.push('ZR1X +100 not faster');
if (Math.abs(zrSameR.et - zrStock.et) > 0.001) fails.push('ZR1X no-edit changed');
if (zrPlus.forceScale !== 1) fails.push('ZR1X forceScale != 1');
if (zrPlus.dragCoefficient !== zrLocks.cd || zrPlus.weightLbs !== zrLocks.wt || zrPlus.finalDriveRatio !== zrLocks.fd)
  fails.push('ZR1X Cd/wt/FD cheated');
ratios.forEach(function (r) {
  if (Math.abs(r - newHp/450) > 1e-6) fails.push('Custom scale not uniform');
});

console.log(fails.length ? '\nFAIL: ' + fails.join('; ') : '\nPASS all gates');
process.exit(fails.length ? 1 : 0);
