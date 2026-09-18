/**
 * Excel accuracy tip — forceScale retired (always 1.0).
 * Calibrate ONLY with: drivetrainLossPercent, launchRpm, tireType.
 * Curve scale = last resort when former forceScale>1 cannot fold into loss.
 * Source: /workspace/powercurve-garage-import.json
 *   node scripts/recalib-loss-launch-tires.js
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

function cloneCar(car) { return JSON.parse(JSON.stringify(car)); }

function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-6) return curve;
  var out = {}, keys = Object.keys(curve);
  for (var i = 0; i < keys.length; i++) out[keys[i]] = +(Number(curve[keys[i]]) * s).toFixed(4);
  return out;
}

/** Fold retired forceScale into loss (preferred) or curve scale (last resort). */
function absorbForceScale(car) {
  var c = cloneCar(car);
  var fScale = c.forceScale != null ? +c.forceScale : 1;
  if (!(fScale > 0) || !isFinite(fScale)) fScale = 1;
  var loss = c.drivetrainLossPercent != null ? +c.drivetrainLossPercent : 12;
  var net = fScale * (1 - loss / 100);
  c.forceScale = 1;
  c._curveScaled = false;
  if (Math.abs(fScale - 1) < 0.005) return c;
  if (net <= 1.0) {
    c.drivetrainLossPercent = +Math.max(0, Math.min(35, 100 * (1 - net))).toFixed(1);
    return c;
  }
  c.torqueCurve = scaleCurve(c.torqueCurve, net);
  c.drivetrainLossPercent = 0;
  c._curveScaled = true;
  return c;
}

function trial(base, tgt, knobs, best) {
  var car = cloneCar(base);
  if (knobs.loss != null) car.drivetrainLossPercent = knobs.loss;
  car.forceScale = 1;
  if (knobs.tireType != null) car.tireType = knobs.tireType;
  if (knobs.launchRpm != null) car.launchRpm = knobs.launchRpm;
  if (knobs.hybridAssistFrac != null) car.hybridAssistFrac = knobs.hybridAssistFrac;
  if (knobs.dragCoefficient != null) car.dragCoefficient = knobs.dragCoefficient;
  if (knobs.frontalAreaSqFt != null) car.frontalAreaSqFt = knobs.frontalAreaSqFt;
  if (knobs.weightLbs != null) car.weightLbs = knobs.weightLbs;
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
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 3000;
  var baseAssist = car.hybridAssistFrac != null ? +car.hybridAssistFrac : 0.22;
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire, launchRpm: baseLaunch,
    hybridAssistFrac: isHybrid ? baseAssist : undefined,
    speedLimiterMph: car.speedLimiterMph
  }, null);

  // Coarse loss × seed tire
  [0, 4, 8, 12, 16, 20, 24, 28].forEach(function (loss) {
    best = trial(car, tgt, {
      loss: loss, tireType: seedTire, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined,
      speedLimiterMph: car.speedLimiterMph
    }, best);
  });
  // Fine loss around best (±2)
  var lc = best.knobs.loss;
  [-2, -1, 1, 2].forEach(function (d) {
    best = trial(car, tgt, {
      loss: Math.max(0, Math.min(35, +(lc + d).toFixed(1))),
      tireType: best.knobs.tireType, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined,
      speedLimiterMph: car.speedLimiterMph
    }, best);
  });
  // Tire ladder with best loss (skip if already all-hit)
  if (!allHit(best.hits)) {
    [0, 1, 3, 4, 2].forEach(function (tire) {
      if (tire === best.knobs.tireType) return;
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: tire, launchRpm: baseLaunch,
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    });
  }
  // Launch if 0-60 miss
  if (!best.hits.z60) {
    [-600, -300, 300, 600, 900].forEach(function (d) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: Math.round(Math.max(200, Math.min(7000, baseLaunch + d))),
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    });
  }
  if (isHybrid && !allHit(best.hits)) {
    [0.18, 0.22, 0.26, 0.30].forEach(function (af) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm, hybridAssistFrac: af,
        speedLimiterMph: car.speedLimiterMph
      }, best);
    });
  }
  // LAST RESORT: curve scale
  if (!allHit(best.hits) && tgt.trap != null && best.sim.trap != null &&
      (Math.abs(best.sim.trap - tgt.trap) > 1.5 ||
       (tgt.et != null && Math.abs(best.sim.et - tgt.et) > 0.2))) {
    [0.94, 0.97, 1.03, 1.06, 1.10, 1.14].forEach(function (sc) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm,
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined,
        speedLimiterMph: car.speedLimiterMph,
        curve: scaleCurve(car.torqueCurve, sc)
      }, best);
    });
  }

  var out = best.car;
  out.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
  out.forceScale = 1;
  out.tireType = best.knobs.tireType | 0;
  out.launchRpm = Math.round(best.knobs.launchRpm);
  if (isHybrid && best.knobs.hybridAssistFrac != null) {
    out.hybridAssistFrac = +Number(best.knobs.hybridAssistFrac).toFixed(3);
  }
  if (best.knobs.curve) out.torqueCurve = best.knobs.curve;
  delete out._curveScaled;
  var finalSim = runSim(out, true);
  return { car: out, sim: finalSim, hits: hitFlags(finalSim, tgt), cost: best.cost, changed: true };
}

function specialZR1X(car, tgt) {
  // Published ZR1X: Cd 0.36 / wt 3978 locked. Knobs ONLY loss + tire + launch; curve last resort.
  var c = absorbForceScale(car);
  c.dragCoefficient = 0.36;
  c.frontalAreaSqFt = 22.5;
  c.weightLbs = 3978;
  c.hybridAssistFrac = 0.28;
  c.speedLimiterMph = 233;
  c.forceScale = 1;
  c.drivetrainLossPercent = 0;
  c.tireType = 1;
  c.launchRpm = 2400;
  delete c._curveScaled;
  var best = trial(c, tgt, { loss: 0, tireType: 1, launchRpm: 2400 }, null);
  [0, 1, 2].forEach(function (loss) {
    [1, 4, 0].forEach(function (tire) {
      [2200, 2400, 2600].forEach(function (lr) {
        best = trial(c, tgt, {
          loss: loss, tireType: tire, launchRpm: lr
        }, best);
      });
    });
  });
  if (!allHit(best.hits)) {
    [1.03, 1.06, 1.08].forEach(function (sc) {
      best = trial(c, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm,
        curve: scaleCurve(c.torqueCurve, sc)
      }, best);
    });
  }
  var out = best.car;
  out.forceScale = 1;
  out.dragCoefficient = 0.36;
  out.frontalAreaSqFt = 22.5;
  out.weightLbs = 3978;
  out.speedLimiterMph = 233;
  out.hybridAssistFrac = 0.28;
  out.source = (car.source || '2026 Chevrolet Corvette ZR1X') +
    ' | fs=1 tip: published Cd0.36/wt3978; loss/tire/launch; Excel 1.9 / 8.675@159 / 3.87';
  var sim = runSim(out, true);
  return { car: out, sim: sim, hits: hitFlags(sim, tgt), cost: cost(sim, tgt), changed: true, special: true };
}

function specialCT(car, tgt) {
  // Known-good fs=1 bake: absorb 1.47→curve, Excel wt 6800, street tire
  var c = absorbForceScale(car);
  c.weightLbs = 6800;
  c.forceScale = 1;
  c.speedLimiterMph = 130;
  c.drivetrainLossPercent = 0;
  c.tireType = 0;
  c.launchRpm = 500;
  delete c._curveScaled;
  var best = trial(c, tgt, { loss: 0, tireType: 0, launchRpm: 500, weightLbs: 6800 }, null);
  [0, 2, 4].forEach(function (loss) {
    [0, 1, 3].forEach(function (tire) {
      [400, 500, 800].forEach(function (lr) {
        best = trial(c, tgt, {
          loss: loss, tireType: tire, launchRpm: lr, weightLbs: 6800
        }, best);
      });
    });
  });
  if (!allHit(best.hits)) {
    [1.03, 1.06].forEach(function (sc) {
      best = trial(c, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm, weightLbs: 6800,
        curve: scaleCurve(c.torqueCurve, sc)
      }, best);
    });
  }
  var out = best.car;
  out.forceScale = 1;
  out.weightLbs = 6800;
  out.speedLimiterMph = 130;
  out.source = (car.source || '2024 Tesla Cybertruck Tri-Motor') +
    ' | fs=1 tip: absorb→curve; Excel wt 6800; loss/tire/launch; Excel 2.6 / 11.0@119';
  var sim = runSim(out, true);
  return { car: out, sim: sim, hits: hitFlags(sim, tgt), cost: cost(sim, tgt), changed: true, special: true };
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
  var outCars = [], results = [];
  var changedN = 0, fastN = 0, curveScaleN = 0;

  console.log('Loss/launch/tire recalib (forceScale=1) — ' + GARAGE.length + ' cars');
  for (var i = 0; i < GARAGE.length; i++) {
    var car0 = GARAGE[i];
    var row = byName[car0.name];
    var tgt = row ? parseTargets(row['0-60 / 1/4 ']) : {};
    var res;

    if (/zr1x/i.test(car0.name || '')) {
      res = specialZR1X(car0, tgt.z60 ? tgt : { z60: 1.9, et: 8.675, trap: 159, z60130: 3.87 });
      console.log('ZR1X → ' + res.sim.z60.toFixed(3) + ' / ' + res.sim.et.toFixed(3) + '@' +
        res.sim.trap.toFixed(1) + ' / 60-130 ' + (res.sim.z60130 != null ? res.sim.z60130.toFixed(3) : '—') +
        ' Vmax ' + (res.sim.vmax != null ? res.sim.vmax.toFixed(1) : '—') +
        ' loss=' + res.car.drivetrainLossPercent + ' tire=' + res.car.tireType +
        ' Cd=' + res.car.dragCoefficient + ' launch=' + res.car.launchRpm +
        ' hits=' + JSON.stringify(res.hits));
      changedN++;
    } else if (/cybertruck/i.test(car0.name || '')) {
      res = specialCT(car0, tgt.z60 ? tgt : { z60: 2.6, et: 11.0, trap: 119 });
      console.log('CT → ' + res.sim.z60.toFixed(3) + ' / ' + res.sim.et.toFixed(3) + '@' +
        res.sim.trap.toFixed(1) + ' loss=' + res.car.drivetrainLossPercent +
        ' tire=' + res.car.tireType + ' wt=' + res.car.weightLbs +
        ' hits=' + JSON.stringify(res.hits));
      changedN++;
    } else if (!tgt.et && !tgt.trap && !tgt.z60) {
      var keep = absorbForceScale(car0);
      if (keep._curveScaled) curveScaleN++;
      delete keep._curveScaled;
      keep.forceScale = 1;
      outCars.push(keep);
      continue;
    } else {
      var seeded = absorbForceScale(car0);
      if (seeded._curveScaled) curveScaleN++;
      delete seeded._curveScaled;
      var seedSim = runSim(seeded, false);
      var seedHits = hitFlags(seedSim, tgt);
      if (allHit(seedHits) && cost(seedSim, tgt) < 2.5) {
        res = { car: seeded, sim: runSim(seeded, true), hits: seedHits, cost: cost(seedSim, tgt), changed: true };
        fastN++;
      } else {
        if ((i % 30) === 0) console.log('[' + (i + 1) + '/' + GARAGE.length + '] ' + car0.name);
        res = calibrateMiss(seeded, tgt);
        changedN++;
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
      name: res.car.name, tireType: res.car.tireType, loss: res.car.drivetrainLossPercent,
      forceScale: 1, launchRpm: res.car.launchRpm, tgt: tgt,
      sim: {
        et: sim.et != null ? +sim.et.toFixed(3) : null,
        trap: sim.trap != null ? +sim.trap.toFixed(1) : null,
        z60: sim.z60 != null ? +sim.z60.toFixed(3) : null,
        z60130: sim.z60130 != null ? +sim.z60130.toFixed(3) : null,
        vmax: sim.vmax != null ? +sim.vmax.toFixed(1) : null
      },
      hits: hits
    });
  }

  outCars.forEach(function (c) { c.forceScale = 1; });
  writeGarage(outCars);

  var meta = {
    tip: 'loss-launch-tires-forceScale1',
    tol: TOL, stats: stats, changedN: changedN, fastN: fastN,
    curveScaleN: curveScaleN, elapsedMs: Date.now() - t0, results: results
  };
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  function pct(a, b) { return b ? ((100 * a / b).toFixed(1) + '%') : '—'; }
  console.log('\n=== HIT RATES ===');
  console.log('ET     ' + stats.et + '/' + stats.nEt + ' ' + pct(stats.et, stats.nEt));
  console.log('trap   ' + stats.trap + '/' + stats.nTrap + ' ' + pct(stats.trap, stats.nTrap));
  console.log('0-60   ' + stats.z60 + '/' + stats.nZ60 + ' ' + pct(stats.z60, stats.nZ60));
  console.log('60-130 ' + stats.z60130 + '/' + stats.n60130 + ' ' + pct(stats.z60130, stats.n60130));
  console.log('all4   ' + stats.all4 + '/' + GARAGE.length);
  console.log('changed', changedN, 'fast', fastN, 'curveAbsorb', curveScaleN);
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

main();
