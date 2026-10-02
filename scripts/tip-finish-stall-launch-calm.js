'use strict';
/**
 * Tip finish: stall v2 (already in physics) + stock-AUTO calm leave (no brake-stand
 * two-foot dumps) fleet-wide + Mustang GT/PP2 retune (curve DOWN ≤460, launch calm)
 * + Z28 gold residual report. Tip-only, Jorge Guerra only, no Pages.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var PHYS_PATH = path.join(ROOT, 'js/physics.js');
var OUT_JS = path.join(ROOT, 'js/garage-data.js');
var REPORT = path.join(__dirname, 'stall-v2-mustang-launch-calm-report.json');

var Phys = require(PHYS_PATH);
var GARAGE = require('../js/garage-data.js');
var PACK = require('./corrected-garage-targets-fresh.json');
var SIMS = 0;
var STOCK_AUTO_CALM_LAUNCH = 2200; // Jorge: stock autos calm D-gate — not brake+gas

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
function isStockAuto(car) {
  if (!car || car.isEv) return false;
  if (car.hasAftermarketConverter) return false;
  var t = String(car.transmission || '');
  return /auto/i.test(t) && !/manual|mt\b|stick/i.test(t);
}
function makeOemCoyoteCurve(peakHp) {
  var peakTq = 420 * (peakHp / 460), peakTqRpm = 4600, peakHpRpm = 7000, redline = 7500, fallFrac = 0.18;
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

function patchPhysicsStockAutoCalm() {
  var src = fs.readFileSync(PHYS_PATH, 'utf8');
  if (src.indexOf('STOCK_AUTO_CALM_LAUNCH') >= 0) {
    console.log('physics stock-auto calm already present');
    return false;
  }
  // Insert calm cap after launchRpm resolved from car, before soft/aggressive
  var marker = '    var launchMode = env.launchMode || \'auto\';\n';
  if (src.indexOf(marker) < 0) throw new Error('launchMode marker missing');
  var inject =
    '    var launchMode = env.launchMode || \'auto\';\n' +
    '    // Jorge Guerra: stock AUTOMATICS — calm D-gate leave. Never brake-stand /\n' +
    '    // two-foot dump in Auto launch mode. Aftermarket converters keep stall path.\n' +
    '    // Aggressive/Custom launches remain user-intent. STOCK_AUTO_CALM_LAUNCH=2200.\n' +
    '    var STOCK_AUTO_CALM_LAUNCH = 2200;\n' +
    '    if (!car.isEv && !car.hasAftermarketConverter &&\n' +
    '        (launchMode === \'auto\' || launchMode == null || launchMode === \'\') &&\n' +
    '        /auto/i.test(String(car.transmission || \'\')) &&\n' +
    '        !/manual|mt\\b|stick/i.test(String(car.transmission || \'\'))) {\n' +
    '      if (launchRpm > STOCK_AUTO_CALM_LAUNCH) launchRpm = STOCK_AUTO_CALM_LAUNCH;\n' +
    '    }\n';
  src = src.replace(marker, inject);
  // Also calm absurd peak-TQ seed for stock autos in resolveLeaveRpm
  var oldSeed =
    '    // Absurd leave (calib leftovers / idle): seed ~0.9× peak-TQ band\n' +
    '    if (lr < 1000) {\n' +
    '      lr = Math.round(clamp(peakTq * 0.9, 1800, Math.min(redline - 200, peakTq)));\n' +
    '    }\n' +
    '    return clamp(lr, 800, redline);';
  var newSeed =
    '    // Absurd leave (calib leftovers / idle): seed ~0.9× peak-TQ band\n' +
    '    if (lr < 1000) {\n' +
    '      lr = Math.round(clamp(peakTq * 0.9, 1800, Math.min(redline - 200, peakTq)));\n' +
    '    }\n' +
    '    // Stock auto: never resolve to brake-stand dump RPM (card may still show high)\n' +
    '    if (car && !car.isEv && !car.hasAftermarketConverter &&\n' +
    '        /auto/i.test(String(car.transmission || \'\')) &&\n' +
    '        !/manual|mt\\b|stick/i.test(String(car.transmission || \'\'))) {\n' +
    '      if (lr > 2200) lr = 2200; // STOCK_AUTO_CALM_LAUNCH\n' +
    '    }\n' +
    '    return clamp(lr, 800, redline);';
  if (src.indexOf(oldSeed) < 0) throw new Error('resolveLeaveRpm seed block missing');
  src = src.replace(oldSeed, newSeed);
  fs.writeFileSync(PHYS_PATH, src);
  delete require.cache[require.resolve(PHYS_PATH)];
  Phys = require(PHYS_PATH);
  console.log('patched physics stock-auto calm leave @2200');
  return true;
}

function runSim(car, need613, prep, daFt) {
  SIMS++;
  var c = clone(car); c.forceScale = 1;
  if (Phys.sanitizeTorqueCurvePostPeak) Phys.sanitizeTorqueCurvePostPeak(c.torqueCurve, c.peakHpRpm);
  var env = {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launchMode: 'auto', trackPrep: prep || 'unprepped', driverWeightLbs: 200,
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
    launchRpmUsed: r.launchRpm != null ? Math.round(r.launchRpm) : null
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

function tuneMustangFast(car, tgt, factoryPeak, maxLaunch) {
  var need613 = tgt.z60130 != null;
  var best = null;
  var launches = car.transmission === 'Manual'
    ? [Math.min(maxLaunch, 3500), 3200, 3000]
    : [Math.min(maxLaunch, STOCK_AUTO_CALM_LAUNCH), 2000, 1800];
  var tires = [0, 3, 4];
  var preps = ['unprepped', 'prepped'];
  var peaks = [factoryPeak, factoryPeak - 15, factoryPeak - 30];

  function makeCar(peak, tire, loss, lr) {
    var curve = makeOemCoyoteCurve(peak);
    var dpk = derivePeaks(curve);
    var c = clone(car);
    c.torqueCurve = curve; c.peakHp = peak; c.peakHpRpm = dpk.peakHpRpm; c.peakTqRpm = dpk.peakTqRpm;
    c.redline = 7500; c.tireType = tire; c.drivetrainLossPercent = +loss.toFixed(2);
    c.launchRpm = lr; c.forceScale = 1; c.weightLbs = tgt.weightLbs || c.weightLbs;
    return c;
  }

  outer:
  for (var pi = 0; pi < peaks.length; pi++) {
    var peak = peaks[pi];
    console.log('  peak', peak);
    for (var li = 0; li < launches.length; li++) {
      for (var ti = 0; ti < tires.length; ti++) {
        for (var pr = 0; pr < preps.length; pr++) {
          var lo = 6, hi = 34;
          for (var it = 0; it < 10; it++) {
            var mid = +((lo + hi) / 2).toFixed(2);
            var c = makeCar(peak, tires[ti], mid, launches[li]);
            var sim = runSim(c, need613, preps[pr]);
            var mv = missVec(sim, tgt);
            var row = { car: clone(c), prep: preps[pr], sim: sim, miss: mv, peak: peak };
            if (!best || better(mv, best.miss)) best = row;
            if (allHit(sim, tgt)) break outer;
            if (tgt.trap != null && sim.trap != null) {
              if (sim.trap > tgt.trap) lo = mid; else hi = mid;
            } else break;
          }
          if (best && best.peak === peak && Number(best.car.launchRpm) === launches[li] &&
              (best.car.tireType | 0) === tires[ti] && best.prep === preps[pr]) {
            var cen = Number(best.car.drivetrainLossPercent);
            for (var d = -1; d <= 1; d += 0.25) {
              var c2 = makeCar(peak, tires[ti], +clamp(cen + d, 0, 40).toFixed(2), launches[li]);
              var sim2 = runSim(c2, need613, preps[pr]);
              var mv2 = missVec(sim2, tgt);
              if (!best || better(mv2, best.miss)) best = { car: clone(c2), prep: preps[pr], sim: sim2, miss: mv2, peak: peak };
              if (allHit(sim2, tgt)) break outer;
            }
          }
        }
      }
    }
    if (best && allHit(best.sim, tgt)) break;
  }
  return best;
}

function scareMono(scare) {
  var stalls = Object.keys(scare).map(Number).sort(function (a, b) { return a - b; });
  var ok = true, notes = [];
  for (var i = 1; i < stalls.length; i++) {
    var a = scare[stalls[i - 1]], b = scare[stalls[i]];
    if (!(b.et <= a.et + 0.02)) { ok = false; notes.push('et'); }
    if (!(b.z60 <= a.z60 + 0.02)) { ok = false; notes.push('z60'); }
    if (!(b.sixtyFt <= a.sixtyFt + 0.02)) { ok = false; notes.push('60ft'); }
  }
  return { ok: ok, notes: notes };
}

function main() {
  var tgtBy = {};
  PACK.targets.forEach(function (t) { tgtBy[t.name] = t; });

  // Verify stall v2
  var physSrc = fs.readFileSync(PHYS_PATH, 'utf8');
  if (physSrc.indexOf('Jorge Z28 gold tone-down v2 (38@4400)') < 0) {
    throw new Error('stall v2 missing — abort');
  }
  patchPhysicsStockAutoCalm();

  // BEFORE snapshots (tip 7f5e7cf garage values)
  var before = {
    z28: { et: 11.183, trap: 119.64, z60: 2.787, sixtyFt: 1.6 },
    mustang: {}
  };
  ['2020-ford-mustang-gt', '2018-ford-mustang-gt-pp2'].forEach(function (id) {
    var c = GARAGE.find(function (x) { return x.id === id; });
    var tgt = tgtBy[c.name];
    before.mustang[id] = {
      peakHp: c.peakHp, launchRpm: c.launchRpm, loss: c.drivetrainLossPercent,
      tireType: c.tireType, tx: c.transmission, txKey: c.txKey, fd: c.finalDriveRatio,
      metrics: gapReport(runSim(c, tgt.z60130 != null, c.trackPrepDefault || 'unprepped'), tgt)
    };
  });

  // Z28 — stall v2 already applied; keep factory peak, report scare
  var z28 = GARAGE.find(function (c) { return c.id === '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals'; });
  z28.tireType = 2; z28.stallRpm = 4400; z28.hasAftermarketConverter = true; z28.forceScale = 1;
  var z28After = runSim(z28, false, 'prepped', 1500);
  var scare = {};
  [1800, 2800, 3600, 4400, 5200, 5500].forEach(function (s) {
    var c = clone(z28); c.stallRpm = s;
    scare[s] = runSim(c, false, 'prepped', 1500);
  });
  console.log('Z28 after stall-v2', JSON.stringify(z28After), 'mono', scareMono(scare).ok);

  // Fleet stock-auto launchRpm card calm (DOWN only)
  var fleetCalm = { touched: 0, examples: [] };
  GARAGE.forEach(function (c) {
    if (!isStockAuto(c)) return;
    var beforeLr = c.launchRpm != null ? Number(c.launchRpm) : null;
    if (beforeLr != null && beforeLr > STOCK_AUTO_CALM_LAUNCH) {
      c.launchRpm = STOCK_AUTO_CALM_LAUNCH;
      fleetCalm.touched++;
      if (fleetCalm.examples.length < 12) {
        fleetCalm.examples.push({ id: c.id, before: beforeLr, after: STOCK_AUTO_CALM_LAUNCH });
      }
    }
  });
  console.log('Fleet stock-auto launch calm:', fleetCalm.touched, 'cars capped to', STOCK_AUTO_CALM_LAUNCH);

  // Mustangs
  var mustangResults = [];
  function doMustang(id, maxLaunch) {
    var car = GARAGE.find(function (x) { return x.id === id; });
    var tgt = tgtBy[car.name];
    var factoryPeak = Math.min(460, Number(tgt.excelHp) || 460);
    if (id === '2018-ford-mustang-gt-pp2') {
      var mt = Phys.FactoryTransmissions.Getrag_MT82;
      car.transmission = 'Manual'; car.txKey = 'Getrag_MT82';
      car.gearRatios = mt.gears.slice(); car.finalDriveRatio = 3.55;
      car.shiftTimeSeconds = car.shiftTimeSeconds || 0.18;
    }
    console.log('Tuning', car.name, 'maxLaunch', maxLaunch);
    var best = tuneMustangFast(car, tgt, factoryPeak, maxLaunch);
    if (!best) throw new Error('no best ' + id);
    car.torqueCurve = best.car.torqueCurve;
    car.peakHp = best.peak;
    car.peakHpRpm = best.car.peakHpRpm;
    car.peakTqRpm = best.car.peakTqRpm;
    car.redline = 7500;
    car.tireType = best.car.tireType | 0;
    car.drivetrainLossPercent = Number(best.car.drivetrainLossPercent);
    car.launchRpm = Number(best.car.launchRpm);
    car.trackPrepDefault = best.prep || 'unprepped';
    car.forceScale = 1;
    car.weightLbs = tgt.weightLbs || car.weightLbs;
    var finalSim = runSim(car, tgt.z60130 != null, best.prep || 'unprepped');
    var ok = allHit(finalSim, tgt);
    var methods = [];
    if ((car.tireType | 0) !== (before.mustang[id].tireType | 0)) methods.push('tires');
    if (Math.abs(car.drivetrainLossPercent - before.mustang[id].loss) > 0.049) methods.push('drivetrain_loss');
    if (car.peakHp < factoryPeak - 0.5) methods.push('curve_down');
    if (car.launchRpm < before.mustang[id].launchRpm - 50) methods.push('launch_rpm_down');
    if (!methods.length) methods.push('tires');
    var row = {
      id: id, name: car.name, fullMatch: ok, methodUsed: methods.join('+'),
      factoryPeakCeiling: factoryPeak, peakAfter: car.peakHp,
      launchBefore: before.mustang[id].launchRpm, launchAfter: car.launchRpm,
      launchUsedInSim: finalSim.launchRpmUsed,
      metrics: gapReport(finalSim, tgt), baseline: before.mustang[id].metrics,
      knobs: {
        tireType: car.tireType, tireLabel: Phys.tireLabelForType(car.tireType | 0),
        loss: car.drivetrainLossPercent, peakHp: car.peakHp, launchRpm: car.launchRpm,
        transmission: car.transmission, txKey: car.txKey, fd: car.finalDriveRatio,
        curveHash: curveHash(car.torqueCurve)
      }
    };
    if (!ok) {
      row.why = 'miss after tires→loss + curve-down≤factory + calm launch';
      row.missVec = missVec(finalSim, tgt);
      if (id.indexOf('pp2') >= 0 && finalSim.z60130 != null && tgt.z60130 != null && finalSim.z60130 > tgt.z60130 + 0.2) {
        row.z60130Note = '60-130 slower than sheet under MT-82 with trap near target; sheet likely auto-era. Cannot hit both trap and sheet 60-130 with Coyote≤460 + MT without raising power above factory.';
      }
    }
    mustangResults.push(row);
    console.log(ok ? '[OK]' : '[MISS]', car.name, row.methodUsed, JSON.stringify(row.metrics));
  }

  doMustang('2020-ford-mustang-gt', STOCK_AUTO_CALM_LAUNCH);
  doMustang('2018-ford-mustang-gt-pp2', 3500);

  writeGarage(GARAGE);

  var gt = GARAGE.find(function (c) { return c.id === '2020-ford-mustang-gt'; });
  var pp2 = GARAGE.find(function (c) { return c.id === '2018-ford-mustang-gt-pp2'; });

  var report = {
    tip: 'stall-v2-stock-auto-calm-launch-mustang',
    credit: 'Jorge Guerra only',
    pages: false,
    fleetRule: 'curve DOWN only ≤ factory peak; stock AUTO launch calm ≤2200 (no brake-stand two-foot); ATC keep stall path',
    stallV2: true,
    stockAutoCalmLaunch: STOCK_AUTO_CALM_LAUNCH,
    fleetCalm: fleetCalm,
    z28: {
      before: before.z28,
      after: z28After,
      gaps: {
        et: +(z28After.et - 11.6).toFixed(3),
        trap: +(z28After.trap - 119.7).toFixed(2),
        z60: +(z28After.z60 - 3.48).toFixed(3),
        sixtyFt: +(z28After.sixtyFt - 1.68).toFixed(3)
      },
      scare: scare,
      mono: scareMono(scare),
      note: 'Exact 1.68 60ft + 3.48 0-60 + 11.6 ET conflict under one ATC model; residual honest.'
    },
    mustang: {
      before: before.mustang,
      results: mustangResults,
      curveIdentity: {
        hashGT: curveHash(gt.torqueCurve), hashPP2: curveHash(pp2.torqueCurve),
        peakGT: gt.peakHp, peakPP2: pp2.peakHp,
        identicalCurve: curveHash(gt.torqueCurve) === curveHash(pp2.torqueCurve),
        launchGT: gt.launchRpm, launchPP2: pp2.launchRpm
      }
    },
    simsTotal: SIMS
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('Wrote', OUT_JS);
  console.log('Wrote', REPORT);
  console.log('sims', SIMS);
}

main();
