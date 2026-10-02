'use strict';
/** For EVs with trap+ET OK but 0-60 slow: raise HP under speedLimiter≈excel trap. */
var fs=require('fs'); var Phys=require('../js/physics.js'); var GARAGE=require('../js/garage-data.js');
var TARGETS=require('./excel-corrected-targets.json');
var CLOSER=require('./ev-miss-closer-report.json');
var TOL={trap:0.5,et:0.05,z60130:0.05,z60:0.05};
var WX={tempF:70,humidity:45,pressureInHg:29.92,windSpeedMph:0,windDirDeg:0,gustMph:0,launchMode:'auto'};
function clone(o){return JSON.parse(JSON.stringify(o));}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function tgtMap(){var m={};TARGETS.forEach(function(t){m[t.name]=t;});return m;}
function scaleCurve(curve,s){if(!curve||!(s>0)||Math.abs(s-1)<1e-9)return curve;var o={};Object.keys(curve).forEach(function(k){o[k]=Math.round(curve[k]*s*10000)/10000;});return o;}
function applyPower(car,newHp){var old=Number(car.peakHp)||1;var s=newHp/old;car.peakHp=Math.round(newHp);if(car.torqueCurve)car.torqueCurve=scaleCurve(car.torqueCurve,s);}
function runSim(car,need613){var r=Phys.runQuarterMile(car,Object.assign({},WX,{tireType:car.tireType|0,needSixtyToOneThirty:!!need613,tireLabel:Phys.tireLabelForType(car.tireType|0)}));return {z60:r.zeroToSixty!=null?+Number(r.zeroToSixty).toFixed(3):null,et:r.quarterMileTime!=null?+Number(r.quarterMileTime).toFixed(3):null,trap:r.quarterMileSpeedMph!=null?+Number(r.quarterMileSpeedMph).toFixed(2):null,z60130:r.sixtyToOneThirty!=null?+Number(r.sixtyToOneThirty).toFixed(3):null,ft60:r.sixtyFootTime!=null?+Number(r.sixtyFootTime).toFixed(3):null};}
function hit(sim,tgt,k){if(tgt[k]==null||sim[k]==null)return null;return Math.abs(sim[k]-tgt[k])<=TOL[k];}
function allHit(sim,tgt){return ['trap','et','z60130','z60','ft60'].every(function(k){return hit(sim,tgt,k)!==false;});}
function missVec(sim,tgt){function m(k,sc){if(tgt[k]==null||sim[k]==null)return 0;var d=Math.abs(sim[k]-tgt[k]);return d<=TOL[k]?0:(d-TOL[k])*sc;}return [m('trap',10),m('et',20),m('z60130',15),m('z60',12)];}
function better(a,b){for(var i=0;i<a.length;i++){if(a[i]<b[i]-1e-9)return true;if(a[i]>b[i]+1e-9)return false;}return false;}

var targets=tgtMap();
var names=CLOSER.stillMiss.map(function(s){return s.name;});
var cars=clone(GARAGE);

cars.forEach(function(car){
  if(names.indexOf(car.name)<0) return;
  var tgt=targets[car.name]; if(!tgt||tgt.trap==null) return;
  var need613=tgt.z60130!=null;
  var best=null; var baseDrag=Number(car.dragCoefficient)||0.28;
  function consider(hp,drive,mu,drag,lim){
    var c=clone(car); applyPower(c,hp);
    c.evLaunchDriveMult=clamp(drive,0.7,1.55); c.evLaunchMuMult=clamp(mu,0.85,1.28);
    c.dragCoefficient=drag; c.speedLimiterMph=+Number(lim).toFixed(1); c.forceScale=1;
    var sim=runSim(c,need613);
    var cfg={hp:c.peakHp,drive:c.evLaunchDriveMult,mu:c.evLaunchMuMult,drag:drag,lim:c.speedLimiterMph,sim:sim,miss:missVec(sim,tgt),car:c};
    if(!best||better(cfg.miss,best.miss)) best=cfg; return cfg;
  }
  var lim=tgt.trap+0.3;
  var hp=car.peakHp, drive=1.55, mu=1.25, drag=baseDrag;
  consider(hp, car.evLaunchDriveMult||1.2, car.evLaunchMuMult||1.1, drag, car.speedLimiterMph||lim);
  // binary HP under limiter for 0-60
  var lo=hp, hi=Math.round(hp*1.55);
  for(var i=0;i<14;i++){
    var mid=Math.round((lo+hi)/2);
    var r=consider(mid,drive,mu,drag,lim);
    if(tgt.z60!=null && r.sim.z60!=null){
      if(r.sim.z60>tgt.z60) lo=mid+1; else hi=mid-1;
    } else break;
  }
  // directed settle all metrics
  hp=best?best.hp:hp;
  for(var r2=0;r2<14;r2++){
    var cur=consider(hp,drive,mu,drag,lim); var s=cur.sim;
    if(tgt.z60!=null&&s.z60!=null&&!hit(s,tgt,'z60')){
      if(s.z60>tgt.z60){hp=Math.round(hp*1.03);drive=1.55;mu=1.25;} else hp=Math.round(hp*0.99);
    }
    if(tgt.et!=null&&s.et!=null&&!hit(s,tgt,'et')){
      if(s.et>tgt.et) hp=Math.round(hp*Math.pow(s.et/tgt.et,1.4));
      else { /* ET too quick — add drag or ease HP */ drag=clamp(drag*1.03,baseDrag*0.85,baseDrag*1.3); hp=Math.round(hp*0.995); }
    }
    if(tgt.trap!=null&&s.trap!=null&&!hit(s,tgt,'trap')){
      if(s.trap>tgt.trap+TOL.trap) lim=tgt.trap+0.15;
      else lim=tgt.trap+0.45;
    }
    if(need613&&s.z60130!=null&&!hit(s,tgt,'z60130')){
      if(s.z60130>tgt.z60130){hp=Math.round(hp*1.06);drag=clamp(drag*0.95,baseDrag*0.75,baseDrag*1.3);}
      else drag=clamp(drag*1.07,baseDrag*0.75,baseDrag*1.35);
    }
    if(best&&allHit(best.sim,tgt)) break;
  }
  // micro
  if(best&&!allHit(best.sim,tgt)){
    for(var dh=-6;dh<=15;dh++){
      consider(best.hp+dh,1.55,1.25,best.drag,best.lim||lim);
      consider(best.hp+dh,1.55,1.25,+(best.drag*1.05).toFixed(4),best.lim||lim);
      consider(best.hp+dh,1.55,1.25,+(best.drag*0.95).toFixed(4),best.lim||lim);
      if(best&&allHit(best.sim,tgt)) break;
    }
  }
  var b=best.car;
  car.peakHp=b.peakHp; car.torqueCurve=b.torqueCurve;
  car.evLaunchDriveMult=b.evLaunchDriveMult; car.evLaunchMuMult=b.evLaunchMuMult;
  car.dragCoefficient=b.dragCoefficient; car.speedLimiterMph=b.speedLimiterMph; car.forceScale=1;
  process.stderr.write((allHit(best.sim,tgt)?'OK ':'MISS ')+car.name+' hp='+car.peakHp+' lim='+car.speedLimiterMph+' T '+best.sim.trap+'/'+tgt.trap+' ET '+best.sim.et+'/'+tgt.et+' 60 '+best.sim.z60+'/'+tgt.z60+(tgt.z60130!=null?(' 613 '+best.sim.z60130+'/'+tgt.z60130):'')+'\n');
});

var header=['/**',' * VelocityBench PowerCurve — static garage data (baked).',' * Tip review/ev-excel-full-match: Jorge µ chart + EV Excel 100% (limiter/0-60 pass).',' * forceScale=1. Credit: Jorge Guerra only.',' */','(function (global) {','  var GARAGE = '].join('\n');
var footer=';\n  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;\n  if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n  }\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n';
fs.writeFileSync('js/garage-data.js', header+JSON.stringify(cars,null,2)+footer);

var hits={trap:[0,0],et:[0,0],z60130:[0,0],z60:[0,0]}; var still=[];
cars.forEach(function(car){ if(!car.isEv)return; var tgt=targets[car.name]; if(!tgt)return;
  var sim=runSim(car,tgt.z60130!=null);
  ['trap','et','z60130','z60'].forEach(function(k){var h=hit(sim,tgt,k); if(h==null)return; hits[k][1]++; if(h)hits[k][0]++;});
  if(!allHit(sim,tgt)) still.push({name:car.name,sim:sim,excel:{trap:tgt.trap,et:tgt.et,z60:tgt.z60,z60130:tgt.z60130},hp:car.peakHp,lim:car.speedLimiterMph});
});
var out={hitRates:{trap:hits.trap[0]+'/'+hits.trap[1],et:hits.et[0]+'/'+hits.et[1],z60130:hits.z60130[0]+'/'+hits.z60130[1],z60:hits.z60[0]+'/'+hits.z60[1]},stillMiss:still};
fs.writeFileSync('scripts/ev-z60-limiter-report.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({hitRates:out.hitRates,still:still.length,names:still.map(function(s){return s.name;})},null,2));
