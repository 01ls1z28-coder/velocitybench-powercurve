/**
 * Launch-tach realism tip — recalib ONLY cars that drifted after stock
 * slip→lockup physics. Knobs: drivetrainLossPercent, launchRpm, tireType.
 * forceScale=1. No Cd / weight / torque-curve edits.
 *
 *   node scripts/recalib-launch-tach-realism.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var IMPORT_PATH = '/workspace/powercurve-garage-import.json';
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_META = path.join(__dirname, 'garage-calib-meta.json');
var OUT_REPORT = path.join(__dirname, 'launch-tach-realism-report.json');
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
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function runSim(car, full) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windMph: 0, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launch: 'auto', launchMode: 'auto', tireType: car.tireType | 0,
    driverWeightLbs: 200, quickMetrics: !full, needSixtyToOneThirty: true
  });
  return {
    et: r.quarterMileTime || null, trap: r.quarterMileSpeedMph || null,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty, vmax: r.topSpeedMph,
    leaveRpm: r.launchRpm
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
  add('et', 3.5, TOL.et);
  add('trap', 5, TOL.trap);
  add('z60', 2.5, TOL.z60);
  add('z60130', 2, TOL.z60130);
  c -= hits * 4;
  c += (app - hits) * 2;
  return c;
}
function trial(base, tgt, knobs, best) {
  var car = clone(base);
  car.forceScale = 1;
  if (knobs.loss != null) car.drivetrainLossPercent = knobs.loss;
  if (knobs.tireType != null) car.tireType = knobs.tireType;
  if (knobs.launchRpm != null) car.launchRpm = knobs.launchRpm;
  var sim = runSim(car, false);
  var c = cost(sim, tgt);
  var h = hitFlags(sim, tgt);
  var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
  var cand = { knobs: knobs, cost: c, sim: sim, hits: h, nh: nh, car: car };
  if (!best || c < best.cost - 1e-9 || (Math.abs(c - best.cost) < 1e-9 && nh > best.nh)) return cand;
  return best;
}

/** launchRpm search — stay ≥1200 so leave seed threshold does not swallow the knob. */
function launchCandidates(car, baseLaunch) {
  var red = Number(car.redline) || 6500;
  var peak = Number(car.peakTqRpm) || Math.round(red * 0.55);
  var seed = Math.max(1200, Math.min(red - 200, Math.round(peak * 0.9)));
  var out = {};
  function add(v) {
    v = Math.round(Math.max(1200, Math.min(red - 100, v)));
    out[v] = 1;
  }
  add(baseLaunch < 1000 ? seed : baseLaunch);
  add(seed);
  add(peak);
  add(Math.round(peak * 0.75));
  add(Math.round(peak * 1.05));
  [-900, -600, -300, 300, 600, 900, 1200].forEach(function (d) {
    add((baseLaunch < 1000 ? seed : baseLaunch) + d);
  });
  // EV: keep low leave targets valid
  if (car.isEv) {
    [200, 400, 500, 800, 1200, 2000, baseLaunch].forEach(function (v) {
      v = Math.round(Math.max(0, Math.min(red, v)));
      out[v] = 1;
    });
  }
  return Object.keys(out).map(Number).sort(function (a, b) { return a - b; });
}

function better(cand, best, seedHits) {
  if (!best) return true;
  // Never accept a candidate that newly breaks a seed trap/ET hit
  function broke(k) {
    return seedHits[k] && cand.hits[k] === false && best.hits[k] !== false;
  }
  // Prefer candidates that preserve seed hits
  function preserved(h) {
    var n = 0;
    if (seedHits.et && h.et) n++;
    if (seedHits.trap && h.trap) n++;
    if (seedHits.z60 && h.z60) n++;
    if (seedHits.z60130 && h.z60130) n++;
    return n;
  }
  var pC = preserved(cand.hits), pB = preserved(best.hits);
  if (pC !== pB) return pC > pB;
  if (cand.nh !== best.nh) return cand.nh > best.nh;
  // Soft: reject if cand newly breaks trap while best keeps it
  if (seedHits.trap && !cand.hits.trap && best.hits.trap) return false;
  if (seedHits.et && !cand.hits.et && best.hits.et) return false;
  if (cand.cost < best.cost - 1e-9) return true;
  return false;
}

function trialGuard(base, tgt, knobs, best, seedHits) {
  var cand = trial(base, tgt, knobs, null);
  // Standalone cost already in cand; compare with seed-aware better()
  if (!best) return cand;
  return better(cand, best, seedHits) ? cand : best;
}

function calibrate(car, tgt, seedHits) {
  seedHits = seedHits || { et: false, trap: false, z60: false, z60130: false };
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 3000;
  var seedTire = car.tireType | 0;
  var seedLaunch = baseLaunch < 1000 && !car.isEv
    ? Math.max(1200, Math.round((Number(car.peakTqRpm) || 2800) * 0.9))
    : baseLaunch;
  var best = trialGuard(car, tgt, { loss: baseLoss, tireType: seedTire, launchRpm: seedLaunch }, null, seedHits);

  // Prefer loss-only first (keep tire) — least disruption to trap
  var losses = [];
  for (var L = 0; L <= 35; L += 2) losses.push(L);
  losses.forEach(function (loss) {
    best = trialGuard(car, tgt, { loss: loss, tireType: seedTire, launchRpm: seedLaunch }, best, seedHits);
  });
  var lc = best.knobs.loss;
  [-0.5, 0.5].forEach(function (d) {
    best = trialGuard(car, tgt, {
      loss: Math.max(0, Math.min(35, +(lc + d).toFixed(1))),
      tireType: seedTire,
      launchRpm: best.knobs.launchRpm
    }, best, seedHits);
  });
  // Launch with seed tire
  if (!allHit(best.hits)) {
    launchCandidates(car, baseLaunch).forEach(function (lr) {
      best = trialGuard(car, tgt, {
        loss: best.knobs.loss, tireType: seedTire, launchRpm: lr
      }, best, seedHits);
    });
  }
  // Tire ladder last (can swing trap)
  if (!allHit(best.hits)) {
    [0, 1, 3, 4, 2].forEach(function (tire) {
      if (tire === best.knobs.tireType) return;
      best = trialGuard(car, tgt, {
        loss: best.knobs.loss, tireType: tire, launchRpm: best.knobs.launchRpm
      }, best, seedHits);
    });
  }
  // Joint refine
  if (!allHit(best.hits)) {
    var bl = best.knobs.loss, bt = best.knobs.tireType, br = best.knobs.launchRpm;
    [-2, -1, 1, 2].forEach(function (dl) {
      [-300, 300].forEach(function (dr) {
        best = trialGuard(car, tgt, {
          loss: Math.max(0, Math.min(35, +(bl + dl).toFixed(1))),
          tireType: bt,
          launchRpm: Math.round(Math.max(car.isEv ? 0 : 1200, Math.min(7000, br + dr)))
        }, best, seedHits);
      });
    });
  }

  // If nothing beats seed on preserved hits + nh, keep original knobs when seed was closer on trap
  var seedCand = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire,
    launchRpm: seedLaunch
  }, null);
  // Keep original baked launch if EV or already sane
  var origCand = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire, launchRpm: baseLaunch
  }, null);
  if (better(origCand, best, seedHits)) best = origCand;
  if (better(seedCand, best, seedHits)) best = seedCand;

  var out = best.car;
  out.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
  out.forceScale = 1;
  out.tireType = best.knobs.tireType | 0;
  out.launchRpm = Math.round(best.knobs.launchRpm);
  var finalSim = runSim(out, true);
  return {
    car: out,
    sim: finalSim,
    hits: hitFlags(finalSim, tgt),
    cost: best.cost,
    beforeLeave: baseLaunch,
    afterLeave: out.launchRpm
  };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph = published electronic top-speed limiter (mph) for all garage EVs.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+launch+tire calibrated toward Excel (forceScale retired = 1.0 always).',
    ' * Excel source: /workspace/powercurve-garage-import.json',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-loss-launch-tires.js',
    ' * Tip launch-tach-realism: stock slip→lockup; recalib loss/launch/tire only.',
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

  var prevMeta = {};
  try { prevMeta = JSON.parse(fs.readFileSync(OUT_META, 'utf8')); } catch (e) {}

  var stats = { et: 0, trap: 0, z60: 0, z60130: 0, nEt: 0, nTrap: 0, nZ60: 0, n60130: 0, all4: 0 };
  var outCars = [];
  var changed = [];
  var stillMiss = [];
  var results = [];
  var fastKeep = 0;

  console.log('Launch-tach realism recalib — ' + GARAGE.length + ' cars');
  for (var i = 0; i < GARAGE.length; i++) {
    var car0 = clone(GARAGE[i]);
    car0.forceScale = 1;
    var row = byName[car0.name];
    var tgt = row ? parseTargets(row['0-60 / 1/4 ']) : {};
    if (!tgt.et && !tgt.trap && !tgt.z60) {
      outCars.push(car0);
      continue;
    }
    var seedSim = runSim(car0, false);
    var seedHits = hitFlags(seedSim, tgt);
    var res;
    if (allHit(seedHits)) {
      res = { car: car0, sim: runSim(car0, true), hits: seedHits, cost: cost(seedSim, tgt), changed: false };
      fastKeep++;
    } else {
      if ((i % 20) === 0) console.log('[' + (i + 1) + '/' + GARAGE.length + '] ' + car0.name);
      res = calibrate(car0, tgt, seedHits);
      res.changed = true;
      changed.push({
        name: car0.name,
        before: {
          loss: GARAGE[i].drivetrainLossPercent,
          launchRpm: GARAGE[i].launchRpm,
          tireType: GARAGE[i].tireType,
          sim: {
            et: seedSim.et != null ? +seedSim.et.toFixed(3) : null,
            trap: seedSim.trap != null ? +seedSim.trap.toFixed(1) : null,
            z60: seedSim.z60 != null ? +seedSim.z60.toFixed(3) : null
          },
          hits: seedHits
        },
        after: {
          loss: res.car.drivetrainLossPercent,
          launchRpm: res.car.launchRpm,
          tireType: res.car.tireType,
          sim: {
            et: res.sim.et != null ? +res.sim.et.toFixed(3) : null,
            trap: res.sim.trap != null ? +res.sim.trap.toFixed(1) : null,
            z60: res.sim.z60 != null ? +res.sim.z60.toFixed(3) : null
          },
          hits: res.hits
        }
      });
      if (!allHit(res.hits)) {
        stillMiss.push({
          name: car0.name,
          tgt: tgt,
          sim: changed[changed.length - 1].after.sim,
          hits: res.hits,
          knobs: {
            loss: res.car.drivetrainLossPercent,
            launchRpm: res.car.launchRpm,
            tireType: res.car.tireType
          }
        });
      }
    }
    res.car.forceScale = 1;
    outCars.push(res.car);
    var sim = res.sim, hits = res.hits;
    if (tgt.et != null) { stats.nEt++; if (hits.et) stats.et++; }
    if (tgt.trap != null) { stats.nTrap++; if (hits.trap) stats.trap++; }
    if (tgt.z60 != null) { stats.nZ60++; if (hits.z60) stats.z60++; }
    if (tgt.z60130 != null) { stats.n60130++; if (hits.z60130) stats.z60130++; }
    if (hits.et && hits.trap && hits.z60 && hits.z60130) stats.all4++;
    results.push({
      name: res.car.name,
      tireType: res.car.tireType,
      loss: res.car.drivetrainLossPercent,
      forceScale: 1,
      launchRpm: res.car.launchRpm,
      tgt: tgt,
      sim: {
        et: sim.et != null ? +sim.et.toFixed(3) : null,
        trap: sim.trap != null ? +sim.trap.toFixed(1) : null,
        z60: sim.z60 != null ? +sim.z60.toFixed(3) : null,
        z60130: sim.z60130 != null ? +sim.z60130.toFixed(3) : null
      },
      hits: hits,
      changed: !!res.changed
    });
  }

  outCars.forEach(function (c) { c.forceScale = 1; });
  writeGarage(outCars);

  var meta = {
    tip: 'launch-tach-realism',
    tol: TOL,
    stats: stats,
    changedN: changed.length,
    fastKeep: fastKeep,
    stillMissN: stillMiss.length,
    baseline: {
      tip: prevMeta.tip || 'real-tx-batch1',
      et: prevMeta.stats && prevMeta.stats.et,
      trap: prevMeta.stats && prevMeta.stats.trap,
      z60: prevMeta.stats && prevMeta.stats.z60,
      z60130: prevMeta.stats && prevMeta.stats.z60130,
      all4: prevMeta.stats && prevMeta.stats.all4
    },
    preRecalibDrift: { et: 306, trap: 301, z60: 260, z60130: 72, all4: 229, drifted: 103 },
    note: 'Stock slip→lockup blend (ATC-like); absurd ICE launchRpm seeds to peak-TQ; manuals short clutch fade; recalib loss/launch/tire only; forceScale=1; no Cd/wt/curve; Peak HP wipe + VB_POWERCURVE_GARAGE intact; NO Merovingian deploy',
    elapsedMs: Date.now() - t0,
    results: results
  };
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2));
  fs.writeFileSync(OUT_REPORT, JSON.stringify({
    tip: 'launch-tach-realism',
    stats: stats,
    changed: changed,
    stillMiss: stillMiss
  }, null, 2));

  function pct(a, b) { return b ? ((100 * a / b).toFixed(1) + '%') : '—'; }
  console.log('\n=== HIT RATES ===');
  console.log('ET     ' + stats.et + '/' + stats.nEt + ' ' + pct(stats.et, stats.nEt));
  console.log('trap   ' + stats.trap + '/' + stats.nTrap + ' ' + pct(stats.trap, stats.nTrap));
  console.log('0-60   ' + stats.z60 + '/' + stats.nZ60 + ' ' + pct(stats.z60, stats.nZ60));
  console.log('60-130 ' + stats.z60130 + '/' + stats.n60130 + ' ' + pct(stats.z60130, stats.n60130));
  console.log('all4   ' + stats.all4);
  console.log('changed', changed.length, 'fastKeep', fastKeep, 'stillMiss', stillMiss.length);
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  if (stillMiss.length) {
    console.log('\nStill miss (honest):');
    stillMiss.slice(0, 20).forEach(function (m) {
      console.log(' ', m.name, 'sim', JSON.stringify(m.sim), 'hits', JSON.stringify(m.hits), 'knobs', JSON.stringify(m.knobs));
    });
  }
}

main();
