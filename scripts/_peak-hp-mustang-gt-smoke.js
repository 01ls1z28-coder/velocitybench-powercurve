'use strict';
/** Peak HP uniform torqueCurve scale smoke — generic garage car (2020 Mustang GT). NOT Z28. */
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function scaleCurve(curve, scale) {
  var out = {};
  Object.keys(curve).forEach(function (k) {
    var v = Number(curve[k]);
    if (isFinite(v)) out[k] = Math.max(5, v * scale);
  });
  return out;
}
var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
  launchMode: 'auto', tireType: 2, tireLabel: 'Slick'
};

var car = null;
for (var i = 0; i < GARAGE.length; i++) {
  if (GARAGE[i].id === '2020-ford-mustang-gt') { car = clone(GARAGE[i]); break; }
}
if (!car) throw new Error('2020-ford-mustang-gt missing');
if (!car.torqueCurve || Object.keys(car.torqueCurve).length < 8) {
  throw new Error('Mustang GT missing baked torqueCurve');
}
car.forceScale = 1;
var baseHp = Math.round(Number(car.peakHp) || 0);
if (!(baseHp > 100)) throw new Error('bad peakHp ' + baseHp);

function run(c) {
  return Phys.runQuarterMile(c, Object.assign({}, WX));
}
var stock = run(car);
var plus = clone(car);
plus.peakHp = baseHp + 100;
plus.torqueCurve = scaleCurve(car.torqueCurve, (baseHp + 100) / baseHp);
var minus = clone(car);
minus.peakHp = baseHp - 50;
minus.torqueCurve = scaleCurve(car.torqueCurve, (baseHp - 50) / baseHp);
var p = run(plus);
var m = run(minus);

var dPlus = p.quarterMileTime - stock.quarterMileTime;
var dMinus = m.quarterMileTime - stock.quarterMileTime;
var dTrapPlus = p.quarterMileSpeedMph - stock.quarterMileSpeedMph;
var dTrapMinus = m.quarterMileSpeedMph - stock.quarterMileSpeedMph;

console.log('car\t2020 Ford Mustang GT\tpeakHp\t' + baseHp + '\tcurveKeys\t' + Object.keys(car.torqueCurve).length);
console.log(['case', 'ET', 'trap', 'ΔET', 'Δtrap'].join('\t'));
console.log(['stock', stock.quarterMileTime.toFixed(3), stock.quarterMileSpeedMph.toFixed(2), '—', '—'].join('\t'));
console.log(['+100 Peak HP uniform scale', p.quarterMileTime.toFixed(3), p.quarterMileSpeedMph.toFixed(2), dPlus.toFixed(3), dTrapPlus.toFixed(2)].join('\t'));
console.log(['−50 Peak HP uniform scale', m.quarterMileTime.toFixed(3), m.quarterMileSpeedMph.toFixed(2), dMinus.toFixed(3), dTrapMinus.toFixed(2)].join('\t'));

if (!(dPlus < -0.15)) throw new Error('+100 must improve ET materially, got ΔET=' + dPlus);
if (!(dTrapPlus > 2)) throw new Error('+100 must raise trap, got Δtrap=' + dTrapPlus);
if (!(dMinus > 0.10)) throw new Error('−50 must slow ET, got ΔET=' + dMinus);
if (!(dTrapMinus < -1)) throw new Error('−50 must lower trap, got Δtrap=' + dTrapMinus);
console.log('PASS Mustang GT Peak HP gates');
