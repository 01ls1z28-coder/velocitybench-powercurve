/**
 * Combined tip review/oem-tire-ev-power-batch — EV power retune (fast).
 * NO weight. peakHp + torqueCurve scale. forceScale=1.
 * Priority: trap → ET → 60-130 → 0-60. Credit: Jorge Guerra.
 * Does NOT touch TIRE_MU_BY_PREP (µ tip layers later).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'ev-power-excel-match-report.json');
var TOL = { trap: 2.5, et: 0.25, z60130: 0.75, z60: 0.25 };
var WX = { tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto', needSixtyToOneThirty: true };

/** Performance AWD OE summer/UHP — launch benefit without rewriting µ tables. */
var OEM_TIRE_FIX = {
  '2024-tesla-cybertruck-tri-motor': 3,
  '2024-rivian-r1s-quad-motor': 3,
  '2021-rimac-nevera': 4,
  '2024-lucid-air-touring': 3,
  '2024-tesla-model-s-long-range': 3,
  '2024-tesla-model-x-long-range': 3,
  '2024-fisker-ocean-extreme': 3,
  '2023-mercedes-eqs-580-suv': 3,
  '2023-bmw-i7-xdrive60': 3,
  '2024-cadillac-lyriq-awd': 3,
  '2024-volvo-ex90-twin-motor': 3,
  '2024-hyundai-ioniq-6-awd': 3,
  '2023-nissan-ariya-e-4orce': 3,
  '2024-volvo-xc40-recharge': 3
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function tgtMap() { var m = {}; TARGETS.forEach(function (t) { m[t.name] = t; }); return m; }
function scaleCurve(curve, s) {
  if (!curve || !(s > 0)) return curve;
  var out = {};
  Object.keys(curve).forEach(function (k) { out[k] = Math.round(curve[k] * s * 1e4) / 1e4; });
  return out;
}
function applyPower(car, newHp, lockWt) {
  var old = Number(car.peakHp) || 1;
  car.peakHp = Math.round(newHp);
  if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, newHp / old);
  car.weightLbs = lockWt;
  car.forceScale = 1;
}
function runSim(car) {
  var env = Object.assign({}, WX, { tireType: car.tireType | 0, tireLabel: Phys.tireLabelForType(car.tireType | 0) });
  var r = Phys.runQuarterMile(car, env);
  return { z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph, z60130: r.sixtyToOneThirty, sixty: r.sixtyFootTime, vmax: r.topSpeedMph };
}
function score(sim, tgt) {
  function abs(a, b) { return (a == null || b == null || !isFinite(a) || !isFinite(b)) ? 0 : Math.abs(a - b); }
  function ot(a, b, tol) { var e = abs(a, b); return e <= tol ? 0 : e - tol; }
  var s = ot(sim.trap, tgt.trap, TOL.trap) * 1000 + abs(sim.trap, tgt.trap) * 10;
  s += ot(sim.et, tgt.et, TOL.et) * 200 + abs(sim.et, tgt.et) * 5;
  if (tgt.z60130 != null) s += ot(sim.z60130, tgt.z60130, TOL.z60130) * 50 + abs(sim.z60130, tgt.z60130) * 2;
  s += ot(sim.z60, tgt.z60, TOL.z60) * 20 + abs(sim.z60, tgt.z60);
  return s;
}
function hits(sim, tgt) {
  function ok(a, b, tol) { if (b == null) return null; if (a == null) return false; return Math.abs(a - b) <= tol; }
  return { trap: ok(sim.trap, tgt.trap, TOL.trap), et: ok(sim.et, tgt.et, TOL.et), z60130: tgt.z60130 != null ? ok(sim.z60130, tgt.z60130, TOL.z60130) : null, z60: ok(sim.z60, tgt.z60, TOL.z60), sixty: null };
}
function clampHp(hp, base) {
  return Math.round(Math.max(base * 0.55, Math.min(base * 1.55, Math.max(40, hp))));
}

/** 2–3 sims: estimate from trap/ET ratio, one correction. */
function searchPower(base, tgt) {
  var baseHp = Number(base.peakHp) || 300;
  var lockWt = base.weightLbs;
  var c0 = clone(base);
  var s0 = runSim(c0);
  var best = { hp: baseHp, sim: s0, score: score(s0, tgt) };

  var guess = baseHp;
  if (tgt.trap != null && s0.trap > 1) {
    var ratio = tgt.trap / s0.trap;
    guess = baseHp * (0.45 * Math.pow(ratio, 3) + 0.55 * Math.pow(ratio, 1.6));
  } else if (tgt.et != null && s0.et > 1) {
    guess = baseHp * Math.pow(s0.et / tgt.et, 2.0);
  }
  guess = clampHp(guess, baseHp);

  function tryHp(hp) {
    var c = clone(base);
    applyPower(c, hp, lockWt);
    var sim = runSim(c);
    var sc = score(sim, tgt);
    if (sc < best.score) best = { hp: Math.round(hp), sim: sim, score: sc };
    return { hp: Math.round(hp), sim: sim, score: sc };
  }

  var r1 = tryHp(guess);
  // One correction toward trap (priority #1)
  if (tgt.trap != null && Math.abs(r1.sim.trap - tgt.trap) > TOL.trap) {
    var r2scale = tgt.trap / Math.max(1, r1.sim.trap);
    var hp2 = clampHp(r1.hp * (0.5 * Math.pow(r2scale, 3) + 0.5 * Math.pow(r2scale, 1.5)), baseHp);
    if (Math.abs(hp2 - r1.hp) >= 2) tryHp(hp2);
  } else if (tgt.et != null && Math.abs(r1.sim.et - tgt.et) > TOL.et) {
    var hpE = clampHp(r1.hp * Math.pow(r1.sim.et / tgt.et, 1.8), baseHp);
    if (Math.abs(hpE - r1.hp) >= 2) tryHp(hpE);
  }
  return best;
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — static garage data (baked).',
    ' * Combined tip oem-tire-ev-power-batch: EV peakHp/curve scale (NO weight) + OEM tire.',
    ' * Mustang GT 10AT all-season from tire half (6464c65). EV AWD/TC in physics.js.',
    ' * Does NOT rewrite TIRE_MU_BY_PREP. Credit: Jorge Guerra only.',
    ' * Generated by scripts/recalib-ev-power-excel-match.js',
    ' */',
    '(function (global) {',
    '  var GARAGE = '
  ].join('\n');
  var footer = ';\n  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n  if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n  }\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n';
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) + footer);
}

function main() {
  var t0 = Date.now();
  var targets = tgtMap();
  var cars = clone(GARAGE);
  var rows = [];
  var changed = 0;

  cars.forEach(function (car) {
    if (!car.isEv) return;
    var tgt = targets[car.name];
    if (!tgt || (tgt.et == null && tgt.trap == null && tgt.z60 == null)) {
      rows.push({ name: car.name, id: car.id, drive: car.driveType, skipped: 'no_excel_target', beforeHp: car.peakHp, afterHp: car.peakHp, weightLbs: car.weightLbs });
      return;
    }
    var before = clone(car);
    var beforeSim = runSim(before);
    var tireNote = null;
    if (OEM_TIRE_FIX[car.id] != null && OEM_TIRE_FIX[car.id] !== car.tireType) {
      tireNote = { from: car.tireType, to: OEM_TIRE_FIX[car.id] };
      car.tireType = OEM_TIRE_FIX[car.id];
    }
    var best = searchPower(car, tgt);
    applyPower(car, best.hp, before.weightLbs);
    var afterSim = best.sim; // already at best.hp; re-run only if tire changed after search — tire applied before search
    // Ensure afterSim matches applied car (tire already set before search)
    if (Math.round(car.peakHp) !== best.hp) applyPower(car, best.hp, before.weightLbs);
    afterSim = runSim(car);

    var note = 'EV power Excel match: peakHp ' + before.peakHp + '→' + car.peakHp +
      ' (curve scale; weight locked ' + car.weightLbs + ' lb; fs=1; credit Jorge Guerra)';
    if (tireNote) note += ' | OEM tire ' + tireNote.from + '→' + tireNote.to;
    car.source = ((car.source || '') + ' | ' + note).replace(/^\s*\|\s*/, '');
    if (car.peakHp !== before.peakHp || tireNote) changed++;

    rows.push({
      name: car.name, id: car.id, drive: car.driveType || 'RWD',
      tireBefore: before.tireType, tireAfter: car.tireType, tireFix: tireNote,
      weightLbs: car.weightLbs, weightLocked: true,
      beforeHp: before.peakHp, afterHp: car.peakHp,
      hpScale: +(car.peakHp / before.peakHp).toFixed(4),
      overOem15pct: car.peakHp > before.peakHp * 1.15,
      excel: { trap: tgt.trap != null ? tgt.trap : 'N/A', et: tgt.et != null ? tgt.et : 'N/A', z60130: tgt.z60130 != null ? tgt.z60130 : 'N/A', z60: tgt.z60 != null ? tgt.z60 : 'N/A', sixty: 'N/A' },
      before: { trap: +beforeSim.trap.toFixed(2), et: +beforeSim.et.toFixed(3), z60130: beforeSim.z60130 != null ? +beforeSim.z60130.toFixed(3) : null, z60: +beforeSim.z60.toFixed(3), sixty: +beforeSim.sixty.toFixed(3) },
      after: { trap: +afterSim.trap.toFixed(2), et: +afterSim.et.toFixed(3), z60130: afterSim.z60130 != null ? +afterSim.z60130.toFixed(3) : null, z60: +afterSim.z60.toFixed(3), sixty: +afterSim.sixty.toFixed(3) },
      hits: hits(afterSim, tgt), score: +best.score.toFixed(3)
    });
    process.stdout.write('.');
  });
  process.stdout.write('\n');

  writeGarage(cars);
  var withTgt = rows.filter(function (r) { return !r.skipped; });
  function hitRate(k) {
    var n = 0, h = 0;
    withTgt.forEach(function (r) { if (r.hits[k] == null) return; n++; if (r.hits[k]) h++; });
    return h + '/' + n;
  }
  var report = {
    tip: 'review/oem-tire-ev-power-batch',
    parentTireSha: '6464c65',
    soi: 'VelocityBench_Garage_Corrected.xlsx + excel-corrected-targets.json',
    priority: ['trap', 'et', 'z60130', 'z60', 'sixty(N/A in Excel)'],
    locks: ['no weightLbs changes', 'forceScale=1', 'no TIRE_MU_BY_PREP edits', 'power=peakHp+torqueCurve scale'],
    credit: 'Jorge Guerra only',
    disclaimer: 'Compiled estimates from OEM specs + instrumented magazine tests — not lab-certified dyno/VBOX numbers.',
    secretsTracking: false,
    bakedPaths: ['js/garage-data.js', 'js/physics.js (EV AWD/TC auto-launch only)'],
    remoteDb: false,
    cacheBustPreserve: true,
    garageBind: 'window.VB_POWERCURVE_GARAGE',
    elapsedMs: Date.now() - t0,
    changed: changed,
    hitRates: { trap: hitRate('trap'), et: hitRate('et'), z60130: hitRate('z60130'), z60: hitRate('z60') },
    rows: rows.sort(function (a, b) { return a.name.localeCompare(b.name); })
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ hitRates: report.hitRates, changed: changed, elapsedMs: report.elapsedMs, overOem: withTgt.filter(function (r) { return r.overOem15pct; }).map(function (r) { return r.name + ' ' + r.beforeHp + '→' + r.afterHp; }) }, null, 2));
}
main();
