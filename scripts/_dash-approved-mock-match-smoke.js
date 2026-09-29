'use strict';
/**
 * Smoke: canonical TRACTION%+SLIP reuse real timeline wheelspin (Soft/Agg/Auto).
 * Traction remaining = clamp(100 − wheelspin, 0, 100). SLIP ON at ≥ 8%.
 * 20 segs (canonical snip). Peak HP / LED logic covered by sibling smokes.
 */
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var SPIN_WARN = 8;
var SEG_N = 20;

function findZ28() {
  for (var i = 0; i < GARAGE.length; i++) {
    if (GARAGE[i].id === '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals') {
      return JSON.parse(JSON.stringify(GARAGE[i]));
    }
  }
  return null;
}

function env(mode) {
  return {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launchMode: mode, tireType: 2, tireLabel: 'Slick'
  };
}

function tractionFromSlip(slip) {
  var s = Number(slip);
  if (!isFinite(s) || s < 0) s = 0;
  var t = 100 - s;
  if (t < 0) t = 0;
  if (t > 100) t = 100;
  return t;
}

function segsLit(trac) {
  var lit = Math.round((trac / 100) * SEG_N);
  if (trac > 0 && lit < 1) lit = 1;
  if (trac <= 0) lit = 0;
  return lit;
}

var car = findZ28();
if (!car) { console.error('Z28 not found'); process.exit(1); }

var fail = 0;
['soft', 'auto', 'aggressive'].forEach(function (mode) {
  var r = Phys.runQuarterMile(car, env(mode));
  var tl = r.timeline || [];
  var maxSpin = 0, framesWarn = 0, hasWsField = 0;
  for (var i = 0; i < tl.length; i++) {
    var w = tl[i].wheelspin;
    if (w != null && isFinite(Number(w))) {
      hasWsField++;
      var n = Number(w);
      if (n > maxSpin) maxSpin = n;
      if (n >= SPIN_WARN) framesWarn++;
    }
  }
  var tracAtMax = tractionFromSlip(maxSpin);
  var ok = hasWsField > 0 && maxSpin > SPIN_WARN && framesWarn > 0 && tracAtMax < 100;
  console.log(
    (ok ? 'PASS' : 'FAIL'),
    mode,
    'ET=' + r.quarterMileTime.toFixed(3),
    'trap=' + (r.trapSpeedMph != null ? r.trapSpeedMph.toFixed(2) : '?'),
    'wsField=' + hasWsField + '/' + tl.length,
    'maxSpin=' + maxSpin.toFixed(1) + '%',
    'warnFrames=' + framesWarn,
    'tracAtMax=' + Math.round(tracAtMax) + '%',
    'segs=' + segsLit(tracAtMax) + '/' + SEG_N
  );
  if (!ok) fail++;
});

var mapCases = [
  { slip: 0, expect: 100, segs: 20 },
  { slip: 8, expect: 92, segs: 18 },
  { slip: 30, expect: 70, segs: 14 },
  { slip: 50, expect: 50, segs: 10 },
  { slip: 100, expect: 0, segs: 0 }
];
mapCases.forEach(function (c) {
  var t = tractionFromSlip(c.slip);
  var s = segsLit(t);
  var ok = Math.round(t) === c.expect && s === c.segs;
  console.log((ok ? 'PASS' : 'FAIL'), 'map slip=' + c.slip, 'trac=' + Math.round(t), 'segs=' + s);
  if (!ok) fail++;
});

if (fail) {
  console.error('DASH approved-mock-match smoke FAIL', fail);
  process.exit(1);
}
console.log('DASH approved-mock-match smoke OK');
