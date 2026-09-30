'use strict';
var fs = require('fs');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var byName = {};
TARGETS.forEach(function (t) { byName[t.name] = t; });

function run(car) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: car.tireType | 0, tireLabel: Phys.tireLabelForType(car.tireType | 0),
    needSixtyToOneThirty: true
  });
  return {
    z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    z60130: r.sixtyToOneThirty, sixty: r.sixtyFootTime, vmax: r.topSpeedMph
  };
}
function abs(a,b){ return (a==null||b==null)?null:Math.abs(a-b); }

var stats = { n:0, et:0,trap:0,z60:0,z60130:0, nEt:0,nTrap:0,nZ60:0,n60130:0, all4:0, nAll4:0,
  sumEt:0,sumTrap:0,sum60:0,sum60130:0, sumSixty:0, nSixtySim:0 };
var misses = { et:[], trap:[], z60:[], z60130:[] };
var rows = [];

GARAGE.forEach(function (car) {
  var t = byName[car.name];
  if (!t) return;
  var tgt = { z60:t.z60, et:t.et, trap:t.trap, z60130:t.z60130 };
  if (tgt.et==null && tgt.trap==null && tgt.z60==null) return;
  var s = run(car);
  stats.n++;
  var h = {};
  function chk(k, tolKey) {
    if (tgt[k]==null || s[k]==null) { h[k]=null; return; }
    var e = Math.abs(s[k]-tgt[k]);
    var ok = e <= TOL[tolKey];
    h[k]=ok;
    if (k==='et'){ stats.nEt++; stats.sumEt+=e; if(ok)stats.et++; else misses.et.push({name:car.name,d:s[k]-tgt[k],sim:s[k],tgt:tgt[k],trap:s.trap,z60:s.z60}); }
    if (k==='trap'){ stats.nTrap++; stats.sumTrap+=e; if(ok)stats.trap++; else misses.trap.push({name:car.name,d:s[k]-tgt[k],sim:s[k],tgt:tgt[k],et:s.et}); }
    if (k==='z60'){ stats.nZ60++; stats.sum60+=e; if(ok)stats.z60++; else misses.z60.push({name:car.name,d:s[k]-tgt[k],sim:s[k],tgt:tgt[k]}); }
    if (k==='z60130'){ stats.n60130++; stats.sum60130+=e; if(ok)stats.z60130++; else misses.z60130.push({name:car.name,d:s[k]-tgt[k],sim:s[k],tgt:tgt[k]}); }
  }
  chk('et','et'); chk('trap','trap'); chk('z60','z60'); chk('z60130','z60130');
  if (s.sixty!=null){ stats.nSixtySim++; stats.sumSixty+=s.sixty; }
  var need = ['et','trap','z60'];
  if (tgt.z60130!=null) need.push('z60130');
  var allOk = need.every(function(k){ return h[k]!==false; });
  stats.nAll4++;
  if (allOk) stats.all4++;
  rows.push({ name:car.name, id:car.id, tgt:tgt, sim:s, hits:h,
    loss:car.drivetrainLossPercent, tire:car.tireType, launch:car.launchRpm, fs:car.forceScale });
});

function top(arr,n){ return arr.slice().sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);}).slice(0,n); }

var out = {
  soi: 'VelocityBench_Garage_Corrected.xlsx + L_Fixes',
  tol: TOL,
  fleet: GARAGE.length,
  matched: stats.n,
  hitRates: {
    et: stats.et+'/'+stats.nEt,
    trap: stats.trap+'/'+stats.nTrap,
    z60: stats.z60+'/'+stats.nZ60,
    z60130: stats.z60130+'/'+stats.n60130,
    priorityAll: stats.all4+'/'+stats.nAll4
  },
  mae: {
    et: +(stats.sumEt/Math.max(1,stats.nEt)).toFixed(3),
    trap: +(stats.sumTrap/Math.max(1,stats.nTrap)).toFixed(2),
    z60: +(stats.sum60/Math.max(1,stats.nZ60)).toFixed(3),
    z60130: +(stats.sum60130/Math.max(1,stats.n60130)).toFixed(3),
    sixtyFoot_sim_mean: +(stats.sumSixty/Math.max(1,stats.nSixtySim)).toFixed(3)
  },
  missCounts: { et:misses.et.length, trap:misses.trap.length, z60:misses.z60.length, z60130:misses.z60130.length },
  worstTrap: top(misses.trap, 20),
  worstEt: top(misses.et, 15),
  worst60: top(misses.z60, 15),
  worst60130: top(misses.z60130, 10),
  forceScaleNonOne: rows.filter(function(r){return r.fs!==1;}).length
};
fs.writeFileSync('/workspace/powercurve-fleet-verify-corrected.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ hitRates: out.hitRates, mae: out.mae, missCounts: out.missCounts, forceScaleNonOne: out.forceScaleNonOne }, null, 2));
console.log('\nWORST TRAP');
out.worstTrap.forEach(function(m){ console.log(m.name, 'd'+m.d.toFixed(1), m.sim.toFixed(1)+' vs '+m.tgt, 'et'+m.et.toFixed(2)); });
console.log('\nWORST ET');
out.worstEt.forEach(function(m){ console.log(m.name, 'd'+m.d.toFixed(2), m.sim.toFixed(2)+' vs '+m.tgt); });
console.log('\nWORST 0-60');
out.worst60.forEach(function(m){ console.log(m.name, 'd'+m.d.toFixed(2), m.sim.toFixed(2)+' vs '+m.tgt); });
console.log('\nWORST 60-130');
out.worst60130.forEach(function(m){ console.log(m.name, 'd'+m.d.toFixed(2), m.sim.toFixed(2)+' vs '+m.tgt); });
