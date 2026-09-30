'use strict';
var fs = require('fs');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var meta = require('./garage-calib-meta.json');
var TOL = meta.tol || { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var WX = { tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto' };

function envFor(tireType) {
  return Object.assign({}, WX, { tireType: tireType|0, tireLabel: Phys.tireLabelForType(tireType|0) });
}
function run(car) {
  var r = Phys.runQuarterMile(car, envFor(car.tireType));
  return { z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph, z60130: r.sixtyToOneThirty, sixty: r.sixtyFootTime, vmax: r.topSpeedMph };
}

var byName = {};
meta.results.forEach(function(row){ byName[row.name] = row; });

var stats = { n:0, et:0, trap:0, z60:0, z60130:0, nEt:0, nTrap:0, nZ60:0, n60130:0, allPriority:0, nPriority:0 };
var misses = { trap:[], et:[], z60:[], z60130:[] };
var allRows = [];

GARAGE.forEach(function(car){
  var row = byName[car.name];
  if (!row || !row.tgt) return;
  var tgt = row.tgt;
  var s = run(car);
  stats.n++;
  function check(key, tolKey) {
    var t = tgt[key];
    if (t == null || s[key] == null) return null;
    var nKey = 'n' + (tolKey === 'z60130' ? '60130' : tolKey === 'z60' ? 'Z60' : tolKey === 'et' ? 'Et' : 'Trap');
    stats[nKey]++;
    var ok = Math.abs(s[key]-t) <= TOL[tolKey];
    var hitKey = tolKey === 'z60130' ? 'z60130' : tolKey;
    if (ok) stats[hitKey]++;
    else {
      var missKey = tolKey === 'z60130' ? 'z60130' : (key === 'z60' ? 'z60' : key);
      misses[missKey].push({
        name: car.name, id: car.id, sim: s[key], tgt: t, d: s[key]-t,
        et:s.et, trap:s.trap, z60:s.z60, z60130:s.z60130, sixty:s.sixty,
        loss: car.drivetrainLossPercent, tire: car.tireType, Cd: car.dragCoefficient,
        fd: car.finalDriveRatio, fs: car.forceScale, peakTqRpm: car.peakTqRpm, peakHpRpm: car.peakHpRpm,
        isEv: !!car.isEv
      });
    }
    return ok;
  }
  var hEt = check('et','et');
  var hTrap = check('trap','trap');
  var h60 = check('z60','z60');
  var h60130 = check('z60130','z60130');
  var priOk = (hEt !== false) && (hTrap !== false) && (h60 !== false);
  if (tgt.z60130 != null) priOk = priOk && (h60130 !== false);
  if (tgt.et != null || tgt.trap != null || tgt.z60 != null) {
    stats.nPriority++;
    if (priOk) stats.allPriority++;
  }
  allRows.push({
    name: car.name, id: car.id, tgt: tgt, sim: s,
    hits: { et: hEt, trap: hTrap, z60: h60, z60130: h60130 },
    loss: car.drivetrainLossPercent, tire: car.tireType, Cd: car.dragCoefficient, fs: car.forceScale
  });
});

function top(arr, n) {
  return arr.slice().sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);}).slice(0,n);
}

var out = {
  tipParent: 'd102976 + c931e63 cherry-pick',
  fleet: GARAGE.length,
  matched: stats.n,
  hitRates: {
    et: stats.et+'/'+stats.nEt,
    trap: stats.trap+'/'+stats.nTrap,
    z60: stats.z60+'/'+stats.nZ60,
    z60130: stats.z60130+'/'+stats.n60130,
    allPriority: stats.allPriority+'/'+stats.nPriority
  },
  missCounts: { et: misses.et.length, trap: misses.trap.length, z60: misses.z60.length, z60130: misses.z60130.length },
  worstTrap: top(misses.trap, 40),
  worstEt: top(misses.et, 25),
  worst60: top(misses.z60, 25),
  worst60130: top(misses.z60130, 25),
  rows: allRows
};
fs.writeFileSync('/workspace/powercurve-fleet-audit-live-tip.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ hitRates: out.hitRates, missCounts: out.missCounts }, null, 2));
console.log('\nWORST TRAP');
out.worstTrap.slice(0,30).forEach(function(m){
  console.log([m.name, 'd'+m.d.toFixed(1), 'sim'+m.sim.toFixed(1), 'tgt'+m.tgt, 'et'+m.et.toFixed(2), 'z60'+m.z60.toFixed(2), 'loss'+m.loss, 'Cd'+m.Cd, m.isEv?'EV':''].join(' | '));
});
console.log('\nWORST 0-60');
out.worst60.slice(0,20).forEach(function(m){
  console.log([m.name, 'd'+m.d.toFixed(2), m.sim.toFixed(2)+' vs '+m.tgt].join(' | '));
});
console.log('\nWORST 60-130');
out.worst60130.slice(0,20).forEach(function(m){
  console.log([m.name, 'd'+m.d.toFixed(2), m.sim.toFixed(2)+' vs '+m.tgt].join(' | '));
});
