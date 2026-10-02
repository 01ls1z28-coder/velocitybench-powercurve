'use strict';
var fs = require('fs');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var REPORT = require('./ev-excel-full-match-report.json');
var TARGETS = require('./excel-corrected-targets.json');
var TOL = { trap: 0.5, et: 0.05, z60130: 0.05, z60: 0.05, ft60: 0.05 };
var WX = { tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto' };
function clone(o){return JSON.parse(JSON.stringify(o));}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function tgtMap(){var m={};TARGETS.forEach(function(t){m[t.name]=t;});return m;}
function scaleCurve(curve,s){if(!curve||!(s>0)||Math.abs(s-1)<1e-9)return curve;var o={};Object.keys(curve).forEach(function(k){o[k]=Math.round(curve[k]*s*10000)/10000;});return o;}
function applyPower(car,newHp){var old=Number(car.peakHp)||1;var s=newHp/old;car.peakHp=Math.round(newHp);if(car.torqueCurve)car.torqueCurve=scaleCurve(car.torqueCurve,s);}
function runSim(car,need613){
  var r=Phys.runQuarterMile(car,Object.assign({},WX,{tireType:car.tireType|0,needSixtyToOneThirty:!!need613,tireLabel:Phys.tireLabelForType(car.tireType|0)}));
  return {z60:r.zeroToSixty!=null?+Number(r.zeroToSixty).toFixed(3):null,et:r.quarterMileTime!=null?+Number(r.quarterMileTime).toFixed(3):null,trap:r.quarterMileSpeedMph!=null?+Number(r.quarterMileSpeedMph).toFixed(2):null,z60130:r.sixtyToOneThirty!=null?+Number(r.sixtyToOneThirty).toFixed(3):null,ft60:r.sixtyFootTime!=null?+Number(r.sixtyFootTime).toFixed(3):null};
}
function hit(sim,tgt,k){if(tgt[k]==null||sim[k]==null)return null;return Math.abs(sim[k]-tgt[k])<=TOL[k];}
function allHit(sim,tgt){return ['trap','et','z60130','z60','ft60'].every(function(k){return hit(sim,tgt,k)!==false;});}
function missVec(sim,tgt){function m(k,sc){if(tgt[k]==null||sim[k]==null)return 0;var d=Math.abs(sim[k]-tgt[k]);return d<=TOL[k]?0:(d-TOL[k])*sc;}return [m('trap',10),m('et',20),m('z60130',15),m('z60',12),m('ft60',10)];}
function better(a,b){for(var i=0;i<a.length;i++){if(a[i]<b[i]-1e-9)return true;if(a[i]>b[i]+1e-9)return false;}return false;}

var targets=tgtMap();
var missNames=REPORT.remainingMisses.map(function(m){return m.name;});
var cars=clone(GARAGE);
var rows=[];

cars.forEach(function(car){
  if(missNames.indexOf(car.name)<0) return;
  var tgt=targets[car.name]; if(!tgt) return;
  var need613=tgt.z60130!=null;
  var best=null;
  var baseDrag=Number(car.dragCoefficient)||0.28;
  function consider(hp,drive,mu,drag,lim){
    var c=clone(car);
    applyPower(c,hp);
    c.evLaunchDriveMult=clamp(drive,0.7,1.55);
    c.evLaunchMuMult=clamp(mu,0.85,1.28);
    c.dragCoefficient=drag;
    if(lim!=null&&lim>0) c.speedLimiterMph=+Number(lim).toFixed(1);
    c.forceScale=1;
    var sim=runSim(c,need613);
    var cfg={hp:c.peakHp,drive:c.evLaunchDriveMult,mu:c.evLaunchMuMult,drag:drag,lim:c.speedLimiterMph,sim:sim,miss:missVec(sim,tgt),car:c};
    if(!best||better(cfg.miss,best.miss)) best=cfg;
    return cfg;
  }
  consider(car.peakHp, car.evLaunchDriveMult||1.1, car.evLaunchMuMult||1.06, baseDrag, car.speedLimiterMph);
  var lim = tgt.trap!=null ? tgt.trap+0.35 : (car.speedLimiterMph||0);
  var hp=car.peakHp, drive=Math.max(car.evLaunchDriveMult||1.1,1.25), mu=Math.max(car.evLaunchMuMult||1.06,1.12), drag=baseDrag;
  for(var r=0;r<20;r++){
    var cur=consider(hp,drive,mu,drag,lim||undefined);
    var s=cur.sim;
    if(tgt.z60!=null && s.z60!=null && !hit(s,tgt,'z60')){
      if(s.z60>tgt.z60){ drive=clamp(drive+0.04,0.7,1.55); mu=clamp(mu+0.025,0.85,1.28); if(drive>=1.54){ hp=Math.round(hp*1.025); lim=tgt.trap!=null?tgt.trap+0.35:lim; } }
      else { drive=clamp(drive-0.025,0.7,1.55); }
    }
    if(tgt.et!=null && s.et!=null && !hit(s,tgt,'et')){
      hp=Math.round(hp*Math.pow(s.et/tgt.et, s.et>tgt.et?1.35:1.2));
      if(s.et>tgt.et) drive=clamp(drive+0.02,0.7,1.55);
    }
    if(tgt.trap!=null && s.trap!=null && !hit(s,tgt,'trap')){
      if(s.trap>tgt.trap+TOL.trap) lim=tgt.trap+0.25;
      else { lim=tgt.trap+0.55; hp=Math.round(hp*1.03); }
    }
    if(need613 && s.z60130!=null && !hit(s,tgt,'z60130')){
      if(s.z60130>tgt.z60130){ hp=Math.round(hp*1.05); drag=clamp(drag*0.96,baseDrag*0.80,baseDrag*1.25); lim=tgt.trap!=null?tgt.trap+0.4:lim; }
      else { drag=clamp(drag*1.06,baseDrag*0.80,baseDrag*1.25); }
    }
    if(best&&allHit(best.sim,tgt)) break;
  }
  // tiny local refine (no explosion)
  if(best&&!allHit(best.sim,tgt)){
    for(var dh=-8;dh<=12;dh+=2){
      consider(best.hp+dh, best.drive, best.mu, best.drag, best.lim||lim);
      consider(best.hp+dh, clamp(best.drive+0.05,0.7,1.55), clamp(best.mu+0.03,0.85,1.28), best.drag, best.lim||lim);
      consider(best.hp+dh, clamp(best.drive+0.08,0.7,1.55), clamp(best.mu+0.05,0.85,1.28), +(best.drag*0.97).toFixed(4), best.lim||lim);
      consider(best.hp+dh, best.drive, best.mu, +(best.drag*1.08).toFixed(4), best.lim||lim);
      if(best&&allHit(best.sim,tgt)) break;
    }
  }
  var b=best.car;
  car.peakHp=b.peakHp; car.torqueCurve=b.torqueCurve;
  car.evLaunchDriveMult=b.evLaunchDriveMult; car.evLaunchMuMult=b.evLaunchMuMult;
  car.dragCoefficient=b.dragCoefficient; if(b.speedLimiterMph!=null) car.speedLimiterMph=b.speedLimiterMph;
  car.forceScale=1;
  var ok=allHit(best.sim,tgt);
  process.stderr.write((ok?'OK ':'MISS ')+car.name+' hp='+car.peakHp+' T '+best.sim.trap+'/'+(tgt.trap||'-')+' ET '+best.sim.et+'/'+(tgt.et||'-')+' 613 '+best.sim.z60130+'/'+(tgt.z60130||'-')+' 60 '+best.sim.z60+'/'+(tgt.z60||'-')+'\n');
  rows.push({name:car.name,ok:ok,sim:best.sim,after:{hp:car.peakHp,drive:car.evLaunchDriveMult,mu:car.evLaunchMuMult,drag:car.dragCoefficient,lim:car.speedLimiterMph}});
});

var header=['/**',' * VelocityBench PowerCurve — static garage data (baked).',' * Tip review/ev-excel-full-match: Jorge µ chart + EV Excel full-match (+closer).',' * forceScale=1. Credit: Jorge Guerra only.',' */','(function (global) {','  var GARAGE = '].join('\n');
var footer=';\n  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n  if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n  }\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n';
fs.writeFileSync('js/garage-data.js', header+JSON.stringify(cars,null,2)+footer);

var hits={trap:[0,0],et:[0,0],z60130:[0,0],z60:[0,0]};
var still=[];
cars.forEach(function(car){
  if(!car.isEv) return;
  var tgt=targets[car.name]; if(!tgt) return;
  var sim=runSim(car,tgt.z60130!=null);
  ['trap','et','z60130','z60'].forEach(function(k){var h=hit(sim,tgt,k); if(h==null)return; hits[k][1]++; if(h)hits[k][0]++;});
  if(!allHit(sim,tgt)) still.push({name:car.name,sim:sim,excel:{trap:tgt.trap,et:tgt.et,z60:tgt.z60,z60130:tgt.z60130}});
});
var out={hitRates:{trap:hits.trap[0]+'/'+hits.trap[1],et:hits.et[0]+'/'+hits.et[1],z60130:hits.z60130[0]+'/'+hits.z60130[1],z60:hits.z60[0]+'/'+hits.z60[1]},stillMiss:still,closerRows:rows};
fs.writeFileSync('scripts/ev-miss-closer-report.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({hitRates:out.hitRates,still:still.length,names:still.map(function(s){return s.name;})},null,2));
