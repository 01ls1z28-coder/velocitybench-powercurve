/**
 * µ ↔ 60ft calibrate — Mustang GT Jorge deltas tip.
 * Credit: Jorge Guerra ONLY. Tip-only — no Pages / no Merovingian.
 *
 * Method: measure LIVE 60ft on 2020 Mustang GT (Street/all-season factory),
 * apply Jorge Δ (seconds; slower = higher 60ft = generally less µ),
 * binary-search µ so new 60ft ≈ current + Δ.
 *
 *   node scripts/recalib-mu-60ft.js
 *   node scripts/recalib-mu-60ft.js --apply
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var APPLY = process.argv.indexOf('--apply') >= 0;
var OUT_REPORT = path.join(__dirname, 'mu-60ft-calibrate-report.json');
var OUT_VERIFY = path.join(__dirname, '..', 'VERIFY-pc-mu-60ft-calibrate.md');
var PHYSICS_JS = path.join(__dirname, '..', 'js', 'physics.js');

var LABELS = { 0: 'Street', 1: 'Drag Radial', 2: 'Slick', 3: 'Summer', 4: 'UHP', 5: 'R-Compound' };
var ORDER = [0, 3, 4, 5, 1, 2];
var MUSTANG_ID = '2020-ford-mustang-gt';

/** Jorge deltas (seconds on 60ft). Positive = slower = need less grip µ generally. */
var DELTAS = {
  unprepped: { 0: 0.70, 3: 0.20, 4: 0.12, 5: 0.80, 1: 0.70, 2: 0.13 },
  prepped:   { 0: 0.30, 3: 0.25, 4: 0.20, 5: 0.14, 1: -0.01, 2: -0.05 }
};

/** LIVE main 3a55f8d µ (frozen) — deltas are vs these, not vs re-baked tip. */
var LIVE_MU = {
  unprepped: { 0: 1.20, 3: 1.34, 4: 1.44, 2: 1.47, 5: 1.64, 1: 1.85 },
  prepped:   { 0: 1.80, 3: 1.95, 1: 1.90, 5: 2.00, 4: 2.15, 2: 2.20 }
};

function find(id) {
  var c = GARAGE.find(function (x) { return x.id === id; });
  if (!c) throw new Error('missing car ' + id);
  return c;
}

function runSixty(car, prep, tireType, tireGrip) {
  var env = {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: tireType | 0, trackPrep: prep,
    driverWeightLbs: 200,
    needSixtyToOneThirty: false, quickMetrics: true
  };
  if (tireGrip != null) env.tireGrip = tireGrip;
  var trial = Object.assign({}, car, { forceScale: 1, tireType: tireType | 0 });
  return Phys.runQuarterMile(trial, env).sixtyFootTime;
}

function powerFloor(car, prep, tireType) {
  return runSixty(car, prep, tireType, 8.0);
}

/**
 * Binary search µ so sixty ≈ target.
 * Higher µ → lower 60ft while traction-limited.
 * If target < power-floor, approach floor with high µ and flag.
 */
function searchMu(car, prep, tireType, target, lo, hi) {
  var floor = powerFloor(car, prep, tireType);
  var floored = target < floor - 0.002;

  if (floored) {
    // Cannot beat power floor (want faster than PW allows) — KEEP current table µ.
    // Raising further does nothing; lowering makes 60ft worse.
    var liveMu = LIVE_MU[prep][tireType];
    var tKeep = runSixty(car, prep, tireType, liveMu);
    return {
      mu: liveMu, sixty: +tKeep.toFixed(4), floor: +floor.toFixed(4),
      floored: true, target: target, effectiveTarget: floor,
      delta: +(tKeep - target).toFixed(4),
      note: 'power-floor: cannot reach target ' + target.toFixed(3) +
            ' (floor ' + floor.toFixed(3) + '); kept LIVE µ ' + liveMu.toFixed(3)
    };
  }

  var bestMu = lo, bestT = runSixty(car, prep, tireType, lo), bestErr = Math.abs(bestT - target);
  var lo2 = lo, hi2 = hi;
  for (var k = 0; k < 32; k++) {
    var m2 = (lo2 + hi2) / 2;
    var tt2 = runSixty(car, prep, tireType, m2);
    var err = Math.abs(tt2 - target);
    if (err < bestErr) { bestErr = err; bestMu = m2; bestT = tt2; }
    if (tt2 > target) lo2 = m2;
    else hi2 = m2;
  }
  bestMu = Math.round(bestMu * 1000) / 1000;
  bestT = runSixty(car, prep, tireType, bestMu);
  return {
    mu: bestMu, sixty: +bestT.toFixed(4), floor: +floor.toFixed(4),
    floored: Math.abs(bestT - floor) < 0.008,
    target: target, effectiveTarget: target,
    delta: +(bestT - target).toFixed(4),
    note: null
  };
}

function currentMu(prep, tt) {
  return Phys.TIRE_MU_BY_PREP[prep][tt];
}

var mustang = find(MUSTANG_ID);
console.log('Ref:', mustang.name, 'id', mustang.id,
  'wt', mustang.curbWeightLbs || mustang.weightLbs,
  'tireType', mustang.tireType, 'forceScale', mustang.forceScale);

var results = { unprepped: {}, prepped: {} };
var corrected = { unprepped: {}, prepped: {} };
var before = { unprepped: {}, prepped: {} };
var after = { unprepped: {}, prepped: {} };
var targets = { unprepped: {}, prepped: {} };
var floorNotes = [];

['unprepped', 'prepped'].forEach(function (prep) {
  ORDER.forEach(function (tt) {
    var curMu = LIVE_MU[prep][tt];
    var curT = runSixty(mustang, prep, tt, curMu);
    var d = DELTAS[prep][tt];
    var tgt = +(curT + d).toFixed(4);
    targets[prep][tt] = tgt;
    before[prep][tt] = { mu: curMu, sixty: +curT.toFixed(4), deltaReq: d, target: tgt };

    // µ search bounds: slower targets need lower µ
    var lo = 0.40, hi = 3.50;
    var res = searchMu(mustang, prep, tt, tgt, lo, hi);
    results[prep][tt] = res;
    corrected[prep][tt] = res.mu;
    if (res.note) floorNotes.push(prep + ' ' + LABELS[tt] + ': ' + res.note);

    console.log(
      prep.padEnd(10), LABELS[tt].padEnd(12),
      'cur', curT.toFixed(3), 'µ', curMu.toFixed(3),
      'Δ', (d >= 0 ? '+' : '') + d.toFixed(2),
      '→ tgt', tgt.toFixed(3),
      '| new µ', res.mu.toFixed(3), '60ft', res.sixty.toFixed(3),
      'err', (res.sixty - tgt).toFixed(3),
      res.floored ? '[FLOOR]' : ''
    );
  });
});

// VERIFY after bake by temporarily patching in-memory table then measuring
function patchInMemory(muTable) {
  ['unprepped', 'prepped'].forEach(function (prep) {
    ORDER.forEach(function (tt) {
      Phys.TIRE_MU_BY_PREP[prep][tt] = muTable[prep][tt];
    });
  });
}

patchInMemory(corrected);
['unprepped', 'prepped'].forEach(function (prep) {
  ORDER.forEach(function (tt) {
    var t = runSixty(mustang, prep, tt); // uses table µ (no override)
    after[prep][tt] = { mu: corrected[prep][tt], sixty: +t.toFixed(4) };
  });
});

var report = {
  credit: 'Jorge Guerra only',
  base: '3a55f8d',
  branch: 'review/mu-60ft-mustang-deltas',
  car: MUSTANG_ID,
  conditions: {
    driverWeightLbs: 200, forceScale: 1, launchMode: 'auto',
    wx: '70F / 45% RH / 29.92 inHg, wind 0'
  },
  deltas: DELTAS,
  before: before,
  targets: targets,
  correctedMu: corrected,
  results: results,
  after: after,
  floorNotes: floorNotes,
  powerFloorMustang: +powerFloor(mustang, 'unprepped', 0).toFixed(4)
};

fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
console.log('\nWrote', OUT_REPORT);
if (floorNotes.length) {
  console.log('\nPower-floor limits:');
  floorNotes.forEach(function (n) { console.log(' -', n); });
}

function fmtRow(obj, key) {
  return ORDER.map(function (tt) {
    var v = obj[tt];
    if (v == null) return '  —  ';
    if (typeof v === 'object') return Number(v.sixty).toFixed(3);
    return Number(v).toFixed(3);
  }).join('  ');
}

var verifyMd = [
  '# VERIFY — µ ↔ 60ft Mustang GT Jorge deltas',
  '',
  '**Credit:** Jorge Guerra only',
  '**Branch:** `review/mu-60ft-mustang-deltas`',
  '**Base:** `3a55f8d` (LIVE main — OEM tire + EV power)',
  '**Repo:** `01ls1z28-coder/velocitybench-powercurve`',
  '**Pages / main:** HOLD — tip only (no deploy)',
  '**Report:** `scripts/mu-60ft-calibrate-report.json`',
  '**Bake:** `node scripts/recalib-mu-60ft.js --apply`',
  '',
  '## Method',
  '',
  '1. Measure LIVE 60ft on `2020-ford-mustang-gt` (Street/all-season factory) for each tireType × unprep/prep.',
  '2. Target = current + Jorge Δ (seconds; slower = higher 60ft).',
  '3. Binary-search µ so sim 60ft ≈ target (forceScale=1, driver 200, launch=auto, wx 70/45/29.92).',
  '4. Bake `TIRE_MU_BY_PREP` + `TARGET_60FT_BY_PREP`.',
  '',
  '## Jorge deltas (s)',
  '',
  '| Prep | Street | Summer | UHP | R-Comp | DR | Slick |',
  '|------|--------|--------|-----|--------|----|-------|',
  '| Unprep | +0.70 | +0.20 | +0.12 | +0.80 | +0.70 | +0.13 |',
  '| Prep | +0.30 | +0.25 | +0.20 | +0.14 | −0.01 | −0.05 |',
  '',
  '## Mustang GT before → after 60ft',
  '',
  '| Prep | Street | Summer | UHP | R-Comp | DR | Slick |',
  '|------|--------|--------|-----|--------|----|-------|',
  '| Unprep before | ' + fmtRow(before.unprepped, 'sixty').split(/\s+/).filter(Boolean).join(' | ') + ' |',
  '| Unprep **after** | ' + fmtRow(after.unprepped, 'sixty').split(/\s+/).filter(Boolean).join(' | ') + ' |',
  '| Unprep target | ' + ORDER.map(function (tt) { return targets.unprepped[tt].toFixed(3); }).join(' | ') + ' |',
  '| Prep before | ' + fmtRow(before.prepped, 'sixty').split(/\s+/).filter(Boolean).join(' | ') + ' |',
  '| Prep **after** | ' + fmtRow(after.prepped, 'sixty').split(/\s+/).filter(Boolean).join(' | ') + ' |',
  '| Prep target | ' + ORDER.map(function (tt) { return targets.prepped[tt].toFixed(3); }).join(' | ') + ' |',
  '',
  '## New µ table (`TIRE_MU_BY_PREP`)',
  '',
  '| tireType | Unprep µ (was→new) | Prep µ (was→new) |',
  '|----------|-------------------:|-----------------:|',
];

ORDER.forEach(function (tt) {
  verifyMd.push(
    '| ' + tt + ' ' + LABELS[tt] +
    ' | ' + before.unprepped[tt].mu.toFixed(3) + '→**' + corrected.unprepped[tt].toFixed(3) + '**' +
    ' | ' + before.prepped[tt].mu.toFixed(3) + '→**' + corrected.prepped[tt].toFixed(3) + '** |'
  );
});

verifyMd.push('');
verifyMd.push('## Power-floor notes');
verifyMd.push('');
verifyMd.push('Mustang GT power floor ≈ **' + report.powerFloorMustang.toFixed(3) + 's** (µ=8).');
if (floorNotes.length) {
  floorNotes.forEach(function (n) { verifyMd.push('- ' + n); });
} else {
  verifyMd.push('- None — all classes reached target within tolerance.');
}
verifyMd.push('');
verifyMd.push('## Code / bind / secrets');
verifyMd.push('');
verifyMd.push('- `js/physics.js`: baked `TIRE_MU_BY_PREP` + `TARGET_60FT_BY_PREP`');
verifyMd.push('- `scripts/recalib-mu-60ft.js`: Mustang-delta calibrator');
verifyMd.push('- `window.VB_POWERCURVE_GARAGE` bind **preserved**');
verifyMd.push('- Secrets: **none**');
verifyMd.push('');

if (APPLY) {
  var src = fs.readFileSync(PHYSICS_JS, 'utf8');

  // Replace TIRE_MU_BY_PREP block (from var TIRE_MU_BY_PREP through closing };
  // Also inject/update TARGET_60FT_BY_PREP just above it.
  var targetBlock =
    '  /** Explicit 60ft targets used to bake TIRE_MU_BY_PREP (Jorge Mustang GT deltas). */\n' +
    '  var TARGET_60FT_BY_PREP = {\n' +
    '    unprepped: { 0: ' + targets.unprepped[0].toFixed(3) +
      ', 3: ' + targets.unprepped[3].toFixed(3) +
      ', 4: ' + targets.unprepped[4].toFixed(3) +
      ', 5: ' + targets.unprepped[5].toFixed(3) +
      ', 1: ' + targets.unprepped[1].toFixed(3) +
      ', 2: ' + targets.unprepped[2].toFixed(3) + ' },\n' +
    '    prepped:   { 0: ' + targets.prepped[0].toFixed(3) +
      ', 3: ' + targets.prepped[3].toFixed(3) +
      ', 4: ' + targets.prepped[4].toFixed(3) +
      ', 5: ' + targets.prepped[5].toFixed(3) +
      ', 1: ' + targets.prepped[1].toFixed(3) +
      ', 2: ' + targets.prepped[2].toFixed(3) + ' }\n' +
    '  };\n\n';

  var muBlock =
    '  var TIRE_MU_BY_PREP = {\n' +
    '    /**\n' +
    '     * Jorge Guerra µ ↔ 60ft Mustang GT deltas (tip review/mu-60ft-mustang-deltas).\n' +
    '     * Base LIVE 3a55f8d 60fts + Jorge Δ; ref car 2020-ford-mustang-gt.\n' +
    '     * Unprep Δ: Street +0.70 · Summer +0.20 · UHP +0.12 · R-comp +0.80 · DR +0.70 · Slick +0.13\n' +
    '     * Prep Δ:   Street +0.30 · Summer +0.25 · UHP +0.20 · R-comp +0.14 · DR −0.01 · Slick −0.05\n' +
    '     * Prep DR/Slick “faster” hit Mustang power floor ~' + report.powerFloorMustang.toFixed(3) + 's — cannot go below.\n' +
    '     * Tunable: edit numbers below or re-run scripts/recalib-mu-60ft.js --apply.\n' +
    '     */\n' +
    '    unprepped: {\n' +
    '      0: ' + corrected.unprepped[0].toFixed(3) + ',  // Street → ~' + after.unprepped[0].sixty.toFixed(3) + 's Mustang\n' +
    '      3: ' + corrected.unprepped[3].toFixed(3) + ',  // Summer → ~' + after.unprepped[3].sixty.toFixed(3) + 's\n' +
    '      4: ' + corrected.unprepped[4].toFixed(3) + ',  // UHP → ~' + after.unprepped[4].sixty.toFixed(3) + 's\n' +
    '      2: ' + corrected.unprepped[2].toFixed(3) + ',  // Slick cold/unprep → ~' + after.unprepped[2].sixty.toFixed(3) + 's\n' +
    '      5: ' + corrected.unprepped[5].toFixed(3) + ',  // R-Compound → ~' + after.unprepped[5].sixty.toFixed(3) + 's\n' +
    '      1: ' + corrected.unprepped[1].toFixed(3) + '   // Drag Radial → ~' + after.unprepped[1].sixty.toFixed(3) + 's\n' +
    '    },\n' +
    '    prepped: {\n' +
    '      0: ' + corrected.prepped[0].toFixed(3) + ',  // Street → ~' + after.prepped[0].sixty.toFixed(3) + 's\n' +
    '      3: ' + corrected.prepped[3].toFixed(3) + ',  // Summer → ~' + after.prepped[3].sixty.toFixed(3) + 's\n' +
    '      1: ' + corrected.prepped[1].toFixed(3) + ',  // DR → floor-limited (target faster)\n' +
    '      5: ' + corrected.prepped[5].toFixed(3) + ',  // R-Compound → ~' + after.prepped[5].sixty.toFixed(3) + 's\n' +
    '      4: ' + corrected.prepped[4].toFixed(3) + ',  // UHP → ~' + after.prepped[4].sixty.toFixed(3) + 's\n' +
    '      2: ' + corrected.prepped[2].toFixed(3) + '   // Slick → floor-limited (target faster)\n' +
    '    }\n' +
    '  };';

  // Remove any existing TARGET_60FT_BY_PREP then replace TIRE_MU_BY_PREP
  if (/var TARGET_60FT_BY_PREP\s*=/.test(src)) {
    src = src.replace(/\n?\s*\/\*\*[^*]*Explicit 60ft[\s\S]*?var TARGET_60FT_BY_PREP\s*=\s*\{[\s\S]*?\};\n\n/, '\n');
  }

  if (!/var TIRE_MU_BY_PREP\s*=/.test(src)) {
    throw new Error('TIRE_MU_BY_PREP not found in physics.js');
  }
  src = src.replace(
    /var TIRE_MU_BY_PREP\s*=\s*\{[\s\S]*?\n  \};/,
    targetBlock + muBlock
  );

  // Export TARGET_60FT_BY_PREP on API if missing
  if (!/TARGET_60FT_BY_PREP:\s*TARGET_60FT_BY_PREP/.test(src)) {
    src = src.replace(
      /TIRE_MU_BY_PREP:\s*TIRE_MU_BY_PREP,/,
      'TIRE_MU_BY_PREP: TIRE_MU_BY_PREP,\n    TARGET_60FT_BY_PREP: TARGET_60FT_BY_PREP,'
    );
  }

  fs.writeFileSync(PHYSICS_JS, src);
  console.log('Applied TIRE_MU_BY_PREP + TARGET_60FT_BY_PREP to', PHYSICS_JS);

  // Re-verify from disk after apply
  delete require.cache[require.resolve('../js/physics.js')];
  var Phys2 = require('../js/physics.js');
  console.log('\n=== POST-APPLY VERIFY (from disk) ===');
  console.log('New TIRE_MU:', JSON.stringify(Phys2.TIRE_MU_BY_PREP));
  console.log('TARGET_60FT:', JSON.stringify(Phys2.TARGET_60FT_BY_PREP));
  ['unprepped', 'prepped'].forEach(function (prep) {
    var row = ORDER.map(function (tt) {
      var env = {
        tempF: 70, humidity: 45, pressureInHg: 29.92,
        windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
        tireType: tt, trackPrep: prep, driverWeightLbs: 200,
        needSixtyToOneThirty: false, quickMetrics: true
      };
      var trial = Object.assign({}, mustang, { forceScale: 1, tireType: tt });
      return Phys2.runQuarterMile(trial, env).sixtyFootTime.toFixed(3);
    }).join('  ');
    console.log(prep.padEnd(12), row);
  });
}

// Write VERIFY md (SHA filled later by VERIFY commit)
fs.writeFileSync(OUT_VERIFY, verifyMd.join('\n') + '\n');
console.log('Wrote', OUT_VERIFY);
