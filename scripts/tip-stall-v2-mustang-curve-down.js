'use strict';
/**
 * Tip: ATC stall tone-down v2 + Z28 gold close + Mustang Coyote curve-DOWN only
 * (never above factory 460) + launchRpm tone-down (no aggressive dump/spin).
 * PP2 stays MT-82 6MT FD 3.55. Tip-only, Jorge Guerra only, no Pages.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var PHYS_PATH = path.join(ROOT, 'js/physics.js');
var OUT_JS = path.join(ROOT, 'js/garage-data.js');
var REPORT = path.join(__dirname, 'stall-v2-mustang-curve-down-report.json');
var CREDIT = 'Jorge Guerra only';

var Phys = require(PHYS_PATH);
var GARAGE = require('../js/garage-data.js');
var PACK = require('./corrected-garage-targets-fresh.json');

var Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
var MUSTANG_IDS = ['2020-ford-mustang-gt', '2018-ford-mustang-gt-pp2'];
var STALLS_SCARE = [1800, 2800, 3600, 4400, 5200, 5500];
var SIMS = 0;

function log() { console.log.apply(console, arguments); if (typeof console.flush === 'function') console.flush(); }
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

function makeOemCoyoteCurve(peakHp, peakTq, peakTqRpm, peakHpRpm, redline, fallFrac) {
  fallFrac = fallFrac != null ? fallFrac : 0.18;
  var scale = peakHp / 460;
  peakTq = peakTq * scale;
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

function scaleTorqueCurve(tc, factor) {
  var out = {};
  Object.keys(tc || {}).forEach(function (k) {
    out[k] = Math.round(Math.max(10, Number(tc[k]) * factor) * 10000) / 10000;
  });
  return out;
}

function ensureStallV2() {
  var src = fs.readFileSync(PHYS_PATH, 'utf8');
  var knobs = {
    flashBase: 240, flashScale: 900,
    lockBase: 38, lockScale: 20,
    boostBase: 0.06, boostScale: 0.32,
    multCap: 0.65, multGain: 0.90,
    fadeStart: 5, fadeSpanBase: 14, fadeSpanScale: 9,
    fadeSpanMin: 8, fadeSpanMax: 24
  };
  if (src.indexOf('Jorge Z28 gold tone-down v2 (38@4400)') >= 0 &&
      src.indexOf('var fadeSpan = 14 + (stallFacN - 0.725) * 9') >= 0 &&
      src.indexOf('Math.min(0.65, slipR * (0.9 + stallBoost))') >= 0) {
    return knobs;
  }
  throw new Error('stall v2 not present in physics.js — apply before running');
}

function runSim(car, need613, prep, daFt) {
  SIMS++;
  var c = clone(car);
  c.forceScale = 1;
  if (Phys.sanitizeTorqueCurvePostPeak) Phys.sanitizeTorqueCurvePostPeak(c.torqueCurve, c.peakHpRpm);
  var env = {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0,
    gustMph: 0, launchMode: 'auto', trackPrep: prep || 'unprepped', driverWeightLbs: 200,
    tireType: c.tireType | 0, tireLabel: Phys.tireLabelForType(c.tireType | 0),
    needSixtyToOneThirty: !!need613
  };
  if (daFt != null) env.densityAltitudeFtInput = daFt;
  var r = Phys.runQuarterMile(c, env);
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty) : null,
    sixtyFt: r.sixtyFootTime != null ? +Number(r.sixtyFootTime) : null,
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
    if (roundTo(sim[k], d) === roundTo(tgt[k], d)) return 0;
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
    g[k] = { sheetTarget: sheet, finalResult: final, match: hit(sim, tgt, k) === true,
      gap: (final == null || sheet == null) ? null : +(final - sheet).toFixed(4) };
  });
  return g;
}
function writeGarage(cars) {
  var js =
    '(function (global) {\n' +
    '  var GARAGE = ' + JSON.stringify(cars, null, 2) + ';\n' +
    '  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n' +
    '  if (typeof window !== "undefined") {\n' +
    '  window.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '  }\n' +
    '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n' +
    '})(typeof globalThis !== "undefined" ? globalThis : this);\n';
  fs.writeFileSync(OUT_JS, js);
}
function scareMono(scare) {
  var stalls = Object.keys(scare).map(Number).sort(function (a, b) { return a - b; });
  var ok = true, notes = [];
  for (var i = 1; i < stalls.length; i++) {
    var a = scare[stalls[i - 1]], b = scare[stalls[i]];
    if (!(b.et <= a.et + 0.02)) { ok = false; notes.push('et ' + stalls[i - 1] + '→' + stalls[i]); }
    if (!(b.z60 <= a.z60 + 0.02)) { ok = false; notes.push('z60 ' + stalls[i - 1] + '→' + stalls[i]); }
    if (!(b.sixtyFt <= a.sixtyFt + 0.02)) { ok = false; notes.push('60ft ' + stalls[i - 1] + '→' + stalls[i]); }
  }
  return { ok: ok, notes: notes };
}
function z28GoldScore(r) {
  var det = r.et - 11.6, dtrap = r.trap - 119.7, dz60 = r.z60 - 3.48, d60 = r.sixtyFt - 1.68;
  function asymmetric(d, wUnder, wOver) { return d < 0 ? wUnder * d * d : wOver * d * d; }
  return asymmetric(det, 5, 8) + asymmetric(dtrap, 3, 12) + asymmetric(dz60, 10, 14) + asymmetric(d60, 6, 14);
}

function tuneZ28(car, beforeSim) {
  var factoryPeak = Number(car.peakHp) || 494;
  var baseCurve = clone(car.torqueCurve);
  var best = null;
  // Keep near factory — trap already slightly soft; mainly lock stall+loss
  var peaks = [factoryPeak, factoryPeak - 4, factoryPeak - 8];
  var losses = [14.5, 15, 15.5, 15.75, 16, 16.5, 17, 17.5, 18];
  peaks.forEach(function (peak) {
    var factor = peak / factoryPeak;
    var curve = scaleTorqueCurve(baseCurve, factor);
    if (Phys.capTorqueCurveToPeakHp) Phys.capTorqueCurveToPeakHp(curve, peak);
    losses.forEach(function (loss) {
      var c = clone(car);
      c.peakHp = peak; c.torqueCurve = curve; c.drivetrainLossPercent = loss;
      c.tireType = 2; c.stallRpm = 4400; c.hasAftermarketConverter = true; c.forceScale = 1;
      var sim = runSim(c, false, 'prepped', 1500);
      var sc = z28GoldScore(sim);
      if (!best || sc < best.score) best = { car: c, sim: sim, score: sc, peak: peak, loss: loss };
    });
  });
  var scare = {};
  STALLS_SCARE.forEach(function (s) {
    var c = clone(best.car); c.stallRpm = s;
    scare[s] = runSim(c, false, 'prepped', 1500);
  });
  var mono = scareMono(scare);
  car.peakHp = best.peak;
  car.torqueCurve = best.car.torqueCurve;
  car.drivetrainLossPercent = best.loss;
  car.tireType = 2; car.stallRpm = 4400; car.hasAftermarketConverter = true; car.forceScale = 1;
  var peaks2 = derivePeaks(car.torqueCurve);
  car.peakHpRpm = peaks2.peakHpRpm; car.peakTqRpm = peaks2.peakTqRpm;
  var after = runSim(car, false, 'prepped', 1500);
  return {
    before: beforeSim, after: after,
    target: { et: 11.6, trap: 119.7, z60: 3.48, sixtyFt: 1.68 },
    gapsAfter: {
      et: +(after.et - 11.6).toFixed(3), trap: +(after.trap - 119.7).toFixed(2),
      z60: +(after.z60 - 3.48).toFixed(3), sixtyFt: +(after.sixtyFt - 1.68).toFixed(3)
    },
    factoryPeakCeiling: factoryPeak, peakAfter: best.peak, lossAfter: best.loss,
    curveScaledDown: best.peak < factoryPeak, scare: scare, mono: mono,
    note: 'Hard 60ft≈1.68 vs 0-60≈3.48 conflict under one ATC model; stall v2 closes gaps; residual honest.'
  };
}

/** Fast hierarchical Mustang tune: launch↓ → tires → loss binary → peak↓ only if needed. */
function tuneMustang(base, tgt, factoryPeak) {
  var need613 = tgt.z60130 != null;
  var startSims = SIMS;
  var best = null;
  var oemLaunch = base.launchRpm != null ? Number(base.launchRpm) : 4000;

  function makeCar(peak, tire, loss, launchRpm) {
    var curve = makeOemCoyoteCurve(peak, 420, 4600, 7000, 7500, 0.18);
    var dpk = derivePeaks(curve);
    var c = clone(base);
    c.torqueCurve = curve; c.peakHp = peak; c.peakHpRpm = dpk.peakHpRpm; c.peakTqRpm = dpk.peakTqRpm;
    c.redline = 7500; c.tireType = tire; c.drivetrainLossPercent = +Number(loss).toFixed(2);
    c.launchRpm = launchRpm; c.forceScale = 1; c.weightLbs = tgt.weightLbs || c.weightLbs;
    return c;
  }
  function consider(car, prep, peak) {
    var sim = runSim(car, need613, prep);
    var mv = missVec(sim, tgt);
    var row = { car: clone(car), prep: prep, sim: sim, miss: mv, peak: peak };
    if (!best || better(mv, best.miss)) best = row;
    return allHit(sim, tgt);
  }
  function binaryLoss(peak, tire, prep, launchRpm) {
    var lo = 6, hi = 34;
    for (var it = 0; it < 11; it++) {
      var mid = +((lo + hi) / 2).toFixed(2);
      var c = makeCar(peak, tire, mid, launchRpm);
      var sim = runSim(c, need613, prep);
      var mv = missVec(sim, tgt);
      var row = { car: clone(c), prep: prep, sim: sim, miss: mv, peak: peak };
      if (!best || better(mv, best.miss)) best = row;
      if (allHit(sim, tgt)) return true;
      if (tgt.trap != null && sim.trap != null) {
        if (sim.trap > tgt.trap) lo = mid; else hi = mid;
      } else if (tgt.et != null && sim.et != null) {
        if (sim.et < tgt.et) lo = mid; else hi = mid;
      } else break;
    }
    if (best && best.peak === peak && (best.car.tireType | 0) === tire && best.prep === prep && Number(best.car.launchRpm) === launchRpm) {
      var cen = Number(best.car.drivetrainLossPercent);
      for (var d = -1.25; d <= 1.25; d += 0.25) {
        if (consider(makeCar(peak, tire, +clamp(cen + d, 0, 40).toFixed(2), launchRpm), prep, peak)) return true;
      }
    }
    return false;
  }

  var launches = base.transmission === 'Manual'
    ? [Math.min(oemLaunch, 3500), 3200, 3000]
    : [Math.min(oemLaunch, 3800), 3500, 3000];
  // unique descending
  var seenL = {};
  launches = launches.filter(function (lr) {
    lr = Math.max(1800, Math.round(Math.min(oemLaunch, lr)));
    if (seenL[lr]) return false; seenL[lr] = 1; return true;
  }).sort(function (a, b) { return b - a; });

  var tires = [0, 3, 4]; // Street, Summer, UHP (DR only if still miss after loop)
  var preps = ['unprepped', 'prepped'];
  var peaks = [factoryPeak, factoryPeak - 15, factoryPeak - 30];

  outer:
  for (var pi = 0; pi < peaks.length; pi++) {
    var peak = peaks[pi];
    if (peak > factoryPeak) continue;
    log('  peak', peak, 'launches', launches.join(','));
    for (var li = 0; li < launches.length; li++) {
      for (var ti = 0; ti < tires.length; ti++) {
        for (var pr = 0; pr < preps.length; pr++) {
          if (binaryLoss(peak, tires[ti], preps[pr], launches[li])) break outer;
        }
      }
      if (best && allHit(best.sim, tgt)) break outer;
    }
    // If trap already matched at this peak and only 60-130/z60 miss, peak-down may hurt trap — still try once more
    if (best && best.peak === peak && tgt.trap != null && hit(best.sim, tgt, 'trap')) {
      // continue peak-down only if et also matched or et too quick (need more loss/less power)
      if (tgt.et != null && best.sim.et != null && best.sim.et > tgt.et + 0.15) break; // too slow already
    }
  }

  if (best && !allHit(best.sim, tgt)) {
    log('  DR fallback at peak', best.peak, 'launch', best.car.launchRpm);
    var pkF = best.peak, lrF = Number(best.car.launchRpm);
    for (var prF = 0; prF < preps.length; prF++) {
      if (binaryLoss(pkF, 1, preps[prF], lrF)) break;
    }
  }

  if (!best) return { best: null, methods: [], simsUsed: SIMS - startSims };

  var methods = [];
  if ((best.car.tireType | 0) !== (base.tireType | 0) || best.prep !== 'unprepped') methods.push('tires');
  if (Math.abs(Number(best.car.drivetrainLossPercent) - Number(base.drivetrainLossPercent || 15)) > 0.049) methods.push('drivetrain_loss');
  if (best.peak < factoryPeak - 0.5) methods.push('curve_down');
  if (Number(best.car.launchRpm) < oemLaunch - 50) methods.push('launch_rpm_down');
  if (!methods.length) methods.push('tires');
  return { best: best, methods: methods, simsUsed: SIMS - startSims, factoryPeak: factoryPeak, oemLaunch: oemLaunch };
}

function main() {
  var tgtBy = {};
  PACK.targets.forEach(function (t) { tgtBy[t.name] = t; });

  // BEFORE = tip 7f5e7cf garage + pre-stall-v2 numbers captured earlier for Z28
  var z28 = GARAGE.find(function (c) { return c.id === Z28_ID; });
  if (!z28) throw new Error('missing Z28');

  var beforeMustang = {};
  MUSTANG_IDS.forEach(function (id) {
    var c = GARAGE.find(function (x) { return x.id === id; });
    var tgt = tgtBy[c.name];
    beforeMustang[id] = {
      peakHp: c.peakHp, launchRpm: c.launchRpm, curveHash: curveHash(c.torqueCurve),
      transmission: c.transmission, txKey: c.txKey, fd: c.finalDriveRatio,
      loss: c.drivetrainLossPercent, tireType: c.tireType,
      metrics: gapReport(runSim(c, tgt.z60130 != null, c.trackPrepDefault || 'unprepped'), tgt)
    };
  });

  var tip7f5e7cfZ28 = { et: 11.183, trap: 119.64, z60: 2.787, sixtyFt: 1.6 }; // from prior report
  log('BEFORE Z28 (tip 7f5e7cf)', JSON.stringify(tip7f5e7cfZ28));

  var stallKnobs = ensureStallV2();
  log('Stall v2 present', JSON.stringify(stallKnobs));
  var afterStallOnly = runSim(z28, false, 'prepped', 1500);
  log('AFTER stall-only Z28', JSON.stringify(afterStallOnly));

  log('Tuning Z28...');
  var z28Report = tuneZ28(z28, tip7f5e7cfZ28);
  log('Z28 after', JSON.stringify(z28Report.after), 'gaps', JSON.stringify(z28Report.gapsAfter),
    'peak', z28Report.peakAfter, 'loss', z28Report.lossAfter, 'mono', z28Report.mono.ok);

  var mustangResults = [];
  MUSTANG_IDS.forEach(function (id) {
    var car = GARAGE.find(function (x) { return x.id === id; });
    var tgt = tgtBy[car.name];
    var factoryPeak = Math.min(460, Number(tgt.excelHp) || 460);

    if (id === '2018-ford-mustang-gt-pp2') {
      var mt = Phys.FactoryTransmissions.Getrag_MT82;
      car.transmission = 'Manual';
      car.txKey = 'Getrag_MT82';
      car.gearRatios = mt.gears.slice();
      car.finalDriveRatio = 3.55;
      car.shiftTimeSeconds = car.shiftTimeSeconds || 0.18;
    }

    log('\nTuning', car.name, 'factoryPeak', factoryPeak, 'oemLaunch', car.launchRpm);
    var tuned = tuneMustang(car, tgt, factoryPeak);
    if (!tuned.best) throw new Error('tune failed ' + id);

    car.torqueCurve = tuned.best.car.torqueCurve;
    car.peakHp = tuned.best.peak;
    car.peakHpRpm = tuned.best.car.peakHpRpm;
    car.peakTqRpm = tuned.best.car.peakTqRpm;
    car.redline = 7500;
    car.tireType = tuned.best.car.tireType | 0;
    car.drivetrainLossPercent = Number(tuned.best.car.drivetrainLossPercent);
    car.launchRpm = Number(tuned.best.car.launchRpm);
    car.trackPrepDefault = tuned.best.prep || 'unprepped';
    car.forceScale = 1;
    car.weightLbs = tgt.weightLbs || car.weightLbs;

    var finalSim = runSim(car, tgt.z60130 != null, tuned.best.prep || 'unprepped');
    var ok = allHit(finalSim, tgt);
    var row = {
      id: car.id, name: car.name, fullMatch: ok,
      methodUsed: tuned.methods.join('+'),
      factoryPeakCeiling: factoryPeak, peakAfter: car.peakHp,
      launchBefore: tuned.oemLaunch, launchAfter: car.launchRpm,
      curveHash: curveHash(car.torqueCurve),
      metrics: gapReport(finalSim, tgt), prep: tuned.best.prep,
      knobs: {
        tireType: car.tireType, tireLabel: Phys.tireLabelForType(car.tireType | 0),
        loss: car.drivetrainLossPercent, peakHp: car.peakHp, peakHpRpm: car.peakHpRpm,
        launchRpm: car.launchRpm, transmission: car.transmission, txKey: car.txKey,
        gearRatios: clone(car.gearRatios), finalDriveRatio: car.finalDriveRatio
      },
      baseline: beforeMustang[id].metrics, simsCar: tuned.simsUsed
    };
    if (!ok) {
      row.why = 'could not reach exact sheet with tires→loss + curve-down≤factory + launch↓';
      row.missVec = missVec(finalSim, tgt);
      if (id === '2018-ford-mustang-gt-pp2' && tgt.z60130 != null && finalSim.z60130 != null && finalSim.z60130 > tgt.z60130 + 0.2) {
        row.z60130Note = '60-130 slower than sheet under MT-82 with trap near target; sheet 60-130 likely auto-era. Impossible to hit both trap ' + tgt.trap + ' and 60-130 ' + tgt.z60130 + ' with Coyote≤460 + MT without raising power above factory.';
      }
    }
    mustangResults.push(row);
    log(ok ? '[OK]' : '[MISS]', car.name, row.methodUsed, 'peak', car.peakHp, 'launch', car.launchRpm, JSON.stringify(row.metrics));
  });

  var gt = GARAGE.find(function (c) { return c.id === MUSTANG_IDS[0]; });
  var pp2 = GARAGE.find(function (c) { return c.id === MUSTANG_IDS[1]; });
  writeGarage(GARAGE);

  var report = {
    tip: 'stall-v2-mustang-curve-down-launch',
    credit: CREDIT, pages: false,
    fleetRule: 'curve/peakHp DOWN only; never above factory peak. LaunchRpm tone-down only (never raise). Only end user may push past factory HP in UI.',
    stall: {
      knobs: stallKnobs,
      summary: 'ATC stall v2: multGain 0.90, multCap 0.65, fadeStart 5mph, fadeSpan~14, lockMph 38@4400, flash reduced, stallBoost 0.06@4400.',
      afterStallOnlyZ28: afterStallOnly,
      z28: z28Report
    },
    mustang: {
      coyoteShape: 'OEM Gen3 Coyote shape; peakHp ≤460 per car; launchRpm toned down from aggressive leave',
      curveIdentity: {
        hashGT: curveHash(gt.torqueCurve), hashPP2: curveHash(pp2.torqueCurve),
        peakGT: gt.peakHp, peakPP2: pp2.peakHp,
        identicalCurve: curveHash(gt.torqueCurve) === curveHash(pp2.torqueCurve),
        identicalPeak: gt.peakHp === pp2.peakHp,
        launchGT: gt.launchRpm, launchPP2: pp2.launchRpm
      },
      before: beforeMustang, results: mustangResults
    },
    simsTotal: SIMS
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  log('\nWrote', OUT_JS);
  log('Wrote', REPORT);
  log('sims', SIMS);
}

main();
