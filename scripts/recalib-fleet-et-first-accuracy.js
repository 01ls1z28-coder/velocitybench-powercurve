/**
 * Tip: fleet-et-first-accuracy (credit Jorge Guerra)
 * Parent: e11f399 = c931e63 cherry-picked onto LIVE d102976.
 * SOI: VelocityBench_Garage_Corrected.xlsx + L_Fixes → excel-corrected-targets.json
 * Priority: ET → trap → 60-130 → 0-60; tighten absolute error (closer > mere in-tol).
 * Honest: loss/launch/tire only; forceScale=1; no fake TX/HP/Cd/curve invent.
 * Park only true ET–trap conflicts (best ET-preserving point still far on trap) or no knob headroom.
 * Skip: Cybertruck, ZR1X, Jorge Z28 ATC.
 *
 *   node scripts/recalib-fleet-et-first-accuracy.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'fleet-et-first-accuracy-report.json');
var TARGETS = require('./excel-corrected-targets.json');

var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var SKIP = {
  '2024-tesla-cybertruck-tri-motor': 'Cybertruck locked on LIVE',
  '2026-chevrolet-corvette-zr1x': 'ZR1X separate tip',
  '2001-chevrolet-camaro-z28-hce-ms3-tsp53stage25-134lt-trueduals': 'Z28 ATC — do not touch'
};

function envFor(tireType) {
  return {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: tireType | 0, tireLabel: Phys.tireLabelForType(tireType | 0),
    needSixtyToOneThirty: true, quickMetrics: true
  };
}
function runSim(car) {
  var r = Phys.runQuarterMile(car, envFor(car.tireType));
  return {
    z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    z60130: r.sixtyToOneThirty, sixty: r.sixtyFootTime, vmax: r.topSpeedMph
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
function allHit(h) { return !!(h && h.et && h.trap && h.z60 && h.z60130); }

/** Continuous closeness cost — prefer nearer residuals even inside tol. */
function cost(sim, tgt) {
  var c = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    if (sim[k] == null) { c += 200 * w; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    // primary: absolute error scaled by priority weight / tol
    c += (err / tol) * w;
    // soft miss bump (does not dominate closeness)
    if (err > tol) c += w * 0.5;
  }
  add('et', 8, TOL.et);
  add('trap', 5, TOL.trap);
  add('z60130', 2.5, TOL.z60130);
  add('z60', 2, TOL.z60);
  return c;
}
function errOf(sim, tgt, k) {
  if (tgt[k] == null || sim[k] == null) return null;
  return Math.abs(sim[k] - tgt[k]);
}

function trial(base, tgt, knobs, best) {
  var car = clone(base);
  car.drivetrainLossPercent = knobs.loss;
  car.tireType = knobs.tire;
  car.launchRpm = knobs.launch;
  car.forceScale = 1;
  var sim = runSim(car);
  var h = hits(sim, tgt);
  var cand = { knobs: knobs, cost: cost(sim, tgt), sim: sim, hits: h, car: car };
  if (!best) return cand;
  // closer wins; tie-break: ET err, then trap err
  if (cand.cost < best.cost - 1e-9) return cand;
  if (Math.abs(cand.cost - best.cost) < 1e-9) {
    var eE = errOf(cand.sim, tgt, 'et'); var eB = errOf(best.sim, tgt, 'et');
    if (eE != null && eB != null && eE < eB - 1e-9) return cand;
    var tE = errOf(cand.sim, tgt, 'trap'); var tB = errOf(best.sim, tgt, 'trap');
    if (tE != null && tB != null && tE < tB - 1e-9) return cand;
  }
  return best;
}

function calibrate(car, tgt) {
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : (car.isEv ? 500 : 2800);
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, { loss: baseLoss, tire: seedTire, launch: baseLaunch }, null);

  // coarse loss
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35].forEach(function (loss) {
    best = trial(car, tgt, { loss: loss, tire: seedTire, launch: baseLaunch }, best);
  });
  // fine loss
  var lc = best.knobs.loss;
  for (var d = -2; d <= 2; d += 0.5) {
    if (d === 0) continue;
    var L = Math.max(0, Math.min(35, +(lc + d).toFixed(1)));
    best = trial(car, tgt, { loss: L, tire: best.knobs.tire, launch: baseLaunch }, best);
  }
  // tires
  [0, 1, 2, 3, 4].forEach(function (tire) {
    if (tire === best.knobs.tire) return;
    best = trial(car, tgt, { loss: best.knobs.loss, tire: tire, launch: baseLaunch }, best);
  });
  // re-fine loss on chosen tire
  lc = best.knobs.loss;
  for (var d2 = -1.5; d2 <= 1.5; d2 += 0.5) {
    if (d2 === 0) continue;
    var L2 = Math.max(0, Math.min(35, +(lc + d2).toFixed(1)));
    best = trial(car, tgt, { loss: L2, tire: best.knobs.tire, launch: baseLaunch }, best);
  }
  // launch
  var launches;
  if (car.isEv) launches = [400, 500, 700, 1000];
  else {
    launches = [];
    [-900, -600, -300, 0, 300, 600, 900].forEach(function (dd) {
      var v = Math.round(Math.max(1000, Math.min(4200, baseLaunch + dd)));
      if (launches.indexOf(v) < 0) launches.push(v);
    });
  }
  launches.forEach(function (launch) {
    best = trial(car, tgt, { loss: best.knobs.loss, tire: best.knobs.tire, launch: launch }, best);
  });
  return best;
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph + EV_Single / Tesla / Taycan / KDD presets.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+launch+tire calibrated toward Excel (forceScale retired = 1.0 always).',
    ' * Excel source: /workspace/garage-export/VelocityBench_Garage_Corrected.xlsx (+ L_Fixes).',
    ' * Cybertruck tip: OEM FD 15.02 + curve-respan; trap-119 via Cd→0.34 + Summer; forceScale=1.',
    ' * ZR1X rebake: published Cd0.36/wt3978/FD5.56 locked — loss-only ET@trap toward Excel 8.675@159.',
    ' * Fleet published-miss batch (c931e63): sourced curve/Cd/loss/tire; fs=1; no fake TX.',
    ' * Fleet ET-first accuracy: Corrected Excel SOI; closer residuals via loss/launch/tire; fs=1; credit Jorge Guerra.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-fleet-et-first-accuracy.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function isTight(sim, tgt) {
  // already very close on all present metrics (≤40% of tol) — still allow improve if cheaper
  function ok(k, tol) {
    if (tgt[k] == null) return true;
    if (sim[k] == null) return false;
    return Math.abs(sim[k] - tgt[k]) <= tol * 0.4;
  }
  return ok('et', TOL.et) && ok('trap', TOL.trap) && ok('z60', TOL.z60) && ok('z60130', TOL.z60130);
}

function main() {
  var tgtByName = {};
  TARGETS.forEach(function (t) { tgtByName[t.name] = t; });
  var t0 = Date.now();
  var report = {
    tip: 'fleet-et-first-accuracy',
    parent: 'e11f399 (c931e63 onto d102976)',
    credit: 'Jorge Guerra',
    soi: 'VelocityBench_Garage_Corrected.xlsx + L_Fixes',
    tol: TOL,
    priority: ['et', 'trap', 'z60130', 'z60'],
    note: 'Closer residuals preferred over mere in-tol; park only ET–trap conflict / no headroom',
    forceScale: 1,
    skipped: SKIP,
    applied: [],
    parked: [],
    unchangedTight: 0,
    searched: 0
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
    var cBefore = cost(before, tgt);

    // Skip only ultra-tight cars (still could search but saves time)
    if (isTight(before, tgt) && allHit(hBefore)) {
      report.unchangedTight++;
      continue;
    }

    report.searched++;
    if (report.searched % 25 === 0) {
      console.log('… searched', report.searched, 'changed', report.applied.length,
        'parked', report.parked.length, 'ms', Date.now() - t0);
    }

    var best = calibrate(car, tgt);

    // ET-first safety: do not accept a candidate that worsens ET error by >0.05s
    // unless ET still in tol AND trap improves enough that total cost drops (classic conflict resolve toward closer ET+trap bal)
    var etErrBefore = errOf(before, tgt, 'et');
    var etErrAfter = errOf(best.sim, tgt, 'et');
    var etSafe = true;
    if (etErrBefore != null && etErrAfter != null) {
      if (etErrAfter > etErrBefore + 0.05 && etErrAfter > TOL.et) etSafe = false;
      // if ET was in tol and leaves tol — reject
      if (etErrBefore <= TOL.et && etErrAfter > TOL.et) etSafe = false;
    }

    var knobsSame =
      Math.abs((+car.drivetrainLossPercent || 0) - best.knobs.loss) < 1e-6 &&
      (car.tireType | 0) === best.knobs.tire &&
      (car.launchRpm | 0) === (best.knobs.launch | 0);

    var improve = best.cost < cBefore - 0.02;

    // True ET–trap conflict: ET in tol (or best ET), trap still >2× tol at best ET-preserving point
    var trapErrBest = errOf(best.sim, tgt, 'trap');
    var conflict = etSafe && best.hits.et && trapErrBest != null && trapErrBest > TOL.trap * 2 && !improve;

    if (!etSafe) {
      report.parked.push({
        id: car.id, name: car.name, reason: 'ET–trap conflict (ET-first reject)',
        before: before, best: best.sim, tgt: tgt, hitsBefore: hBefore, hitsBest: best.hits,
        knobsBest: best.knobs, costBefore: cBefore, costBest: best.cost
      });
      continue;
    }
    if (!improve || knobsSame) {
      report.parked.push({
        id: car.id, name: car.name,
        reason: conflict ? 'ET–trap conflict residual (parked invent)' :
          knobsSame ? 'no knob headroom (residual)' : 'no closer residual found',
        before: before, best: best.sim, tgt: tgt, hitsBefore: hBefore, hitsBest: best.hits,
        knobsBest: best.knobs, costBefore: cBefore, costBest: best.cost
      });
      continue;
    }

    car.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
    car.tireType = best.knobs.tire;
    car.launchRpm = best.knobs.launch;
    car.forceScale = 1;
    car.source = (car.source || '') +
      ' | ET-first closer: loss ' + car.drivetrainLossPercent +
      ' / tire ' + car.tireType + ' / launch ' + car.launchRpm +
      ' vs Corrected Excel (fs=1; credit Jorge Guerra)';

    var after = runSim(car);
    var hAfter = hits(after, tgt);
    var status = allHit(hAfter) ? 'HIT' :
      (hAfter.et && hAfter.trap ? 'PARTIAL' :
        (hAfter.et ? 'ET_OK' : 'CLOSER'));
    report.applied.push({
      id: car.id, name: car.name, status: status,
      before: before, after: after, tgt: tgt,
      hitsBefore: hBefore, hitsAfter: hAfter,
      costBefore: cBefore, costAfter: cost(after, tgt),
      knobs: { loss: car.drivetrainLossPercent, tire: car.tireType, launch: car.launchRpm },
      delta: {
        dEt: (after.et != null && before.et != null) ? after.et - before.et : null,
        dTrap: (after.trap != null && before.trap != null) ? after.trap - before.trap : null,
        d60: (after.z60 != null && before.z60 != null) ? after.z60 - before.z60 : null
      }
    });
  }

  writeGarage(GARAGE);
  report.changed = report.applied.length;
  report.hitApplied = report.applied.filter(function (a) { return a.status === 'HIT'; }).length;
  report.partialApplied = report.applied.filter(function (a) { return a.status === 'PARTIAL'; }).length;
  report.ms = Date.now() - t0;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    searched: report.searched,
    unchangedTight: report.unchangedTight,
    changed: report.changed,
    hitApplied: report.hitApplied,
    partialApplied: report.partialApplied,
    parked: report.parked.length,
    ms: report.ms
  }, null, 2));
  report.applied.forEach(function (a) {
    console.log(
      a.status, a.name,
      (a.before.et != null ? a.before.et.toFixed(2) : '?') + '@' + (a.before.trap != null ? a.before.trap.toFixed(1) : '?'),
      '→',
      (a.after.et != null ? a.after.et.toFixed(2) : '?') + '@' + (a.after.trap != null ? a.after.trap.toFixed(1) : '?'),
      'tgt', a.tgt.et + '@' + a.tgt.trap,
      'knobs', JSON.stringify(a.knobs)
    );
  });
}

main();
