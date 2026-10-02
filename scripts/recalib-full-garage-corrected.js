'use strict';
/**
 * LOCKED: see scripts/JORGE_LOCKED_RECALIB_RULES.md — NEVER touch Cd/FA/mass/gears for Excel hit rate.
 * FULL GARAGE match to VelocityBench_Garage_Corrected.xlsx Garage sheet.
 * ACCEPTANCE: exact to sheet decimal places (NOT ±0.5/±0.05).
 * ICE: tires(+prep) FIRST → drivetrainLossPercent SECOND. No free peakHp.
 * EV: peakHp/curve/launch/drag/limiter FIRST → tires/loss only if needed.
 * UI-path sim. Tip-only. Jorge Guerra only. No Pages.
 */
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var PACK = require('./corrected-garage-targets-fresh.json');
var TARGETS = PACK.targets;
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'full-garage-corrected-report.json');
var PROG = path.join(__dirname, 'full-garage-corrected-progress.json');
var CREDIT = 'Jorge Guerra only';
var TIRES = [0, 3, 4, 5, 1, 2];
var PREPS = ['unprepped', 'prepped'];
var SIMS = 0;
var MAX_SIMS_CAR = 48;

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function isEv(c) { return !!(c.isEv || c.powerSource === 'ev'); }
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
function restoreExcelHp(car, excelHp) {
  if (excelHp == null || !(excelHp > 0)) return;
  applyPower(car, excelHp);
}

function runSim(car, need613, prep) {
  SIMS++;
  var c = clone(car);
  c.forceScale = 1;
  // UI path: sanitize ICE only; keep evLaunch* on EV
  if (!isEv(c) && Phys.sanitizeTorqueCurvePostPeak) {
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
    peakHP: r.peakHorsepower != null ? Math.round(r.peakHorsepower) : null,
    prep: prep || 'unprepped'
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

function writeGarage() {
  var body = JSON.stringify(GARAGE, null, 2);
  fs.writeFileSync(OUT_JS,
    '(function (global) {\n  var GARAGE = ' + body + ';\n' +
    '  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n' +
    '  if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n  }\n' +
    '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this);\n');
}
function writeProg(o) {
  o.credit = CREDIT;
  o.updated = new Date().toISOString();
  o.sims = SIMS;
  fs.writeFileSync(PROG, JSON.stringify(o, null, 2));
}

function tuneIce(base, tgt, budget) {
  var need613 = tgt.z60130 != null;
  var startSims = SIMS;
  var best = null;
  var methods = [];
  var oemTire = base.tireType | 0;
  var oemLoss = base.drivetrainLossPercent != null ? Number(base.drivetrainLossPercent) : 15;

  function consider(car, prep, tag) {
    if (SIMS - startSims >= budget) return;
    var sim = runSim(car, need613, prep);
    var mv = missVec(sim, tgt);
    var row = { car: clone(car), prep: prep, sim: sim, miss: mv, tag: tag };
    if (!best || better(mv, best.miss)) best = row;
    return row;
  }

  // Phase 1: tires + prep only (loss frozen at OEM)
  for (var pi = 0; pi < PREPS.length; pi++) {
    for (var ti = 0; ti < TIRES.length; ti++) {
      if (SIMS - startSims >= budget) break;
      var c = clone(base);
      c.tireType = TIRES[ti];
      c.drivetrainLossPercent = oemLoss;
      c.forceScale = 1;
      consider(c, PREPS[pi], 'tires');
      if (best && allHit(best.sim, tgt)) {
        methods = ['tires'];
        return { best: best, methods: methods, simsUsed: SIMS - startSims };
      }
    }
  }

  // Phase 2: binary loss on best tire(+prep), and on oem tire
  var tireCandidates = [];
  if (best) tireCandidates.push({ tire: best.car.tireType | 0, prep: best.prep });
  tireCandidates.push({ tire: oemTire, prep: 'unprepped' });
  // unique
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
    var lo = 0, hi = 35;
    for (var it = 0; it < 10; it++) {
      if (SIMS - startSims >= budget) break;
      var mid = +((lo + hi) / 2).toFixed(2);
      var c2 = clone(base);
      c2.tireType = tc.tire;
      c2.drivetrainLossPercent = mid;
      c2.forceScale = 1;
      var trial = consider(c2, tc.prep, 'tires+drivetrain_loss');
      if (trial && allHit(trial.sim, tgt)) {
        return { best: best, methods: methodFrom(best, oemTire, oemLoss), simsUsed: SIMS - startSims };
      }
      // loss ↑ slows car / usually lowers trap slightly and raises ET
      if (!trial || trial.sim.et == null) break;
      if (tgt.et != null) {
        if (trial.sim.et < tgt.et) lo = mid; // too quick → more loss
        else hi = mid;
      } else if (tgt.trap != null && trial.sim.trap != null) {
        if (trial.sim.trap > tgt.trap) lo = mid;
        else hi = mid;
      } else break;
    }
    // fine loss grid around best for this tire
    if (best) {
      var center = Number(best.car.drivetrainLossPercent);
      for (var d = -3; d <= 3; d += 0.5) {
        if (SIMS - startSims >= budget) break;
        var loss = +clamp(center + d, 0, 40).toFixed(2);
        var c3 = clone(base);
        c3.tireType = best.car.tireType | 0;
        c3.drivetrainLossPercent = loss;
        c3.forceScale = 1;
        consider(c3, best.prep, 'tires+drivetrain_loss');
        if (best && allHit(best.sim, tgt)) break;
      }
    }
    if (best && allHit(best.sim, tgt)) break;
  }

  return { best: best, methods: methodFrom(best, oemTire, oemLoss), simsUsed: SIMS - startSims };
}

function methodFrom(best, oemTire, oemLoss) {
  if (!best) return [];
  var methods = [];
  var tireChanged = (best.car.tireType | 0) !== (oemTire | 0) || best.prep !== 'unprepped';
  var lossChanged = Math.abs(Number(best.car.drivetrainLossPercent) - oemLoss) > 0.049;
  if (tireChanged) methods.push('tires');
  if (lossChanged) methods.push('drivetrain_loss');
  if (!methods.length) methods.push('tires'); // evaluated tires even if oem won
  return methods;
}

function tuneEv(base, tgt, budget) {
  var need613 = tgt.z60130 != null;
  var startSims = SIMS;
  var best = null;
  var cardHp = tgt.excelHp != null ? Number(tgt.excelHp) : Number(base.peakHp);
  var baseDrag = Number(base.dragCoefficient) || 0.3;
  var baseDrive = base.evLaunchDriveMult != null ? Number(base.evLaunchDriveMult) : 1.2;
  var baseMu = base.evLaunchMuMult != null ? Number(base.evLaunchMuMult) : 1.1;
  var baseSlip = base.evLaunchSlipTarget != null ? Number(base.evLaunchSlipTarget) : 0.12;
  var baseLim = base.speedLimiterMph != null ? Number(base.speedLimiterMph) : (base.topSpeedMph != null ? Number(base.topSpeedMph) : 0);
  var oemTire = base.tireType | 0;
  var oemLoss = base.drivetrainLossPercent != null ? Number(base.drivetrainLossPercent) : 8;
  var hpLo = Math.max(80, Math.round(cardHp * 0.4));
  var hpHi = Math.max(Math.round(cardHp * 2.4), Math.round(Number(base.peakHp) * 1.8), cardHp + 500);
  var usedPower = false, usedTires = false, usedLoss = false;

  function consider(cfg) {
    if (SIMS - startSims >= budget) return;
    var c = clone(base);
    c.forceScale = 1;
    c.tireType = cfg.tire != null ? cfg.tire : oemTire;
    c.drivetrainLossPercent = cfg.loss != null ? cfg.loss : oemLoss;
    c.dragCoefficient = +clamp(cfg.drag, 0.12, 0.95).toFixed(4);
    c.evLaunchDriveMult = +clamp(cfg.drive, 0.7, 1.85).toFixed(3);
    c.evLaunchMuMult = +clamp(cfg.mu, 0.85, 1.4).toFixed(3);
    c.evLaunchSlipTarget = +clamp(cfg.slip, 0.04, 0.22).toFixed(3);
    if (cfg.limiter != null && cfg.limiter > 0) c.speedLimiterMph = +Number(cfg.limiter).toFixed(1);
    applyPower(c, cfg.hp);
    var sim = runSim(c, need613, cfg.prep || 'unprepped');
    var mv = missVec(sim, tgt);
    var row = { car: c, prep: cfg.prep || 'unprepped', sim: sim, miss: mv, cfg: cfg };
    if (!best || better(mv, best.miss)) best = row;
    return row;
  }

  function binaryHp(drag, drive, mu, slip, limiter, tire, loss, prep) {
    if (tgt.trap == null) {
      consider({ hp: Number(base.peakHp) || cardHp, drag: drag, drive: drive, mu: mu, slip: slip, limiter: limiter, tire: tire, loss: loss, prep: prep });
      return;
    }
    var lo = hpLo, hi = hpHi;
    for (var i = 0; i < 8; i++) {
      if (SIMS - startSims >= budget) return;
      var mid = Math.round((lo + hi) / 2);
      usedPower = true;
      var trial = consider({ hp: mid, drag: drag, drive: drive, mu: mu, slip: slip, limiter: limiter, tire: tire, loss: loss, prep: prep });
      if (!trial || trial.sim.trap == null) return;
      if (allHit(trial.sim, tgt)) return;
      if (trial.sim.trap < tgt.trap) lo = mid + 1;
      else if (trial.sim.trap > tgt.trap) hi = mid - 1;
      else {
        for (var d = -6; d <= 6; d += 2) {
          if (SIMS - startSims >= budget) break;
          consider({ hp: clamp(mid + d, hpLo, hpHi), drag: drag, drive: drive, mu: mu, slip: slip, limiter: limiter, tire: tire, loss: loss, prep: prep });
          if (best && allHit(best.sim, tgt)) return;
        }
        return;
      }
    }
  }

  // Phase A: power at base launch/drag
  binaryHp(baseDrag, baseDrive, baseMu, baseSlip, baseLim || null, oemTire, oemLoss, 'unprepped');
  if (best && allHit(best.sim, tgt)) {
    return finishEv(best, usedPower, usedTires, usedLoss, oemTire, oemLoss, base);
  }

  // Phase B: small launch/drag variants + binary HP
  var launches = [
    [baseDrive, baseMu, baseSlip],
    [1.0, 1.0, 0.12],
    [1.35, 1.15, 0.1],
    [1.55, 1.25, 0.1],
    [1.7, 1.3, 0.08],
    [1.85, 1.35, 0.1]
  ];
  var drags = [baseDrag, baseDrag - 0.03, baseDrag + 0.03, baseDrag - 0.06, baseDrag + 0.06];
  for (var di = 0; di < drags.length; di++) {
    if (best && allHit(best.sim, tgt)) break;
    if (SIMS - startSims >= budget) break;
    for (var li = 0; li < launches.length; li++) {
      if (best && allHit(best.sim, tgt)) break;
      if (SIMS - startSims >= budget) break;
      var L = launches[li];
      usedPower = true;
      binaryHp(+clamp(drags[di], 0.12, 0.95).toFixed(4), L[0], L[1], L[2], baseLim || null, oemTire, oemLoss, 'unprepped');
    }
  }
  if (best && allHit(best.sim, tgt)) {
    return finishEv(best, usedPower, usedTires, usedLoss, oemTire, oemLoss, base);
  }

  // Phase C: tires then loss (power path failed)
  if (best) {
    var hpKeep = best.car.peakHp;
    var dragKeep = best.car.dragCoefficient;
    var drv = best.car.evLaunchDriveMult, mu = best.car.evLaunchMuMult, slip = best.car.evLaunchSlipTarget;
    for (var ti = 0; ti < TIRES.length; ti++) {
      if (SIMS - startSims >= budget) break;
      usedTires = true;
      consider({ hp: hpKeep, drag: dragKeep, drive: drv, mu: mu, slip: slip, limiter: baseLim || null, tire: TIRES[ti], loss: oemLoss, prep: 'unprepped' });
      if (best && allHit(best.sim, tgt)) break;
    }
    if (!(best && allHit(best.sim, tgt))) {
      var lo = 0, hi = 30;
      for (var it = 0; it < 8; it++) {
        if (SIMS - startSims >= budget) break;
        var mid = +((lo + hi) / 2).toFixed(2);
        usedLoss = true;
        var trial = consider({
          hp: best.car.peakHp, drag: best.car.dragCoefficient,
          drive: best.car.evLaunchDriveMult, mu: best.car.evLaunchMuMult, slip: best.car.evLaunchSlipTarget,
          limiter: baseLim || null, tire: best.car.tireType | 0, loss: mid, prep: best.prep
        });
        if (trial && allHit(trial.sim, tgt)) break;
        if (!trial || trial.sim.et == null) break;
        if (tgt.et != null) {
          if (trial.sim.et < tgt.et) lo = mid; else hi = mid;
        } else break;
      }
    }
  }

  return finishEv(best, usedPower, usedTires, usedLoss, oemTire, oemLoss, base);
}

function finishEv(best, usedPower, usedTires, usedLoss, oemTire, oemLoss, base) {
  var methods = [];
  if (!best) return { best: null, methods: [], simsUsed: 0 };
  if (usedPower || Math.abs(best.car.peakHp - (Number(base.peakHp) || 0)) > 1 ||
      Math.abs((best.car.dragCoefficient || 0) - (Number(base.dragCoefficient) || 0)) > 0.001) {
    methods.push('power');
  }
  if (usedTires || (best.car.tireType | 0) !== (oemTire | 0)) methods.push('tires');
  if (usedLoss || Math.abs(Number(best.car.drivetrainLossPercent) - oemLoss) > 0.049) methods.push('drivetrain_loss');
  if (!methods.length) methods.push('power');
  return { best: best, methods: methods, simsUsed: 0 };
}

function applyIceBest(idx, best) {
  var car = GARAGE[idx];
  car.tireType = best.car.tireType | 0;
  car.drivetrainLossPercent = Number(best.car.drivetrainLossPercent);
  car.forceScale = 1;
  // bake preferred prep as annotation only (runtime WX); store hint
  car.trackPrepDefault = best.prep;
}
function applyEvBest(idx, best) {
  var car = GARAGE[idx];
  var oldHp = Number(car.peakHp) || 1;
  car.peakHp = best.car.peakHp;
  if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, best.car.peakHp / oldHp);
  alignPeakRpm(car);
  car.dragCoefficient = best.car.dragCoefficient;
  car.evLaunchDriveMult = best.car.evLaunchDriveMult;
  car.evLaunchMuMult = best.car.evLaunchMuMult;
  car.evLaunchSlipTarget = best.car.evLaunchSlipTarget;
  if (best.car.speedLimiterMph != null) car.speedLimiterMph = best.car.speedLimiterMph;
  car.tireType = best.car.tireType | 0;
  car.drivetrainLossPercent = Number(best.car.drivetrainLossPercent);
  car.forceScale = 1;
  car.trackPrepDefault = best.prep;
}

// --- main ---
var byName = {};
TARGETS.forEach(function (t) { byName[t.name] = t; });

var args = process.argv.slice(2);
var only = null, limit = null, offset = 0;
args.forEach(function (a) {
  if (a.indexOf('--only=') === 0) only = a.slice(7);
  else if (a.indexOf('--id=') === 0) only = a.slice(5);
  else if (a.indexOf('--limit=') === 0) limit = parseInt(a.slice(8), 10);
  else if (a.indexOf('--offset=') === 0) offset = parseInt(a.slice(9), 10);
});

var results = [];
var processed = 0;
writeProg({ status: 'start', offset: offset, limit: limit, only: only, garage: GARAGE.length });

for (var i = 0; i < GARAGE.length; i++) {
  if (i < offset) continue;
  if (limit != null && processed >= limit) break;
  var car = GARAGE[i];
  if (only && car.id !== only && car.name !== only) continue;
  var tgt = byName[car.name];
  if (!tgt || tgt.et == null || tgt.trap == null) {
    results.push({
      id: car.id, name: car.name, fullMatch: false,
      why: !tgt ? 'no Corrected Garage row' : 'sheet missing et/trap',
      methodUsed: 'none', metrics: null
    });
    continue;
  }

  processed++;
  var ev = isEv(car);
  writeProg({ status: 'tuning', idx: i, id: car.id, name: car.name, kind: ev ? 'EV' : 'ICE', processed: processed });

  // ICE: restore sheet card HP so prior power-only tunes don't stick
  var frozenGears = car.gears ? clone(car.gears) : null;
  var frozenFd = car.finalDrive;
  var frozenWt = car.weightLbs;
  if (!ev && tgt.excelHp != null) {
    restoreExcelHp(car, tgt.excelHp);
  }

  var baseline = runSim(car, tgt.z60130 != null, 'unprepped');
  if (allHit(baseline, tgt)) {
    var row0 = {
      id: car.id, name: car.name, kind: ev ? 'EV' : 'ICE',
      fullMatch: true, methodUsed: 'already_matched',
      metrics: gapReport(baseline, tgt),
      knobs: { tireType: car.tireType, loss: car.drivetrainLossPercent, peakHp: car.peakHp }
    };
    results.push(row0);
    console.log('[OK-SKIP]', car.id);
    fs.writeFileSync(REPORT, JSON.stringify({ credit: CREDIT, partial: true, results: results }, null, 2));
    writeProg({ status: 'green-skip', id: car.id, processed: processed });
    continue;
  }

  var t0 = Date.now();
  var tuned = ev ? tuneEv(car, tgt, MAX_SIMS_CAR) : tuneIce(car, tgt, MAX_SIMS_CAR);
  var dt = +((Date.now() - t0) / 1000).toFixed(1);

  if (!tuned.best) {
    results.push({
      id: car.id, name: car.name, kind: ev ? 'EV' : 'ICE', fullMatch: false,
      methodUsed: 'none', why: 'tune returned null', metrics: gapReport(baseline, tgt), seconds: dt
    });
    continue;
  }

  if (ev) applyEvBest(i, tuned.best);
  else applyIceBest(i, tuned.best);
  // restore frozen TX/weight always
  if (frozenGears) GARAGE[i].gears = frozenGears;
  if (frozenFd != null) GARAGE[i].finalDrive = frozenFd;
  GARAGE[i].weightLbs = frozenWt;

  var finalSim = runSim(GARAGE[i], tgt.z60130 != null, tuned.best.prep || 'unprepped');
  var ok = allHit(finalSim, tgt);
  var methodUsed = tuned.methods.join('+') || (ev ? 'power' : 'tires');
  var row = {
    id: car.id, name: car.name, kind: ev ? 'EV' : 'ICE',
    fullMatch: ok, methodUsed: methodUsed,
    metrics: gapReport(finalSim, tgt),
    prep: tuned.best.prep,
    knobs: {
      tireType: GARAGE[i].tireType,
      tireLabel: Phys.tireLabelForType(GARAGE[i].tireType | 0),
      loss: GARAGE[i].drivetrainLossPercent,
      peakHp: GARAGE[i].peakHp,
      drag: GARAGE[i].dragCoefficient,
      evLaunchDriveMult: GARAGE[i].evLaunchDriveMult,
      evLaunchMuMult: GARAGE[i].evLaunchMuMult
    },
    seconds: dt,
    simsCar: tuned.simsUsed
  };
  if (!ok) {
    row.why = 'could not reach exact sheet match within budget with allowed method';
    row.missVec = missVec(finalSim, tgt);
  }
  results.push(row);
  writeGarage();
  writeProg({ status: ok ? 'green' : 'MISS', id: car.id, fullMatch: ok, methodUsed: methodUsed, processed: processed, metrics: row.metrics });
  fs.writeFileSync(REPORT, JSON.stringify({ credit: CREDIT, partial: true, acceptance: 'exact sheet decimals', results: results }, null, 2));
  console.log(ok ? '[GREEN]' : '[MISS]', car.id, methodUsed, JSON.stringify(row.metrics), dt + 's');
}

// final verify pass — only re-sim cars touched this run (or full garage when no filter)
var summary = { n: 0, full: 0, ice: 0, iceFull: 0, ev: 0, evFull: 0, misses: [] };
var finalRows = [];
var verifyIds = null;
if (only || limit != null || offset) {
  verifyIds = {};
  results.forEach(function (r) { if (r.id) verifyIds[r.id] = 1; });
}
GARAGE.forEach(function (c) {
  var tgt = byName[c.name];
  if (!tgt || tgt.et == null) return;
  if (verifyIds && !verifyIds[c.id]) return;
  summary.n++;
  var ev = isEv(c);
  if (ev) summary.ev++; else summary.ice++;
  var prep = c.trackPrepDefault || 'unprepped';
  var sim = runSim(c, tgt.z60130 != null, prep);
  var ok = allHit(sim, tgt);
  if (ok) { summary.full++; if (ev) summary.evFull++; else summary.iceFull++; }
  else summary.misses.push(c.id);
  var prior = results.find(function (r) { return r.id === c.id; });
  finalRows.push({
    id: c.id, name: c.name, kind: ev ? 'EV' : 'ICE',
    fullMatch: ok,
    methodUsed: prior ? prior.methodUsed : 'unchecked',
    metrics: gapReport(sim, tgt)
  });
});

var out = {
  credit: CREDIT,
  source: PACK.source,
  acceptance: 'exact to sheet decimal places — no ±0.5/±0.05 pass',
  method: { ICE: 'tires(+prep) → drivetrainLossPercent', EV: 'power/launch/drag → tires/loss if needed' },
  sims: SIMS,
  summary: summary,
  results: finalRows
};
fs.writeFileSync(REPORT, JSON.stringify(out, null, 2));
writeProg({ status: 'done', summary: summary, sims: SIMS });
console.log('[DONE]', JSON.stringify(summary), 'sims', SIMS);
process.exit(summary.full === summary.n ? 0 : 2);
