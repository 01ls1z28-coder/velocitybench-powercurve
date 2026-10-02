'use strict';
/**
 * Fast tip: Cd/FA restore from d2c50e7 onto 3f2a898 + allowed-knob retune on misses only.
 * ICE: tires/loss/power↓. EV: power± near stock. Z28 Cd=0.34 HP locked. Never touch other OEM. Jorge Guerra only.
 */
var fs = require('fs');
var path = require('path');
var { execSync, spawnSync } = require('child_process');
var Phys = require('../js/physics.js');

var SEED = 'd2c50e7';
var TIP_BASE = '3f2a898';
var JORGE_Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
var JORGE_Z28_CD = 0.34;
var CREDIT = 'Jorge Guerra only';
var PACK = require('./corrected-garage-targets-fresh.json');
var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'tip-restore-oem-allowed-recalib-report.json');
var PROG = path.join(__dirname, 'tip-restore-oem-allowed-recalib-progress.json');
var SHARD_DIR = path.join(__dirname, '_cd_fa_shards');

var NEVER_TOUCH = [
  'dragCoefficient', 'frontalAreaSqFt', 'weightLbs',
  'gearRatios', 'finalDriveRatio', 'transmission', 'txKey', 'txFactoryLabel', 'shiftTimeSeconds',
  'frontWeightPercent', 'rearWeightPercent',
  'cgHeightFeet', 'cgHeightPublished', 'cgHeightSource',
  'launchRpm', 'redline', 'peakTqRpm',
  'evLaunchDriveMult', 'evLaunchMuMult', 'evLaunchSlipTarget',
  'speedLimiterMph'
];

var MODE = process.argv[2] || 'all'; // all | shard
var SHARD_I = Number(process.argv[3] || 0);
var SHARD_N = Number(process.argv[4] || 1);

function loadGarage(rev) {
  var src = execSync('git show ' + rev + ':js/garage-data.js', { maxBuffer: 20e6, encoding: 'utf8' });
  return JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function isEv(c) { return !!(c.isEv || c.powerSource === 'ev'); }
function roundTo(v, d) {
  if (v == null || d == null) return v;
  var f = Math.pow(10, d);
  return Math.round(Number(v) * f) / f;
}
function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-9) return curve;
  var out = {};
  Object.keys(curve).forEach(function (k) { out[k] = Math.round(curve[k] * s * 10000) / 10000; });
  return out;
}
function alignPeakRpm(car) {
  var peak = 0, at = 0;
  Object.keys(car.torqueCurve || {}).forEach(function (k) {
    var hp = (Number(car.torqueCurve[k]) * Number(k)) / 5252;
    if (hp > peak) { peak = hp; at = Number(k); }
  });
  if (at > 0) car.peakHpRpm = at;
}
function applyPower(car, newHp, seedP) {
  if (!(newHp > 0)) return;
  if (seedP && seedP.peakHp > 0 && seedP.torqueCurve) {
    car.peakHp = Math.round(newHp);
    car.torqueCurve = scaleCurve(seedP.torqueCurve, newHp / seedP.peakHp);
  } else {
    var old = Number(car.peakHp) || 1;
    car.peakHp = Math.round(newHp);
    if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, newHp / old);
  }
  alignPeakRpm(car);
}
function stripCdFudgeNotes(src) {
  if (typeof src !== 'string' || !src) return src;
  var t = src;
  t = t.replace(/\s*\|\s*Cd\s*[0-9.]+→[0-9.]+/gi, '');
  t = t.replace(/\s*\|\s*Trap-first tire-prep:\s*Cd[^|]*/gi, '');
  t = t.replace(/\s*\|\s*[^|]*aero fudge[^|]*/gi, '');
  t = t.replace(/\s*\|\s*[^|]*OEM restore d2c50e7[^|]*/gi, '');
  t = t.replace(/\s*\|\s*[^|]*Cd\/FA restore d2c50e7[^|]*/gi, '');
  t = t.replace(/\s*\|\s*ICE tires\/loss\/power↓[^|]*/gi, '');
  t = t.replace(/\s*\|\s*EV power±[^|]*/gi, '');
  return t.replace(/\s*\|\s*\|/g, ' |').replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim();
}

var SIMS = 0;
function runSim(car, need613, prep) {
  SIMS++;
  var c = clone(car);
  c.forceScale = 1;
  if (!isEv(c) && Phys.sanitizeTorqueCurvePostPeak) {
    Phys.sanitizeTorqueCurvePostPeak(c.torqueCurve, c.peakHpRpm);
  }
  var r = Phys.runQuarterMile(c, {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0,
    gustMph: 0, launchMode: 'auto', trackPrep: prep || 'unprepped', driverWeightLbs: 200,
    tireType: c.tireType | 0,
    tireLabel: Phys.tireLabelForType ? Phys.tireLabelForType(c.tireType | 0) : undefined,
    needSixtyToOneThirty: !!need613
  });
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty) : null
  };
}
function exactMatch(sim, t) {
  var d = t.decs || {};
  if (t.z60 != null && (sim.z60 == null || roundTo(sim.z60, d.z60 != null ? d.z60 : 1) !== t.z60)) return false;
  if (t.et != null && (sim.et == null || roundTo(sim.et, d.et != null ? d.et : 1) !== t.et)) return false;
  if (t.trap != null && (sim.trap == null || roundTo(sim.trap, d.trap != null ? d.trap : 0) !== t.trap)) return false;
  if (t.z60130 != null && (sim.z60130 == null || roundTo(sim.z60130, d.z60130 != null ? d.z60130 : 1) !== t.z60130)) return false;
  return true;
}
function missScore(sim, t) {
  var d = t.decs || {};
  var s = 0;
  function add(simV, tgt, dec, w) {
    if (tgt == null) return;
    if (simV == null) { s += 10 * w; return; }
    s += Math.abs(roundTo(simV, dec) - tgt) * w;
  }
  add(sim.z60, t.z60, d.z60 != null ? d.z60 : 1, 3);
  add(sim.et, t.et, d.et != null ? d.et : 1, 2);
  add(sim.trap, t.trap, d.trap != null ? d.trap : 0, 2);
  add(sim.z60130, t.z60130, d.z60130 != null ? d.z60130 : 1, 2);
  return s;
}

var tipCars = loadGarage(TIP_BASE);
var seedCars = loadGarage(SEED);
var seedMap = new Map(seedCars.map(function (c) { return [c.id, c]; }));
var tipMap = new Map(tipCars.map(function (c) { return [c.id, c]; }));

var restoreStats = { cd: 0, fa: 0, sourceCdStrip: 0, samples: { cd: [], fa: [] } };
var garage = tipCars.map(function (tc) {
  var b = seedMap.get(tc.id);
  var c = clone(tc);
  if (!b) return c;
  if (c.dragCoefficient !== b.dragCoefficient) {
    restoreStats.cd++;
    if (restoreStats.samples.cd.length < 10) restoreStats.samples.cd.push({ id: tc.id, from: tc.dragCoefficient, to: b.dragCoefficient });
    c.dragCoefficient = b.dragCoefficient;
  }
  if (c.frontalAreaSqFt !== b.frontalAreaSqFt) {
    restoreStats.fa++;
    if (restoreStats.samples.fa.length < 6) restoreStats.samples.fa.push({ id: tc.id, from: tc.frontalAreaSqFt, to: b.frontalAreaSqFt });
    c.frontalAreaSqFt = b.frontalAreaSqFt;
  }
  if (typeof c.source === 'string') {
    var stripped = stripCdFudgeNotes(c.source);
    if (stripped !== c.source) restoreStats.sourceCdStrip++;
    c.source = stripped;
  }
  return c;
});

// Jorge Z28: real Cd 0.34; leave peakHp/curve alone forever on this car
garage.forEach(function (c) {
  if (c.id !== JORGE_Z28_ID) return;
  if (c.dragCoefficient !== JORGE_Z28_CD) {
    restoreStats.samples.cd.push({ id: c.id, from: c.dragCoefficient, to: JORGE_Z28_CD, note: 'Jorge real Cd' });
    if (c.dragCoefficient !== JORGE_Z28_CD) { /* already counted if differed from seed */ }
  }
  c.dragCoefficient = JORGE_Z28_CD;
});

var factoryHp = new Map(garage.map(function (c) {
  var b = seedMap.get(c.id);
  return [c.id, Number((b && b.peakHp) != null ? b.peakHp : c.peakHp)];
}));
var seedPower = new Map(seedCars.map(function (c) {
  return [c.id, { peakHp: c.peakHp, torqueCurve: clone(c.torqueCurve), peakHpRpm: c.peakHpRpm }];
}));
garage.forEach(function (c) {
  if (c.id === JORGE_Z28_ID) return; // Jorge: leave his HP alone
  var fac = factoryHp.get(c.id);
  // ICE: peakHp never above factory. EV tip may be above stock — retune prefers near stock.
  if (!isEv(c) && fac != null && Number(c.peakHp) > fac) applyPower(c, fac, seedPower.get(c.id));
});

var oemLock = new Map(garage.map(function (c) {
  var lock = {};
  NEVER_TOUCH.forEach(function (k) { if (c[k] !== undefined) lock[k] = clone(c[k]); });
  return [c.id, lock];
}));

var byName = new Map();
(Array.isArray(PACK.targets) ? PACK.targets : []).forEach(function (t) {
  byName.set(String(t.name).toLowerCase(), t);
});

function enforceLock(car) {
  var lock = oemLock.get(car.id);
  if (!lock) return;
  Object.keys(lock).forEach(function (k) { car[k] = clone(lock[k]); });
}

function tuneCar(car, t) {
  var ev = isEv(car);
  var need613 = t.z60130 != null;
  var facHp = factoryHp.get(car.id) || car.peakHp;
  var seedP = seedPower.get(car.id);
  var best = null;
  var budget = ev ? 36 : 28;
  var sims0 = SIMS;
  var lockPower = (car.id === JORGE_Z28_ID); // Jorge: never touch Z28 peakHp/curve
  function used() { return SIMS - sims0; }
  function consider(c, prep) {
    if (used() >= budget) return false;
    enforceLock(c);
    // ICE only: never exceed factory peakHp. EV may wiggle above stock near need.
    if (!isEv(c) && c.id !== JORGE_Z28_ID && Number(c.peakHp) > facHp) applyPower(c, facHp, seedP);
    var sim = runSim(c, need613, prep);
    var row = { car: clone(c), sim: sim, prep: prep, score: missScore(sim, t), full: exactMatch(sim, t) };
    enforceLock(row.car);
    if (!best || (row.full && !best.full) || (row.full === best.full && row.score < best.score)) best = row;
    return row.full;
  }

  if (consider(clone(car), 'unprepped')) return best;
  if (consider(clone(car), 'prepped')) return best;

  if (!ev) {
    var tires = [car.tireType | 0, 0, 3, 4, 5, 1, 2];
    tires = Array.from(new Set(tires));
    var L0 = Number(car.drivetrainLossPercent); if (!(L0 >= 0)) L0 = 15;
    // Coarse loss ladder (few points) × few tires at factory HP
    var losses = Array.from(new Set([L0, 8, 12, 15, 18, 22, 26, 30, 35].map(function (x) { return +clamp(x, 0, 35).toFixed(2); })));
    for (var ti = 0; ti < Math.min(4, tires.length) && used() < 16; ti++) {
      for (var li = 0; li < losses.length && used() < 16; li++) {
        var cA = clone(car);
        if (!lockPower) applyPower(cA, facHp, seedP);
        cA.tireType = tires[ti];
        cA.drivetrainLossPercent = losses[li];
        if (consider(cA, 'unprepped')) return best;
      }
    }
    if (!lockPower && best && !best.full && best.sim.z60 != null && t.z60 != null && best.sim.z60 + 0.03 < t.z60) {
      [0.97, 0.94, 0.9, 0.86, 0.8, 0.74, 0.68, 0.6].forEach(function (m) {
        if (used() >= budget || (best && best.full)) return;
        var cB = clone(best.car);
        applyPower(cB, Math.max(60, Math.round(facHp * m)), seedP);
        consider(cB, best.prep || 'unprepped');
      });
    }
    if (best && !best.full && best.sim.z60 != null && t.z60 != null && best.sim.z60 > t.z60 + 0.03) {
      [5, 4, 3].forEach(function (tt) {
        if (used() >= budget || (best && best.full)) return;
        var cC = clone(car);
        if (!lockPower) applyPower(cC, Math.min(facHp, Number(car.peakHp) || facHp), seedP);
        cC.tireType = tt;
        cC.drivetrainLossPercent = clamp(L0 - 4, 0, 35);
        if (consider(cC, 'prepped')) return;
        consider(cC, 'unprepped');
      });
    }
    if (best && !best.full && used() < budget) {
      var Lb = Number(best.car.drivetrainLossPercent) || 15;
      [-2, -1, 1, 2, 3].forEach(function (d) {
        if (used() >= budget || (best && best.full)) return;
        var cD = clone(best.car);
        cD.drivetrainLossPercent = +clamp(Lb + d, 0, 35).toFixed(2);
        consider(cD, best.prep || 'unprepped');
      });
      if (used() < budget && !(best && best.full)) {
        consider(clone(best.car), best.prep === 'prepped' ? 'unprepped' : 'prepped');
      }
    }
  } else {
    // EV: power up OR down OK; keep peakHp as close to stock (facHp) as possible
    var mults = [];
    // Prefer near 1.0 stock, then small wiggle out
    for (var p = 0; p <= 12; p++) {
      mults.push(+(1 + p * 0.02).toFixed(3));
      if (p > 0) mults.push(+(1 - p * 0.02).toFixed(3));
    }
    [1.28, 1.32, 1.36, 0.72, 0.68, 0.64].forEach(function (m) { mults.push(m); });
    mults = Array.from(new Set(mults));
    mults.sort(function (a, b) { return Math.abs(a - 1) - Math.abs(b - 1); });
    for (var mi = 0; mi < mults.length && used() < budget; mi++) {
      var cE = clone(car);
      applyPower(cE, Math.max(60, Math.round(facHp * mults[mi])), seedP);
      if (consider(cE, 'unprepped')) return best;
      if (used() < budget && consider(cE, 'prepped')) return best;
    }
  }
  return best;
}

function processRange(start, end) {
  var results = [];
  var t0 = Date.now();
  for (var i = start; i < end; i++) {
    var car = garage[i];
    var t = byName.get(String(car.name).toLowerCase());
    var simsBefore = SIMS;
    if (!t) {
      results.push({ idx: i, id: car.id, name: car.name, kind: isEv(car) ? 'EV' : 'ICE', fullMatch: false, noTarget: true, car: car });
      continue;
    }
    var best = tuneCar(car, t);
    if (best) {
      enforceLock(best.car);
      var note = (isEv(best.car) ? 'EV power±(~stock)' : 'ICE tires/loss/power↓(≤stock)') +
        ' after Cd/FA restore d2c50e7 (credit Jorge Guerra)';
      if (typeof best.car.source === 'string') {
        best.car.source = stripCdFudgeNotes(best.car.source);
        if (best.car.source.indexOf('Cd/FA restore d2c50e7') < 0) {
          best.car.source += (best.car.source ? ' | ' : '') + note;
        }
      } else best.car.source = note;
      results.push({
        idx: i, id: car.id, name: car.name, kind: isEv(car) ? 'EV' : 'ICE',
        fullMatch: !!best.full, score: +best.score.toFixed(4), prep: best.prep,
        sim: best.sim, target: { z60: t.z60, et: t.et, trap: t.trap, z60130: t.z60130 },
        knobs: { tireType: best.car.tireType, loss: best.car.drivetrainLossPercent, peakHp: best.car.peakHp, factoryHp: factoryHp.get(car.id) },
        sims: SIMS - simsBefore, car: best.car
      });
    }
    if ((i - start + 1) % 10 === 0 || i === end - 1) {
      var full = results.filter(function (r) { return r.fullMatch; }).length;
      console.error(JSON.stringify({ shard: SHARD_I, i: i + 1, end: end, full: full, sims: SIMS, min: +((Date.now() - t0) / 60000).toFixed(2) }));
    }
  }
  return results;
}

if (MODE === 'shard') {
  var n = garage.length;
  var start = Math.floor((SHARD_I * n) / SHARD_N);
  var end = Math.floor(((SHARD_I + 1) * n) / SHARD_N);
  fs.mkdirSync(SHARD_DIR, { recursive: true });
  // write restore stats once from shard 0
  if (SHARD_I === 0) fs.writeFileSync(path.join(SHARD_DIR, 'restoreStats.json'), JSON.stringify(restoreStats));
  var shardResults = processRange(start, end);
  // drop car torque curves size? keep full car
  fs.writeFileSync(path.join(SHARD_DIR, 'shard-' + SHARD_I + '.json'), JSON.stringify({ start: start, end: end, sims: SIMS, results: shardResults }));
  console.log(JSON.stringify({ shard: SHARD_I, start: start, end: end, full: shardResults.filter(function (r) { return r.fullMatch; }).length, sims: SIMS }));
  process.exit(0);
}

// MODE === all: spawn shards in parallel then merge
fs.mkdirSync(SHARD_DIR, { recursive: true });
var { spawn } = require('child_process');
var NSH = Math.max(2, Math.min(6, require('os').cpus().length || 4));
console.error('spawning ' + NSH + ' shards in parallel');

function runShardsParallel(n) {
  return new Promise(function (resolve, reject) {
    var left = n;
    var failed = [];
    var stderrs = [];
    for (var s = 0; s < n; s++) {
      (function (si) {
        var child = spawn('node', [__filename, 'shard', String(si), String(n)], {
          cwd: path.join(__dirname, '..'),
          stdio: ['ignore', 'pipe', 'pipe']
        });
        var err = '';
        child.stderr.on('data', function (d) { err += d; process.stderr.write(d); });
        child.stdout.on('data', function (d) { process.stderr.write(d); });
        child.on('close', function (code) {
          stderrs[si] = err;
          if (code !== 0) failed.push({ si: si, code: code, err: err.slice(-800) });
          left--;
          if (left === 0) {
            if (failed.length) reject(new Error(JSON.stringify(failed)));
            else resolve();
          }
        });
      })(s);
    }
  });
}

runShardsParallel(NSH).then(function () {
  mergeAndFinish(NSH);
}).catch(function (e) {
  console.error(String(e));
  process.exit(1);
});
return;

function mergeAndFinish(NSH) {

var allResults = [];
var totalSims = 0;
for (var s2 = 0; s2 < NSH; s2++) {
  var sh = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, 'shard-' + s2 + '.json'), 'utf8'));
  totalSims += sh.sims;
  sh.results.forEach(function (r) {
    garage[r.idx] = r.car;
    var copy = clone(r);
    delete copy.car;
    allResults.push(copy);
  });
}
allResults.sort(function (a, b) { return a.idx - b.idx; });

garage.forEach(function (c) { enforceLock(c); });

var verify = { cdOk: 0, cdBad: 0, faOk: 0, faBad: 0, massTipOk: 0, massTipBad: 0, gearTipOk: 0, gearTipBad: 0 };
garage.forEach(function (c) {
  var b = seedMap.get(c.id); var tip = tipMap.get(c.id); if (!b || !tip) return;
  if (c.dragCoefficient === b.dragCoefficient) verify.cdOk++; else verify.cdBad++;
  if (c.frontalAreaSqFt === b.frontalAreaSqFt) verify.faOk++; else verify.faBad++;
  if (c.weightLbs === tip.weightLbs) verify.massTipOk++; else verify.massTipBad++;
  if (deepEq(c.gearRatios, tip.gearRatios)) verify.gearTipOk++; else verify.gearTipBad++;
});

var ice = allResults.filter(function (r) { return r.kind === 'ICE'; });
var ev = allResults.filter(function (r) { return r.kind === 'EV'; });
var summary = {
  n: allResults.length,
  full: allResults.filter(function (r) { return r.fullMatch; }).length,
  ice: ice.length,
  iceFull: ice.filter(function (r) { return r.fullMatch; }).length,
  ev: ev.length,
  evFull: ev.filter(function (r) { return r.fullMatch; }).length,
  near: allResults.filter(function (r) { return !r.noTarget && (r.score || 0) <= 0.5; }).length,
  noTarget: allResults.filter(function (r) { return r.noTarget; }).length,
  misses: allResults.filter(function (r) { return !r.fullMatch && !r.noTarget; }).map(function (r) { return r.id; })
};

var keySamples = ['2024-tesla-model-3-performance', '2020-ford-mustang-gt', '2014-chevrolet-camaro-z-28', JORGE_Z28_ID].map(function (id) {
  var c = garage.find(function (x) { return x.id === id; });
  var tip = tipMap.get(id); var b = seedMap.get(id); var r = allResults.find(function (x) { return x.id === id; });
  if (!c) return null;
  return {
    id: id,
    cd: { tip: tip && tip.dragCoefficient, seed: b && b.dragCoefficient, now: c.dragCoefficient },
    fa: { tip: tip && tip.frontalAreaSqFt, seed: b && b.frontalAreaSqFt, now: c.frontalAreaSqFt },
    peakHp: c.peakHp, tireType: c.tireType, loss: c.drivetrainLossPercent,
    fullMatch: r && r.fullMatch, score: r && r.score, sim: r && r.sim, target: r && r.target
  };
}).filter(Boolean);

var hdr = [
  '/*',
  ' * VelocityBench PowerCurve — garage data',
  ' * Credits: Jorge Guerra only',
  ' * Tip: Cd/FA restore d2c50e7 + Excel allowed-knobs only (ICE tires/loss/power↓; EV power± near stock; Z28 Cd=0.34 HP locked)',
  ' * Generated: ' + new Date().toISOString(),
  ' */',
  ''
].join('\n');
fs.writeFileSync(OUT_JS, hdr + 'var VB_POWERCURVE_GARAGE = ' + JSON.stringify(garage, null, 2) + ';\n' +
  'if (typeof module !== "undefined" && module.exports) module.exports = VB_POWERCURVE_GARAGE;\n');

var report = {
  credit: CREDIT,
  seed: SEED,
  tipBase: TIP_BASE,
  source: '/workspace/VelocityBench_Garage_Corrected.xlsx#Garage',
  acceptance: 'exact sheet decimals; honest miss if allowed knobs cannot hit',
  method: {
    restore: 'Cd+FA from d2c50e7 onto tip 3f2a898 (Z28 Cd forced 0.34); strip Cd fudge; keep tip gears/mass/TX; never touch other OEM',
    ICE: 'tires only if needed; realistic drivetrainLoss; curve reshape with peakHp ≤ factory',
    EV: 'power up OR down near stock (prefer closest kW to factory); honest miss if cannot hit',
    neverTouch: NEVER_TOUCH
  },
  guardFile: 'scripts/JORGE_LOCKED_RECALIB_RULES.md',
  restoreStats: restoreStats,
  verifyVsSeed: verify,
  keySamples: keySamples,
  sims: totalSims,
  shards: NSH,
  summary: summary,
  results: allResults
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
fs.writeFileSync(PROG, JSON.stringify({ i: garage.length, n: garage.length, full: summary.full, sims: totalSims, done: true }, null, 2));
console.log(JSON.stringify({ summary: summary, restoreStats: restoreStats, verify: verify, keySamples: keySamples, sims: totalSims }, null, 2));

// bind check
var bindSrc = fs.readFileSync(OUT_JS, 'utf8');
if (bindSrc.indexOf('var VB_POWERCURVE_GARAGE') < 0) throw new Error('missing bind');
var cars = JSON.parse(bindSrc.slice(bindSrc.indexOf('['), bindSrc.lastIndexOf(']') + 1));
if (cars.length !== 316) throw new Error('car count ' + cars.length);
if (bindSrc.toLowerCase().indexOf('jorge guerra') < 0) throw new Error('missing Jorge credit');
console.error('VERIFY bind+316+credit OK');

}
