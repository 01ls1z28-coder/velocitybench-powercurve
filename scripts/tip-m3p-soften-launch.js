'use strict';
/** Tip: M3P soften launch + ZR1X R-Compound. Fast local refine. Jorge Guerra only. */
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'm3p-soften-launch-report.json');
var ID = '2024-tesla-model-3-performance';
var ZR1X = '2026-chevrolet-corvette-zr1x';
var FACTORY_HP = 510;
var TGT = { z60: 2.9, et: 11.0, trap: 124.5, z60130: 9.2, decs: { z60: 1, et: 1, trap: 1, z60130: 1 } };

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function roundTo(v, d) {
  if (v == null || d == null) return v;
  var f = Math.pow(10, d);
  return Math.round(Number(v) * f) / f;
}
function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-9) return curve;
  var out = {};
  Object.keys(curve).forEach(function (k) { out[k] = Math.round(curve[k] * s * 10000) / 10000; });
  return out;
}
function applyPowerFromBase(car, baseCurve, baseHp, newHp) {
  var hp = clamp(Math.round(newHp), 1, FACTORY_HP);
  car.peakHp = hp;
  car.torqueCurve = scaleCurve(baseCurve, hp / (baseHp || 1));
  var peak = 0, at = 0;
  Object.keys(car.torqueCurve || {}).forEach(function (k) {
    var h = (Number(car.torqueCurve[k]) * Number(k)) / 5252;
    if (h > peak) { peak = h; at = Number(k); }
  });
  if (at > 0) car.peakHpRpm = at;
}
function setLaunch(car, drive, mu, slip) {
  car.evLaunchDriveMult = +clamp(drive, 0.70, 1.85).toFixed(3);
  car.evLaunchMuMult = +clamp(mu, 0.85, 1.40).toFixed(3);
  car.evLaunchSlipTarget = +clamp(slip, 0.04, 0.22).toFixed(3);
}
function runSim(car) {
  var c = clone(car);
  c.forceScale = 1;
  var r = Phys.runQuarterMile(c, {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0,
    gustMph: 0, launchMode: 'auto', trackPrep: 'unprepped', driverWeightLbs: 200,
    tireType: c.tireType | 0,
    tireLabel: Phys.tireLabelForType(c.tireType | 0),
    needSixtyToOneThirty: true
  });
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty) : null,
    ft60: r.sixtyFootTime != null ? +Number(r.sixtyFootTime) : null,
    peakHP: r.peakHorsepower != null ? Math.round(r.peakHorsepower) : null,
    vmax: r.topSpeedMph != null ? +Number(r.topSpeedMph) : null
  };
}
function hit(sim, k) {
  if (TGT[k] == null) return null;
  if (sim[k] == null) return false;
  return roundTo(sim[k], TGT.decs[k]) === roundTo(TGT[k], TGT.decs[k]);
}
function allHit(sim) {
  return ['trap', 'et', 'z60130', 'z60'].every(function (k) { return hit(sim, k) !== false; });
}
function scoreOf(sim, drive, mu) {
  function m(k, sc) {
    if (TGT[k] == null) return 0;
    if (sim[k] == null) return 100;
    if (roundTo(sim[k], TGT.decs[k]) === roundTo(TGT[k], TGT.decs[k])) return 0;
    return Math.abs(sim[k] - TGT[k]) * sc;
  }
  var ftPen = (sim.ft60 != null && sim.ft60 < 1.85) ? (1.85 - sim.ft60) * 40 : 0;
  var zFast = (sim.z60 != null && sim.z60 < 2.85) ? (2.85 - sim.z60) * 35 : 0;
  // Prefer calmer than stock 1.7/1.3
  var calmBonus = Math.max(0, 1.7 - drive) * 1.5 + Math.max(0, 1.3 - mu) * 1.5;
  return m('trap', 14) + m('et', 24) + m('z60130', 20) + m('z60', 32) + ftPen + zFast - calmBonus;
}
function gapReport(sim) {
  var g = {};
  ['trap', 'et', 'z60130', 'z60'].forEach(function (k) {
    var sheet = roundTo(TGT[k], TGT.decs[k]);
    var final = sim[k] == null ? null : roundTo(sim[k], TGT.decs[k]);
    g[k] = { sheetTarget: sheet, finalResult: final, match: hit(sim, k) === true,
      gap: (final == null || sheet == null) ? null : +(final - sheet).toFixed(4) };
  });
  g.ft60 = { finalResult: sim.ft60 == null ? null : +sim.ft60.toFixed(3) };
  return g;
}

var idx = GARAGE.findIndex(function (c) { return c.id === ID; });
if (idx < 0) throw new Error('missing ' + ID);
var base = clone(GARAGE[idx]);
var baseCurve = clone(base.torqueCurve);
var baseHp = Number(base.peakHp) || 475;
var baseDrag = Number(base.dragCoefficient);
var before = runSim(base);
console.log('BEFORE', JSON.stringify({
  launch: { d: base.evLaunchDriveMult, m: base.evLaunchMuMult, s: base.evLaunchSlipTarget },
  hp: base.peakHp, lim: base.speedLimiterMph, sim: before
}));

var sims = 0, best = null;
function tryCfg(drive, mu, slip, hp, lim, drag) {
  var car = clone(base);
  applyPowerFromBase(car, baseCurve, baseHp, hp);
  setLaunch(car, drive, mu, slip);
  car.speedLimiterMph = +Number(lim).toFixed(1);
  car.dragCoefficient = drag;
  car.forceScale = 1;
  sims++;
  var sim = runSim(car);
  var score = scoreOf(sim, car.evLaunchDriveMult, car.evLaunchMuMult);
  var cfg = { drive: car.evLaunchDriveMult, mu: car.evLaunchMuMult, slip: car.evLaunchSlipTarget,
    hp: car.peakHp, lim: car.speedLimiterMph, drag: car.dragCoefficient, sim: sim, score: score, car: car };
  if (!best || score < best.score) best = cfg;
  return cfg;
}

// Known-good region from prior staged run: launch ~1.40/1.20/0.14, HP ~480-510, lim ~145-155
var drives = [1.32, 1.36, 1.40, 1.44];
var mus = [1.14, 1.18, 1.22];
var slips = [0.14];
var hps = [480, 488, 496, 504, 510];
var lims = [148, 152];
var drags = [baseDrag, +(baseDrag * 1.03).toFixed(4), +(baseDrag * 1.06).toFixed(4), +(baseDrag * 1.09).toFixed(4)];

for (var di = 0; di < drives.length; di++) {
  for (var mi = 0; mi < mus.length; mi++) {
    for (var si = 0; si < slips.length; si++) {
      for (var hi = 0; hi < hps.length; hi++) {
        for (var li = 0; li < lims.length; li++) {
          for (var dri = 0; dri < drags.length; dri++) {
            tryCfg(drives[di], mus[mi], slips[si], hps[hi], lims[li], drags[dri]);
          }
        }
      }
    }
  }
}
console.log('grid sims', sims, 'best', JSON.stringify({ d: best.drive, m: best.mu, s: best.slip, hp: best.hp, lim: best.lim, drag: best.drag, score: +best.score.toFixed(3), sim: best.sim }));

// Tiny polish ±2 hp / ±1 lim / ±0.02 launch around best (~100 sims)
var d0 = best.drive, m0 = best.mu, s0 = best.slip, h0 = best.hp, l0 = best.lim, g0 = best.drag;
for (var dh = -4; dh <= 4; dh += 2) {
  for (var dl = -2; dl <= 2; dl += 1) {
    for (var dd = -0.04; dd <= 0.04; dd += 0.02) {
      for (var mm = -0.04; mm <= 0.04; mm += 0.02) {
        tryCfg(d0 + dd, m0 + mm, s0, h0 + dh, l0 + dl, g0);
      }
    }
  }
}
console.log('TOTAL', sims);
console.log('BEST', JSON.stringify({ d: best.drive, m: best.mu, s: best.slip, hp: best.hp, lim: best.lim, drag: best.drag, score: +best.score.toFixed(3), sim: best.sim, full: allHit(best.sim) }));

GARAGE[idx] = best.car;
var after = runSim(GARAGE[idx]);

var zIdx = GARAGE.findIndex(function (c) { return c.id === ZR1X; });
if (zIdx < 0) throw new Error('missing ' + ZR1X);
var zr1xBefore = { id: ZR1X, name: GARAGE[zIdx].name, tireType: GARAGE[zIdx].tireType };
GARAGE[zIdx].tireType = 5;
var zr1xAfter = { id: ZR1X, name: GARAGE[zIdx].name, tireType: GARAGE[zIdx].tireType };

var prev = fs.readFileSync(OUT_JS, 'utf8');
var headerMatch = prev.match(/^\/\*[\s\S]*?\*\/\s*/);
var header;
if (headerMatch && /Jorge Guerra/i.test(headerMatch[0])) {
  header = headerMatch[0];
  if (/\* Tip:/.test(header)) header = header.replace(/\* Tip:[^\n]*\n/, '* Tip: M3P soften launch + ZR1X R-Compound (tireType=5)\n');
  else header = header.replace(/\*\//, '* Tip: M3P soften launch + ZR1X R-Compound (tireType=5)\n */');
  if (/\* Generated:/.test(header)) header = header.replace(/\* Generated:[^\n]*\n/, '* Generated: ' + new Date().toISOString() + '\n');
  else header = header.replace(/\*\//, '* Generated: ' + new Date().toISOString() + '\n */');
} else {
  header = '/*\n * VelocityBench PowerCurve — garage data\n * Credits: Jorge Guerra only\n * Tip: M3P soften launch + ZR1X R-Compound (tireType=5)\n * Generated: ' + new Date().toISOString() + '\n */\n';
}
fs.writeFileSync(OUT_JS, header + 'var VB_POWERCURVE_GARAGE = ' + JSON.stringify(GARAGE, null, 2) + ';\n' +
  'if (typeof module !== "undefined" && module.exports) module.exports = VB_POWERCURVE_GARAGE;\n');

var report = {
  credit: 'Jorge Guerra only',
  tip: 'm3p-soften-launch-zr1x-rcomp',
  m3p: {
    id: ID,
    factoryHpCap: FACTORY_HP,
    before: {
      launch: { drive: base.evLaunchDriveMult, mu: base.evLaunchMuMult, slip: base.evLaunchSlipTarget },
      hp: base.peakHp, lim: base.speedLimiterMph, drag: base.dragCoefficient,
      sim: before, gaps: gapReport(before)
    },
    after: {
      launch: { drive: GARAGE[idx].evLaunchDriveMult, mu: GARAGE[idx].evLaunchMuMult, slip: GARAGE[idx].evLaunchSlipTarget },
      hp: GARAGE[idx].peakHp, lim: GARAGE[idx].speedLimiterMph, drag: GARAGE[idx].dragCoefficient,
      sim: after, gaps: gapReport(after), fullMatch: allHit(after)
    }
  },
  zr1x: { before: zr1xBefore, after: zr1xAfter },
  sims: sims
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log('FULL_MATCH', allHit(after));
console.log('GAPS', JSON.stringify(report.m3p.after.gaps, null, 2));
console.log('ZR1X', JSON.stringify(report.zr1x));
console.log('launch before→after', report.m3p.before.launch, '→', report.m3p.after.launch);
