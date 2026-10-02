/**
 * Fleet fidelity tip (Jorge Guerra) — fast path:
 * 1) Demote every non-Z28 slick → factory-like seed
 * 2) Step-up Street→Summer→UHP→DR + modest launchRpm search only when Excel misses
 * Never touch Cd/FA/weight/peakHp/TX/FD/curve. forceScale=1.
 * Priority: trap > ET > 60-130 > 0-60. Unprepped Excel SOI.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'fleet-fidelity-trap-first-report.json');

var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
var SKIP = { '2024-tesla-cybertruck-tri-motor': 1, '2026-chevrolet-corvette-zr1x': 1 };
SKIP[Z28_ID] = 1;
var STEP_UP = [0, 3, 4, 1];
var byName = {};
TARGETS.forEach(function (t) { byName[t.name] = t; });

function log() {
  process.stdout.write(Array.prototype.slice.call(arguments).join(' ') + '\n');
}

function factoryTireSeed(car) {
  var cat = String(car.category || '');
  var hp = Number(car.peakHp) || 0;
  if (cat === 'Motorcycle') return 4;
  if (cat === 'Supercars' || cat === 'Hypercars') return 4;
  if (cat === 'EV' || cat === 'Hybrid') return 4;
  if (cat === 'Sports Cars') return 3;
  if (cat === 'Modern Muscle') return 3;
  if (cat === 'Classic Muscle') return 0;
  if (cat === 'Trucks' || cat === 'SUV') return 0;
  if (cat === 'Garage') return hp >= 400 ? 3 : 0;
  return 0;
}

function tireRank(t) {
  var i = STEP_UP.indexOf(t | 0);
  return i < 0 ? 99 : i;
}

function allowedTiresFrom(seed) {
  var start = STEP_UP.indexOf(seed);
  if (start < 0) start = 0;
  return STEP_UP.slice(start);
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function runSim(car) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: car.tireType | 0, trackPrep: 'unprepped',
    needSixtyToOneThirty: true, quickMetrics: true
  });
  return {
    et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty,
    sixty: r.sixtyFootTime
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

function priorityOk(h, tgt) {
  if (tgt.trap != null && !h.trap) return false;
  if (tgt.et != null && !h.et) return false;
  if (tgt.z60130 != null && !h.z60130) return false;
  if (tgt.z60 != null && !h.z60) return false;
  return true;
}

function cost(sim, tgt) {
  var c = 0, hits = 0, app = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    app++;
    if (sim[k] == null) { c += 100; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    c += (err / tol) * w + err * w * 0.1;
    if (err <= tol) hits++;
  }
  add('trap', 6, TOL.trap);
  add('et', 4, TOL.et);
  add('z60130', 2.5, TOL.z60130);
  add('z60', 2, TOL.z60);
  c -= hits * 5;
  c += (app - hits) * 3;
  return c;
}

function launchCandidates(car) {
  var base = Number(car.launchRpm) || 2500;
  var red = Number(car.redline) || 6500;
  var isEv = !!(car.isEv || car.powerSource === 'ev');
  var deltas = isEv ? [0, -400, 400] : [0, -400, 400, -200, 600];
  var out = [], seen = {};
  deltas.forEach(function (d) {
    var v = Math.round((base + d) / 50) * 50;
    if (isEv) v = Math.max(200, Math.min(red, v));
    else v = Math.max(1200, Math.min(red - 200, v));
    if (!seen[v]) { seen[v] = 1; out.push(v); }
  });
  return out;
}

var demoted = [];
var reseated = [];
var applied = [];
var unchanged = [];
var parked = [];
var locked = [];
var t0 = Date.now();

// Pass 1 — lock Z28 slick; reseat every other car to factory-like seed (Street→… never slick)
GARAGE.forEach(function (car) {
  car.forceScale = 1;
  if (car.id === Z28_ID) {
    car.tireType = 2;
    locked.push({ id: car.id, name: car.name, tire: 2 });
    return;
  }
  if (SKIP[car.id]) return; // Cybertruck / ZR1X keep LIVE tire
  var prev = car.tireType | 0;
  var seed = factoryTireSeed(car);
  if (prev === 2) {
    demoted.push({ id: car.id, name: car.name, from: 2, to: seed, category: car.category });
  } else if (prev !== seed) {
    reseated.push({ id: car.id, name: car.name, from: prev, to: seed, category: car.category });
  }
  car.tireType = seed;
});
log('demoted slicks', demoted.length, 'reseated to factory seed', reseated.length);

// Pass 2 — Excel search
var matched = 0;
GARAGE.forEach(function (car, idx) {
  car.forceScale = 1;
  var tgt = byName[car.name];
  if (!tgt) return;
  if (tgt.et == null && tgt.trap == null && tgt.z60 == null) return;
  matched++;
  if (SKIP[car.id]) {
    parked.push({ id: car.id, name: car.name, reason: 'skip-locked' });
    return;
  }

  var before = { tire: car.tireType | 0, launch: car.launchRpm };
  var seed = factoryTireSeed(car);
  // Pass1 already seated to seed; step-up from seed only
  var tires = allowedTiresFrom(seed);
  var launches = launchCandidates(car);
  var best = null;

  // Fast path: evaluate current first
  var curSim = runSim(car);
  var curH = hitFlags(curSim, tgt);
  if (priorityOk(curH, tgt)) {
    unchanged.push({ id: car.id, name: car.name, before: before, after: before, sim: curSim, hits: curH, nh: 4, cost: 0, fast: true });
    if (matched % 50 === 0) log('progress matched', matched, 'applied', applied.length, 'sec', ((Date.now() - t0) / 1000).toFixed(1));
    return;
  }

  tires.forEach(function (tire) {
    launches.forEach(function (launch) {
      var trial = clone(car);
      trial.tireType = tire;
      trial.launchRpm = launch;
      trial.forceScale = 1;
      var sim = runSim(trial);
      var c = cost(sim, tgt) + tireRank(tire) * 0.12;
      var h = hitFlags(sim, tgt);
      var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
      var cand = { tire: tire, launch: launch, cost: c, sim: sim, hits: h, nh: nh };
      if (!best || c < best.cost - 1e-9 ||
          (Math.abs(c - best.cost) < 1e-9 && tireRank(tire) < tireRank(best.tire))) {
        best = cand;
      }
    });
  });

  if (!best) {
    parked.push({ id: car.id, name: car.name, reason: 'no-cand' });
    return;
  }

  var changed = best.tire !== before.tire || best.launch !== before.launch;
  car.tireType = best.tire;
  car.launchRpm = best.launch;
  var row = {
    id: car.id, name: car.name, before: before,
    after: { tire: best.tire, launch: best.launch },
    sim: best.sim, hits: best.hits, nh: best.nh, cost: +best.cost.toFixed(3)
  };
  if (changed) applied.push(row);
  else unchanged.push(row);

  if (matched % 25 === 0) {
    log('progress matched', matched, 'applied', applied.length, 'sec', ((Date.now() - t0) / 1000).toFixed(1));
  }
});

// Safety sweep
var slickResidual = [];
GARAGE.forEach(function (c) {
  c.forceScale = 1;
  if ((c.tireType | 0) === 2 && c.id !== Z28_ID) {
    slickResidual.push(c.name);
    c.tireType = factoryTireSeed(c);
  }
});

var body = JSON.stringify(GARAGE, null, 2);
var js = [
  '/**',
  ' * VelocityBench PowerCurve — baked garage.',
  ' * Fleet fidelity: research µ + slicks only Jorge Z28; tire step-up Street→DR.',
  ' * Credit: Jorge Guerra. Tip: review/fleet-fidelity-trap-first.',
  ' * Knobs: tireType + launchRpm only. OEM Cd/FA/weight/peakHp/TX untouched. forceScale=1.',
  ' */',
  'var GARAGE = ' + body + ';',
  '',
  'if (typeof module !== "undefined" && module.exports) {',
  '  module.exports = GARAGE;',
  '}',
  'if (typeof window !== "undefined") {',
  '  window.VB_POWERCURVE_GARAGE = GARAGE;',
  '} else if (typeof globalThis !== "undefined") {',
  '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;',
  '}',
  ''
].join('\n');
fs.writeFileSync(OUT_JS, js);

var hist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
GARAGE.forEach(function (c) { hist[c.tireType | 0]++; });

var report = {
  tip: 'fleet-fidelity-trap-first',
  credit: 'Jorge Guerra',
  elapsedSec: +((Date.now() - t0) / 1000).toFixed(1),
  knobs: ['tireType', 'launchRpm'],
  neverTouch: ['dragCoefficient', 'frontalAreaSqFt', 'weightLbs', 'peakHp', 'gearRatios', 'finalDriveRatio', 'torqueCurve'],
  demotedSlicks: demoted.length,
  demoted: demoted,
  reseatedToFactory: reseated.length,
  reseated: reseated.slice(0, 80),
  locked: locked,
  applied: applied.length,
  unchanged: unchanged.length,
  parked: parked,
  slickResidual: slickResidual,
  tireHistAfter: hist,
  sampleApplied: applied.slice(0, 30)
};
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
log(JSON.stringify({
  demotedSlicks: demoted.length,
  reseatedToFactory: reseated.length,
  applied: applied.length,
  unchanged: unchanged.length,
  parked: parked.length,
  slickResidual: slickResidual.length,
  tireHistAfter: hist,
  elapsedSec: report.elapsedSec
}, null, 2));
