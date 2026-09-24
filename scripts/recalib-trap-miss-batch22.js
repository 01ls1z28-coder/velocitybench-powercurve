/**
 * Trap-miss accuracy tip — first batch of 22 (Jorge approved).
 * Knobs ONLY: drivetrainLossPercent, launchRpm, tireType.
 * forceScale=1. No Cd / weight / torque-curve edits.
 * 14 honest-miss cars are never touched.
 *
 *   node scripts/recalib-trap-miss-batch22.js           # apply shipped recipes + fleet meta
 *   node scripts/recalib-trap-miss-batch22.js --search  # slow joint search (optional)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var META_PATH = path.join(__dirname, 'garage-calib-meta.json');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var DO_SEARCH = process.argv.indexOf('--search') >= 0;

/** Tire: 0 Street, 1 Drag Radial, 2 Slick, 3 Summer, 4 UHP. null = leave unchanged. */
var RECIPES = {
  '2023 Hyundai Ioniq 5 N': { loss: 7, tire: 1, launch: 200 },
  '2022 Tesla Model S Plaid': { loss: 9, tire: 2, launch: 500 },
  '1978 Dodge Magnum XE': { loss: 16, tire: 0, launch: 1300 },
  '2023 Mercedes EQE AMG 53': null,
  '2007 Ford F-150 4.6 Triton': { loss: 1.5, tire: 0, launch: 3000 },
  '2019 McLaren Speedtail': { loss: 25.5, tire: 2, launch: 1800 },
  '1985 Mazda RX-7 GSL-SE': { loss: 10, tire: 0, launch: 5100 },
  '1967 Plymouth GTX 440': { loss: 12, tire: 0, launch: 200 },
  '1968 Mercury Cougar XR-7': { loss: 30, tire: 0, launch: 200 },
  '1963 Corvette Stingray 327': { loss: 29, tire: 0, launch: 200 },
  '2001 Lamborghini Diablo VT 6.0': { loss: 2, tire: 0, launch: 200 },
  '1969 Chevrolet Camaro SS 396': { loss: 19.5, tire: 0, launch: 200 },
  '1968 Dodge Dart GTS 383': { loss: 13, tire: 0, launch: 200 },
  '2023 Chevrolet Silverado ZR2': { loss: 0, tire: 0, launch: 1500 },
  '2022 BMW iX M60': null,
  '1979 Pontiac Firebird Trans Am': { loss: 10, tire: 0, launch: 500 },
  '2008 Audi S5': { loss: 5, tire: 0, launch: 200 },
  '1971 Dodge Demon 340': { loss: 10, tire: 0, launch: 200 },
  '2022 Porsche Taycan Turbo S': null,
  '1977 Chevrolet Monte Carlo': { loss: 9, tire: 0, launch: 500 },
  '1974 Pontiac Firebird 400': { loss: 15, tire: 0, launch: 200 },
  '2018 Jeep Grand Cherokee SRT': { loss: 0, tire: 0, launch: 2400 }
};

var HONEST_MISS = [
  '2007 Lamborghini Murciélago LP640', '1964 Pontiac GTO', '2021 BMW S1000RR',
  '1965 Chevrolet Chevelle SS396', '2022 Cadillac Escalade V', '2020 Dodge Durango SRT',
  '2021 Range Rover Sport SVR', '2007 Audi S6 V10', '1972 Oldsmobile 442',
  '2002 Nissan Skyline GT-R R34', '2023 Acura TLX Type S', '2023 Ford Bronco Raptor',
  '1973 Ford Torino 351', '1955 Ford Thunderbird'
];

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
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty, vmax: r.topSpeedMph
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
function fmt(n, d) { return n == null || !isFinite(n) ? '—' : (+n).toFixed(d); }

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
    ' * Tip: trap-miss batch22 — knobs loss/tire/launch only; 14 honest-miss untouched.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-trap-miss-batch22.js',
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
  if (DO_SEARCH) {
    console.error('--search not embedded in this tip; use shipped RECIPES (default).');
    console.error('Inventory probe was loss×tire×launch with early-abort; recipes below are the accepted set.');
    process.exit(2);
  }
  var meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  var byNameMeta = {};
  meta.results.forEach(function (r) {
    if (!byNameMeta[r.name]) byNameMeta[r.name] = [];
    byNameMeta[r.name].push(r);
  });

  var outCars = GARAGE.map(clone);
  var report = [];
  var changed = 0;
  var names = Object.keys(RECIPES);

  console.log('Trap-miss batch22 — apply recipes (forceScale=1; loss/tire/launch only)');
  console.log('Targets:', names.length, 'names');

  names.forEach(function (name) {
    var recipe = RECIPES[name];
    var idxs = [];
    for (var i = 0; i < outCars.length; i++) if (outCars[i].name === name) idxs.push(i);
    if (!idxs.length) { console.error('MISSING', name); return; }
    if (HONEST_MISS.indexOf(name) >= 0) { console.error('REFUSING honest-miss', name); return; }
    var tgt = (byNameMeta[name] && byNameMeta[name][0] && byNameMeta[name][0].tgt) || {};

    idxs.forEach(function (gi) {
      var before = clone(outCars[gi]);
      var snap = {
        cd: before.dragCoefficient, wt: before.weightLbs,
        area: before.frontalAreaSqFt, curve: curveSig(before)
      };
      var beforeSim = runSim(before, true);
      var beforeHits = hitFlags(beforeSim, tgt);
      var afterCar = clone(before);
      var knobsChanged = false;
      if (recipe) {
        afterCar.drivetrainLossPercent = +Number(recipe.loss).toFixed(1);
        afterCar.tireType = recipe.tire | 0;
        afterCar.launchRpm = Math.round(recipe.launch);
        knobsChanged =
          Math.abs((+before.drivetrainLossPercent || 0) - afterCar.drivetrainLossPercent) > 1e-6 ||
          (before.tireType | 0) !== afterCar.tireType ||
          Math.round(before.launchRpm || 0) !== afterCar.launchRpm;
      }
      afterCar.dragCoefficient = snap.cd;
      afterCar.weightLbs = snap.wt;
      afterCar.frontalAreaSqFt = snap.area;
      afterCar.torqueCurve = before.torqueCurve;
      afterCar.forceScale = 1;
      var afterSim = runSim(afterCar, true);
      var afterHits = hitFlags(afterSim, tgt);
      if (curveSig(afterCar) !== snap.curve) throw new Error('CURVE ' + name);
      if (afterCar.dragCoefficient !== snap.cd || afterCar.weightLbs !== snap.wt) throw new Error('Cd/wt ' + name);
      if (knobsChanged) { outCars[gi] = afterCar; changed++; }
      report.push({
        name: name, gi: gi, tgt: tgt,
        before: {
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
          loss: afterCar.drivetrainLossPercent, tire: afterCar.tireType | 0, launch: afterCar.launchRpm,
          sim: {
            et: afterSim.et != null ? +afterSim.et.toFixed(3) : null,
            trap: afterSim.trap != null ? +afterSim.trap.toFixed(1) : null,
            z60: afterSim.z60 != null ? +afterSim.z60.toFixed(3) : null,
            z60130: afterSim.z60130 != null ? +afterSim.z60130.toFixed(3) : null
          },
          hits: afterHits
        },
        stillMiss: !(afterHits.et && afterHits.trap),
        knobsChanged: knobsChanged
      });
      console.log(
        (afterHits.et && afterHits.trap ? 'HIT ' : 'MISS') +
        ' [' + gi + '] ' + name +
        '  after ' + fmt(afterSim.et, 3) + '@' + fmt(afterSim.trap, 1) +
        '  knobs ' + afterCar.drivetrainLossPercent + '% / ' +
        Phys.tireLabelForType(afterCar.tireType | 0) + ' / L' + afterCar.launchRpm
      );
    });
  });

  console.log('\nFleet quick re-sim…');
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
      name: car.name, tireType: car.tireType | 0, loss: car.drivetrainLossPercent,
      forceScale: 1, launchRpm: car.launchRpm, tgt: tgt2, sim: sim2, hits: hits2
    });
  }
  worstEt.sort(function (a, b) { return b.abs - a.abs; });
  worstTrap.sort(function (a, b) { return b.abs - a.abs; });

  HONEST_MISS.forEach(function (n) {
    for (var i = 0; i < GARAGE.length; i++) {
      if (GARAGE[i].name !== n) continue;
      var a = GARAGE[i], b = outCars[i];
      if (a.drivetrainLossPercent !== b.drivetrainLossPercent || a.tireType !== b.tireType || a.launchRpm !== b.launchRpm) {
        throw new Error('Honest-miss touched: ' + n);
      }
    }
  });
  var fsBad = outCars.filter(function (c) { return +c.forceScale !== 1; });
  if (fsBad.length) throw new Error('forceScale≠1: ' + fsBad.length);

  writeGarage(outCars);
  fs.writeFileSync(META_PATH, JSON.stringify({
    tip: 'trap-miss-batch22',
    tol: TOL, stats: stats, changedN: changed, batchN: report.length,
    note: 'Trap-miss batch22: loss/tire/launch only on 22 names; forceScale=1; Cd/wt/curve untouched; 14 honest-miss left alone; Peak HP wipe fix + VB_POWERCURVE_GARAGE bind intact',
    results: newResults,
    worst15Et: worstEt.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    worst15Trap: worstTrap.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    batch22: report
  }, null, 2));
  fs.writeFileSync(path.join(__dirname, 'trap-miss-batch22-report.json'), JSON.stringify({
    tip: 'trap-miss-batch22', elapsedMs: Date.now() - t0, stats: stats, report: report, fsBad: fsBad.length
  }, null, 2));

  var hitBoth = report.filter(function (r) { return r.after.hits.et && r.after.hits.trap; }).length;
  var stillMiss = report.filter(function (r) { return r.stillMiss; });
  function pct(a, b) { return b ? ((100 * a / b).toFixed(1) + '%') : '—'; }
  console.log('\nET+trap HIT', hitBoth + '/' + report.length, 'still miss', stillMiss.length);
  console.log('Fleet ET', stats.et + '/' + stats.nEt, 'trap', stats.trap + '/' + stats.nTrap,
    '0-60', stats.z60 + '/' + stats.nZ60, '60-130', stats.z60130 + '/' + stats.n60130, 'all4', stats.all4);
  console.log('changed', changed, 'elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

main();
