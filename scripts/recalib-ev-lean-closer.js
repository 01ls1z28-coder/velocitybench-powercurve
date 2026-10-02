'use strict';
/** Lean EV miss closer — UI path, tire→Cd/launch→loss last. Early exit. Jorge Guerra. */
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'ev-lean-closer-report.json');
var FINAL = path.join(__dirname, 'ev-lean-closer-final.json');
var PROG = path.join(__dirname, 'ev-lean-closer-progress.json');
var TOL = { trap: 0.5, et: 0.05, z60130: 0.05, z60: 0.05 };
var WX = { tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto', trackPrep: 'unprepped', driverWeightLbs: 200 };
var TIRES = [0, 3, 4, 5, 1, 2];
var SIMS = 0;

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function isEv(c) { return !!(c.isEv || c.powerSource === 'ev'); }
function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-9) return curve;
  var out = {}; Object.keys(curve).forEach(function (k) { out[k] = Math.round(curve[k] * s * 10000) / 10000; });
  return out;
}
function alignPeakRpm(car) {
  var peak = 0, at = 0;
  Object.keys(car.torqueCurve || {}).forEach(function (k) {
    var hp = (Number(car.torqueCurve[k]) * Number(k)) / 5252;
    if (hp > peak) { peak = hp; at = Number(k); }
  });
  if (at > 0) car.peakHpRpm = at;
}
function applyPower(car, newHp) {
  var old = Number(car.peakHp) || 1;
  car.peakHp = Math.round(newHp);
  if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, newHp / old);
  alignPeakRpm(car);
}
function runSim(car, need613) {
  SIMS++;
  var c = clone(car);
  var r = Phys.runQuarterMile(c, Object.assign({}, WX, {
    tireType: c.tireType | 0, tireLabel: Phys.tireLabelForType(c.tireType | 0), needSixtyToOneThirty: !!need613
  }));
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty).toFixed(3) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime).toFixed(3) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph).toFixed(2) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty).toFixed(3) : null,
    peakHP: r.peakHorsepower != null ? Math.round(r.peakHorsepower) : null
  };
}
function hit(sim, tgt, k) {
  if (tgt[k] == null || sim[k] == null) return null;
  return Math.abs(sim[k] - tgt[k]) <= TOL[k];
}
function missVec(sim, tgt) {
  function m(k, sc) {
    if (tgt[k] == null || sim[k] == null) return 0;
    var d = Math.abs(sim[k] - tgt[k]);
    return d <= TOL[k] ? 0 : (d - TOL[k]) * sc;
  }
  return [m('trap', 10), m('et', 20), m('z60130', 15), m('z60', 12)];
}
function better(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] < b[i] - 1e-9) return true;
    if (a[i] > b[i] + 1e-9) return false;
  }
  return false;
}
function allHit(sim, tgt) {
  return ['trap', 'et', 'z60130', 'z60'].every(function (k) { return hit(sim, tgt, k) !== false; });
}
function writeGarage() {
  var body = JSON.stringify(GARAGE, null, 2);
  fs.writeFileSync(OUT_JS,
    '(function (global) {\n  var GARAGE = ' + body + ';\n' +
    '  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n' +
    '  if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n  }\n' +
    '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this);\n');
}

function tune(base, tgt) {
  var need613 = tgt.z60130 != null;
  var cardHp = tgt.excelHp != null ? Number(tgt.excelHp) : Number(base.peakHp);
  var baseDrag = Number(base.dragCoefficient) || 0.3;
  var baseLoss = base.drivetrainLossPercent != null ? Number(base.drivetrainLossPercent) : 8;
  var oemTire = base.tireType | 0;
  var hpLo = Math.max(50, Math.round(cardHp * 0.45));
  var hpHi = Math.max(Math.round(cardHp * 2.2), Math.round(Number(base.peakHp) * 1.6), cardHp + 400);
  var best = null;

  function consider(hp, tire, drag, loss, drive, mu, slip) {
    if (best && allHit(best.sim, tgt)) return best;
    var c = clone(base);
    c.tireType = tire;
    c.dragCoefficient = +clamp(drag, 0.12, 0.95).toFixed(4);
    c.drivetrainLossPercent = +clamp(loss, 0, 28).toFixed(2);
    c.forceScale = 1;
    c.evLaunchDriveMult = +clamp(drive, 0.7, 1.85).toFixed(3);
    c.evLaunchMuMult = +clamp(mu, 0.85, 1.40).toFixed(3);
    c.evLaunchSlipTarget = +clamp(slip, 0.04, 0.22).toFixed(3);
    applyPower(c, clamp(Math.round(hp), hpLo, hpHi));
    var sim = runSim(c, need613);
    var mv = missVec(sim, tgt);
    var cfg = { hp: c.peakHp, tire: tire, drag: c.dragCoefficient, loss: c.drivetrainLossPercent,
      drive: c.evLaunchDriveMult, mu: c.evLaunchMuMult, slip: c.evLaunchSlipTarget, sim: sim, miss: mv, car: c };
    if (!best || better(mv, best.miss)) best = cfg;
    return cfg;
  }
  function binaryHp(tire, drag, loss, drive, mu, slip) {
    if (best && allHit(best.sim, tgt)) return;
    if (tgt.trap == null) { consider(cardHp, tire, drag, loss, drive, mu, slip); return; }
    var lo = hpLo, hi = hpHi;
    for (var i = 0; i < 10; i++) {
      var mid = Math.round((lo + hi) / 2);
      var cfg = consider(mid, tire, drag, loss, drive, mu, slip);
      if (cfg.sim.trap == null) break;
      if (cfg.sim.trap < tgt.trap) lo = mid + 1; else hi = mid - 1;
      if (lo > hi) break;
    }
  }

  var d0 = base.evLaunchDriveMult != null ? Number(base.evLaunchDriveMult) : 1.4;
  var u0 = base.evLaunchMuMult != null ? Number(base.evLaunchMuMult) : 1.2;
  var s0 = base.evLaunchSlipTarget != null ? Number(base.evLaunchSlipTarget) : 0.12;

  // Seed current + max launch
  binaryHp(oemTire, baseDrag, baseLoss, d0, u0, s0);
  binaryHp(oemTire, baseDrag, baseLoss, 1.85, 1.40, 0.10);
  if (allHit(best.sim, tgt)) return best;

  // z60 slow with trap ok: Cd↑ + max launch so binary keeps trap
  var onlyZ60 = hit(best.sim, tgt, 'trap') !== false && hit(best.sim, tgt, 'et') !== false &&
    hit(best.sim, tgt, 'z60130') !== false && hit(best.sim, tgt, 'z60') === false;
  if (onlyZ60 && best.sim.z60 > tgt.z60) {
    [0.03, 0.06, 0.10, 0.16, 0.24, 0.35].forEach(function (dd) {
      [1.55, 1.7, 1.85].forEach(function (d) {
        [1.25, 1.35, 1.40].forEach(function (u) {
          binaryHp(oemTire, baseDrag + dd, Math.min(baseLoss, 6), d, u, 0.10);
        });
      });
    });
    // tire assist
    [4, 5, 1].forEach(function (tire) {
      if (tire === oemTire) return;
      [0.08, 0.18, 0.3].forEach(function (dd) {
        binaryHp(tire, baseDrag + dd, Math.min(baseLoss, 4), 1.85, 1.40, 0.10);
      });
    });
  } else if (onlyZ60 && best.sim.z60 < tgt.z60) {
    [0.9, 1.1, 1.25].forEach(function (d) {
      [0.95, 1.1].forEach(function (u) {
        binaryHp(oemTire, baseDrag, baseLoss, d, u, 0.14);
      });
    });
  }
  if (allHit(best.sim, tgt)) return best;

  // Full tire sweep compact
  TIRES.forEach(function (tire) {
    if (allHit(best.sim, tgt)) return;
    binaryHp(tire, baseDrag, baseLoss, 1.85, 1.40, 0.12);
    [0.08, 0.2].forEach(function (dd) { binaryHp(tire, baseDrag + dd, baseLoss, 1.7, 1.35, 0.12); });
  });
  if (allHit(best.sim, tgt)) return best;

  // 60-130 couple
  if (tgt.z60130 != null && hit(best.sim, tgt, 'z60130') === false) {
    var s = best;
    if (best.sim.z60130 > tgt.z60130) {
      [1.1, 1.25, 1.45, 1.7].forEach(function (hs) {
        [0.05, 0.12, 0.22, 0.35].forEach(function (dd) {
          consider(Math.round(s.hp * hs), s.tire, s.drag + dd, Math.min(s.loss, 6), 1.85, 1.40, 0.12);
          binaryHp(s.tire, s.drag + dd, Math.min(s.loss, 6), 1.85, 1.40, 0.12);
        });
      });
    } else {
      [0.92, 0.85].forEach(function (hs) {
        [0.04, 0.1].forEach(function (dd) {
          consider(Math.round(s.hp * hs), s.tire, s.drag + dd, s.loss, 1.2, 1.1, 0.12);
        });
      });
    }
  }
  if (allHit(best.sim, tgt)) return best;

  // Loss last
  var s = best;
  for (var L = 0; L <= 16; L += 2) {
    binaryHp(s.tire, s.drag, L, 1.85, 1.40, s.slip);
    binaryHp(s.tire, s.drag + 0.1, L, 1.85, 1.40, s.slip);
  }
  s = best;
  for (var h = s.hp - 16; h <= s.hp + 16; h += 2) consider(h, s.tire, s.drag, s.loss, s.drive, s.mu, s.slip);
  return best;
}

var byT = {}; TARGETS.forEach(function (t) { byT[t.name] = t; });
// Chunked resume: --only=<id|name-substr> --limit=N  (Jorge Guerra durable overnight)
var ONLY = null, LIMIT = null;
process.argv.slice(2).forEach(function (a) {
  if (a.indexOf('--only=') === 0) ONLY = a.slice(7).toLowerCase();
  if (a.indexOf('--limit=') === 0) LIMIT = Math.max(1, parseInt(a.slice(8), 10) || 1);
});

var t0 = Date.now();
var reports = [];
var todo = [];
GARAGE.forEach(function (car) {
  if (!isEv(car)) return;
  var tgt = byT[car.name];
  if (!tgt || (tgt.et == null && tgt.trap == null && tgt.z60 == null)) return;
  var before = runSim(car, tgt.z60130 != null);
  if (allHit(before, tgt)) return;
  todo.push({ car: car, tgt: tgt, before: before });
});
if (ONLY) {
  todo = todo.filter(function (item) {
    var id = String(item.car.id || '').toLowerCase();
    var name = String(item.car.name || '').toLowerCase();
    return id === ONLY || name === ONLY || id.indexOf(ONLY) >= 0 || name.indexOf(ONLY) >= 0;
  });
}
if (LIMIT != null) todo = todo.slice(0, LIMIT);
process.stderr.write('EV lean closer: ' + todo.length + ' cars' + (ONLY ? ' only=' + ONLY : '') + (LIMIT != null ? ' limit=' + LIMIT : '') + '\n');

todo.forEach(function (item, idx) {
  var car = item.car, tgt = item.tgt;
  var beforeSims = SIMS;
  var best = tune(car, tgt);
  car.peakHp = best.car.peakHp; car.peakHpRpm = best.car.peakHpRpm; car.torqueCurve = best.car.torqueCurve;
  car.tireType = best.tire; car.dragCoefficient = best.drag;
  car.drivetrainLossPercent = best.loss; car.forceScale = 1;
  car.evLaunchDriveMult = best.drive; car.evLaunchMuMult = best.mu; car.evLaunchSlipTarget = best.slip;
  car.source = (car.source || '') + ' | EV lean closer (Jorge Guerra) hp ' + car.peakHp + ' tire ' + car.tireType + ' drv ' + car.evLaunchDriveMult;
  var after = runSim(car, tgt.z60130 != null);
  var hits = { trap: hit(after, tgt, 'trap'), et: hit(after, tgt, 'et'), z60130: hit(after, tgt, 'z60130'), z60: hit(after, tgt, 'z60') };
  reports.push({ name: car.name, id: car.id, before: item.before, after: after, hits: hits,
    cfg: { hp: car.peakHp, tire: car.tireType, drag: car.dragCoefficient, loss: car.drivetrainLossPercent, drive: car.evLaunchDriveMult, mu: car.evLaunchMuMult, slip: car.evLaunchSlipTarget },
    simsThis: SIMS - beforeSims });
  writeGarage();
  fs.writeFileSync(PROG, JSON.stringify({
    credit: 'Jorge Guerra only', done: idx + 1, total: todo.length, sims: SIMS,
    elapsedSec: +((Date.now() - t0) / 1000).toFixed(1), last: car.name, lastHits: hits,
    fullOkSoFar: reports.filter(function (r) { return ['trap','et','z60130','z60'].every(function (k) { return r.hits[k] !== false; }); }).length
  }, null, 2));
  process.stderr.write('EV ' + (idx + 1) + '/' + todo.length + ' ' + car.name +
    ' sims=' + SIMS + ' carSims=' + (SIMS - beforeSims) + ' hits=' + JSON.stringify(hits) + '\n');
});

var rates = { trap: [0, 0], et: [0, 0], z60130: [0, 0], z60: [0, 0], fullOk: [0, 0] };
var miss = [];
GARAGE.forEach(function (car) {
  if (!isEv(car)) return;
  var tgt = byT[car.name];
  if (!tgt || (tgt.et == null && tgt.trap == null && tgt.z60 == null)) return;
  var sim = runSim(car, tgt.z60130 != null);
  var h = {};
  ['trap', 'et', 'z60130', 'z60'].forEach(function (k) {
    h[k] = hit(sim, tgt, k);
    if (h[k] === null) return;
    rates[k][1]++;
    if (h[k]) rates[k][0]++;
  });
  var full = ['trap', 'et', 'z60130', 'z60'].every(function (k) { return h[k] !== false; });
  rates.fullOk[1]++;
  if (full) rates.fullOk[0]++;
  else {
    var parts = [];
    ['trap', 'et', 'z60130', 'z60'].forEach(function (k) {
      if (h[k] === false) parts.push(k + ':' + sim[k] + '/' + tgt[k]);
    });
    miss.push({ name: car.name, id: car.id, parts: parts, sim: sim });
  }
});
function fmt(a) { return a[0] + '/' + a[1]; }
writeGarage();
var final = {
  credit: 'Jorge Guerra only',
  elapsedSec: +((Date.now() - t0) / 1000).toFixed(1),
  sims: SIMS,
  tuned: reports.length,
  hitRates: { trap: fmt(rates.trap), et: fmt(rates.et), z60130: fmt(rates.z60130), z60: fmt(rates.z60), fullOk: fmt(rates.fullOk) },
  miss: miss
};
fs.writeFileSync(REPORT, JSON.stringify(reports, null, 2));
fs.writeFileSync(FINAL, JSON.stringify(final, null, 2));
console.log(JSON.stringify(final, null, 2));
