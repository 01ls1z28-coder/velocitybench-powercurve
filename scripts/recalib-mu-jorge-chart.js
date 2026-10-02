/**
 * Bake TIRE_MU_BY_PREP to Jorge AUTHORITATIVE Mustang GT 60ft chart.
 * Credit: Jorge Guerra only. Tip review/ev-excel-full-match.
 *   node scripts/recalib-mu-jorge-chart.js --apply
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var APPLY = process.argv.indexOf('--apply') >= 0;
var PHYSICS_JS = path.join(__dirname, '..', 'js', 'physics.js');
var REPORT = path.join(__dirname, 'mu-jorge-chart-report.json');

var LABELS = { 0: 'Street', 1: 'DR', 2: 'Slick', 3: 'Summer', 4: 'UHP', 5: 'R-Comp' };
var ORDER = [0, 3, 4, 5, 1, 2];
var MUSTANG_ID = '2020-ford-mustang-gt';

/** AUTHORITATIVE Jorge chart (Mustang GT 10AT, driver 200, fs=1). */
var CHART = {
  unprepped: { 0: 2.200, 3: 2.103, 4: 1.960, 5: 1.900, 1: 1.820, 2: 1.908 },
  prepped:   { 0: 2.040, 3: 1.989, 4: 1.900, 5: 1.850, 1: 1.730, 2: 1.708 }
};

function find(id) {
  var c = GARAGE.find(function (x) { return x.id === id; });
  if (!c) throw new Error('missing ' + id);
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

function searchMu(car, prep, tireType, target) {
  var floor = powerFloor(car, prep, tireType);
  var floored = target < floor - 0.002;
  var lo = 0.55, hi = 3.50;
  // Always search — if floored, get as close as possible with high µ
  var bestMu = lo, bestT = runSixty(car, prep, tireType, lo), bestErr = Math.abs(bestT - target);
  var lo2 = lo, hi2 = hi;
  for (var k = 0; k < 36; k++) {
    var m2 = (lo2 + hi2) / 2;
    var tt2 = runSixty(car, prep, tireType, m2);
    var err = Math.abs(tt2 - target);
    if (err < bestErr) { bestErr = err; bestMu = m2; bestT = tt2; }
    // higher µ → lower 60ft
    if (tt2 > target) lo2 = m2;
    else hi2 = m2;
  }
  bestMu = Math.round(bestMu * 1000) / 1000;
  bestT = runSixty(car, prep, tireType, bestMu);
  // fine
  for (var d = -0.02; d <= 0.02; d += 0.001) {
    var m3 = Math.round((bestMu + d) * 1000) / 1000;
    if (m3 < 0.5 || m3 > 4) continue;
    var t3 = runSixty(car, prep, tireType, m3);
    if (Math.abs(t3 - target) < Math.abs(bestT - target)) { bestMu = m3; bestT = t3; }
  }
  return {
    mu: bestMu,
    sixty: +bestT.toFixed(3),
    floor: +floor.toFixed(3),
    floored: floored || Math.abs(bestT - floor) < 0.008,
    target: target,
    err: +(bestT - target).toFixed(3),
    note: (floored || Math.abs(bestT - target) > 0.01)
      ? ('closest; floor=' + floor.toFixed(3) + (floored ? ' TARGET_BELOW_FLOOR' : ''))
      : null
  };
}

function main() {
  var mustang = find(MUSTANG_ID);
  console.error('Ref', mustang.name, 'wt', mustang.weightLbs, 'tire', mustang.tireType);

  // BEFORE with current baked µ (table values, not env override)
  var before = { unprepped: {}, prepped: {} };
  ORDER.forEach(function (tt) {
    before.unprepped[LABELS[tt]] = +runSixty(mustang, 'unprepped', tt, Phys.TIRE_MU_BY_PREP.unprepped[tt]).toFixed(3);
    before.prepped[LABELS[tt]] = +runSixty(mustang, 'prepped', tt, Phys.TIRE_MU_BY_PREP.prepped[tt]).toFixed(3);
  });

  var corrected = { unprepped: {}, prepped: {} };
  var afterDetail = { unprepped: {}, prepped: {} };
  var flags = [];

  ['unprepped', 'prepped'].forEach(function (prep) {
    ORDER.forEach(function (tt) {
      var tgt = CHART[prep][tt];
      process.stderr.write('… ' + prep + ' ' + LABELS[tt] + ' → ' + tgt + '\n');
      var r = searchMu(mustang, prep, tt, tgt);
      corrected[prep][tt] = r.mu;
      afterDetail[prep][LABELS[tt]] = r;
      console.error('  mu=' + r.mu + ' sixty=' + r.sixty + ' err=' + r.err + (r.note ? ' ' + r.note : ''));
      if (Math.abs(r.err) > 0.01) flags.push(prep + ' ' + LABELS[tt] + ': ' + r.note + ' err=' + r.err);
    });
  });

  // AFTER matrix from corrected µ
  var after = { unprepped: {}, prepped: {} };
  ORDER.forEach(function (tt) {
    after.unprepped[LABELS[tt]] = +runSixty(mustang, 'unprepped', tt, corrected.unprepped[tt]).toFixed(3);
    after.prepped[LABELS[tt]] = +runSixty(mustang, 'prepped', tt, corrected.prepped[tt]).toFixed(3);
  });

  var chartPretty = {
    unprepped: {}, prepped: {}
  };
  ORDER.forEach(function (tt) {
    chartPretty.unprepped[LABELS[tt]] = CHART.unprepped[tt];
    chartPretty.prepped[LABELS[tt]] = CHART.prepped[tt];
  });

  var report = {
    credit: 'Jorge Guerra',
    tip: 'review/ev-excel-full-match',
    ref: MUSTANG_ID,
    chart: chartPretty,
    before: before,
    after: after,
    mu: corrected,
    detail: afterDetail,
    flags: flags,
    prepSlickVsDr: +(after.prepped.DR - after.prepped.Slick).toFixed(3)
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ before: before, after: after, chart: chartPretty, mu: corrected, flags: flags, prepSlickVsDr: report.prepSlickVsDr }, null, 2));

  if (!APPLY) {
    console.error('Dry-run only. Pass --apply to bake physics.js');
    return;
  }

  var src = fs.readFileSync(PHYSICS_JS, 'utf8');
  var tgtBlock =
    '  /** Explicit 60ft targets used to bake TIRE_MU_BY_PREP (Jorge Mustang GT chart). */\n' +
    '  var TARGET_60FT_BY_PREP = {\n' +
    '    unprepped: { 0: 2.200, 3: 2.103, 4: 1.960, 5: 1.900, 1: 1.820, 2: 1.908 },\n' +
    '    prepped:   { 0: 2.040, 3: 1.989, 4: 1.900, 5: 1.850, 1: 1.730, 2: 1.708 }\n' +
    '  };\n\n';

  var muBlock =
    '  var TIRE_MU_BY_PREP = {\n' +
    '    /**\n' +
    '     * Jorge Guerra AUTHORITATIVE Mustang GT 60ft chart (tip review/ev-excel-full-match).\n' +
    '     * Unprep: Street 2.200 · Summer 2.103 · UHP 1.960 · R-Comp 1.900 · DR 1.820 · Slick 1.908\n' +
    '     * Prep:   Street 2.040 · Summer 1.989 · UHP 1.900 · R-Comp 1.850 · DR 1.730 · Slick 1.708\n' +
    '     * Prep Slick 0.022s faster than DR (chart). forceScale=1, driver 200.\n' +
    '     */\n' +
    '    unprepped: {\n' +
    '      0: ' + corrected.unprepped[0].toFixed(3) + ',  // Street → ~' + after.unprepped.Street + 's\n' +
    '      3: ' + corrected.unprepped[3].toFixed(3) + ',  // Summer → ~' + after.unprepped.Summer + 's\n' +
    '      4: ' + corrected.unprepped[4].toFixed(3) + ',  // UHP → ~' + after.unprepped.UHP + 's\n' +
    '      2: ' + corrected.unprepped[2].toFixed(3) + ',  // Slick → ~' + after.unprepped.Slick + 's\n' +
    '      5: ' + corrected.unprepped[5].toFixed(3) + ',  // R-Compound → ~' + after.unprepped['R-Comp'] + 's\n' +
    '      1: ' + corrected.unprepped[1].toFixed(3) + '   // Drag Radial → ~' + after.unprepped.DR + 's\n' +
    '    },\n' +
    '    prepped: {\n' +
    '      0: ' + corrected.prepped[0].toFixed(3) + ',  // Street → ~' + after.prepped.Street + 's\n' +
    '      3: ' + corrected.prepped[3].toFixed(3) + ',  // Summer → ~' + after.prepped.Summer + 's\n' +
    '      1: ' + corrected.prepped[1].toFixed(3) + ',  // DR → ~' + after.prepped.DR + 's\n' +
    '      5: ' + corrected.prepped[5].toFixed(3) + ',  // R-Compound → ~' + after.prepped['R-Comp'] + 's\n' +
    '      4: ' + corrected.prepped[4].toFixed(3) + ',  // UHP → ~' + after.prepped.UHP + 's\n' +
    '      2: ' + corrected.prepped[2].toFixed(3) + '   // Slick → ~' + after.prepped.Slick + 's\n' +
    '    }\n' +
    '  };';

  // Remove existing TARGET block then replace TIRE_MU_BY_PREP
  if (/var TARGET_60FT_BY_PREP\s*=/.test(src)) {
    src = src.replace(/\n?\s*\/\*\*[^*]*Explicit 60ft[\s\S]*?var TARGET_60FT_BY_PREP\s*=\s*\{[\s\S]*?\};\n\n/, '\n');
  }
  if (!/var TIRE_MU_BY_PREP\s*=/.test(src)) throw new Error('TIRE_MU_BY_PREP missing');
  src = src.replace(/var TIRE_MU_BY_PREP\s*=\s*\{[\s\S]*?\n  \};/, muBlock);
  // Insert TARGET just above TIRE_MU
  src = src.replace(/var TIRE_MU_BY_PREP\s*=/, tgtBlock + '  var TIRE_MU_BY_PREP =');

  fs.writeFileSync(PHYSICS_JS, src);
  console.error('Applied to', PHYSICS_JS);

  // Re-verify from disk
  delete require.cache[require.resolve('../js/physics.js')];
  var P2 = require('../js/physics.js');
  var verify = { unprepped: {}, prepped: {} };
  ORDER.forEach(function (tt) {
    verify.unprepped[LABELS[tt]] = +runSixty(mustang, 'unprepped', tt, P2.TIRE_MU_BY_PREP.unprepped[tt]).toFixed(3);
    verify.prepped[LABELS[tt]] = +runSixty(mustang, 'prepped', tt, P2.TIRE_MU_BY_PREP.prepped[tt]).toFixed(3);
  });
  report.verifyAfterBake = verify;
  report.bakedMu = P2.TIRE_MU_BY_PREP;
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('VERIFY_AFTER_BAKE', JSON.stringify(verify, null, 2));
  console.log('BAKED_MU', JSON.stringify(P2.TIRE_MU_BY_PREP));
}

main();
