/**
 * Tip: park flagged-17 unsourced cars OUT of public garage + diesel powerband realism.
 * Jorge hard rule: anything that can't reach a realistic stage stays out of public garage.
 * Diesel: OEM-character redline / peak TQ / peak HP RPM + dense 100-RPM mesh.
 * forceScale=1. No Cd / weight / frontalArea edits. Knobs OK after curve/redline.
 * Credit: Jorge Guerra. Author: Sati (env-only).
 *
 *   node scripts/park-unsourced-diesel-bands.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var META_PATH = path.join(__dirname, 'garage-calib-meta.json');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var PARKED_PATH = path.join(__dirname, '..', 'js', 'garage-parked-unsourced.json');
var OUT_REPORT = path.join(__dirname, 'park-unsourced-diesel-bands-report.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };

/** Exact names from Phase 7b FLAGGED UNSOURCED — must match garage `name` fields. */
var PARK_NAMES = [
  '2015 Koenigsegg One:1',
  '2011 Koenigsegg Agera R',
  '2014 Koenigsegg Agera S',
  '2010 Pagani Zonda R',
  '2012 Pagani Huayra',
  '2017 Pagani Huayra BC',
  '2019 Pagani Huayra Roadster BC',
  '2010 Gumpert Apollo Sport',
  '2018 Zenvo TSR-S',
  '1995 Nissan Silvia S14',
  '1991 Nissan 240SX (S13)',
  '1994 Nissan 180SX Type X',
  '1992 Nissan Pulsar GTI-R',
  '1990 Nissan 300ZX NA',
  '1998 Toyota Celica GT-Four',
  '1991 Toyota Soarer GT-T',
  '1997 Toyota Chaser Tourer V'
];

/**
 * Diesel OEM-character bands.
 * 2019 F-250 6.7 PowerStroke: SAE 450 @ 2800 / 935 @ 1800; redline ~4000 class.
 */
var DIESEL_SPEC = {
  '2019 Ford F-250 6.7 PowerStroke': {
    redline: 4000,
    shiftRpm: 3600,
    peakTqRpm: 1800,
    peakHpRpm: 2800,
    // keep peakHp label OEM (450) — do not wipe
    note: 'OEM SAE 450hp@2800 / 935lb-ft@1800; redline ~4000 class (was gas-like 6800/6120)'
  }
};

var DIESEL_DETECT = /diesel|powerstroke|duramax|cummins|\btdi\b|\bcdi\b|tdci|ecodiesel|bluetec|common.?rail|\bhdi\b|\bdci\b|crdi|td5|oil.?burner/i;

function clone(o) { return JSON.parse(JSON.stringify(o)); }


function densify(curve, redline) {
  var keys = Object.keys(curve).map(Number).filter(isFinite).sort(function (a, b) { return a - b; });
  var out = {}, prev = null;
  var start = Math.max(500, Math.floor(keys[0] / 100) * 100);
  for (var r = start; r <= redline + 0.01; r += 100) {
    var rpm = Math.round(r);
    var tq = Phys.getTorqueAtRpm(curve, rpm);
    if (!isFinite(tq) || tq <= 0) tq = prev != null ? prev : 5;
    out[rpm] = tq;
    prev = tq;
  }
  keys.forEach(function (k) {
    if (k % 100 === 0) return;
    var t = Number(curve[k]);
    if (isFinite(t) && t > 0) out[k] = t;
  });
  // Pin declared peaks
  return out;
}

function curvePeaks(curve) {
  var keys = Object.keys(curve).map(Number).filter(isFinite);
  var maxT = 0, maxTr = 0, maxH = 0, maxHr = 0;
  keys.forEach(function (k) {
    var t = Number(curve[k]);
    if (!isFinite(t)) return;
    var h = (t * k) / 5252;
    if (t > maxT) { maxT = t; maxTr = k; }
    if (h > maxH) { maxH = h; maxHr = k; }
  });
  return { peakTq: maxT, peakTqRpm: maxTr, peakHp: maxH, peakHpRpm: maxHr };
}

function runSim(car) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windMph: 0, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launch: 'auto', launchMode: 'auto', tireType: car.tireType | 0,
    driverWeightLbs: 200, quickMetrics: false, needSixtyToOneThirty: true
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
  var sim = runSim(car);
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
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 1600;
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire, launchRpm: baseLaunch
  }, null);

  [0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35].forEach(function (loss) {
    best = trial(car, tgt, {
      loss: loss, tireType: seedTire, launchRpm: baseLaunch
    }, best);
  });
  var lc = best.knobs.loss;
  [-2, -1, -0.5, 0.5, 1, 2].forEach(function (d) {
    best = trial(car, tgt, {
      loss: Math.max(0, Math.min(35, +(lc + d).toFixed(1))),
      tireType: best.knobs.tireType, launchRpm: baseLaunch
    }, best);
  });
  [0, 1, 3, 4, 2].forEach(function (tire) {
    if (tire === best.knobs.tireType) return;
    best = trial(car, tgt, {
      loss: best.knobs.loss, tireType: tire, launchRpm: baseLaunch
    }, best);
  });
  if (!best.hits.z60 || !best.hits.et || !best.hits.trap) {
    // Diesel launch band: keep low (idle–~2200)
    [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400].forEach(function (launch) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: launch
      }, best);
    });
  }
  return best;
}

function isDieselCandidate(car) {
  if (DIESEL_SPEC[car.name]) return true;
  var blob = [car.name, car.id, car.category, car.source, car.txFactoryLabel].join(' ');
  return DIESEL_DETECT.test(blob);
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (park unsourced + diesel bands).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph + EV_Single / Tesla / Taycan / KDD presets.',
    ' * Real-TX Phase 7b: blank unsure TX names retained; gearRatios/FD period-OEM where sourced.',
    ' * Park tip: flagged-17 unsourced cars removed from public VB_POWERCURVE_GARAGE',
    ' *   (archive: js/garage-parked-unsourced.json — NOT loaded by app).',
    ' * Diesel tip: OEM-character redline/peakTQ/peakHP RPM + dense 100-RPM mesh; forceScale=1.',
    ' * Standing rule: future unsourced / unrealistic cars stay OUT of public garage.',
    ' * Rebuild: node scripts/park-unsourced-diesel-bands.js',
    ' * Credit: Jorge Guerra',
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
  var meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  var tgtByName = {};
  (meta.results || []).forEach(function (r) {
    if (r && r.name && r.tgt) tgtByName[r.name] = r.tgt;
  });

  var parkSet = {};
  PARK_NAMES.forEach(function (n) { parkSet[n] = true; });

  // --- A) Park flagged-17 ---
  var parked = [];
  var missing = [];
  PARK_NAMES.forEach(function (n) {
    var car = GARAGE.find(function (c) { return c.name === n; });
    if (!car) missing.push(n);
    else parked.push(clone(car));
  });
  if (missing.length) throw new Error('Park names missing from garage: ' + missing.join(' | '));
  if (parked.length !== 17) throw new Error('Expected 17 parked, got ' + parked.length);

  var publicCars = GARAGE.filter(function (c) { return !parkSet[c.name]; }).map(clone);
  console.log('Parked', parked.length, '→ public fleet', publicCars.length, '(was', GARAGE.length + ')');

  // Archive (NOT loaded by app)
  fs.writeFileSync(PARKED_PATH, JSON.stringify({
    tip: 'garage-park-unsourced-diesel-bands',
    rule: 'Jorge hard rule: unsourced / unrealistic stage cars stay OUT of public VB_POWERCURVE_GARAGE. This archive is NOT loaded by the app.',
    parkedAt: new Date().toISOString(),
    count: parked.length,
    names: parked.map(function (c) { return c.name; }),
    cars: parked
  }, null, 2));

  // --- B) Diesel audit + reshape ---
  var dieselHits = publicCars.filter(isDieselCandidate);
  console.log('Diesel candidates after park:', dieselHits.map(function (c) { return c.name; }).join(' | ') || '(none)');

  var dieselReport = [];
  dieselHits.forEach(function (car) {
    var spec = DIESEL_SPEC[car.name];
    if (!spec) {
      dieselReport.push({
        name: car.name,
        action: 'FLAG_MISCLASS_OR_UNKNOWN',
        before: { redline: car.redline, shiftRpm: car.shiftRpm, peakTqRpm: car.peakTqRpm, peakHpRpm: car.peakHpRpm, peakHp: car.peakHp },
        note: 'Matched diesel detect regex but no OEM band table — left untouched; classify in VERIFY'
      });
      return;
    }

    var before = {
      redline: car.redline,
      shiftRpm: car.shiftRpm,
      peakTqRpm: car.peakTqRpm,
      peakHpRpm: car.peakHpRpm,
      peakHp: car.peakHp,
      launchRpm: car.launchRpm,
      loss: car.drivetrainLossPercent,
      tireType: car.tireType,
      forceScale: car.forceScale,
      curvePeak: curvePeaks(car.torqueCurve)
    };

    // Preserve Cd / weight / frontalArea / peakHp label
    var peakHpKeep = car.peakHp;
    car.redline = spec.redline;
    car.shiftRpm = spec.shiftRpm;
    car.peakTqRpm = spec.peakTqRpm;
    car.peakHpRpm = spec.peakHpRpm;
    car.peakHp = peakHpKeep; // do not wipe
    car.forceScale = 1;
    // Diesel-ish default launch before knobs search
    if (car.launchRpm == null || car.launchRpm > 2200) car.launchRpm = 1600;

    // synthesizeTorqueCurve + densify (same as bike tip). OEM pins on car fields;
    // mild synth HP overshoot past peakHpRpm is inherent — Peak HP label kept OEM.
    var sparse = Phys.synthesizeTorqueCurve(car.peakHp, car.peakTqRpm, car.redline, car.peakHpRpm);
    car.torqueCurve = densify(sparse, car.redline);

    var tgt = tgtByName[car.name] || { z60: 7.2, et: 15.6, trap: 89 };
    var beforeSim = null;
    try { beforeSim = runSim(Object.assign(clone(car), {
      // approximate before with old knobs but new curve already applied — skip
    })); } catch (e) { /* ignore */ }

    var cal = calibrateLossLaunchTire(car, tgt);
    car.drivetrainLossPercent = cal.knobs.loss;
    car.tireType = cal.knobs.tireType;
    car.launchRpm = cal.knobs.launchRpm;
    car.forceScale = 1;

    var after = {
      redline: car.redline,
      shiftRpm: car.shiftRpm,
      peakTqRpm: car.peakTqRpm,
      peakHpRpm: car.peakHpRpm,
      peakHp: car.peakHp,
      launchRpm: car.launchRpm,
      loss: car.drivetrainLossPercent,
      tireType: car.tireType,
      forceScale: car.forceScale,
      curvePeak: curvePeaks(car.torqueCurve)
    };

    dieselReport.push({
      name: car.name,
      action: 'RESHAPE',
      note: spec.note,
      before: before,
      after: after,
      tgt: tgt,
      sim: cal.sim,
      hits: cal.hits,
      knobs: cal.knobs
    });

    console.log('DIESEL', car.name,
      'RL', before.redline, '→', after.redline,
      'pTq', before.peakTqRpm, '→', after.peakTqRpm,
      'pHp', before.peakHpRpm, '→', after.peakHpRpm,
      'peakHp label', after.peakHp,
      'sim ET', cal.sim.et != null ? cal.sim.et.toFixed(3) : '—',
      'trap', cal.sim.trap != null ? cal.sim.trap.toFixed(1) : '—',
      'loss', cal.knobs.loss, 'launch', cal.knobs.launchRpm);
  });

  // Locks
  var fsBad = publicCars.filter(function (c) { return +c.forceScale !== 1; });
  if (fsBad.length) throw new Error('forceScale≠1: ' + fsBad.map(function (c) { return c.name; }).join(', '));

  // Sanity: parked not in public; diesel public present
  PARK_NAMES.forEach(function (n) {
    if (publicCars.some(function (c) { return c.name === n; })) throw new Error('Parked still public: ' + n);
  });
  if (!publicCars.some(function (c) { return c.name === '2019 Ford F-250 6.7 PowerStroke'; })) {
    throw new Error('F-250 PowerStroke missing from public garage');
  }
  var f250 = publicCars.find(function (c) { return c.name === '2019 Ford F-250 6.7 PowerStroke'; });
  if (f250.redline > 4500 || f250.peakHpRpm > 3500) throw new Error('F-250 still gas-like band');
  if (+f250.forceScale !== 1) throw new Error('F-250 forceScale');
  if (f250.peakHp !== 450) throw new Error('F-250 Peak HP wiped');

  // Phase heroes intact
  var cyber = publicCars.find(function (c) { return c.name === '2024 Tesla Cybertruck Tri-Motor'; });
  if (!cyber || Math.abs(+cyber.finalDriveRatio - 15.02) > 0.01) throw new Error('Cybertruck FD broken');
  var zl1 = publicCars.find(function (c) { return c.name === '2012 Chevrolet Camaro ZL1'; });
  if (!zl1 || zl1.txKey !== 'TR6060_6') throw new Error('ZL1 TR6060 broken');

  writeGarage(publicCars);

  // Meta: drop parked from results; annotate diesel; standing rule note
  var newResults = (meta.results || []).filter(function (r) { return !parkSet[r.name]; });
  // Refresh F-250 result row
  var f250Row = dieselReport.find(function (d) { return d.action === 'RESHAPE' && d.name === '2019 Ford F-250 6.7 PowerStroke'; });
  if (f250Row) {
    var existing = newResults.find(function (r) { return r.name === f250Row.name; });
    var row = {
      name: f250Row.name,
      gi: publicCars.findIndex(function (c) { return c.name === f250Row.name; }),
      tgt: f250Row.tgt,
      sim: {
        et: f250Row.sim.et != null ? +f250Row.sim.et.toFixed(3) : null,
        trap: f250Row.sim.trap != null ? +f250Row.sim.trap.toFixed(1) : null,
        z60: f250Row.sim.z60 != null ? +f250Row.sim.z60.toFixed(3) : null,
        z60130: f250Row.sim.z60130 != null ? +f250Row.sim.z60130.toFixed(3) : null,
        vmax: f250Row.sim.vmax != null ? +f250Row.sim.vmax.toFixed(1) : null
      },
      hits: f250Row.hits,
      knobs: { loss: f250Row.knobs.loss, tire: f250Row.knobs.tireType, launch: f250Row.knobs.launchRpm },
      txKey: f250.txKey,
      nG: (f250.gearRatios || []).length,
      fd: f250.finalDriveRatio,
      blank: f250.txFactoryLabel === '',
      dieselBand: {
        redline: f250.redline, shiftRpm: f250.shiftRpm,
        peakTqRpm: f250.peakTqRpm, peakHpRpm: f250.peakHpRpm
      }
    };
    if (existing) {
      Object.keys(row).forEach(function (k) { existing[k] = row[k]; });
    } else {
      newResults.push(row);
    }
  }

  var metaOut = {
    tip: 'garage-park-unsourced-diesel-bands',
    baseTip: meta.tip || 'real-tx-phase7b-honest-ratios',
    tol: TOL,
    fleetPublic: publicCars.length,
    parkedN: parked.length,
    parkedNames: PARK_NAMES.slice(),
    parkedArchive: 'js/garage-parked-unsourced.json',
    dieselReshaped: dieselReport.filter(function (d) { return d.action === 'RESHAPE'; }).map(function (d) {
      return {
        name: d.name,
        before: { redline: d.before.redline, peakTqRpm: d.before.peakTqRpm, peakHpRpm: d.before.peakHpRpm },
        after: { redline: d.after.redline, peakTqRpm: d.after.peakTqRpm, peakHpRpm: d.after.peakHpRpm },
        knobs: d.knobs, sim: rowSim(d), hits: d.hits
      };
    }),
    standingRule: 'Future unsourced / unrealistic cars stay OUT of public VB_POWERCURVE_GARAGE. Park to js/garage-parked-unsourced.json (or successor archive) — do not invent gears/FD/stage data.',
    note: 'Park flagged-17 unsourced from Phase7b out of public garage; diesel OEM-character bands (F-250 6.7 PS); forceScale=1; no Cd/wt/frontalArea; knobs loss/tire/launch after diesel reshape; Peak HP labels kept; credit Jorge Guerra',
    priorStats: meta.stats || null,
    results: newResults,
    flaggedUnsourcedParked: (meta.flaggedUnsourced || PARK_NAMES.map(function (n) { return { name: n }; }))
  };
  function rowSim(d) {
    return {
      et: d.sim.et != null ? +d.sim.et.toFixed(3) : null,
      trap: d.sim.trap != null ? +d.sim.trap.toFixed(1) : null,
      z60: d.sim.z60 != null ? +d.sim.z60.toFixed(3) : null
    };
  }

  fs.writeFileSync(META_PATH, JSON.stringify(metaOut, null, 2));
  fs.writeFileSync(OUT_REPORT, JSON.stringify({
    tip: 'garage-park-unsourced-diesel-bands',
    elapsedMs: Date.now() - t0,
    parkedNames: PARK_NAMES,
    parkedN: parked.length,
    publicN: publicCars.length,
    dieselReport: dieselReport,
    fsBad: fsBad.length
  }, null, 2));

  console.log('Wrote', OUT_JS);
  console.log('Wrote', PARKED_PATH);
  console.log('Wrote', META_PATH);
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

main();
