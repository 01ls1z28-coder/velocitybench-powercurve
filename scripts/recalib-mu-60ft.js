/**
 * µ ↔ 60ft calibration — Jorge Guerra FINAL targets.
 * Credit: Jorge Guerra ONLY. Tip-only — no Pages / no Merovingian.
 *
 * NO closed form: µ → tracLim → softTractionForce → integrate → sixtyFootTime.
 * Binary-search µ via env.tireGrip override until sim lands on mid-band target.
 *
 *   node scripts/recalib-mu-60ft.js
 *   node scripts/recalib-mu-60ft.js --apply   # patch js/physics.js TIRE_MU_BY_PREP
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

var HELL_ID = '2020-dodge-challenger-hellcat';
var Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';

/** Mid-band picks (Jorge). Prep DR = slick mid + 0.05 after slick bake. */
var TARGET_MID = {
  unprepped: { 0: 2.20, 3: 2.00, 4: 1.875, 5: 1.775, 1: 1.685, 2: 1.85 },
  prepped:   { 0: 1.725, 3: 1.60, 4: 1.475, 5: 1.50, 1: null /* filled */, 2: 1.475 }
};
var TARGET_BAND = {
  unprepped: {
    0: [2.20, 2.20], 3: [2.00, 2.00], 4: [1.85, 1.90],
    5: [1.75, 1.80], 1: [1.65, 1.72], 2: [1.80, 1.90]
  },
  prepped: {
    0: [1.70, 1.75], 3: [1.60, 1.60], 4: [1.45, 1.50],
    5: [1.50, 1.50], 1: null, 2: [1.45, 1.50]
  }
};

/**
 * Reference car per tireType × prep.
 * Hellcat-class for street/UHP unprep + Street prep (traction-limited).
 * Z28 ATC for race tires + sticky prep (Hellcat power-floors ~1.725).
 */
var REFS = {
  unprepped: { 0: HELL_ID, 3: HELL_ID, 4: HELL_ID, 5: HELL_ID, 2: HELL_ID, 1: HELL_ID },
  prepped:   { 0: HELL_ID, 3: Z28_ID, 4: Z28_ID, 5: Z28_ID, 2: Z28_ID, 1: Z28_ID }
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
 * Binary search µ so sixty ≈ target. Higher µ → lower 60ft (while traction-limited).
 * If power-floor > target, return µ that reaches floor (best possible) + flagged.
 */
function searchMu(car, prep, tireType, target, lo, hi, band) {
  var floor = powerFloor(car, prep, tireType);
  var floored = floor > target + 0.002;

  // If power-limited: land in-band at lowest µ (prefer band_hi, or floor if in band).
  if (floored) {
    var inBandFloor = band && floor >= band[0] - 0.002 && floor <= band[1] + 0.002;
    var thresh;
    if (inBandFloor) {
      // floor itself is in band — min µ to land near floor (still in band)
      thresh = floor + 0.008;
    } else if (band && floor < band[0]) {
      // floor faster than band — hit band mid via normal path below; use mid
      thresh = target;
    } else {
      // floor outside/above band (e.g. Hellcat DR 1.725 vs band 1.65–1.72):
      // cannot enter band — approach floor with minimum µ
      thresh = floor + 0.005;
    }
    var a = lo, b = hi, mid, t, i;
    for (i = 0; i < 30; i++) {
      mid = (a + b) / 2;
      t = runSixty(car, prep, tireType, mid);
      if (t > thresh) a = mid;
      else b = mid;
    }
    var muMin = Math.round(b * 1000) / 1000;
    var tMin = runSixty(car, prep, tireType, muMin);
    return {
      mu: muMin, sixty: +tMin.toFixed(4), floor: +floor.toFixed(4),
      floored: true, target: target, effectiveTarget: thresh,
      delta: +(tMin - target).toFixed(4)
    };
  }

  // Target near floor (within 5 ms): min µ to reach target+2ms
  if (Math.abs(floor - target) <= 0.005) {
    var a2 = lo, b2 = hi, mid2, t2, j;
    for (j = 0; j < 30; j++) {
      mid2 = (a2 + b2) / 2;
      t2 = runSixty(car, prep, tireType, mid2);
      if (t2 > target + 0.002) a2 = mid2;
      else b2 = mid2;
    }
    var muN = Math.round(b2 * 1000) / 1000;
    var tN = runSixty(car, prep, tireType, muN);
    return {
      mu: muN, sixty: +tN.toFixed(4), floor: +floor.toFixed(4),
      floored: Math.abs(tN - floor) < 0.008,
      target: target, effectiveTarget: target,
      delta: +(tN - target).toFixed(4)
    };
  }

  // Normal traction-limited binary search toward mid-band target
  var bestMu = lo, bestT = runSixty(car, prep, tireType, lo), bestErr = Math.abs(bestT - target);
  var lo2 = lo, hi2 = hi;
  for (var k = 0; k < 28; k++) {
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
    floored: false, target: target, effectiveTarget: target,
    delta: +(bestT - target).toFixed(4)
  };
}

function currentMu(prep, tt) {
  return Phys.TIRE_MU_BY_PREP[prep][tt];
}

var G = 32.174; // ft/s^2
function idealSixty(mu, driveShare) {
  var a = mu * G * driveShare;
  return Math.sqrt(2 * 60 / a);
}

var hell = find(HELL_ID);
var z28 = find(Z28_ID);

// Rear static load share from WD if present; Hellcat OEM 57/43 → rear 0.43
function rearShare(car) {
  if (car.rearWeightPercent != null && car.rearWeightPercent !== "") {
    return Number(car.rearWeightPercent) / 100;
  }
  var f = car.frontWeightPercent != null ? car.frontWeightPercent : car.weightDistFront;
  if (f == null && car.weightDistribution) {
    var m = String(car.weightDistribution).match(/(\d+)\s*\/\s*(\d+)/);
    if (m) f = Number(m[1]);
  }
  if (f == null) return 0.45; // RWD-ish default
  return (100 - Number(f)) / 100;
}

var hellShare = rearShare(hell);
var z28Share = rearShare(z28);

console.log('Refs: Hellcat rearShare', hellShare, 'Z28 rearShare', z28Share);
console.log('Hellcat power floor', powerFloor(hell, 'unprepped', 4).toFixed(3));
console.log('Z28 power floor', powerFloor(z28, 'prepped', 2).toFixed(3));

var results = { unprepped: {}, prepped: {} };
var corrected = { unprepped: {}, prepped: {} };
var currentOff = { unprepped: {}, prepped: {} };

function calibrateOne(prep, tt, lo, hi) {
  var refId = REFS[prep][tt];
  var car = find(refId);
  var target = TARGET_MID[prep][tt];
  var curMu = currentMu(prep, tt);
  var curT = runSixty(car, prep, tt, curMu);
  var band = TARGET_BAND[prep][tt];
  currentOff[prep][tt] = {
    ref: car.name, refId: refId, currentMu: curMu,
    currentSixty: +curT.toFixed(4),
    targetMid: target, band: band,
    delta: +(curT - target).toFixed(4),
    inBand: band ? (curT >= band[0] - 0.005 && curT <= band[1] + 0.005) : null
  };
  var hit = searchMu(car, prep, tt, target, lo, hi, band);
  hit.ref = car.name;
  hit.refId = refId;
  hit.currentMu = curMu;
  hit.currentSixty = +curT.toFixed(4);
  hit.band = band;
  hit.label = LABELS[tt];
  // idealized vs sim at corrected µ
  var share = rearShare(car);
  hit.idealized = +idealSixty(hit.mu, share).toFixed(4);
  hit.idealizedShare = share;
  hit.idealVsSim = +(hit.idealized - hit.sixty).toFixed(4);
  results[prep][tt] = hit;
  corrected[prep][tt] = hit.mu;
  console.log(
    prep, LABELS[tt],
    'ref=' + car.name.slice(0, 28),
    'curµ=' + curMu, 'cur60=' + curT.toFixed(3),
    '→ µ=' + hit.mu, '60=' + hit.sixty.toFixed(3),
    'tgt=' + target,
    hit.floored ? 'FLOORED@' + hit.floor : 'ok',
    'ideal=' + hit.idealized
  );
}

// Search bounds (generous)
var BOUNDS = {
  unprepped: { 0: [0.9, 2.0], 3: [1.0, 2.0], 4: [1.1, 2.2], 5: [1.2, 2.4], 1: [1.1, 2.5], 2: [1.1, 2.2] },
  prepped:   { 0: [1.2, 2.5], 3: [1.2, 2.6], 4: [1.3, 3.0], 5: [1.3, 2.8], 1: [1.3, 3.0], 2: [1.4, 3.2] }
};

ORDER.forEach(function (tt) {
  if (tt === 1) return; // DR prep after slick
  calibrateOne('unprepped', tt, BOUNDS.unprepped[tt][0], BOUNDS.unprepped[tt][1]);
});
calibrateOne('unprepped', 1, BOUNDS.unprepped[1][0], BOUNDS.unprepped[1][1]);

ORDER.forEach(function (tt) {
  if (tt === 1) return;
  calibrateOne('prepped', tt, BOUNDS.prepped[tt][0], BOUNDS.prepped[tt][1]);
});

// Race-tire monotonicity on prep: Slick µ >= UHP µ (both near Z28 floor; µ sets character)
if (corrected.prepped[2] < corrected.prepped[4]) {
  corrected.prepped[2] = Math.round((corrected.prepped[4] + 0.02) * 1000) / 1000;
  var z28s = find(Z28_ID);
  results.prepped[2].mu = corrected.prepped[2];
  results.prepped[2].sixty = +runSixty(z28s, 'prepped', 2, corrected.prepped[2]).toFixed(4);
  results.prepped[2].note = 'bumped >= UHP prep µ for race-tire ordering';
  console.log('Slick prep µ bumped to', corrected.prepped[2], 'sixty', results.prepped[2].sixty);
}


// DR prep = slick prep sim + 0.05 on same ref (Z28)
var slickPrepSixty = results.prepped[2].sixty;
var drPrepTarget = +(slickPrepSixty + 0.05).toFixed(3);
TARGET_MID.prepped[1] = drPrepTarget;
TARGET_BAND.prepped[1] = [drPrepTarget - 0.02, drPrepTarget + 0.02];
console.log('DR prep target = slickPrep + 0.05 =', drPrepTarget, '(slickPrep', slickPrepSixty, ')');
calibrateOne('prepped', 1, BOUNDS.prepped[1][0], BOUNDS.prepped[1][1]);

// Ladders with corrected µ (override tireGrip)
function ladder(car, muTable) {
  var out = { unprepped: {}, prepped: {} };
  ORDER.forEach(function (tt) {
    out.unprepped[LABELS[tt]] = +runSixty(car, 'unprepped', tt, muTable.unprepped[tt]).toFixed(3);
    out.prepped[LABELS[tt]] = +runSixty(car, 'prepped', tt, muTable.prepped[tt]).toFixed(3);
  });
  return out;
}

var hellLadderNew = ladder(hell, corrected);
var z28LadderNew = ladder(z28, corrected);
var hellLadderOld = ladder(hell, Phys.TIRE_MU_BY_PREP);
var z28LadderOld = ladder(z28, Phys.TIRE_MU_BY_PREP);

console.log('\nHellcat NEW ladder', JSON.stringify(hellLadderNew));
console.log('Z28 NEW ladder', JSON.stringify(z28LadderNew));

// Relationship µ→60ft table at fixed refs (for VERIFY)
function relationSweep(car, prep, tt) {
  var rows = [];
  for (var mu = 1.0; mu <= 2.4 + 1e-9; mu += 0.1) {
    var sim = runSixty(car, prep, tt, +mu.toFixed(2));
    var ideal = idealSixty(mu, rearShare(car));
    rows.push({ mu: +mu.toFixed(2), sim: +sim.toFixed(3), ideal: +ideal.toFixed(3), delta: +(ideal - sim).toFixed(3) });
  }
  return rows;
}

var report = {
  tip: 'review/mu-60ft-calibrate',
  credit: 'Jorge Guerra',
  conditions: { driverWeightLbs: 200, forceScale: 1, launchMode: 'auto', wx: '70F/45%/29.92inHg', wind: 0 },
  refs: REFS,
  refMeta: {
    hellcat: { id: HELL_ID, name: hell.name, weightLbs: hell.weightLbs, launchRpm: hell.launchRpm, rearShare: hellShare, powerFloor: +powerFloor(hell, 'unprepped', 4).toFixed(3) },
    z28: { id: Z28_ID, name: z28.name, weightLbs: z28.weightLbs, launchRpm: z28.launchRpm, rearShare: z28Share, powerFloor: +powerFloor(z28, 'prepped', 2).toFixed(3) }
  },
  targetsMid: TARGET_MID,
  targetsBand: TARGET_BAND,
  currentOffTarget: currentOff,
  corrected: results,
  correctedMu: corrected,
  previousMu: JSON.parse(JSON.stringify(Phys.TIRE_MU_BY_PREP)),
  ladders: {
    hellcat: { before: hellLadderOld, after: hellLadderNew },
    z28: { before: z28LadderOld, after: z28LadderNew }
  },
  relationship: {
    note: 'Engine has NO closed form. Idealized t=sqrt(2s/a) with a=µ*g*rearShare is a lower-bound sanity check; sim includes softTractionForce, gripMultSmooth, kinetic fall, launch, driveline.',
    hellcatUnprepUHP: relationSweep(hell, 'unprepped', 4),
    z28PrepSlick: relationSweep(z28, 'prepped', 2)
  }
};

fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT_REPORT);

function patchPhysics(muTable) {
  var src = fs.readFileSync(PHYSICS_JS, 'utf8');
  var start = src.indexOf('var TIRE_MU_BY_PREP = {');
  if (start < 0) throw new Error('TIRE_MU_BY_PREP not found');
  // Find matching close of the object — next "};\n\n  /**\n   * Kinetic"
  var marker = 'var TIRE_KINETIC_FALL';
  var end = src.indexOf(marker, start);
  if (end < 0) throw new Error('TIRE_KINETIC_FALL marker not found');
  // Walk back to end of TIRE_MU_BY_PREP block (the }; before kinetic comment)
  var blockEnd = src.lastIndexOf('};', end);
  if (blockEnd < start) throw new Error('block end not found');
  blockEnd += 2;

  var block = [];
  block.push('var TIRE_MU_BY_PREP = {');
  block.push('    /**');
  block.push('     * Jorge Guerra µ ↔ 60ft calibrate (tip review/mu-60ft-calibrate).');
  block.push('     * TARGET_60FT mid-band (driver 200, forceScale=1, launch=auto):');
  block.push('     *   Unprep: Street 2.2 · Summer 2.0 · UHP 1.875 · R-comp 1.775 ·');
  block.push('     *           DR 1.685 · Slick 1.85');
  block.push('     *   Prep:   Street 1.725 · Summer 1.6 · UHP 1.475 · R-comp 1.5 ·');
  block.push('     *           Slick 1.475 · DR = slickSim+0.05');
  block.push('     * Refs: Hellcat for ALL unprep + Street prep; Z28 for sticky prep classes.');
  block.push('     * Unprep DR: Hellcat floors ~1.725 (band 1.65-1.72 needs stickier PW).');
  block.push('     * Absolute 60ft still depends on mass/launch; µ sets class traction character.');
  block.push('     * Tunable: edit numbers below or re-run scripts/recalib-mu-60ft.js --apply.');
  block.push('     */');
  block.push('    unprepped: {');
  block.push('      0: ' + muTable.unprepped[0].toFixed(3) + ',  // Street / all-season → ~2.2s Hellcat');
  block.push('      3: ' + muTable.unprepped[3].toFixed(3) + ',  // Summer → ~2.0s Hellcat');
  block.push('      4: ' + muTable.unprepped[4].toFixed(3) + ',  // UHP → ~1.875s Hellcat');
  block.push('      2: ' + muTable.unprepped[2].toFixed(3) + ',  // Slick cold/unprep → ~1.85s Hellcat (behind DR)');
  block.push('      5: ' + muTable.unprepped[5].toFixed(3) + ',  // R-Compound → ~1.775s Hellcat');
  block.push('      1: ' + muTable.unprepped[1].toFixed(3) + '   // Drag Radial → Hellcat floor ~1.725 (band needs stickier PW)');
  block.push('    },');
  block.push('    prepped: {');
  block.push('      0: ' + muTable.prepped[0].toFixed(3) + ',  // Street → ~1.725s Hellcat');
  block.push('      3: ' + muTable.prepped[3].toFixed(3) + ',  // Summer → ~1.6s Z28');
  block.push('      1: ' + muTable.prepped[1].toFixed(3) + ',  // DR → slickSim+0.05 on Z28');
  block.push('      5: ' + muTable.prepped[5].toFixed(3) + ',  // R-Compound → ~1.5s Z28');
  block.push('      4: ' + muTable.prepped[4].toFixed(3) + ',  // UHP → ~1.475s Z28 (near power floor)');
  block.push('      2: ' + muTable.prepped[2].toFixed(3) + '   // Slick → ~1.475s Z28 (near power floor)');
  block.push('    }');
  block.push('  }');

  // Also inject TARGET_60FT_BY_PREP helper table just before TIRE_MU_BY_PREP for explicit tuning
  var helper = [];
  helper.push('  /** Explicit 60ft mid-band targets used to bake TIRE_MU_BY_PREP (Jorge). */');
  helper.push('  var TARGET_60FT_BY_PREP = {');
  helper.push('    unprepped: { 0: 2.20, 3: 2.00, 4: 1.875, 5: 1.775, 1: 1.685, 2: 1.85 },');
  helper.push('    prepped:   { 0: 1.725, 3: 1.60, 4: 1.475, 5: 1.50, 1: ' + drPrepTarget.toFixed(3) + ', 2: 1.475 }');
  helper.push('  };');
  helper.push('');
  helper.push('  ');

  // Remove prior TARGET_60FT_BY_PREP if re-applying
  src = src.replace(/\n  \/\*\* Explicit 60ft mid-band targets[\s\S]*?var TARGET_60FT_BY_PREP = \{[\s\S]*?\};\n\n  /m, '\n  ');

  var before = src.slice(0, start);
  var after = src.slice(blockEnd);
  // Insert helper before TIRE_MU_BY_PREP
  var newSrc = before + helper.join('\n') + block.join('\n') + after;

  // Export TARGET_60FT_BY_PREP on API if not present
  if (newSrc.indexOf('TARGET_60FT_BY_PREP:') < 0) {
    newSrc = newSrc.replace(
      'TIRE_MU_BY_PREP: TIRE_MU_BY_PREP,',
      'TIRE_MU_BY_PREP: TIRE_MU_BY_PREP,\n    TARGET_60FT_BY_PREP: TARGET_60FT_BY_PREP,'
    );
  }

  fs.writeFileSync(PHYSICS_JS, newSrc);
  console.log('Patched', PHYSICS_JS);
}

if (APPLY) {
  patchPhysics(corrected);
  // reload verify
  delete require.cache[require.resolve('../js/physics.js')];
  Phys = require('../js/physics.js');
  console.log('Reloaded TIRE_MU_BY_PREP', JSON.stringify(Phys.TIRE_MU_BY_PREP));
  console.log('TARGET_60FT_BY_PREP', JSON.stringify(Phys.TARGET_60FT_BY_PREP));
}

// WRITE VERIFY.md
function fmt(n, d) { return n == null ? '—' : Number(n).toFixed(d == null ? 3 : d); }

var md = [];
md.push('# VERIFY — µ ↔ 60ft calibrate');
md.push('');
md.push('**Credit:** Jorge Guerra only');
md.push('**Branch:** `review/mu-60ft-calibrate`');
md.push('**Base:** `6464c65` (`review/oem-tire-ev-power-batch`) — sibling tip (EV worktree dirty; no clobber)');
md.push('**Repo:** `01ls1z28-coder/velocitybench-powercurve`');
md.push('**Pages / main:** HOLD for Seraph — tip only');
md.push('**Report:** `scripts/mu-60ft-calibrate-report.json`');
md.push('**Bake:** `node scripts/recalib-mu-60ft.js --apply`');
md.push('');
md.push('## Disclaimer');
md.push('');
md.push('Engine has **no closed-form** µ→60ft. Path: µ → tracLim≈µ×N_axle → softTractionForce → integrate → sixtyFootTime at dist≥60ft. Idealized `t=sqrt(2s/a)` with `a≈µ_eff·g·driveAxleShare` is a sanity check only; sim includes gripMultSmooth, kinetic fall, launch mode, and driveline. Absolute 60ft depends on mass/launch; µ sets class traction character.');
md.push('');
md.push('## Conditions');
md.push('');
md.push('- driverWeightLbs **200**, forceScale **1**, launchMode **auto**');
md.push('- wx 70°F / 45% RH / 29.92 inHg, wind 0');
md.push('');
md.push('## Reference cars');
md.push('');
md.push('| Role | Car | Why |');
md.push('|------|-----|-----|');
md.push('| Hellcat-class | 2020 Dodge Challenger Hellcat (4449 lb, launch 2300) | Traction-limited unprep Street→Slick; Street prep. Power floor **' + fmt(report.refMeta.hellcat.powerFloor) + 's** |');
md.push('| Sticky / race | 2001 Camaro Z28 ATC (3340 lb, launch 3000, factory Slick) | Unprep DR + prep Summer/UHP/R-comp/DR/Slick. Power floor **' + fmt(report.refMeta.z28.powerFloor) + 's** |');
md.push('');
md.push('## (1) µ ↔ 60ft relationship');
md.push('');
md.push('### Idealized vs sim (Hellcat Unprep UHP, rearShare≈' + fmt(hellShare, 2) + ')');
md.push('');
md.push('| µ | Idealized t | Sim 60ft | Ideal−Sim |');
md.push('|--:|----------:|--------:|----------:|');
report.relationship.hellcatUnprepUHP.forEach(function (r) {
  md.push('| ' + fmt(r.mu, 2) + ' | ' + fmt(r.ideal) + ' | ' + fmt(r.sim) + ' | ' + fmt(r.delta) + ' |');
});
md.push('');
md.push('### Idealized vs sim (Z28 Prep Slick, rearShare≈' + fmt(z28Share, 2) + ')');
md.push('');
md.push('| µ | Idealized t | Sim 60ft | Ideal−Sim |');
md.push('|--:|----------:|--------:|----------:|');
report.relationship.z28PrepSlick.forEach(function (r) {
  md.push('| ' + fmt(r.mu, 2) + ' | ' + fmt(r.ideal) + ' | ' + fmt(r.sim) + ' | ' + fmt(r.delta) + ' |');
});
md.push('');
md.push('Idealized is consistently **slower** than sim at the same µ (weight transfer, softTraction overshoot, and launch raise effective axle load above static rear share).');
md.push('');
md.push('## (2) Current µ → off-target 60fts');
md.push('');
md.push('| Prep | Class | Ref | Curr µ | Curr 60ft | Target mid | Δ (s) | In band? |');
md.push('|------|-------|-----|-------:|----------:|-----------:|------:|----------|');
['unprepped', 'prepped'].forEach(function (prep) {
  ORDER.forEach(function (tt) {
    var c = currentOff[prep][tt];
    var band = c.band ? (c.band[0] + '–' + c.band[1]) : '—';
    md.push('| ' + prep + ' | ' + LABELS[tt] + ' | ' + (c.refId === HELL_ID ? 'Hellcat' : 'Z28') +
      ' | ' + fmt(c.currentMu, 2) + ' | ' + fmt(c.currentSixty) + ' | ' + fmt(c.targetMid) +
      ' | ' + (c.delta >= 0 ? '+' : '') + fmt(c.delta) + ' | ' + (c.inBand ? 'yes' : 'NO') + ' |');
  });
});
md.push('');
md.push('## (3) Corrected µ values');
md.push('');
md.push('| tireType | Unprep µ (was→new) | Prep µ (was→new) | Unprep ref 60ft | Prep ref 60ft |');
md.push('|----------|-------------------:|-----------------:|----------------:|--------------:|');
ORDER.forEach(function (tt) {
  var u = results.unprepped[tt];
  var p = results.prepped[tt];
  md.push('| ' + tt + ' ' + LABELS[tt] +
    ' | ' + fmt(u.currentMu, 3) + '→**' + fmt(u.mu, 3) + '**' +
    ' | ' + fmt(p.currentMu, 3) + '→**' + fmt(p.mu, 3) + '**' +
    ' | ' + fmt(u.sixty) + (u.floored ? '†' : '') +
    ' | ' + fmt(p.sixty) + (p.floored ? '†' : '') + ' |');
});
md.push('');
md.push('† = power-floor limited (target below car’s µ→∞ 60ft); µ set to approach floor. Hellcat cannot break ~' + fmt(report.refMeta.hellcat.powerFloor) + 's; Z28 cannot break ~' + fmt(report.refMeta.z28.powerFloor) + 's.');
md.push('');
md.push('### Hellcat ladder (after)');
md.push('');
md.push('| Prep | Street | Summer | UHP | R-Comp | DR | Slick |');
md.push('|------|--------|--------|-----|--------|----|-------|');
(function () {
  var u = hellLadderNew.unprepped, p = hellLadderNew.prepped;
  md.push('| Unprep | ' + u.Street + ' | ' + u.Summer + ' | ' + u.UHP + ' | ' + u['R-Compound'] + ' | ' + u['Drag Radial'] + ' | ' + u.Slick + ' |');
  md.push('| Prep | ' + p.Street + ' | ' + p.Summer + ' | ' + p.UHP + ' | ' + p['R-Compound'] + ' | ' + p['Drag Radial'] + ' | ' + p.Slick + ' |');
})();
md.push('');
md.push('### Z28 ATC ladder (after)');
md.push('');
md.push('| Prep | Street | Summer | UHP | R-Comp | DR | Slick |');
md.push('|------|--------|--------|-----|--------|----|-------|');
(function () {
  var u = z28LadderNew.unprepped, p = z28LadderNew.prepped;
  md.push('| Unprep | ' + u.Street + ' | ' + u.Summer + ' | ' + u.UHP + ' | ' + u['R-Compound'] + ' | ' + u['Drag Radial'] + ' | ' + u.Slick + ' |');
  md.push('| Prep | ' + p.Street + ' | ' + p.Summer + ' | ' + p.UHP + ' | ' + p['R-Compound'] + ' | ' + p['Drag Radial'] + ' | ' + p.Slick + ' |');
})();
md.push('');
md.push('## (4) Code changes (explicit / tunable mapping)');
md.push('');
md.push('- `js/physics.js`: bake corrected `TIRE_MU_BY_PREP`; add `TARGET_60FT_BY_PREP` comment table + export on Phys API');
md.push('- `scripts/recalib-mu-60ft.js`: binary-search calibrator (re-runnable with `--apply`)');
md.push('- No UI redesign; `window.VB_POWERCURVE_GARAGE` bind preserved');
md.push('- Does **not** touch EV launch retune (sibling tip)');
md.push('');
md.push('## Secrets / tracking');
md.push('');
md.push('None in touched files. No API keys, no telemetry pixels.');
md.push('');
md.push('## node --check');
md.push('');
md.push('`js/physics.js` — run at bake time.');
md.push('');

fs.writeFileSync(OUT_VERIFY, md.join('\n'));
console.log('Wrote', OUT_VERIFY);

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to patch physics.js');
}
