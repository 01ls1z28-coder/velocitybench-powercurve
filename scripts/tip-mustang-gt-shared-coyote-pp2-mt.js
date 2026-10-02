'use strict';
/**
 * Tip: sync 2020 Mustang GT + 2018 Mustang GT PP2 to identical OEM Coyote
 * torqueCurve (460 hp @ 7000 / 420 lb-ft @ 4600). PP2 → Getrag MT-82 6MT
 * (S550 GT OEM manual; FD stays PP 3.55). Retune ICE: tires→loss only vs
 * VelocityBench_Garage_Corrected.xlsx. Tip-only, Jorge Guerra only, no Pages.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var PACK = require('./corrected-garage-targets-fresh.json');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'mustang-gt-shared-coyote-pp2-mt-report.json');
var CREDIT = 'Jorge Guerra only';
var IDS = ['2020-ford-mustang-gt', '2018-ford-mustang-gt-pp2'];
var TIRES = [0, 3, 4, 5, 1, 2];
var PREPS = ['unprepped', 'prepped'];
var SIMS = 0;
var BUDGET = 220;

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function roundTo(v, d) {
  if (v == null || d == null) return v;
  var f = Math.pow(10, d);
  return Math.round(Number(v) * f) / f;
}
function curveHash(tc) {
  return crypto.createHash('sha1').update(JSON.stringify(tc)).digest('hex').slice(0, 16);
}
function derivePeaks(tc) {
  var peakHp = 0, peakHpRpm = 0, peakTq = 0, peakTqRpm = 0;
  Object.keys(tc || {}).forEach(function (k) {
    var rpm = Number(k), tq = Number(tc[k]);
    var hp = (tq * rpm) / 5252;
    if (hp > peakHp) { peakHp = hp; peakHpRpm = rpm; }
    if (tq > peakTq) { peakTq = tq; peakTqRpm = rpm; }
  });
  return { peakHp: peakHp, peakHpRpm: peakHpRpm, peakTq: peakTq, peakTqRpm: peakTqRpm };
}

/** OEM-realistic Gen3 Coyote: 460 hp @ 7000, 420 lb-ft @ 4600 (Ford published). */
function makeOemCoyoteCurve(peakHp, peakTq, peakTqRpm, peakHpRpm, redline, fallFrac) {
  fallFrac = fallFrac != null ? fallFrac : 0.18;
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
    var maxTq = (peakHp * 1.002 * 5252) / Math.max(1, r);
    curve[r] = Math.round(Math.max(10, Math.min(tq, maxTq)) * 10000) / 10000;
  }
  curve[peakTqRpm] = Math.round(Math.min(peakTq, (peakHp * 1.002 * 5252) / peakTqRpm) * 10000) / 10000;
  curve[peakHpRpm] = Math.round(tqAtPeakHp * 10000) / 10000;
  curve[redline] = Math.round(Math.max(10, (peakHp * (1.0 - fallFrac) * 5252) / redline) * 10000) / 10000;
  if (Phys.sanitizeTorqueCurvePostPeak) Phys.sanitizeTorqueCurvePostPeak(curve, peakHpRpm);
  if (Phys.capTorqueCurveToPeakHp) Phys.capTorqueCurveToPeakHp(curve, peakHp);
  return curve;
}

function runSim(car, need613, prep) {
  SIMS++;
  var c = clone(car);
  c.forceScale = 1;
  if (Phys.sanitizeTorqueCurvePostPeak) {
    Phys.sanitizeTorqueCurvePostPeak(c.torqueCurve, c.peakHpRpm);
  }
  var r = Phys.runQuarterMile(c, {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0,
    gustMph: 0, launchMode: 'auto', trackPrep: prep || 'unprepped', driverWeightLbs: 200,
    tireType: c.tireType | 0,
    tireLabel: Phys.tireLabelForType(c.tireType | 0),
    needSixtyToOneThirty: !!need613
  });
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty) : null,
    peakHP: r.peakHorsepower != null ? Math.round(r.peakHorsepower) : null
  };
}

function hit(sim, tgt, k) {
  if (tgt[k] == null) return null;
  if (sim[k] == null) return false;
  var d = (tgt.decs && tgt.decs[k] != null) ? tgt.decs[k] : 1;
  return roundTo(sim[k], d) === roundTo(tgt[k], d);
}
function allHit(sim, tgt) {
  return ['trap', 'et', 'z60130', 'z60'].every(function (k) { return hit(sim, tgt, k) !== false; });
}
function missVec(sim, tgt) {
  function m(k, sc) {
    if (tgt[k] == null || sim[k] == null) return 0;
    var d = (tgt.decs && tgt.decs[k] != null) ? tgt.decs[k] : 1;
    var a = roundTo(sim[k], d), b = roundTo(tgt[k], d);
    if (a === b) return 0;
    return Math.abs(sim[k] - tgt[k]) * sc;
  }
  return [m('trap', 10), m('et', 20), m('z60130', 15), m('z60', 12)];
}
function better(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] < b[i] - 1e-12) return true;
    if (a[i] > b[i] + 1e-12) return false;
  }
  return false;
}
function gapReport(sim, tgt) {
  var g = {};
  ['trap', 'et', 'z60130', 'z60'].forEach(function (k) {
    if (tgt[k] == null) { g[k] = null; return; }
    var d = (tgt.decs && tgt.decs[k] != null) ? tgt.decs[k] : 1;
    var sheet = roundTo(tgt[k], d);
    var final = sim[k] == null ? null : roundTo(sim[k], d);
    g[k] = {
      sheetTarget: sheet,
      finalResult: final,
      match: hit(sim, tgt, k) === true,
      gap: (final == null || sheet == null) ? null : +(final - sheet).toFixed(4)
    };
  });
  return g;
}

function tuneIce(base, tgt, budget) {
  var need613 = tgt.z60130 != null;
  var startSims = SIMS;
  var best = null;
  var oemTire = base.tireType | 0;
  var oemLoss = base.drivetrainLossPercent != null ? Number(base.drivetrainLossPercent) : 15;

  function consider(car, prep, tag) {
    if (SIMS - startSims >= budget) return null;
    var sim = runSim(car, need613, prep);
    var mv = missVec(sim, tgt);
    var row = { car: clone(car), prep: prep, sim: sim, miss: mv, tag: tag };
    if (!best || better(mv, best.miss)) best = row;
    return row;
  }

  // Phase 1: tires + prep, loss frozen
  for (var pi = 0; pi < PREPS.length; pi++) {
    for (var ti = 0; ti < TIRES.length; ti++) {
      if (SIMS - startSims >= budget) break;
      var c = clone(base);
      c.tireType = TIRES[ti];
      c.drivetrainLossPercent = oemLoss;
      c.forceScale = 1;
      consider(c, PREPS[pi], 'tires');
      if (best && allHit(best.sim, tgt)) {
        return { best: best, methods: ['tires'], simsUsed: SIMS - startSims };
      }
    }
  }

  var tireCandidates = [];
  if (best) tireCandidates.push({ tire: best.car.tireType | 0, prep: best.prep });
  tireCandidates.push({ tire: oemTire, prep: 'unprepped' });
  // also keep UHP/Summer/Street as PP/base OEM seeds
  [0, 3, 4].forEach(function (t) {
    tireCandidates.push({ tire: t, prep: 'unprepped' });
    tireCandidates.push({ tire: t, prep: 'prepped' });
  });
  var seen = {};
  tireCandidates = tireCandidates.filter(function (t) {
    var k = t.tire + ':' + t.prep;
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  });

  for (var ci = 0; ci < tireCandidates.length; ci++) {
    if (SIMS - startSims >= budget) break;
    var tc = tireCandidates[ci];
    var lo = 0, hi = 38;
    for (var it = 0; it < 14; it++) {
      if (SIMS - startSims >= budget) break;
      var mid = +((lo + hi) / 2).toFixed(2);
      var c2 = clone(base);
      c2.tireType = tc.tire;
      c2.drivetrainLossPercent = mid;
      c2.forceScale = 1;
      var trial = consider(c2, tc.prep, 'tires+drivetrain_loss');
      if (trial && allHit(trial.sim, tgt)) {
        return finish(best, oemTire, oemLoss, startSims);
      }
      if (!trial || trial.sim.et == null) break;
      if (tgt.et != null) {
        if (trial.sim.et < tgt.et) lo = mid;
        else hi = mid;
      } else if (tgt.trap != null && trial.sim.trap != null) {
        if (trial.sim.trap > tgt.trap) lo = mid;
        else hi = mid;
      } else break;
    }
    if (best) {
      var center = Number(best.car.drivetrainLossPercent);
      for (var d = -4; d <= 4; d += 0.25) {
        if (SIMS - startSims >= budget) break;
        var loss = +clamp(center + d, 0, 40).toFixed(2);
        var c3 = clone(base);
        c3.tireType = best.car.tireType | 0;
        c3.drivetrainLossPercent = loss;
        c3.forceScale = 1;
        consider(c3, best.prep, 'tires+drivetrain_loss');
        if (best && allHit(best.sim, tgt)) return finish(best, oemTire, oemLoss, startSims);
      }
    }
    if (best && allHit(best.sim, tgt)) break;
  }

  // Final dense grid on top tire candidates
  var finals = tireCandidates.slice(0, 6);
  for (var fi = 0; fi < finals.length; fi++) {
    for (var loss = 0; loss <= 36; loss += 0.5) {
      if (SIMS - startSims >= budget) break;
      var c4 = clone(base);
      c4.tireType = finals[fi].tire;
      c4.drivetrainLossPercent = +loss.toFixed(2);
      c4.forceScale = 1;
      consider(c4, finals[fi].prep, 'tires+drivetrain_loss');
      if (best && allHit(best.sim, tgt)) return finish(best, oemTire, oemLoss, startSims);
    }
  }

  return finish(best, oemTire, oemLoss, startSims);
}

function finish(best, oemTire, oemLoss, startSims) {
  var methods = [];
  if (!best) return { best: null, methods: [], simsUsed: SIMS - startSims };
  var tireChanged = (best.car.tireType | 0) !== (oemTire | 0) || best.prep !== 'unprepped';
  var lossChanged = Math.abs(Number(best.car.drivetrainLossPercent) - oemLoss) > 0.049;
  if (tireChanged) methods.push('tires');
  if (lossChanged) methods.push('drivetrain_loss');
  if (!methods.length) methods.push('tires');
  return { best: best, methods: methods, simsUsed: SIMS - startSims };
}

function writeGarage(cars) {
  var body = JSON.stringify(cars, null, 2);
  var js =
    '(function (global) {\n' +
    '  var GARAGE = ' + body + ';\n' +
    '  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n' +
    '  if (typeof window !== "undefined") {\n' +
    '  window.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '  }\n' +
    '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this);\n';
  fs.writeFileSync(OUT_JS, js);
}

function snapshotCar(c) {
  var d = derivePeaks(c.torqueCurve);
  return {
    peakHp: c.peakHp,
    peakHpRpm: c.peakHpRpm,
    peakTqRpm: c.peakTqRpm,
    derivedPeakHp: +d.peakHp.toFixed(2),
    derivedPeakHpRpm: d.peakHpRpm,
    derivedPeakTq: +d.peakTq.toFixed(2),
    derivedPeakTqRpm: d.peakTqRpm,
    curveHash: curveHash(c.torqueCurve),
    transmission: c.transmission,
    txKey: c.txKey,
    gearRatios: clone(c.gearRatios),
    finalDriveRatio: c.finalDriveRatio,
    drivetrainLossPercent: c.drivetrainLossPercent,
    tireType: c.tireType,
    tireLabel: Phys.tireLabelForType(c.tireType | 0),
    shiftTimeSeconds: c.shiftTimeSeconds,
    launchRpm: c.launchRpm,
    shiftRpm: c.shiftRpm,
    redline: c.redline
  };
}

function main() {
  var tgtBy = {};
  PACK.targets.forEach(function (t) { tgtBy[t.name] = t; });

  var idx = {};
  IDS.forEach(function (id) {
    for (var i = 0; i < GARAGE.length; i++) {
      if (GARAGE[i].id === id) { idx[id] = i; break; }
    }
    if (idx[id] == null) throw new Error('missing ' + id);
  });

  var before = {};
  IDS.forEach(function (id) { before[id] = snapshotCar(GARAGE[idx[id]]); });

  // Prefer OEM-realistic Gen3 Coyote (neither drifted curve matches Ford's 460@7000 / 420@4600).
  var sharedRedline = 7500;
  var sharedCurve = makeOemCoyoteCurve(460, 420, 4600, 7000, sharedRedline, 0.18);
  var sharedHash = curveHash(sharedCurve);
  var sharedPeaks = derivePeaks(sharedCurve);

  console.log('Shared OEM Coyote curve hash', sharedHash, 'derived', sharedPeaks);

  // Apply identical curve to both
  IDS.forEach(function (id) {
    var c = GARAGE[idx[id]];
    c.torqueCurve = clone(sharedCurve);
    c.peakHp = 460;
    c.peakHpRpm = sharedPeaks.peakHpRpm;
    c.peakTqRpm = sharedPeaks.peakTqRpm;
    c.redline = sharedRedline;
    if (c.shiftRpm > sharedRedline) c.shiftRpm = sharedRedline - 50;
    if (c.shiftRpm < sharedPeaks.peakHpRpm - 400) c.shiftRpm = Math.min(sharedRedline - 50, sharedPeaks.peakHpRpm + 100);
    c.forceScale = 1;
    c.weightLbs = 3705; // sheet
  });

  // PP2 → S550 GT OEM 6-speed manual (Getrag MT-82). Keep PP axle 3.55.
  var mt = Phys.FactoryTransmissions.Getrag_MT82;
  var pp2 = GARAGE[idx['2018-ford-mustang-gt-pp2']];
  pp2.transmission = 'Manual';
  pp2.txKey = 'Getrag_MT82';
  pp2.gearRatios = mt.gears.slice();
  pp2.finalDriveRatio = 3.55; // Performance Package OEM axle
  pp2.shiftTimeSeconds = 0.18; // peer S550 MT-82 cars
  // factory MT package loss seed before retune
  pp2.drivetrainLossPercent = mt.loss;
  // OEM PP2 tire seed: UHP (PS4S) — retune may change
  if (pp2.tireType == null) pp2.tireType = 4;

  var gt = GARAGE[idx['2020-ford-mustang-gt']];
  // 2020 GT stays Auto 10R80; seed factory auto loss before retune
  if (gt.txKey !== 'Ford_10R80') {
    gt.txKey = 'Ford_10R80';
    gt.transmission = 'Auto';
  }
  // keep existing gears/FD; seed loss to factory package if absurd after prior tunes
  // (will be retuned anyway)

  var note =
    ' | Shared OEM Coyote curve sync (460@7000 / 420@4600) + PP2 Getrag MT-82 6MT / 3.55 FD; ' +
    'ICE tires→loss retune vs Corrected Excel (fs=1; credit Jorge Guerra)';

  var results = [];
  IDS.forEach(function (id) {
    var i = idx[id];
    var car = GARAGE[i];
    var tgt = tgtBy[car.name];
    if (!tgt) throw new Error('no target for ' + car.name);

    var baseline = runSim(car, tgt.z60130 != null, 'unprepped');
    console.log('\n[BASE]', car.name, baseline);

    var tuned = tuneIce(car, tgt, BUDGET);
    if (!tuned.best) throw new Error('tune failed for ' + car.name);

    car.tireType = tuned.best.car.tireType | 0;
    car.drivetrainLossPercent = Number(tuned.best.car.drivetrainLossPercent);
    car.trackPrepDefault = tuned.best.prep || 'unprepped';
    car.forceScale = 1;
    if (car.source && car.source.indexOf('Shared OEM Coyote curve sync') < 0) {
      car.source = (car.source || '') + note;
    } else if (!car.source) {
      car.source = note.trim().replace(/^\s*\|\s*/, '');
    }

    var finalSim = runSim(car, tgt.z60130 != null, tuned.best.prep || 'unprepped');
    var ok = allHit(finalSim, tgt);
    var row = {
      id: car.id,
      name: car.name,
      fullMatch: ok,
      methodUsed: tuned.methods.join('+'),
      metrics: gapReport(finalSim, tgt),
      prep: tuned.best.prep,
      knobs: {
        tireType: car.tireType,
        tireLabel: Phys.tireLabelForType(car.tireType | 0),
        loss: car.drivetrainLossPercent,
        peakHp: car.peakHp,
        peakHpRpm: car.peakHpRpm,
        transmission: car.transmission,
        txKey: car.txKey,
        gearRatios: clone(car.gearRatios),
        finalDriveRatio: car.finalDriveRatio,
        curveHash: curveHash(car.torqueCurve)
      },
      baseline: gapReport(baseline, tgt),
      simsCar: tuned.simsUsed
    };
    if (!ok) {
      row.why = 'could not reach exact sheet match with tires→loss only (curves locked identical)';
      row.missVec = missVec(finalSim, tgt);
    }
    results.push(row);
    console.log(ok ? '[OK]' : '[MISS]', car.name, row.methodUsed, JSON.stringify(row.metrics), 'sims', tuned.simsUsed);
  });

  // Identity check
  var h0 = curveHash(GARAGE[idx[IDS[0]]].torqueCurve);
  var h1 = curveHash(GARAGE[idx[IDS[1]]].torqueCurve);
  var identical = h0 === h1 &&
    GARAGE[idx[IDS[0]]].peakHp === GARAGE[idx[IDS[1]]].peakHp &&
    GARAGE[idx[IDS[0]]].peakHpRpm === GARAGE[idx[IDS[1]]].peakHpRpm;

  writeGarage(GARAGE);

  var after = {};
  IDS.forEach(function (id) { after[id] = snapshotCar(GARAGE[idx[id]]); });

  var report = {
    tip: 'mustang-gt-shared-coyote-pp2-mt',
    credit: CREDIT,
    sharedCurve: {
      hash: sharedHash,
      peakHp: 460,
      peakHpRpm: sharedPeaks.peakHpRpm,
      peakTq: +sharedPeaks.peakTq.toFixed(2),
      peakTqRpm: sharedPeaks.peakTqRpm,
      redline: sharedRedline,
      rationale: 'OEM Gen3 Coyote published ratings (460 hp @ 7000, 420 lb-ft @ 4600); both cars share identical torqueCurve object values'
    },
    curveIdentity: { hash0: h0, hash1: h1, identical: identical },
    before: before,
    after: after,
    results: results,
    simsTotal: SIMS,
    pages: false
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\nWrote', OUT_JS);
  console.log('Wrote', REPORT);
  console.log('curve identical:', identical, 'fullMatches:', results.filter(function (r) { return r.fullMatch; }).length + '/' + results.length);
}

main();
