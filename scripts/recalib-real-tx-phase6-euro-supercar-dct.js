/**
 * Real-TX Phase 6 Euro supercar DCT marque split — stop cloning Tremec TR-9070
 * (DCT_7_AMG) across remaining Ferrari / McLaren / Lambo / Bugatti / BMW M / GT-R.
 * Knobs ONLY after gear/FD writes: drivetrainLossPercent + launchRpm + tireType.
 * forceScale=1. No Cd / weight / frontal area / torque-curve edits.
 * Keep Phase 3 Porsche/AMG/VW-Audi; Tremec only on Mustangs/C8 that use them.
 *
 *   node scripts/recalib-real-tx-phase6-euro-supercar-dct.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var META_PATH = path.join(__dirname, 'garage-calib-meta.json');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'real-tx-phase6-euro-supercar-dct-report.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };

function g(key) { return Phys.FactoryTransmissions[key].gears.slice(); }

/** Remap plan: gearRatios + finalDriveRatio + txKey. */
var REMAPS = {
  // —— Ferrari Getrag 7DCT (458 / 488 / F12 / 812) ——
  '2017 Ferrari 812 Superfast': { txKey: 'Ferrari_DCT_7', gears: g('Ferrari_DCT_7'), fd: 5.14, transmission: 'DCT' },
  '2016 Ferrari 488 GTB': { txKey: 'Ferrari_DCT_7', gears: g('Ferrari_DCT_7'), fd: 5.14, transmission: 'DCT' },
  '2014 Ferrari F12 Berlinetta': { txKey: 'Ferrari_DCT_7', gears: g('Ferrari_DCT_7'), fd: 5.14, transmission: 'DCT' },
  '2010 Ferrari 458 Italia': { txKey: 'Ferrari_DCT_7', gears: g('Ferrari_DCT_7'), fd: 5.14, transmission: 'DCT' },

  // —— Ferrari Magna 8DCT (SF90 hybrid) ——
  '2021 Ferrari SF90 Stradale': { txKey: 'Ferrari_DCT_8', gears: g('Ferrari_DCT_8'), fd: 4.51, transmission: 'DCT' },

  // —— Ferrari F1 6-spd AMT (360 / F430 / Enzo / 612) ——
  '2002 Ferrari Enzo': { txKey: 'Ferrari_F1_6', gears: g('Ferrari_F1_6'), fd: 4.30, transmission: 'Auto' },
  '2003 Ferrari 360 Modena': { txKey: 'Ferrari_F1_6', gears: g('Ferrari_F1_6'), fd: 4.30, transmission: 'Auto' },
  '2005 Ferrari F430': { txKey: 'Ferrari_F1_6', gears: g('Ferrari_F1_6'), fd: 4.30, transmission: 'Auto' },
  '2006 Ferrari 612 Scaglietti': { txKey: 'Ferrari_F1_6', gears: g('Ferrari_F1_6'), fd: 4.30, transmission: 'Auto' },

  // —— McLaren SSG 7DCT ——
  '2020 McLaren 765LT': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2018 McLaren 600LT': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2015 McLaren P1': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2013 McLaren MP4-12C': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2011 McLaren MP4-12C HS': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2020 McLaren 720S': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2019 McLaren Speedtail': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2020 McLaren Elva': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },
  '2021 McLaren Sabre': { txKey: 'McLaren_SSG_7', gears: g('McLaren_SSG_7'), fd: 3.31, transmission: 'DCT' },

  // —— Lamborghini LDF 7DCT (Huracán) ——
  '2020 Lamborghini Huracán EVO': { txKey: 'Lambo_LDF_7', gears: g('Lambo_LDF_7'), fd: 4.89, transmission: 'DCT' },
  '2019 Lamborghini Huracán Performante': { txKey: 'Lambo_LDF_7', gears: g('Lambo_LDF_7'), fd: 4.89, transmission: 'DCT' },

  // —— Lamborghini ISR 7 AMT (Aventador) ——
  '2019 Lamborghini Aventador SVJ': { txKey: 'Lambo_ISR_7', gears: g('Lambo_ISR_7'), fd: 2.867, transmission: 'Auto' },

  // —— Lamborghini e-gear 6 AMT (Gallardo) ——
  '2012 Lamborghini Gallardo LP570-4': { txKey: 'Lambo_EGear_6', gears: g('Lambo_EGear_6'), fd: 3.08, transmission: 'Auto' },
  '2009 Lamborghini Gallardo LP560-4': { txKey: 'Lambo_EGear_6', gears: g('Lambo_EGear_6'), fd: 3.08, transmission: 'Auto' },

  // —— Lamborghini e-gear 6 AMT V12 (Murciélago / Reventón) ——
  '2007 Lamborghini Murciélago LP640': { txKey: 'Lambo_EGear_V12_6', gears: g('Lambo_EGear_V12_6'), fd: 2.53, transmission: 'Auto' },
  '2008 Lamborghini Reventón': { txKey: 'Lambo_EGear_V12_6', gears: g('Lambo_EGear_V12_6'), fd: 2.53, transmission: 'Auto' },

  // —— Bugatti DSG 7DCT ——
  '2019 Bugatti Chiron': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },
  '2013 Bugatti Veyron Super Sport': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },
  '2005 Bugatti Veyron': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },
  '2017 Bugatti Chiron Sport': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },
  '2018 Bugatti Divo': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },
  '2016 Bugatti Chiron': { txKey: 'Bugatti_DSG_7', gears: g('Bugatti_DSG_7'), fd: 3.64, transmission: 'DCT' },

  // —— BMW M DCT 7 (F80/F82) ——
  '2018 BMW M3 Competition': { txKey: 'BMW_M_DCT_7', gears: g('BMW_M_DCT_7'), fd: 3.462, transmission: 'DCT' },
  '2015 BMW M4': { txKey: 'BMW_M_DCT_7', gears: g('BMW_M_DCT_7'), fd: 3.462, transmission: 'DCT' },

  // —— Nissan GT-R GR6 (was wrongly on DCT_7_AMG 7-spd) ——
  '2009 Nissan GT-R': { txKey: 'GR6_DCT', gears: g('GR6_DCT'), fd: 3.70, transmission: 'DCT' }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function curveSig(c) {
  if (!c || !c.torqueCurve) return '';
  return Object.keys(c.torqueCurve).sort(function (a, b) { return +a - +b; })
    .map(function (k) { return k + ':' + c.torqueCurve[k]; }).join('|');
}
function runSim(car, full) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windMph: 0, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launch: 'auto', launchMode: 'auto', tireType: car.tireType | 0,
    driverWeightLbs: 200, quickMetrics: !full, needSixtyToOneThirty: true
  });
  return {
    et: r.quarterMileTime || null, trap: r.quarterMileSpeedMph || null,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty,
    ft60: r.sixtyFootTime || null, vmax: r.topSpeedMph
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
    if (sim[k] == null) { c += 100; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    c += (err / tol) * w + err * w * 0.15;
    if (err <= tol) hits++;
    else c += (err / tol) * w * 0.8;
  }
  add('et', 8.0, TOL.et);
  add('trap', 5.0, TOL.trap);
  add('z60130', 3.0, TOL.z60130);
  add('z60', 2.0, TOL.z60);
  c -= hits * 5;
  c += (app - hits) * 3;
  return c;
}
function trial(base, tgt, knobs, best) {
  var car = clone(base);
  car.drivetrainLossPercent = knobs.loss;
  car.forceScale = 1;
  car.tireType = knobs.tireType;
  car.launchRpm = knobs.launchRpm;
  if (knobs.hybridAssistFrac != null) car.hybridAssistFrac = knobs.hybridAssistFrac;
  var sim = runSim(car, false);
  var c = cost(sim, tgt);
  var h = hitFlags(sim, tgt);
  var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
  var etErr = (tgt.et != null && sim.et != null) ? Math.abs(sim.et - tgt.et) : 0;
  var cand = { knobs: knobs, cost: c, sim: sim, hits: h, nh: nh, etErr: etErr, car: car };
  if (!best) return cand;
  if (c < best.cost - 1e-9) return cand;
  if (Math.abs(c - best.cost) < 1e-9) {
    if (etErr < best.etErr - 1e-9) return cand;
    if (Math.abs(etErr - best.etErr) < 1e-9 && nh > best.nh) return cand;
  }
  if (allHit(h) && !allHit(best.hits) && c < best.cost + 1.5) return cand;
  return best;
}
function calibrateLossLaunchTire(car, tgt) {
  var isHybrid = !!(car.isHybrid || car.powerSource === 'hybrid');
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 3000;
  var baseAssist = car.hybridAssistFrac != null ? +car.hybridAssistFrac : 0.22;
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire, launchRpm: baseLaunch,
    hybridAssistFrac: isHybrid ? baseAssist : undefined
  }, null);

  [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35].forEach(function (loss) {
    best = trial(car, tgt, {
      loss: loss, tireType: seedTire, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined
    }, best);
  });
  var lc = best.knobs.loss;
  [-2, -1, -0.5, 0.5, 1, 2].forEach(function (d) {
    best = trial(car, tgt, {
      loss: Math.max(0, Math.min(35, +(lc + d).toFixed(1))),
      tireType: best.knobs.tireType, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined
    }, best);
  });
  [0, 1, 3, 4, 2].forEach(function (tire) {
    if (tire === best.knobs.tireType) return;
    best = trial(car, tgt, {
      loss: best.knobs.loss, tireType: tire, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
    }, best);
  });
  if (!best.hits.z60 || !best.hits.et || !best.hits.trap) {
    [-1200, -900, -600, -300, 0, 300, 600, 900, 1200, 1500].forEach(function (d) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: Math.round(Math.max(200, Math.min(7000, baseLaunch + d))),
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
      }, best);
    });
  }
  var bl = best.knobs.loss, bt = best.knobs.tireType, bla = best.knobs.launchRpm;
  [-1.5, -1, -0.5, 0.5, 1, 1.5].forEach(function (d) {
    [-400, -200, 200, 400].forEach(function (ld) {
      best = trial(car, tgt, {
        loss: Math.max(0, Math.min(35, +(bl + d).toFixed(1))),
        tireType: bt,
        launchRpm: Math.round(Math.max(200, Math.min(7000, bla + ld))),
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
      }, best);
    });
  });
  if (isHybrid) {
    [0.18, 0.22, 0.26, 0.28, 0.30, 0.34].forEach(function (af) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm, hybridAssistFrac: af
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
  var finalSim = runSim(out, true);
  return { car: out, sim: finalSim, hits: hitFlags(finalSim, tgt), cost: best.cost };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph = published electronic top-speed limiter (mph) for all garage EVs.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+launch+tire calibrated ET-first toward Excel (forceScale = 1.0 always).',
    ' * Excel source: /workspace/powercurve-garage-import.json',
    ' * ZR1X: published Cd 0.36 / wt 3978 locked — never search Cd/weight.',
    ' * Tip: real-tx-phase6-euro-supercar-dct — Ferrari/McLaren/Lambo/Bugatti/BMW M/GR6 marque presets;',
    ' *   knobs loss/tire/launch only after gear/FD writes; no Cd/wt/curve fakes.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-real-tx-phase6-euro-supercar-dct.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function fmt(n, d) { return n == null || !isFinite(n) ? '—' : (+n).toFixed(d); }

function main() {
  var t0 = Date.now();
  var meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  var byNameMeta = {};
  meta.results.forEach(function (r) {
    if (!byNameMeta[r.name]) byNameMeta[r.name] = [];
    byNameMeta[r.name].push(r);
  });

  var outCars = GARAGE.map(clone);
  var report = [];
  var names = Object.keys(REMAPS);
  console.log('Real-TX Phase6 Euro supercar DCT — remap + loss/tire/launch recalib');
  console.log('Targets:', names.length);

  // Preflight: every REMAP name must currently be on DCT_7_AMG
  names.forEach(function (name) {
    var c = outCars.find(function (x) { return x.name === name; });
    if (!c) throw new Error('MISSING garage car: ' + name);
    if (c.txKey !== 'DCT_7_AMG') console.warn('WARN not on DCT_7_AMG before:', name, c.txKey);
  });

  names.forEach(function (name) {
    var plan = REMAPS[name];
    var idxs = [];
    for (var i = 0; i < outCars.length; i++) if (outCars[i].name === name) idxs.push(i);
    if (!idxs.length) { console.error('MISSING', name); return; }
    var tgt = (byNameMeta[name] && byNameMeta[name][0] && byNameMeta[name][0].tgt) || {};

    idxs.forEach(function (gi) {
      var before = clone(outCars[gi]);
      var snap = {
        cd: before.dragCoefficient, wt: before.weightLbs,
        area: before.frontalAreaSqFt, curve: curveSig(before)
      };
      var beforeSim = runSim(before, true);
      var beforeHits = hitFlags(beforeSim, tgt);

      var remapped = clone(before);
      remapped.txKey = plan.txKey;
      remapped.gearRatios = plan.gears.slice();
      remapped.finalDriveRatio = plan.fd;
      remapped.transmission = plan.transmission || remapped.transmission || 'DCT';
      remapped.forceScale = 1;
      remapped.dragCoefficient = snap.cd;
      remapped.weightLbs = snap.wt;
      remapped.frontalAreaSqFt = snap.area;
      remapped.torqueCurve = before.torqueCurve;

      var calib = calibrateLossLaunchTire(remapped, tgt);
      var afterCar = calib.car;
      afterCar.dragCoefficient = snap.cd;
      afterCar.weightLbs = snap.wt;
      afterCar.frontalAreaSqFt = snap.area;
      afterCar.torqueCurve = before.torqueCurve;
      afterCar.forceScale = 1;
      afterCar.transmission = plan.transmission || afterCar.transmission || 'DCT';
      if (curveSig(afterCar) !== snap.curve) throw new Error('CURVE mutated: ' + name);
      if (afterCar.dragCoefficient !== snap.cd) throw new Error('Cd: ' + name);
      if (afterCar.weightLbs !== snap.wt) throw new Error('wt: ' + name);
      if (afterCar.frontalAreaSqFt !== snap.area) throw new Error('area: ' + name);

      outCars[gi] = afterCar;
      var afterSim = runSim(afterCar, true);
      var afterHits = hitFlags(afterSim, tgt);
      var row = {
        name: name, gi: gi, tgt: tgt,
        before: {
          txKey: before.txKey, nG: (before.gearRatios || []).length, fd: before.finalDriveRatio,
          transmission: before.transmission,
          loss: before.drivetrainLossPercent, tire: before.tireType | 0, launch: before.launchRpm,
          sim: {
            et: beforeSim.et != null ? +beforeSim.et.toFixed(3) : null,
            trap: beforeSim.trap != null ? +beforeSim.trap.toFixed(1) : null,
            z60: beforeSim.z60 != null ? +beforeSim.z60.toFixed(3) : null,
            z60130: beforeSim.z60130 != null ? +beforeSim.z60130.toFixed(3) : null
          },
          hits: beforeHits
        },
        after: {
          txKey: afterCar.txKey, nG: (afterCar.gearRatios || []).length, fd: afterCar.finalDriveRatio,
          transmission: afterCar.transmission,
          loss: afterCar.drivetrainLossPercent, tire: afterCar.tireType | 0, launch: afterCar.launchRpm,
          sim: {
            et: afterSim.et != null ? +afterSim.et.toFixed(3) : null,
            trap: afterSim.trap != null ? +afterSim.trap.toFixed(1) : null,
            z60: afterSim.z60 != null ? +afterSim.z60.toFixed(3) : null,
            z60130: afterSim.z60130 != null ? +afterSim.z60130.toFixed(3) : null
          },
          hits: afterHits
        },
        stillMiss: !(afterHits.et && afterHits.trap)
      };
      report.push(row);
      console.log(
        (afterHits.et && afterHits.trap ? 'HIT ' : 'MISS') +
        ' ' + name +
        '  ' + before.txKey + '/' + (before.gearRatios || []).length + '/' + before.finalDriveRatio +
        ' → ' + afterCar.txKey + '/' + (afterCar.gearRatios || []).length + '/' + afterCar.finalDriveRatio +
        '  Excel ' + fmt(tgt.et, 3) + '@' + fmt(tgt.trap, 1) +
        '  sim ' + fmt(afterSim.et, 3) + '@' + fmt(afterSim.trap, 1) +
        '  knobs ' + afterCar.drivetrainLossPercent + '% / T' + afterCar.tireType + ' / L' + afterCar.launchRpm
      );
    });
  });

  console.log('\nFleet re-sim…');
  var stats = { et: 0, trap: 0, z60: 0, z60130: 0, nEt: 0, nTrap: 0, nZ60: 0, n60130: 0, all4: 0 };
  var newResults = [];
  var worstEt = [], worstTrap = [];
  var nameOcc = {}, metaByNameOcc = {};
  meta.results.forEach(function (r) {
    if (!metaByNameOcc[r.name]) metaByNameOcc[r.name] = [];
    metaByNameOcc[r.name].push(r);
  });
  for (var i = 0; i < outCars.length; i++) {
    var car = outCars[i];
    car.forceScale = 1;
    var occ = nameOcc[car.name] || 0;
    nameOcc[car.name] = occ + 1;
    var oldMeta = (metaByNameOcc[car.name] || [])[occ];
    if (!oldMeta || !oldMeta.tgt) continue;
    var tgt2 = oldMeta.tgt;
    var simR = runSim(car, false);
    var sim2 = {
      et: simR.et != null ? +simR.et.toFixed(3) : null,
      trap: simR.trap != null ? +simR.trap.toFixed(1) : null,
      z60: simR.z60 != null ? +simR.z60.toFixed(3) : null,
      z60130: simR.z60130 != null ? +simR.z60130.toFixed(3) : null,
      vmax: simR.vmax != null ? +simR.vmax.toFixed(1) : null
    };
    var hits2 = hitFlags(simR, tgt2);
    if (tgt2.et != null) {
      stats.nEt++;
      if (hits2.et) stats.et++;
      else worstEt.push({ name: car.name, tgt: tgt2.et, sim: sim2.et, d: sim2.et != null ? +(sim2.et - tgt2.et).toFixed(3) : null, abs: sim2.et != null ? Math.abs(sim2.et - tgt2.et) : 99 });
    }
    if (tgt2.trap != null) {
      stats.nTrap++;
      if (hits2.trap) stats.trap++;
      else worstTrap.push({ name: car.name, tgt: tgt2.trap, sim: sim2.trap, d: sim2.trap != null ? +(sim2.trap - tgt2.trap).toFixed(1) : null, abs: sim2.trap != null ? Math.abs(sim2.trap - tgt2.trap) : 99 });
    }
    if (tgt2.z60 != null) { stats.nZ60++; if (hits2.z60) stats.z60++; }
    if (tgt2.z60130 != null) { stats.n60130++; if (hits2.z60130) stats.z60130++; }
    if (hits2.et && hits2.trap && hits2.z60 && hits2.z60130) stats.all4++;
    newResults.push({
      name: car.name, tgt: tgt2, sim: sim2, hits: hits2,
      loss: car.drivetrainLossPercent, tireType: car.tireType | 0, launchRpm: car.launchRpm,
      forceScale: 1, txKey: car.txKey, nG: (car.gearRatios || []).length, fd: car.finalDriveRatio
    });
  }
  worstEt.sort(function (a, b) { return b.abs - a.abs; });
  worstTrap.sort(function (a, b) { return b.abs - a.abs; });

  var fsBad = outCars.filter(function (c) { return +c.forceScale !== 1; });
  if (fsBad.length) throw new Error('forceScale≠1: ' + fsBad.length);

  // Integrity: remapped cars must leave DCT_7_AMG
  var stillWrong = [];
  Object.keys(REMAPS).forEach(function (n) {
    var c = outCars.find(function (x) { return x.name === n; });
    if (!c) { stillWrong.push(n + ' missing'); return; }
    if (c.txKey !== REMAPS[n].txKey) stillWrong.push(n + ' tx=' + c.txKey);
    if (Math.abs(+c.finalDriveRatio - REMAPS[n].fd) > 0.01) stillWrong.push(n + ' FD');
    if ((c.gearRatios || []).length !== REMAPS[n].gears.length) stillWrong.push(n + ' nG');
  });
  if (stillWrong.length) throw new Error('Phase6 integrity: ' + stillWrong.join(', '));

  var nAmg = outCars.filter(function (c) { return c.txKey === 'DCT_7_AMG'; }).length;

  // Phase1 Tremec_TR9080 must stay on C8 trio
  var tr9080 = outCars.filter(function (c) { return c.txKey === 'Tremec_TR9080_8DCT'; }).map(function (c) { return c.name; });
  var expect9080 = ['2024 Chevrolet Corvette Stingray', '2023 Chevrolet Corvette Z06', '2026 Chevrolet Corvette ZR1X'];
  expect9080.forEach(function (n) {
    if (tr9080.indexOf(n) < 0) throw new Error('Phase1 TR9080 missing: ' + n);
  });
  // Phase3 / Phase4 / Phase5 heroes intact
  var gt3 = outCars.find(function (c) { return c.name === '2024 Porsche 911 GT3 RS'; });
  if (!gt3 || gt3.txKey !== 'Porsche_PDK_7_GT') throw new Error('Phase3 GT3 RS PDK broken');
  var gt500 = outCars.find(function (c) { return c.name === '2020 Ford Mustang Shelby GT500'; });
  if (!gt500 || gt500.txKey !== 'Tremec_TR9070_7DCT') throw new Error('Phase3 GT500 TR9070 broken');
  var cyber = outCars.find(function (c) { return c.name === '2024 Tesla Cybertruck Tri-Motor'; });
  if (!cyber || Math.abs(+cyber.finalDriveRatio - 15.02) > 0.01) throw new Error('Phase4 Cybertruck FD broken');
  var regera = outCars.find(function (c) { return c.name === '2016 Koenigsegg Regera'; });
  if (!regera || regera.txKey !== 'Koenigsegg_KDD') throw new Error('Phase4 Regera KDD broken');
  var g8 = outCars.find(function (c) { return c.name === '2009 Pontiac G8 GXP'; });
  if (!g8 || g8.txKey !== 'GM_6L80') throw new Error('Phase5 G8 GXP 6L80 broken');
  var miata = outCars.find(function (c) { return c.name === '1990 Mazda Miata NA'; });
  if (!miata || miata.txKey !== 'Mazda_Miata_5') throw new Error('Phase5 Miata broken');

  var counts = {};
  Object.keys(REMAPS).forEach(function (n) {
    var k = REMAPS[n].txKey;
    counts[k] = (counts[k] || 0) + 1;
  });

  writeGarage(outCars);
  fs.writeFileSync(META_PATH, JSON.stringify({
    tip: 'real-tx-phase6-euro-supercar-dct',
    tol: TOL, stats: stats, changedN: report.length, batchN: report.length,
    baseline: {
      tip: 'real-tx-phase5-zf8-tr6060@8b47f89',
      et: 320, trap: 295, z60: 280, z60130: 71, all4: 243
    },
    leftover: { DCT_7_AMG: nAmg },
    note: 'Real-TX Phase6 Euro supercar DCT marque split: Ferrari_DCT_7/8 + Ferrari_F1_6 + McLaren_SSG_7 + Lambo_LDF/ISR/EGear + Bugatti_DSG_7 + BMW_M_DCT_7 + GR6; knobs loss/tire/launch only; forceScale=1; Cd/wt/curve untouched; Peak HP wipe + VB_POWERCURVE_GARAGE + launch-tach + P1-P5 intact; NO Merovingian',
    results: newResults,
    worst15Et: worstEt.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    worst15Trap: worstTrap.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    batch: report
  }, null, 2));
  fs.writeFileSync(OUT_REPORT, JSON.stringify({
    tip: 'real-tx-phase6-euro-supercar-dct', elapsedMs: Date.now() - t0, stats: stats, report: report,
    leftover: { DCT_7_AMG: nAmg }, counts: counts,
    fsBad: fsBad.length, stillWrong: stillWrong, tr9080: tr9080
  }, null, 2));

  var hitBoth = report.filter(function (r) { return r.after.hits.et && r.after.hits.trap; }).length;
  var stillMiss = report.filter(function (r) { return r.stillMiss; });
  console.log('\nBatch ET+trap HIT', hitBoth + '/' + report.length, 'still miss', stillMiss.length);
  console.log('Fleet ET', stats.et + '/' + stats.nEt, 'trap', stats.trap + '/' + stats.nTrap,
    '0-60', stats.z60 + '/' + stats.nZ60, '60-130', stats.z60130 + '/' + stats.n60130, 'all4', stats.all4);
  console.log('Leftover DCT_7_AMG', nAmg, 'elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  stillMiss.forEach(function (r) {
    console.log('  MISS', r.name,
      'ΔET', r.after.sim.et != null && r.tgt.et != null ? (r.after.sim.et - r.tgt.et).toFixed(3) : '—',
      'Δtrap', r.after.sim.trap != null && r.tgt.trap != null ? (r.after.sim.trap - r.tgt.trap).toFixed(1) : '—');
  });
}

main();
