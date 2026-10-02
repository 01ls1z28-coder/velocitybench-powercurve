#!/usr/bin/env node
'use strict';
/**
 * Durable one-EV (or small batch) Garage closer wrapper.
 * Tip-only. Jorge Guerra only. No Pages.
 *
 *   node scripts/chunk-ev-one.js --id=2024-tesla-model-3-performance
 *   node scripts/chunk-ev-one.js --next-miss          # first miss only (--limit=1)
 *   node scripts/chunk-ev-one.js --limit=3            # next 3 misses
 *
 * Delegates to recalib-ev-lean-closer.js which checkpoints garage-data.js + progress JSON per car.
 */
var fs = require('fs');
var path = require('path');
var { spawnSync } = require('child_process');
var PROG = path.join(__dirname, 'chunk-progress.json');

function patchProg(patch) {
  var o = {};
  try { o = JSON.parse(fs.readFileSync(PROG, 'utf8')); } catch (e) {}
  o.credit = 'Jorge Guerra only';
  o.updated = new Date().toISOString();
  o.current = Object.assign({}, o.current || {}, patch);
  fs.writeFileSync(PROG, JSON.stringify(o, null, 2));
}

var args = process.argv.slice(2);
var only = null, limit = null, nextMiss = false;
args.forEach(function (a) {
  if (a === '--next-miss') nextMiss = true;
  else if (a.indexOf('--id=') === 0) only = a.slice(5);
  else if (a.indexOf('--only=') === 0) only = a.slice(7);
  else if (a.indexOf('--limit=') === 0) limit = a.slice(8);
});
if (nextMiss && limit == null) limit = '1';

var childArgs = [];
if (only) childArgs.push('--only=' + only);
if (limit) childArgs.push('--limit=' + limit);

patchProg({ status: 'starting', childArgs: childArgs, note: 'delegating to recalib-ev-lean-closer.js' });
var r = spawnSync(process.execPath, [path.join(__dirname, 'recalib-ev-lean-closer.js')].concat(childArgs), {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit'
});
var leanProg = {};
try { leanProg = JSON.parse(fs.readFileSync(path.join(__dirname, 'ev-lean-closer-progress.json'), 'utf8')); } catch (e) {}
var final = null;
try { final = JSON.parse(fs.readFileSync(path.join(__dirname, 'ev-lean-closer-final.json'), 'utf8')); } catch (e) {}
patchProg({
  status: r.status === 0 ? 'finished' : 'finished_nonzero',
  exitCode: r.status,
  leanProgress: leanProg,
  hitRates: final && final.hitRates,
  miss: final && final.miss
});
process.exit(r.status == null ? 1 : r.status);
