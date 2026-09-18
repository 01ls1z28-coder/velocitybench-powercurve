/**
 * Lean Excel fleet recalib — evaluate all, deep-search misses only.
 * Source: /workspace/powercurve-garage-import.json
 *   node scripts/recalib-fleet-excel.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var IMPORT_PATH = '/workspace/powercurve-garage-import.json';
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_META = path.join(__dirname, 'garage-calib-meta.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };

function parseTargets(s) {
  var out = {};
  if (!s) return out;
  var m = String(s).match(/0-60:\s*([\d.]+)/i);
  if (m) out.z60 = +m[1];
  m = String(s).match(/1\/4:\s*([\d.]+)\s*(?:s)?\s*@\s*([\d.]+)/i);
  if (m) { out.et = +m[1]; out.trap = +m[2]; }
  m = String(s).match(/60-130:\s*([\d.]+|n\/a)/i);
  if (m && !/n\/a/i.test(m[1])) out.z60130 = +m[1];
  return out;
}

function runSim(car, full) {
  var env = {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windMph: 0, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launch: 'auto', launchMode: 'auto', tireType: car.tireType | 0,
    driverWeightLbs: 200, quickMetrics: !full, needSixtyToOneThirty: true
  };
  var r = Phys.runQuarterMile(car, env);
  return {
    et: r.quarterMileTime || null, trap: r.quarterMileSpeedMph || null,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty,
    vmax: r.topSpeedMph, reason: r.vmaxReason
  };
}

function hitFlags(sim, tgt) {
  return {
    et: tgt.et == null || (sim.et != null && Math.abs(sim.et - tgt.et) <= TOL.et),
    trap: tgt.trap == null || (sim.trap != null && Math.abs(sim.trap - tgt.trap) <= TOL.trap),
    z60: tgt.z60 == null || (sim.z60 != null && Math.abs(sim.z60 - tgt.z60) <= TOL.z60),
    z60130: tgt.z60130 == null || (sim.z60130 != null && Math.abs(sim.z60130 - tgt.z60130) <= TOL.z60130)
  };
}
function allHit(h) { return !!(h && h.et && h.trap && h.z60 && h.z60130); }

function cost(sim, tgt) {
  var c = 0, hits = 0, app = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    app++;
    if (sim[k] == null) { c += 80; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    c += (err / tol) * w + err * w * 0.12;
    if (err <= tol) hits++;
  }
  add('trap', 5, TOL.trap); add('et', 3.5, TOL.et);
  add('z60130', 2.5, TOL.z60130); add('z60', 2, TOL.z60);
  c -= hits * 4; c += (app - hits) * 2;
  return c;
}

function taperCurve(curve, startRpm, endFactor) {
  var out = {}, keys = Object.keys(curve).map(Number).sort(function (a, b) { return a - b; });
  var maxR = keys[keys.length - 1];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], v = +curve[k];
    if (k < startRpm) out[k] = v;
    else {
      var t = (k - startRpm) / Math.max(1, maxR - startRpm);
      out[k] = +(v * (1 - (1 - endFactor) * t)).toFixed(3);
    }
  }
  return out;
}

function cloneCar(car) { return JSON.parse(JSON.stringify(car)); }

function trial(base, tgt, knobs, best) {
  var car = cloneCar(base);
  if (knobs.loss != null) car.drivetrainLossPercent = knobs.loss;
  if (knobs.forceScale != null) car.forceScale = knobs.forceScale;
  if (knobs.tireType != null) car.tireType = knobs.tireType;
  if (knobs.launchRpm != null) car.launchRpm = knobs.launchRpm;
  if (knobs.hybridAssistFrac != null) car.hybridAssistFrac = knobs.hybridAssistFrac;
  if (knobs.dragCoefficient != null) car.dragCoefficient = knobs.dragCoefficient;
  if (knobs.frontalAreaSqFt != null) car.frontalAreaSqFt = knobs.frontalAreaSqFt;
  if (knobs.speedLimiterMph != null) car.speedLimiterMph = knobs.speedLimiterMph;
  if (knobs.curve) car.torqueCurve = knobs.curve;
  var sim = runSim(car, false);
  var c = cost(sim, tgt);
  var h = hitFlags(sim, tgt);
  var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
  var cand = { knobs: knobs, cost: c, sim: sim, hits: h, nh: nh, car: car };
  if (!best || c < best.cost - 1e-9 || (Math.abs(c - best.cost) < 1e-9 && nh > best.nh)) return cand;
  return best;
}

function calibrateMiss(car, tgt) {
  var isHybrid = !!(car.isHybrid || car.powerSource === 'hybrid');
  var isEv = !!(car.isEv || car.powerSource === 'ev');
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseFs = car.forceScale != null ? +car.forceScale : 1;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 3000;
  var baseAssist = car.hybridAssistFrac != null ? +car.hybridAssistFrac : 0.22;
  var baseCd = +car.dragCoefficient || 0.35;
  var baseArea = +car.frontalAreaSqFt || 22;
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, {
    loss: baseLoss, forceScale: baseFs, tireType: seedTire, launchRpm: baseLaunch,
    hybridAssistFrac: isHybrid ? baseAssist : undefined,
    dragCoefficient: baseCd, frontalAreaSqFt: baseArea, speedLimiterMph: car.speedLimiterMph
  }, null);

  var scales = [0.80, 0.90, 1.0, 1.08, 1.15, 1.22, 1.30, 1.40, 1.55, 1.70];
  if (isEv) scales = scales.concat([1.45, 1.60, 1.80]);
  var losses = [0, 4, 8, 12, 16, 20, 24, 28, baseLoss];
  for (var li = 0; li < losses.length; li++) {
    for (var si = 0; si < scales.length; si++) {
      best = trial(car, tgt, {
        loss: +(+losses[li]).toFixed(1), forceScale: scales[si], tireType: seedTire,
        launchRpm: baseLaunch, hybridAssistFrac: isHybrid ? baseAssist : undefined,
        dragCoefficient: baseCd, frontalAreaSqFt: baseArea, speedLimiterMph: car.speedLimiterMph
      }, best);
    }
  }
  // fine
  var lc = best.knobs.loss, fs0 = best.knobs.forceScale;
  for (var dL = -2; dL <= 2; dL += 1) {
    for (var dF = -0.10; dF <= 0.10; dF += 0.02) {
      best = trial(car, tgt, {
        loss: Math.max(0, Math.min(32, +(lc + dL).toFixed(1))),
        forceScale: Math.max(0.55, Math.min(2.0, +(fs0 + dF).toFixed(3))),
        tireType: best.knobs.tireType, launchRpm: best.knobs.launchRpm,
        hybridAssistFrac: isHybrid ? (best.knobs.hybridAssistFrac || baseAssist) : undefined,
        dragCoefficient: best.knobs.dragCoefficient, frontalAreaSqFt: best.knobs.frontalAreaSqFt,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    }
  }
  // tire ladder if needed
  if (!allHit(best.hits)) {
    [3, 4, 1, 2, 0].forEach(function (tire) {
      [ -0.1, 0, 0.1 ].forEach(function (dF) {
        best = trial(car, tgt, {
          loss: best.knobs.loss,
          forceScale: Math.max(0.55, Math.min(2.0, +(best.knobs.forceScale + dF).toFixed(3))),
          tireType: tire, launchRpm: best.knobs.launchRpm,
          hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
          dragCoefficient: best.knobs.dragCoefficient, frontalAreaSqFt: best.knobs.frontalAreaSqFt,
          speedLimiterMph: car.speedLimiterMph
        }, best);
      });
    });
  }
  // launch if 0-60 miss
  if (!best.hits.z60) {
    [-600, -300, 300, 600, 900].forEach(function (d) {
      var lr = Math.max(500, Math.min(6000, baseLaunch + d));
      best = trial(car, tgt, {
        loss: best.knobs.loss, forceScale: best.knobs.forceScale,
        tireType: best.knobs.tireType, launchRpm: lr,
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
        dragCoefficient: best.knobs.dragCoefficient, frontalAreaSqFt: best.knobs.frontalAreaSqFt,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    });
  }
  // hybrid assist
  if (isHybrid) {
    [0.14, 0.18, 0.22, 0.26, 0.30].forEach(function (af) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, forceScale: best.knobs.forceScale,
        tireType: best.knobs.tireType, launchRpm: best.knobs.launchRpm,
        hybridAssistFrac: af,
        dragCoefficient: best.knobs.dragCoefficient, frontalAreaSqFt: best.knobs.frontalAreaSqFt,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    });
  }
  // aero micro for trap
  if (tgt.trap != null && best.sim.trap != null && Math.abs(best.sim.trap - tgt.trap) > 1.2) {
    [-0.03, -0.01, 0.01, 0.03, 0.05].forEach(function (dC) {
      [0, 0.4, 0.8].forEach(function (dA) {
        best = trial(car, tgt, {
          loss: best.knobs.loss, forceScale: best.knobs.forceScale,
          tireType: best.knobs.tireType, launchRpm: best.knobs.launchRpm,
          hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
          dragCoefficient: Math.max(0.18, Math.min(0.70, +(baseCd + dC).toFixed(3))),
          frontalAreaSqFt: Math.max(6, +(baseArea + dA).toFixed(1)),
          speedLimiterMph: car.speedLimiterMph
        }, best);
      });
    });
  }

  var out = best.car;
  out.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
  out.forceScale = +Number(best.knobs.forceScale).toFixed(3);
  out.tireType = best.knobs.tireType | 0;
  out.launchRpm = Math.round(best.knobs.launchRpm);
  if (isHybrid && best.knobs.hybridAssistFrac != null) out.hybridAssistFrac = +Number(best.knobs.hybridAssistFrac).toFixed(3);
  if (best.knobs.dragCoefficient != null) out.dragCoefficient = +Number(best.knobs.dragCoefficient).toFixed(3);
  if (best.knobs.frontalAreaSqFt != null) out.frontalAreaSqFt = +Number(best.knobs.frontalAreaSqFt).toFixed(1);
  var finalSim = runSim(out, true);
  return { car: out, sim: finalSim, hits: hitFlags(finalSim, tgt), cost: best.cost, changed: true };
}

function specialZR1X(car, tgt) {
  // Published ZR1X lock: Cd 0.36 / wt 3978 / fs=1. Do NOT fake Cd/weight.
  // Prefer scripts/recalib-et-first.js --only-special for current calib path.
  var c = cloneCar(car);
  c.forceScale = 1;
  c.hybridAssistFrac = 0.28;
  c.dragCoefficient = 0.36;
  c.frontalAreaSqFt = 22.5;
  c.weightLbs = 3978;
  c.drivetrainLossPercent = 0;
  c.tireType = 1;
  c.launchRpm = 2400;
  c.speedLimiterMph = 233;
  c.source = (car.source || '2026 Chevrolet Corvette ZR1X') +
    ' | Excel lock published Cd0.36/wt3978; fs=1; loss/tire/launch; 1.9 / 8.675@159 / 60-130 3.87; lim233';
  var sim = runSim(c, true);
  return { car: c, sim: sim, hits: hitFlags(sim, tgt), cost: cost(sim, tgt), changed: true, special: true };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph = published electronic top-speed limiter (mph) for all garage EVs.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+forceScale calibrated toward Excel 0-60 / ¼ / 60-130 (trap-first).',
    ' * Excel fleet recalib tip: /workspace/powercurve-garage-import.json absolute baseline.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-fleet-excel.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function main() {
  var t0 = Date.now();
  var rows = JSON.parse(fs.readFileSync(IMPORT_PATH, 'utf8'));
  var byName = {};
  rows.forEach(function (r) { byName[r.Name] = r; });
  var stats = { et: 0, trap: 0, z60: 0, z60130: 0, nEt: 0, nTrap: 0, nZ60: 0, n60130: 0, all4: 0 };
  var outCars = [], results = [], worst = { trap: [], et: [], z60: [], z60130: [] };
  var changedN = 0, fastN = 0;

  console.log('Lean Excel recalib — ' + GARAGE.length + ' cars');
  for (var i = 0; i < GARAGE.length; i++) {
    var car0 = GARAGE[i];
    var row = byName[car0.name];
    var tgt = row ? parseTargets(row['0-60 / 1/4 ']) : {};
    var res;
    if (/zr1x/i.test(car0.name || '')) {
      res = specialZR1X(car0, tgt.z60 ? tgt : { z60: 1.9, et: 8.675, trap: 159, z60130: 3.87 });
      console.log('ZR1X SPECIAL → ' + res.sim.z60.toFixed(3) + ' / ' + res.sim.et.toFixed(3) + '@' +
        res.sim.trap.toFixed(1) + ' / 60-130 ' + res.sim.z60130.toFixed(3) + ' Vmax ' + res.sim.vmax.toFixed(1));
      changedN++;
    } else if (!tgt.et && !tgt.trap && !tgt.z60) {
      outCars.push(car0); continue;
    } else {
      var seedSim = runSim(car0, false);
      var seedHits = hitFlags(seedSim, tgt);
      if (allHit(seedHits) && cost(seedSim, tgt) < 2.0) {
        // keep; optional micro if trap residual > 1.5
        if (tgt.trap != null && seedSim.trap != null && Math.abs(seedSim.trap - tgt.trap) > 1.5) {
          res = calibrateMiss(car0, tgt);
          changedN++;
        } else {
          var full = runSim(car0, true);
          res = { car: car0, sim: full, hits: hitFlags(full, tgt), cost: cost(full, tgt), changed: false };
          fastN++;
        }
      } else {
        if ((i % 20) === 0) console.log('[' + (i + 1) + '/' + GARAGE.length + '] miss ' + car0.name);
        res = calibrateMiss(car0, tgt);
        changedN++;
      }
    }
    outCars.push(res.car);
    var sim = res.sim, hits = res.hits;
    if (tgt.et != null) { stats.nEt++; if (hits.et) stats.et++; }
    if (tgt.trap != null) { stats.nTrap++; if (hits.trap) stats.trap++; }
    if (tgt.z60 != null) { stats.nZ60++; if (hits.z60) stats.z60++; }
    if (tgt.z60130 != null) { stats.n60130++; if (hits.z60130) stats.z60130++; }
    if (hits.et && hits.trap && hits.z60 && hits.z60130) stats.all4++;
    results.push({
      name: res.car.name, tireType: res.car.tireType, loss: res.car.drivetrainLossPercent,
      forceScale: res.car.forceScale, tgt: tgt,
      sim: {
        et: sim.et != null ? +sim.et.toFixed(3) : null,
        trap: sim.trap != null ? +sim.trap.toFixed(1) : null,
        z60: sim.z60 != null ? +sim.z60.toFixed(3) : null,
        z60130: sim.z60130 != null ? +sim.z60130.toFixed(3) : null,
        vmax: sim.vmax != null ? +sim.vmax.toFixed(1) : null
      },
      hits: hits, cost: res.cost, changed: !!res.changed
    });
    function pushW(key) {
      if (tgt[key] == null || sim[key] == null) return;
      worst[key].push({ name: res.car.name, err: +Math.abs(sim[key] - tgt[key]).toFixed(3), tgt: tgt[key], sim: +(+sim[key]).toFixed(3) });
    }
    pushW('trap'); pushW('et'); pushW('z60'); pushW('z60130');
  }

  ['trap', 'et', 'z60', 'z60130'].forEach(function (k) {
    worst[k].sort(function (a, b) { return b.err - a.err; });
    worst[k] = worst[k].slice(0, 15);
  });
  writeGarage(outCars);
  var summary = {
    generatedAt: new Date().toISOString(),
    fleetCount: outCars.length,
    source: IMPORT_PATH,
    tolerances: TOL,
    priority: 'trap → ET → 60-130 → 0-60',
    changedN: changedN, fastN: fastN,
    hitRates: {
      et: stats.et + '/' + stats.nEt,
      trap: stats.trap + '/' + stats.nTrap,
      z60: stats.z60 + '/' + stats.nZ60,
      z60130: stats.z60130 + '/' + stats.n60130,
      all4: stats.all4 + '/' + outCars.length,
      etPct: +(100 * stats.et / Math.max(1, stats.nEt)).toFixed(1),
      trapPct: +(100 * stats.trap / Math.max(1, stats.nTrap)).toFixed(1),
      z60Pct: +(100 * stats.z60 / Math.max(1, stats.nZ60)).toFixed(1),
      z60130Pct: +(100 * stats.z60130 / Math.max(1, stats.n60130)).toFixed(1),
      all4Pct: +(100 * stats.all4 / Math.max(1, outCars.length)).toFixed(1)
    },
    elapsedSec: +((Date.now() - t0) / 1000).toFixed(1),
    sample: results.filter(function (r) {
      return /Mustang GT$|Hellcat Redeye|Cybertruck|ZR1X|Supra Twin Turbo|Miata Club|Cobra 427|Model S Plaid/i.test(r.name);
    }),
    worst: worst,
    powerSourceCounts: (function () {
      var ev = 0, hy = 0;
      outCars.forEach(function (c) {
        if (c.isEv || c.powerSource === 'ev') ev++;
        if (c.isHybrid || c.powerSource === 'hybrid') hy++;
      });
      return { ev: ev, hybrid: hy };
    })()
  };
  fs.writeFileSync(OUT_META, JSON.stringify(summary, null, 2));
  console.log('Hit-rates:', JSON.stringify(summary.hitRates, null, 2));
  console.log('changed', changedN, 'fast', fastN, 'elapsed', summary.elapsedSec, 's');
  console.log('Worst trap:', worst.trap.slice(0, 8));
  console.log('Worst et:', worst.et.slice(0, 8));
  console.log('Worst z60:', worst.z60.slice(0, 8));
  console.log('Worst 60-130:', worst.z60130.slice(0, 8));
}

main();
