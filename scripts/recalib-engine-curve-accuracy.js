/**
 * Tip: pc-engine-curve-accuracy (credit Jorge Guerra ONLY)
 * Parent: 9c639c9 review/pc-trap-first-tire-prep
 * HARD: never touch Cd / FA / weightLbs / peakHp. forceScale=1.
 * Knobs: torqueCurve shape (peakTqRpm / peakHpRpm / TQ ratio / fall) + modest loss.
 * Priority: trap → ET → 60-130 → 0-60.
 *
 *   node scripts/recalib-engine-curve-accuracy.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'engine-curve-accuracy-report.json');
var TARGETS = require('./excel-corrected-targets.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var SKIP = {
  '2024-tesla-cybertruck-tri-motor': 'Cybertruck locked',
  '2026-chevrolet-corvette-zr1x': 'ZR1X locked',
  '2001-chevrolet-camaro-z28-hce-ms3-tsp53stage25-134lt-trueduals': 'Z28 ATC locked'
};

function envFor(tireType) {
  return {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: tireType | 0, trackPrep: 'unprepped',
    tireLabel: Phys.tireLabelForType(tireType | 0),
    needSixtyToOneThirty: true, quickMetrics: true
  };
}
function runSim(car) {
  var r = Phys.runQuarterMile(car, envFor(car.tireType));
  return {
    z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    z60130: r.sixtyToOneThirty
  };
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hits(sim, tgt) {
  return {
    et: tgt.et == null || (sim.et != null && Math.abs(sim.et - tgt.et) <= TOL.et),
    trap: tgt.trap == null || (sim.trap != null && Math.abs(sim.trap - tgt.trap) <= TOL.trap),
    z60: tgt.z60 == null || (sim.z60 != null && Math.abs(sim.z60 - tgt.z60) <= TOL.z60),
    z60130: tgt.z60130 == null || (sim.z60130 != null && Math.abs(sim.z60130 - tgt.z60130) <= TOL.z60130)
  };
}
function errOf(sim, tgt, k) {
  if (tgt[k] == null || sim[k] == null) return null;
  return Math.abs(sim[k] - tgt[k]);
}
function cost(sim, tgt) {
  var c = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    if (sim[k] == null) { c += 200 * w; return; }
    var e = Math.abs(sim[k] - tgt[k]);
    c += (e / tol) * w;
    if (e > tol) c += w * 0.75;
  }
  add('trap', 12, TOL.trap);
  add('et', 7, TOL.et);
  add('z60130', 3, TOL.z60130);
  add('z60', 2.5, TOL.z60);
  return c;
}

/** ICE curve: fixed peakHp; shape via peakTq / RPMs / fall. */
function makeIceCurve(peakHp, peakTq, peakTqRpm, peakHpRpm, redline, fallFrac) {
  fallFrac = fallFrac != null ? fallFrac : 0.20;
  var tqAtPeakHp = (peakHp * 5252) / peakHpRpm;
  peakTq = Math.max(peakTq, tqAtPeakHp * 1.02);
  var span = Math.max(1, redline - peakHpRpm);
  var curve = {};
  for (var r = 1000; r <= redline; r += 100) {
    var tq;
    if (r <= peakTqRpm) {
      var u = r / Math.max(1, peakTqRpm);
      tq = peakTq * (0.50 + 0.50 * Math.pow(u, 0.70));
    } else if (r <= peakHpRpm) {
      var v = (r - peakTqRpm) / Math.max(1, peakHpRpm - peakTqRpm);
      tq = peakTq + (tqAtPeakHp - peakTq) * (0.20 * v + 0.80 * v * v);
    } else {
      var w = (r - peakHpRpm) / span;
      var hpHere = peakHp * (1.0 - fallFrac * (0.75 * w + 0.25 * w * w));
      tq = (hpHere * 5252) / r;
    }
    // Cap so no knot exceeds peakHp
    var maxTq = (peakHp * 1.002 * 5252) / Math.max(1, r);
    curve[r] = Math.max(10, Math.min(tq, maxTq));
  }
  curve[peakTqRpm] = Math.min(peakTq, (peakHp * 1.002 * 5252) / peakTqRpm);
  curve[peakHpRpm] = tqAtPeakHp;
  curve[redline] = Math.max(10, (peakHp * (1.0 - fallFrac) * 5252) / redline);
  if (Phys.sanitizeTorqueCurvePostPeak) Phys.sanitizeTorqueCurvePostPeak(curve, peakHpRpm);
  if (Phys.capTorqueCurveToPeakHp) Phys.capTorqueCurveToPeakHp(curve, peakHp);
  return curve;
}

function peakTqFromCurve(curve) {
  if (!curve) return null;
  var best = 0;
  Object.keys(curve).forEach(function (k) {
    var t = +curve[k];
    if (t > best) best = t;
  });
  return best > 0 ? best : null;
}

function trial(base, tgt, knobs, best) {
  var car = clone(base);
  car.peakHp = base.peakHp; // lock
  car.weightLbs = base.weightLbs; // lock
  car.dragCoefficient = base.dragCoefficient; // lock
  car.frontalAreaSqFt = base.frontalAreaSqFt; // lock
  car.forceScale = 1;

  if (!car.isEv) {
    car.peakTqRpm = knobs.peakTqRpm;
    car.peakHpRpm = knobs.peakHpRpm;
    car.torqueCurve = makeIceCurve(
      base.peakHp, knobs.peakTq, knobs.peakTqRpm, knobs.peakHpRpm,
      Number(base.redline) || knobs.peakHpRpm + 500, knobs.fallFrac
    );
  }
  if (knobs.loss != null) car.drivetrainLossPercent = +Number(knobs.loss).toFixed(1);

  var sim = runSim(car);
  var cand = { knobs: knobs, cost: cost(sim, tgt), sim: sim, hits: hits(sim, tgt), car: car };
  if (!best) return cand;
  if (cand.cost < best.cost - 1e-9) return cand;
  if (Math.abs(cand.cost - best.cost) < 1e-9) {
    var tE = errOf(cand.sim, tgt, 'trap'); var tB = errOf(best.sim, tgt, 'trap');
    if (tE != null && tB != null && tE < tB - 1e-9) return cand;
  }
  return best;
}

function calibrateIce(car, tgt) {
  var peakHp = Number(car.peakHp) || 300;
  var red = Number(car.redline) || 6500;
  var basePhp = Number(car.peakHpRpm) || Math.round(red * 0.9);
  var basePtq = Number(car.peakTqRpm) || Math.round(red * 0.58);
  var baseTq = peakTqFromCurve(car.torqueCurve) || ((peakHp * 5252) / basePhp) * 1.12;
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var tqAtPhp = (peakHp * 5252) / basePhp;

  var best = trial(car, tgt, {
    peakTq: baseTq, peakTqRpm: basePtq, peakHpRpm: basePhp,
    fallFrac: 0.20, loss: baseLoss
  }, null);

  // TQ ratio sweep (shape only — peakHp fixed)
  [1.06, 1.10, 1.14, 1.18, 1.22, 1.28].forEach(function (ratio) {
    var peakTq = tqAtPhp * ratio;
    best = trial(car, tgt, {
      peakTq: peakTq, peakTqRpm: best.knobs.peakTqRpm, peakHpRpm: best.knobs.peakHpRpm,
      fallFrac: best.knobs.fallFrac, loss: best.knobs.loss
    }, best);
  });

  // peakTqRpm sweep
  var ptqs = [];
  [-800, -400, -200, 0, 200, 400, 800].forEach(function (d) {
    var v = Math.round(Math.max(1200, Math.min(basePhp - 200, basePtq + d)));
    if (ptqs.indexOf(v) < 0) ptqs.push(v);
  });
  ptqs.forEach(function (ptqRpm) {
    best = trial(car, tgt, {
      peakTq: best.knobs.peakTq, peakTqRpm: ptqRpm, peakHpRpm: best.knobs.peakHpRpm,
      fallFrac: best.knobs.fallFrac, loss: best.knobs.loss
    }, best);
  });

  // peakHpRpm sweep (toward/away from redline)
  var phps = [];
  [-600, -300, 0, 300, 600, 900].forEach(function (d) {
    var v = Math.round(Math.max(best.knobs.peakTqRpm + 200, Math.min(red - 50, basePhp + d)));
    if (phps.indexOf(v) < 0) phps.push(v);
  });
  phps.forEach(function (phpRpm) {
    var tqAt = (peakHp * 5252) / phpRpm;
    // keep similar TQ ratio
    var ratio = best.knobs.peakTq / Math.max(1, (peakHp * 5252) / best.knobs.peakHpRpm);
    best = trial(car, tgt, {
      peakTq: tqAt * ratio, peakTqRpm: Math.min(best.knobs.peakTqRpm, phpRpm - 200),
      peakHpRpm: phpRpm, fallFrac: best.knobs.fallFrac, loss: best.knobs.loss
    }, best);
  });

  // Fall sweep
  [0.08, 0.12, 0.16, 0.20, 0.24, 0.28].forEach(function (ff) {
    best = trial(car, tgt, {
      peakTq: best.knobs.peakTq, peakTqRpm: best.knobs.peakTqRpm,
      peakHpRpm: best.knobs.peakHpRpm, fallFrac: ff, loss: best.knobs.loss
    }, best);
  });

  // Modest loss only
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].forEach(function (loss) {
    best = trial(car, tgt, {
      peakTq: best.knobs.peakTq, peakTqRpm: best.knobs.peakTqRpm,
      peakHpRpm: best.knobs.peakHpRpm, fallFrac: best.knobs.fallFrac, loss: loss
    }, best);
  });
  var lc = best.knobs.loss;
  for (var d = -1; d <= 1; d += 0.5) {
    if (d === 0) continue;
    var L = Math.max(0, Math.min(22, +(lc + d).toFixed(1)));
    best = trial(car, tgt, {
      peakTq: best.knobs.peakTq, peakTqRpm: best.knobs.peakTqRpm,
      peakHpRpm: best.knobs.peakHpRpm, fallFrac: best.knobs.fallFrac, loss: L
    }, best);
  }

  return best;
}

function calibrateEv(car, tgt) {
  // EV: curve maps locked-ish; modest loss only (no Cd/FA/HP/wt)
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 8;
  var best = null;
  for (var loss = 0; loss <= 28; loss += 1) {
    var c = clone(car);
    c.drivetrainLossPercent = loss;
    c.forceScale = 1;
    c.peakHp = car.peakHp;
    c.weightLbs = car.weightLbs;
    c.dragCoefficient = car.dragCoefficient;
    c.frontalAreaSqFt = car.frontalAreaSqFt;
    var sim = runSim(c);
    var cand = {
      knobs: { loss: loss, ev: true },
      cost: cost(sim, tgt), sim: sim, hits: hits(sim, tgt), car: c
    };
    if (!best || cand.cost < best.cost - 1e-9) best = cand;
  }
  return best;
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Tip pc-engine-curve-accuracy: ICE curve shape (peakTq/HP RPM, fall) + modest loss;',
    ' * NEVER Cd/FA/weight/peakHp; forceScale=1; credit Jorge Guerra only.',
    ' * Physics: dyno-honest synthesizeTorqueCurve + span-aware sanitize; weather identity at RHO0.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-engine-curve-accuracy.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function needsWork(sim, tgt, h) {
  if (!h.trap || !h.et) return true;
  if (tgt.z60 != null && !h.z60) return true;
  if (tgt.z60130 != null && !h.z60130) return true;
  // also refine if trap residual > 1 mph even in tol
  if (tgt.trap != null && sim.trap != null && Math.abs(sim.trap - tgt.trap) > 1.0) return true;
  if (tgt.et != null && sim.et != null && Math.abs(sim.et - tgt.et) > 0.12) return true;
  return false;
}

function main() {
  var tgtByName = {};
  TARGETS.forEach(function (t) { tgtByName[t.name] = t; });
  var t0 = Date.now();
  var report = {
    tip: 'pc-engine-curve-accuracy',
    parent: '9c639c9',
    credit: 'Jorge Guerra',
    hard: 'no Cd/FA/weight/peakHp',
    priority: ['trap', 'et', 'z60130', 'z60'],
    applied: [], parked: [], unchanged: 0, searched: 0
  };

  for (var i = 0; i < GARAGE.length; i++) {
    var car = GARAGE[i];
    if (SKIP[car.id]) continue;
    var row = tgtByName[car.name];
    if (!row) continue;
    var tgt = { z60: row.z60, et: row.et, trap: row.trap, z60130: row.z60130 };
    if (tgt.et == null && tgt.trap == null && tgt.z60 == null) continue;

    car.forceScale = 1;
    var before = runSim(car);
    var hBefore = hits(before, tgt);
    if (!needsWork(before, tgt, hBefore)) {
      report.unchanged++;
      continue;
    }

    report.searched++;
    if (report.searched % 25 === 0) {
      console.log('… searched', report.searched, 'changed', report.applied.length,
        'ms', Date.now() - t0);
    }

    var best = car.isEv ? calibrateEv(car, tgt) : calibrateIce(car, tgt);
    var cBefore = cost(before, tgt);
    if (!(best.cost < cBefore - 0.03)) {
      report.parked.push({
        id: car.id, name: car.name, reason: 'no closer curve/loss residual',
        before: before, best: best.sim, tgt: tgt, knobs: best.knobs,
        costBefore: cBefore, costBest: best.cost
      });
      continue;
    }

    // Apply — prove locks
    var locked = {
      peakHp: car.peakHp, weightLbs: car.weightLbs,
      cd: car.dragCoefficient, fa: car.frontalAreaSqFt
    };
    if (car.isEv) {
      car.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
    } else {
      car.peakTqRpm = best.knobs.peakTqRpm;
      car.peakHpRpm = best.knobs.peakHpRpm;
      car.torqueCurve = best.car.torqueCurve;
      car.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
    }
    car.peakHp = locked.peakHp;
    car.weightLbs = locked.weightLbs;
    car.dragCoefficient = locked.cd;
    car.frontalAreaSqFt = locked.fa;
    car.forceScale = 1;
    car.source = (car.source || '') +
      ' | Engine-curve accuracy: shape/loss only (no Cd/FA/HP/wt); fs=1; credit Jorge Guerra';

    var after = runSim(car);
    report.applied.push({
      id: car.id, name: car.name, isEv: !!car.isEv,
      before: before, after: after, tgt: tgt,
      hitsBefore: hBefore, hitsAfter: hits(after, tgt),
      knobs: best.knobs,
      locked: locked,
      costBefore: cBefore, costAfter: cost(after, tgt)
    });
  }

  writeGarage(GARAGE);
  report.elapsedMs = Date.now() - t0;
  report.appliedCount = report.applied.length;
  report.parkedCount = report.parked.length;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    tip: report.tip, searched: report.searched,
    applied: report.appliedCount, parked: report.parkedCount,
    unchanged: report.unchanged, elapsedMs: report.elapsedMs
  }, null, 2));
}

main();
