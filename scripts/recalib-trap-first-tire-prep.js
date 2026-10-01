/**
 * Tip: pc-trap-first-tire-prep (credit Jorge Guerra ONLY)
 * Parent: 21fb630 review/pc-fleet-realism-pass
 * Priority: trap → ET → 60-130 → 0-60
 * Knobs: Cd / frontalArea / modest loss / curve post-peak fall / tire / launch
 * NEVER touch peakHp or weightLbs. forceScale=1 always.
 * Track-prep µ (unprepped default): DR 1.38 / Slick 1.40.
 *
 *   node scripts/recalib-trap-first-tire-prep.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'trap-first-tire-prep-report.json');
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
    tireType: tireType | 0, trackPrep: 'unprepped',
    tireLabel: Phys.tireLabelForType(tireType | 0),
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
function errOf(sim, tgt, k) {
  if (tgt[k] == null || sim[k] == null) return null;
  return Math.abs(sim[k] - tgt[k]);
}

/** Trap-first continuous cost (Jorge priority stack). */
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

function isBike(car) {
  return /bike|motorcycle|s1000|panigale|gsxr|r1\b|ninja|ducati|yamaha|kawasaki|suzuki.?gsx|honda.?cbr/i.test(car.name || '') ||
    (Number(car.frontalAreaSqFt) > 0 && Number(car.frontalAreaSqFt) < 10);
}

/** Reshape post-peak fall without changing peakHp (cap after). fallMult>1 steeper. */
function applyFallMult(car, fallMult) {
  if (!car.torqueCurve || !(fallMult > 0) || Math.abs(fallMult - 1) < 1e-6) return;
  if (car.isEv) return; // EV motor maps — prefer Cd/loss
  var peakHpRpm = Number(car.peakHpRpm) || 6000;
  var curve = clone(car.torqueCurve);
  var keys = Object.keys(curve).map(Number).sort(function (a, b) { return a - b; });
  var tqPeak = null;
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] >= peakHpRpm) { tqPeak = +curve[keys[i]]; break; }
  }
  if (!(tqPeak > 0)) return;
  keys.forEach(function (r) {
    if (r <= peakHpRpm) return;
    var old = +curve[r];
    var delta = old - tqPeak;
    curve[r] = Math.max(8, tqPeak + delta * fallMult);
  });
  if (Phys.sanitizeTorqueCurvePostPeak) Phys.sanitizeTorqueCurvePostPeak(curve, peakHpRpm);
  if (car.peakHp > 0 && Phys.capTorqueCurveToPeakHp) Phys.capTorqueCurveToPeakHp(curve, car.peakHp);
  car.torqueCurve = curve;
}

function cdClamp(car, cd) {
  if (isBike(car)) return Math.max(0.28, Math.min(0.85, cd));
  return Math.max(0.20, Math.min(0.55, cd));
}
function faClamp(car, fa) {
  if (isBike(car)) return Math.max(4.5, Math.min(10, fa));
  return Math.max(16, Math.min(36, fa));
}

function trial(base, tgt, knobs, best) {
  var car = clone(base);
  if (knobs.cd != null) car.dragCoefficient = +Number(knobs.cd).toFixed(3);
  if (knobs.fa != null) car.frontalAreaSqFt = +Number(knobs.fa).toFixed(2);
  if (knobs.loss != null) car.drivetrainLossPercent = +Number(knobs.loss).toFixed(1);
  if (knobs.tire != null) car.tireType = knobs.tire | 0;
  if (knobs.launch != null) car.launchRpm = knobs.launch | 0;
  car.forceScale = 1;
  if (knobs.fallMult != null && knobs.fallMult !== 1) applyFallMult(car, knobs.fallMult);
  // Never mutate peakHp / weight
  car.peakHp = base.peakHp;
  car.weightLbs = base.weightLbs;

  var sim = runSim(car);
  var h = hits(sim, tgt);
  var cand = { knobs: knobs, cost: cost(sim, tgt), sim: sim, hits: h, car: car };
  if (!best) return cand;
  if (cand.cost < best.cost - 1e-9) return cand;
  if (Math.abs(cand.cost - best.cost) < 1e-9) {
    var tE = errOf(cand.sim, tgt, 'trap'); var tB = errOf(best.sim, tgt, 'trap');
    if (tE != null && tB != null && tE < tB - 1e-9) return cand;
    var eE = errOf(cand.sim, tgt, 'et'); var eB = errOf(best.sim, tgt, 'et');
    if (eE != null && eB != null && eE < eB - 1e-9) return cand;
  }
  return best;
}

function calibrate(car, tgt) {
  var baseCd = Number(car.dragCoefficient) || 0.35;
  var baseFa = Number(car.frontalAreaSqFt) || 22;
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : (car.isEv ? 500 : 2800);
  var seedTire = car.tireType | 0;

  var best = trial(car, tgt, {
    cd: baseCd, fa: baseFa, loss: baseLoss, tire: seedTire, launch: baseLaunch, fallMult: 1
  }, null);

  // 1) Directed Cd sweep (trap dominant at speed)
  var cds = [];
  for (var d = -0.08; d <= 0.08 + 1e-9; d += 0.01) {
    cds.push(+cdClamp(car, baseCd + d).toFixed(3));
  }
  cds = cds.filter(function (v, i, a) { return a.indexOf(v) === i; });
  cds.forEach(function (cd) {
    best = trial(car, tgt, {
      cd: cd, fa: best.knobs.fa, loss: best.knobs.loss,
      tire: best.knobs.tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
  });

  // 2) Frontal area modest sweep
  var fas = [];
  for (var f = -2.5; f <= 2.5 + 1e-9; f += 0.5) {
    fas.push(+faClamp(car, baseFa + f).toFixed(2));
  }
  fas = fas.filter(function (v, i, a) { return a.indexOf(v) === i; });
  fas.forEach(function (fa) {
    best = trial(car, tgt, {
      cd: best.knobs.cd, fa: fa, loss: best.knobs.loss,
      tire: best.knobs.tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
  });

  // 3) Modest loss (prefer aero/curve first; loss only if needed)
  [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28].forEach(function (loss) {
    best = trial(car, tgt, {
      cd: best.knobs.cd, fa: best.knobs.fa, loss: loss,
      tire: best.knobs.tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
  });
  var lc = best.knobs.loss;
  for (var dl = -1.5; dl <= 1.5; dl += 0.5) {
    if (dl === 0) continue;
    var L = Math.max(0, Math.min(30, +(lc + dl).toFixed(1)));
    best = trial(car, tgt, {
      cd: best.knobs.cd, fa: best.knobs.fa, loss: L,
      tire: best.knobs.tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
  }

  // 4) Post-peak fall reshape (ICE only) — trap nudge without HP change
  if (!car.isEv) {
    [0.75, 0.85, 1.0, 1.15, 1.3].forEach(function (fm) {
      best = trial(car, tgt, {
        cd: best.knobs.cd, fa: best.knobs.fa, loss: best.knobs.loss,
        tire: best.knobs.tire, launch: best.knobs.launch, fallMult: fm
      }, best);
    });
  }

  // 5) Tire ladder
  [0, 3, 4, 1, 2].forEach(function (tire) {
    best = trial(car, tgt, {
      cd: best.knobs.cd, fa: best.knobs.fa, loss: best.knobs.loss,
      tire: tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
  });

  // 6) Launch
  var launches;
  if (car.isEv) launches = [200, 400, 500, 700, 1000];
  else {
    launches = [];
    [-900, -600, -300, 0, 300, 600, 900].forEach(function (dd) {
      var v = Math.round(Math.max(800, Math.min(4500, baseLaunch + dd)));
      if (launches.indexOf(v) < 0) launches.push(v);
    });
  }
  launches.forEach(function (launch) {
    best = trial(car, tgt, {
      cd: best.knobs.cd, fa: best.knobs.fa, loss: best.knobs.loss,
      tire: best.knobs.tire, launch: launch, fallMult: best.knobs.fallMult
    }, best);
  });

  // 7) Fine Cd around winner
  var c0 = best.knobs.cd;
  [-0.015, -0.01, -0.005, 0.005, 0.01, 0.015].forEach(function (d) {
    var cd = +cdClamp(car, c0 + d).toFixed(3);
    best = trial(car, tgt, {
      cd: cd, fa: best.knobs.fa, loss: best.knobs.loss,
      tire: best.knobs.tire, launch: best.knobs.launch, fallMult: best.knobs.fallMult
    }, best);
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
    ' * or curated; loss+launch+tire+Cd/FA calibrated toward Excel (forceScale = 1.0 always).',
    ' * Excel source: /workspace/garage-export/VelocityBench_Garage_Corrected.xlsx (+ L_Fixes).',
    ' * Cybertruck / ZR1X / Jorge Z28 ATC: locked — skipped by trap-first recalib.',
    ' * Tip pc-trap-first-tire-prep: unprepped µ DR1.38/Slick1.40; trap→ET→60-130→0-60;',
    ' * knobs Cd/FA/loss/curve-fall/tire/launch; NEVER peakHp/weight; credit Jorge Guerra only.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-trap-first-tire-prep.js',
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
    tip: 'pc-trap-first-tire-prep',
    parent: '21fb630',
    credit: 'Jorge Guerra',
    soi: 'VelocityBench_Garage_Corrected.xlsx + L_Fixes',
    tol: TOL,
    priority: ['trap', 'et', 'z60130', 'z60'],
    muUnprepped: Phys.TIRE_MU_BY_PREP.unprepped,
    muPrepped: Phys.TIRE_MU_BY_PREP.prepped,
    note: 'Trap-first; Cd/FA/loss/curve-fall/tire/launch; no peakHp/weight; fs=1; default trackPrep=unprepped',
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

    if (isTight(before, tgt) && hBefore.et && hBefore.trap && hBefore.z60 &&
        (tgt.z60130 == null || hBefore.z60130)) {
      report.unchangedTight++;
      continue;
    }

    report.searched++;
    if (report.searched % 20 === 0) {
      console.log('… searched', report.searched, 'changed', report.applied.length,
        'parked', report.parked.length, 'ms', Date.now() - t0);
    }

    var best = calibrate(car, tgt);

    // Soft ET guard: do not accept if ET leaves tol when it was in tol,
    // unless trap improves enough that total cost still wins strongly.
    var etErrBefore = errOf(before, tgt, 'et');
    var etErrAfter = errOf(best.sim, tgt, 'et');
    var trapErrBefore = errOf(before, tgt, 'trap');
    var trapErrAfter = errOf(best.sim, tgt, 'trap');
    var etSafe = true;
    if (etErrBefore != null && etErrAfter != null) {
      if (etErrBefore <= TOL.et && etErrAfter > TOL.et) {
        // allow only if trap was missing and now hits (or trap err drops ≥2 mph)
        var trapWin = (trapErrBefore != null && trapErrAfter != null &&
          ((trapErrBefore > TOL.trap && trapErrAfter <= TOL.trap) ||
           (trapErrBefore - trapErrAfter >= 2.0)));
        if (!trapWin) etSafe = false;
      }
      if (etErrAfter > etErrBefore + 0.35 && etErrAfter > TOL.et * 1.5) etSafe = false;
    }

    var knobs = best.knobs;
    var knobsSame =
      Math.abs((Number(car.dragCoefficient) || 0.35) - knobs.cd) < 1e-4 &&
      Math.abs((Number(car.frontalAreaSqFt) || 22) - knobs.fa) < 1e-3 &&
      Math.abs((+car.drivetrainLossPercent || 0) - knobs.loss) < 1e-6 &&
      (car.tireType | 0) === (knobs.tire | 0) &&
      (car.launchRpm | 0) === (knobs.launch | 0) &&
      Math.abs((knobs.fallMult || 1) - 1) < 1e-6;

    var improve = best.cost < cBefore - 0.03;

    if (!etSafe) {
      report.parked.push({
        id: car.id, name: car.name, reason: 'ET guard reject (trap win insufficient)',
        before: before, best: best.sim, tgt: tgt, hitsBefore: hBefore, hitsBest: best.hits,
        knobsBest: knobs, costBefore: cBefore, costBest: best.cost
      });
      continue;
    }
    if (!improve || knobsSame) {
      report.parked.push({
        id: car.id, name: car.name,
        reason: knobsSame ? 'no knob headroom' : 'no closer residual',
        before: before, best: best.sim, tgt: tgt, hitsBefore: hBefore, hitsBest: best.hits,
        knobsBest: knobs, costBefore: cBefore, costBest: best.cost
      });
      continue;
    }

    // Apply
    car.dragCoefficient = +Number(knobs.cd).toFixed(3);
    car.frontalAreaSqFt = +Number(knobs.fa).toFixed(2);
    car.drivetrainLossPercent = +Number(knobs.loss).toFixed(1);
    car.tireType = knobs.tire | 0;
    car.launchRpm = knobs.launch | 0;
    car.forceScale = 1;
    if (knobs.fallMult != null && Math.abs(knobs.fallMult - 1) > 1e-6) {
      applyFallMult(car, knobs.fallMult);
    }
    car.source = (car.source || '') +
      ' | Trap-first tire-prep: Cd ' + car.dragCoefficient +
      ' / FA ' + car.frontalAreaSqFt +
      ' / loss ' + car.drivetrainLossPercent +
      ' / tire ' + car.tireType +
      ' / launch ' + car.launchRpm +
      (knobs.fallMult && knobs.fallMult !== 1 ? ' / fall×' + knobs.fallMult : '') +
      ' (fs=1; credit Jorge Guerra)';

    var after = runSim(car);
    var hAfter = hits(after, tgt);
    report.applied.push({
      id: car.id, name: car.name,
      before: before, after: after, tgt: tgt,
      hitsBefore: hBefore, hitsAfter: hAfter,
      knobs: {
        cd: car.dragCoefficient, fa: car.frontalAreaSqFt,
        loss: car.drivetrainLossPercent, tire: car.tireType,
        launch: car.launchRpm, fallMult: knobs.fallMult || 1
      },
      costBefore: cBefore, costAfter: cost(after, tgt),
      peakHp: car.peakHp, weightLbs: car.weightLbs
    });
  }

  writeGarage(GARAGE);
  report.elapsedMs = Date.now() - t0;
  report.appliedCount = report.applied.length;
  report.parkedCount = report.parked.length;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    tip: report.tip,
    searched: report.searched,
    applied: report.appliedCount,
    parked: report.parkedCount,
    unchangedTight: report.unchangedTight,
    elapsedMs: report.elapsedMs,
    muUnprepped: report.muUnprepped
  }, null, 2));
}

main();
