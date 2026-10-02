/**
 * Tip review/ev-excel-full-match — EV 100% Corrected Excel after tire µ retune.
 * Priority trap→ET→60-130→0-60→60ft. forceScale=1. Jorge Guerra only.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'ev-excel-full-match-report.json');
var TOL = { trap: 0.5, et: 0.05, z60130: 0.05, z60: 0.05, ft60: 0.05 };
var WX = { tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto' };

var OEM_TIRE = {
  '2024-tesla-cybertruck-tri-motor': 3, '2024-rivian-r1s-quad-motor': 3, '2021-rimac-nevera': 4,
  '2024-lucid-air-touring': 3, '2024-tesla-model-s-long-range': 3, '2024-tesla-model-x-long-range': 3,
  '2024-chevrolet-blazer-ev-ss': 4, '2024-fisker-ocean-extreme': 3, '2023-mercedes-eqs-580-suv': 3,
  '2023-bmw-i7-xdrive60': 3, '2024-cadillac-lyriq-awd': 3, '2024-volvo-ex90-twin-motor': 3,
  '2024-hyundai-ioniq-6-awd': 3, '2023-nissan-ariya-e-4orce': 3, '2024-volvo-xc40-recharge': 3,
  '2023-audi-q4-e-tron': 3, '2022-mercedes-eqb-350': 3, '2023-vw-id-4-awd-pro': 3,
  '2024-mercedes-eqs-450': 3, '2024-subaru-solterra': 3, '2023-toyota-bz4x-awd': 3
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function tgtMap() { var m = {}; TARGETS.forEach(function (t) { m[t.name] = t; }); return m; }

function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-9) return curve;
  var out = {}; Object.keys(curve).forEach(function (k) { out[k] = Math.round(curve[k] * s * 10000) / 10000; });
  return out;
}
function applyPower(car, newHp) {
  var old = Number(car.peakHp) || 1; var s = newHp / old;
  car.peakHp = Math.round(newHp); if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, s);
}
function runSim(car, need613) {
  var env = Object.assign({}, WX, {
    tireType: car.tireType | 0, needSixtyToOneThirty: !!need613,
    tireLabel: Phys.tireLabelForType(car.tireType | 0)
  });
  var r = Phys.runQuarterMile(car, env);
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty).toFixed(3) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime).toFixed(3) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph).toFixed(2) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty).toFixed(3) : null,
    ft60: r.sixtyFootTime != null ? +Number(r.sixtyFootTime).toFixed(3) : null
  };
}
function hit(sim, tgt, k) {
  if (tgt[k] == null || sim[k] == null) return null;
  return Math.abs(sim[k] - tgt[k]) <= TOL[k];
}
function missVec(sim, tgt) {
  function m(k, sc) {
    if (tgt[k] == null || sim[k] == null) return 0;
    var d = Math.abs(sim[k] - tgt[k]); return d <= TOL[k] ? 0 : (d - TOL[k]) * sc;
  }
  return [m('trap', 10), m('et', 20), m('z60130', 15), m('z60', 12), m('ft60', 10)];
}
function better(a, b) {
  for (var i = 0; i < a.length; i++) { if (a[i] < b[i] - 1e-9) return true; if (a[i] > b[i] + 1e-9) return false; }
  return false;
}
function allHit(sim, tgt) {
  return ['trap', 'et', 'z60130', 'z60', 'ft60'].every(function (k) { return hit(sim, tgt, k) !== false; });
}

function makeCar(base, hp, tire, drive, mu, drag, wt, lim) {
  var c = clone(base);
  c.weightLbs = wt; c.tireType = tire; c.dragCoefficient = drag;
  c.evLaunchDriveMult = +Number(drive).toFixed(3);
  c.evLaunchMuMult = +Number(mu).toFixed(3);
  if (lim != null && lim > 0) c.speedLimiterMph = Math.round(lim * 10) / 10;
  applyPower(c, hp); c.forceScale = 1;
  return c;
}

function searchCar(base, tgt) {
  var need613 = tgt.z60130 != null;
  var cardHp = tgt.excelHp != null ? Number(tgt.excelHp) : Number(base.peakHp);
  var excelWt = tgt.excelWt != null ? Number(tgt.excelWt) : Number(base.weightLbs);
  var baseDrag = Number(base.dragCoefficient) || 0.28;
  var drive0 = base.driveType === 'AWD' ? 1.10 : 1.05;
  var mu0 = base.driveType === 'AWD' ? 1.06 : 1.03;
  var tires = [base.tireType | 0];
  if (OEM_TIRE[base.id] != null && OEM_TIRE[base.id] !== tires[0]) tires.push(OEM_TIRE[base.id]);
  if ((base.tireType | 0) === 0 && base.driveType === 'AWD') tires.push(3);
  tires = Array.from(new Set(tires));

  var hpLo = Math.max(80, Math.round(cardHp * 0.55));
  var hpHi = Math.max(Math.round(cardHp * 2.0), Math.round(Number(base.peakHp) * 1.2), cardHp + 350);
  var best = null;

  var baseLim = Number(base.speedLimiterMph) || 0;
  function consider(hp, tire, drive, mu, drag, lim) {
    hp = clamp(Math.round(hp), hpLo, hpHi);
    drive = clamp(drive, 0.70, 1.45); mu = clamp(mu, 0.85, 1.25);
    if (lim == null) lim = baseLim;
    var c = makeCar(base, hp, tire, drive, mu, drag, excelWt, lim);
    var sim = runSim(c, need613);
    var mv = missVec(sim, tgt);
    var cfg = { hp: hp, tire: tire, drive: drive, mu: mu, drag: drag, lim: lim, sim: sim, miss: mv, car: c };
    if (!best || better(mv, best.miss)) best = cfg;
    return cfg;
  }

  for (var ti = 0; ti < tires.length; ti++) {
    var tire = tires[ti];
    var hp = clamp(Math.max(cardHp, Number(base.peakHp)), hpLo, hpHi);
    // restore crushed cars toward card
    if (Number(base.peakHp) < cardHp * 0.85) hp = cardHp;
    var drive = drive0, mu = mu0, drag = baseDrag;
    consider(hp, tire, drive, mu, drag);
    consider(cardHp, tire, drive, mu, drag);

    // Binary trap HP
    if (tgt.trap != null) {
      var lo = hpLo, hi = hpHi;
      for (var it = 0; it < 12; it++) {
        var mid = Math.round((lo + hi) / 2);
        var r = consider(mid, tire, drive, mu, drag);
        if (r.sim.trap == null) break;
        if (r.sim.trap < tgt.trap) lo = mid + 1; else hi = mid - 1;
      }
      hp = best && best.tire === tire ? best.hp : Math.round((lo + hi) / 2);
    }

    for (var round = 0; round < 8; round++) {
      var cur = consider(hp, tire, drive, mu, drag);
      var sim = cur.sim;
      if (tgt.trap != null && sim.trap != null && !hit(sim, tgt, 'trap')) {
        var ratio = tgt.trap / Math.max(1, sim.trap);
        hp = clamp(Math.round(hp * (0.5 * Math.pow(ratio, 3) + 0.5 * Math.pow(ratio, 1.5))), hpLo, hpHi);
        cur = consider(hp, tire, drive, mu, drag); sim = cur.sim;
      }
      if (tgt.z60 != null && sim.z60 != null && !hit(sim, tgt, 'z60')) {
        var zr = sim.z60 / tgt.z60;
        if (zr > 1.01) { drive = clamp(drive * (1 + Math.min(0.07, (zr - 1) * 0.4)), 0.7, 1.45); mu = clamp(mu * (1 + Math.min(0.05, (zr - 1) * 0.25)), 0.85, 1.25); }
        else if (zr < 0.99) { drive = clamp(drive * (1 - Math.min(0.05, (1 - zr) * 0.35)), 0.7, 1.45); mu = clamp(mu * (1 - Math.min(0.04, (1 - zr) * 0.2)), 0.85, 1.25); }
        cur = consider(hp, tire, drive, mu, drag); sim = cur.sim;
      }
      if (tgt.et != null && sim.et != null && !hit(sim, tgt, 'et')) {
        var er = sim.et / tgt.et;
        if (er > 1.002) { hp = clamp(Math.round(hp * Math.pow(er, 1.4)), hpLo, hpHi); drive = clamp(drive * (1 + Math.min(0.04, (er - 1) * 0.5)), 0.7, 1.45); }
        else if (er < 0.998) { hp = clamp(Math.round(hp * Math.pow(er, 1.2)), hpLo, hpHi); drive = clamp(drive * (1 - Math.min(0.03, (1 - er) * 0.4)), 0.7, 1.45); }
        cur = consider(hp, tire, drive, mu, drag); sim = cur.sim;
      }
      if (need613 && tgt.z60130 != null && sim.z60130 != null && !hit(sim, tgt, 'z60130')) {
        var sr = sim.z60130 / tgt.z60130;
        if (sr > 1.002) { hp = clamp(Math.round(hp * Math.min(1.05, Math.pow(sr, 1.15))), hpLo, hpHi); drag = clamp(drag * 0.985, baseDrag * 0.9, baseDrag * 1.14); }
        else if (sr < 0.998) {
          drag = clamp(drag * Math.min(1.06, 1 / Math.pow(Math.max(0.85, sr), 0.7)), baseDrag * 0.9, baseDrag * 1.14);
          if (tgt.trap != null && sim.trap > tgt.trap + TOL.trap) hp = clamp(Math.round(hp * 0.99), hpLo, hpHi);
        }
        cur = consider(hp, tire, drive, mu, drag); sim = cur.sim;
      }
      if (tgt.trap != null && sim.trap != null && !hit(sim, tgt, 'trap')) {
        var r2 = tgt.trap / Math.max(1, sim.trap);
        hp = clamp(Math.round(hp * (0.5 * Math.pow(r2, 3) + 0.5 * Math.pow(r2, 1.5))), hpLo, hpHi);
        consider(hp, tire, drive, mu, drag);
      }
      if (best && allHit(best.sim, tgt)) break;
      // abandon hopeless 60130
      if (best && hit(best.sim, tgt, 'trap') !== false && hit(best.sim, tgt, 'et') !== false &&
          hit(best.sim, tgt, 'z60') !== false && need613 && best.sim.z60130 != null &&
          Math.abs(best.sim.z60130 - tgt.z60130) > 0.55) break;
    }
    // lean fine
    if (best && best.tire === tire && !allHit(best.sim, tgt)) {
      var bh = best.hp, bd = best.drive, bm = best.mu, bg = best.drag;
      for (var dh = -4; dh <= 4; dh++) {
        consider(bh + dh, tire, bd, bm, bg);
        consider(bh + dh, tire, bd + 0.03, bm + 0.02, bg);
        consider(bh + dh, tire, bd - 0.03, bm - 0.02, bg);
      }
      for (var dg = -0.03; dg <= 0.03; dg += 0.015) {
        consider(bh, tire, bd, bm, +(bg * (1 + dg)).toFixed(4));
      }
    }
    if (best && allHit(best.sim, tgt)) break;
  }

  // Lean limiter/aero directed pass for trap↔60130 / trap↔launch conflicts
  if (best && !allHit(best.sim, tgt) && tgt.trap != null) {
    var lim = tgt.trap + 0.4;
    var hp = Math.max(best.hp, Math.round(cardHp * 1.05));
    var drive = best.drive, mu = best.mu, drag = best.drag, tire = best.tire;
    for (var r = 0; r < 12; r++) {
      var cur = consider(hp, tire, drive, mu, drag, lim);
      var sim = cur.sim;
      if (need613 && tgt.z60130 != null && sim.z60130 != null && !hit(sim, tgt, 'z60130')) {
        var sr = sim.z60130 / tgt.z60130;
        if (sr > 1.002) { hp = clamp(Math.round(hp * Math.min(1.08, Math.pow(sr, 1.3))), hpLo, hpHi); drag = clamp(drag * 0.97, baseDrag * 0.85, baseDrag * 1.15); }
        else { drag = clamp(drag * 1.04, baseDrag * 0.85, baseDrag * 1.18); }
      }
      if (tgt.z60 != null && sim.z60 != null && !hit(sim, tgt, 'z60')) {
        var zr = sim.z60 / tgt.z60;
        if (zr > 1.01) { drive = clamp(drive * 1.05, 0.7, 1.45); mu = clamp(mu * 1.03, 0.85, 1.25); }
        else { drive = clamp(drive * 0.97, 0.7, 1.45); }
      }
      if (tgt.et != null && sim.et != null && !hit(sim, tgt, 'et')) {
        var er = sim.et / tgt.et;
        if (er > 1.002) { hp = clamp(Math.round(hp * Math.pow(er, 1.35)), hpLo, hpHi); drive = clamp(drive * 1.03, 0.7, 1.45); }
        else { hp = clamp(Math.round(hp * Math.pow(er, 1.15)), hpLo, hpHi); }
      }
      // trap should be near lim; if under, raise lim slightly or HP
      if (sim.trap != null && !hit(sim, tgt, 'trap')) {
        if (sim.trap < tgt.trap - TOL.trap) { lim = Math.max(lim, tgt.trap + 0.5); hp = clamp(Math.round(hp * 1.03), hpLo, hpHi); }
        else { lim = tgt.trap + 0.2; }
      }
      if (best && allHit(best.sim, tgt)) break;
    }
    // small fine around best
    if (best && !allHit(best.sim, tgt)) {
      for (var dh = -10; dh <= 10; dh += 2) {
        consider(best.hp + dh, best.tire, best.drive, best.mu, best.drag, best.lim);
        consider(best.hp + dh, best.tire, clamp(best.drive + 0.04, 0.7, 1.45), clamp(best.mu + 0.03, 0.85, 1.25), best.drag, best.lim || lim);
      }
    }
  }

  if (!best) return null;
  var car = best.car;
  var overOem = cardHp > 0 ? +(((car.peakHp / cardHp) - 1) * 100).toFixed(1) : null;
  var impossible = !allHit(best.sim, tgt);
  var flags = [];
  if (impossible) {
    var parts = [];
    ['trap', 'et', 'z60130', 'z60', 'ft60'].forEach(function (k) {
      if (hit(best.sim, tgt, k) === false)
        parts.push(k + ' sim=' + best.sim[k] + ' excel=' + tgt[k] + ' d=' + (best.sim[k] - tgt[k]).toFixed(3));
    });
    flags.push('REMAINING_MISS: ' + parts.join('; '));
    if (tgt.trap != null && tgt.z60130 != null && hit(best.sim, tgt, 'trap') && hit(best.sim, tgt, 'et') && !hit(best.sim, tgt, 'z60130'))
      flags.push('POSSIBLE_TRAP_ET_VS_60130_TENSION');
    if (tgt.trap != null && tgt.et != null && hit(best.sim, tgt, 'trap') && !hit(best.sim, tgt, 'et'))
      flags.push('POSSIBLE_TRAP_ET_TENSION');
    if (tgt.trap != null && tgt.z60 != null && hit(best.sim, tgt, 'trap') && !hit(best.sim, tgt, 'z60'))
      flags.push('POSSIBLE_TRAP_060_TENSION');
  }
  if (overOem != null && overOem > 15) flags.push('OVER_OEM_HP: ' + cardHp + '→' + car.peakHp + ' (+' + overOem + '%)');
  return {
    name: base.name, id: base.id, drive: base.driveType, cardHp: cardHp,
    before: { hp: base.peakHp, wt: base.weightLbs, tire: base.tireType, drag: base.dragCoefficient },
    after: { hp: car.peakHp, wt: car.weightLbs, tire: car.tireType, drag: car.dragCoefficient,
      launchDrive: car.evLaunchDriveMult, launchMu: car.evLaunchMuMult,
      lim: car.speedLimiterMph,
      dragScale: +(car.dragCoefficient / baseDrag).toFixed(4) },
    excel: { z60: tgt.z60, et: tgt.et, trap: tgt.trap, z60130: tgt.z60130, ft60: tgt.ft60, excelHp: tgt.excelHp, excelWt: excelWt },
    afterSim: best.sim,
    hits: { trap: hit(best.sim, tgt, 'trap'), et: hit(best.sim, tgt, 'et'), z60130: hit(best.sim, tgt, 'z60130'), z60: hit(best.sim, tgt, 'z60'), ft60: hit(best.sim, tgt, 'ft60') },
    wtChanged: Number(base.weightLbs) !== Number(car.weightLbs),
    dragChanged: Math.abs((Number(base.dragCoefficient) || baseDrag) - car.dragCoefficient) > 0.0008,
    tireChanged: (base.tireType | 0) !== (car.tireType | 0),
    overOemPct: overOem, impossible: impossible, flags: flags, car: car
  };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — static garage data (baked).',
    ' * Tip review/ev-excel-full-match: tire µ retune + ALL EVs → Corrected Excel 100%.',
    ' * forceScale=1. Credit: Jorge Guerra only. scripts/recalib-ev-excel-full-match.js',
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
  var hitCounts = { trap: [0, 0], et: [0, 0], z60130: [0, 0], z60: [0, 0], ft60: [0, 0] };
  var changed = 0;
  cars.forEach(function (car) {
    if (!car.isEv) return;
    var tgt = targets[car.name];
    if (!tgt) { rows.push({ name: car.name, skipped: 'no_target' }); return; }
    process.stderr.write('… ' + car.name + '\n');
    var beforeSim = runSim(car, tgt.z60130 != null);
    var result = searchCar(car, tgt);
    if (!result) return;
    result.beforeSim = beforeSim;
    var b = result.car;
    car.peakHp = b.peakHp; car.torqueCurve = b.torqueCurve; car.tireType = b.tireType;
    car.weightLbs = b.weightLbs; car.dragCoefficient = b.dragCoefficient;
    car.evLaunchDriveMult = b.evLaunchDriveMult; car.evLaunchMuMult = b.evLaunchMuMult;
    if (b.speedLimiterMph != null) car.speedLimiterMph = b.speedLimiterMph;
    car.forceScale = 1;
    var note = 'EV Excel full-match (Jorge Guerra): hp ' + result.before.hp + '→' + result.after.hp +
      ' tire ' + result.before.tire + '→' + result.after.tire +
      ' launchDrv ' + result.after.launchDrive + ' launchMu ' + result.after.launchMu + ' fs=1';
    if (result.wtChanged) note += ' | WEIGHT ' + result.before.wt + '→' + result.after.wt + ' (Excel curb)';
    if (result.dragChanged) note += ' | Cd ' + result.before.drag + '→' + result.after.drag;
    if (result.flags.length) note += ' | ' + result.flags.join(' | ');
    car.source = ((car.source || '') + ' | ' + note).replace(/^\s*\|\s*/, '');
    ['trap', 'et', 'z60130', 'z60', 'ft60'].forEach(function (k) {
      if (result.hits[k] == null) return; hitCounts[k][1]++; if (result.hits[k]) hitCounts[k][0]++;
    });
    changed++;
    var rep = clone(result); delete rep.car; rows.push(rep);
    process.stderr.write('  ' + (result.impossible ? 'MISS' : 'OK') + ' hp=' + result.after.hp +
      ' T ' + result.afterSim.trap + '/' + (tgt.trap || '-') +
      ' ET ' + result.afterSim.et + '/' + (tgt.et || '-') +
      ' 613 ' + result.afterSim.z60130 + '/' + (tgt.z60130 || '-') +
      ' 60 ' + result.afterSim.z60 + '/' + (tgt.z60 || '-') + '\n');
  });
  writeGarage(cars);
  var report = {
    tip: 'review/ev-excel-full-match', credit: 'Jorge Guerra', baseSha: 'd34df6c',
    excel: '/workspace/VelocityBench_Garage_Corrected.xlsx', tol: TOL, forceScale: 1,
    tireMuRetune: JSON.parse(fs.readFileSync('/tmp/mu60-final.json', 'utf8')),
    hitRates: {
      trap: hitCounts.trap[0] + '/' + hitCounts.trap[1],
      et: hitCounts.et[0] + '/' + hitCounts.et[1],
      z60130: hitCounts.z60130[0] + '/' + hitCounts.z60130[1],
      z60: hitCounts.z60[0] + '/' + hitCounts.z60[1],
      ft60: hitCounts.ft60[0] + '/' + hitCounts.ft60[1]
    },
    changed: changed, elapsedMs: Date.now() - t0,
    weightChanges: rows.filter(function (r) { return r.wtChanged; }),
    overOem: rows.filter(function (r) { return r.overOemPct != null && r.overOemPct > 15; })
      .map(function (r) { return r.name + ' ' + r.cardHp + '→' + r.after.hp + ' (+' + r.overOemPct + '%)'; }),
    remainingMisses: rows.filter(function (r) { return r.impossible; })
      .map(function (r) { return { name: r.name, flags: r.flags, afterSim: r.afterSim, excel: r.excel, after: r.after }; }),
    unfinishedJorgeVoice: 'Jorge started a third tire/voice issue (“And if I go to…”) but was cut off — FLAG for him to finish.',
    rows: rows
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ hitRates: report.hitRates, changed: changed, elapsedMs: report.elapsedMs,
    overOem: report.overOem, missCount: report.remainingMisses.length,
    misses: report.remainingMisses.map(function (m) { return m.name; }) }, null, 2));
}
main();
