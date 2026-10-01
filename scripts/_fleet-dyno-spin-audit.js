'use strict';
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

function auditDyno(car) {
  if (car.isEv || car.isBike) return null;
  var curve = car.torqueCurve ? Object.assign({}, car.torqueCurve) : null;
  if (!curve || !Object.keys(curve).length) {
    curve = Phys.synthesizeTorqueCurve(car.peakHp || car.horsepower, car.peakTqRpm, car.redline, car.peakHpRpm);
  } else if (Phys.sanitizeTorqueCurvePostPeak) {
    Phys.sanitizeTorqueCurvePostPeak(curve, car.peakHpRpm);
  }
  if (Phys.capTorqueCurveToPeakHp && car.peakHp) Phys.capTorqueCurveToPeakHp(curve, car.peakHp);
  var keys = Object.keys(curve).map(Number).filter(isFinite).sort(function(a,b){return a-b;});
  var peakHp = 0, peakRpm = keys[0], series = [];
  for (var i=0;i<keys.length;i++){
    var hp = (Number(curve[keys[i]])*keys[i])/5252;
    series.push({rpm:keys[i], hp:hp, tq:Number(curve[keys[i]])});
    if (hp > peakHp) { peakHp = hp; peakRpm = keys[i]; }
  }
  var red = keys[keys.length-1];
  var post = series.filter(function(p){ return p.rpm > peakRpm; });
  var upticks = 0, flats = 0, maxRise = 0;
  for (var j=1;j<post.length;j++){
    var d = post[j].hp - post[j-1].hp;
    if (d > 0.15) { upticks++; if (d>maxRise) maxRise=d; }
    else if (Math.abs(d) <= 0.15 && post[j].rpm > peakRpm + 200) flats++;
  }
  var endHp = series[series.length-1].hp;
  var fallPct = peakHp > 0 ? (peakHp - endHp)/peakHp : 0;
  var crossRpm = null;
  for (var k=1;k<series.length;k++){
    var a = series[k-1], b = series[k];
    if ((a.hp - a.tq) * (b.hp - b.tq) <= 0) {
      // interpolate
      var da = a.hp - a.tq, db = b.hp - b.tq;
      crossRpm = a.rpm + (b.rpm - a.rpm) * (Math.abs(da)/(Math.abs(da)+Math.abs(db)+1e-9));
      break;
    }
  }
  var capOk = !(car.peakHp > 0) || peakHp <= car.peakHp * 1.002 + 0.5;
  return {
    name: car.name, id: car.id,
    peakHpCurve: +peakHp.toFixed(1), peakHpParam: car.peakHp||null,
    peakRpm: peakRpm, redline: red, endHp: +endHp.toFixed(1),
    fallPct: +fallPct.toFixed(3), upticks: upticks, flats: flats, maxRise: +maxRise.toFixed(2),
    crossRpm: crossRpm!=null ? Math.round(crossRpm) : null,
    capOk: capOk, badTail: upticks>0 || flats>3 || fallPct < 0.08
  };
}

function peakG(car, tireType) {
  var r = Phys.runQuarterMile(car, {
    tempF:70, humidity:45, pressureInHg:29.92, windSpeedMph:0, windDirDeg:0, gustMph:0,
    launchMode:'auto', tireType: tireType, tireLabel: Phys.tireLabelForType(tireType)
  });
  var gSeries = r.gSeries || r.accelGSeries || [];
  var peak = 0, peakT = 0;
  if (Array.isArray(gSeries)) {
    for (var i=0;i<gSeries.length;i++){
      var g = typeof gSeries[i]==='number' ? gSeries[i] : (gSeries[i] && (gSeries[i].g||gSeries[i].y));
      if (g!=null && g>peak){ peak=g; peakT = (gSeries[i]&&gSeries[i].t)||i*0.01; }
    }
  }
  // also scan timeseries if present
  if ((!peak || !gSeries.length) && r.timeseries) {
    for (var j=0;j<r.timeseries.length;j++){
      var row = r.timeseries[j];
      var gg = row.g || row.accelG || row.longG;
      if (gg!=null && gg>peak) peak=gg;
    }
  }
  return {
    name: car.name, tire: Phys.tireLabelForType(tireType),
    peakG: +peak.toFixed(3), spinPct: +(r.wheelspinPercent||0).toFixed(1),
    et: +(r.quarterMileTime||0).toFixed(3), trap: +(r.quarterMileSpeedMph||0).toFixed(1),
    z60: +(r.zeroToSixty||0).toFixed(3), sixty: +(r.sixtyFootTime||0).toFixed(3),
    drive: car.driveType, isEv: !!car.isEv
  };
}

var dyno = [];
var badDyno = [];
GARAGE.forEach(function(car){
  var a = auditDyno(car);
  if (!a) return;
  dyno.push(a);
  if (a.badTail || !a.capOk || (a.crossRpm!=null && (a.crossRpm<4800||a.crossRpm>5700))) badDyno.push(a);
});

var namesWanted = [
  '2014 Chevrolet Camaro Z/28',
  '2020 Ford Mustang GT',
  '2019 Dodge Challenger Scat Pack',
  '2023 Chevrolet Corvette Z06',
  '2021 Tesla Model S Plaid',
  '2015 Nissan GT-R',
  '1969 Chevrolet Camaro Z/28',
  '2024 Tesla Cybertruck Tri-Motor',
  '2018 Honda Civic Type R',
  '2020 Porsche 911 Turbo S'
];
function findCar(n){ return GARAGE.find(function(c){ return c.name===n || (c.name&&c.name.indexOf(n)>=0); }); }

var launchSpot = [];
namesWanted.forEach(function(n){
  var car = findCar(n);
  if (!car) { launchSpot.push({name:n, missing:true}); return; }
  [0,1,2,3,4].forEach(function(tt){ launchSpot.push(peakG(car, tt)); });
});

// Tire ladder ET deltas for a few RWD muscle
var ladderCars = ['2020 Ford Mustang GT','2014 Chevrolet Camaro Z/28','2019 Dodge Challenger Scat Pack'].map(findCar).filter(Boolean);
var ladders = ladderCars.map(function(car){
  var row = { name: car.name };
  [0,3,4,1,2].forEach(function(tt){
    var r = Phys.runQuarterMile(car, {
      tempF:70, humidity:45, pressureInHg:29.92, windSpeedMph:0, windDirDeg:0, gustMph:0,
      launchMode:'auto', tireType:tt, tireLabel:Phys.tireLabelForType(tt)
    });
    row[Phys.tireLabelForType(tt)] = { et:+r.quarterMileTime.toFixed(3), trap:+r.quarterMileSpeedMph.toFixed(1), z60:+r.zeroToSixty.toFixed(3), spin:+(r.wheelspinPercent||0).toFixed(1), peakG:null };
  });
  return row;
});

var crossBad = dyno.filter(function(a){ return a.crossRpm!=null && (a.crossRpm<5000||a.crossRpm>5500); });
var uptickCars = dyno.filter(function(a){ return a.upticks>0; });
var flatCars = dyno.filter(function(a){ return a.flats>3; });
var capBad = dyno.filter(function(a){ return !a.capOk; });
var shallowFall = dyno.filter(function(a){ return a.fallPct < 0.10; });

var out = {
  dynoN: dyno.length,
  uptickN: uptickCars.length,
  flatN: flatCars.length,
  capBadN: capBad.length,
  shallowFallN: shallowFall.length,
  crossOutside5250band: crossBad.length,
  uptickSample: uptickCars.slice(0,15),
  flatSample: flatCars.slice(0,10),
  capBadSample: capBad.slice(0,10),
  shallowSample: shallowFall.slice(0,15),
  crossSample: crossBad.slice(0,15),
  crossMedian: (function(){
    var xs = dyno.map(function(a){return a.crossRpm;}).filter(function(x){return x!=null;}).sort(function(a,b){return a-b;});
    return xs.length ? xs[Math.floor(xs.length/2)] : null;
  })(),
  launchSpot: launchSpot,
  ladders: ladders
};
require('fs').writeFileSync('/workspace/powercurve-fleet-dyno-spin-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  dynoN: out.dynoN, uptickN: out.uptickN, flatN: out.flatN, capBadN: out.capBadN,
  shallowFallN: out.shallowFallN, crossOutside5250band: out.crossOutside5250band,
  crossMedian: out.crossMedian
}, null, 2));
console.log('\nUPTICK sample');
out.uptickSample.forEach(function(a){ console.log(a.name, 'upticks',a.upticks,'flats',a.flats,'fall',a.fallPct,'cross',a.crossRpm,'peak',a.peakHpCurve,'param',a.peakHpParam); });
console.log('\nSHALLOW fall');
out.shallowSample.forEach(function(a){ console.log(a.name, 'fall',a.fallPct,'end',a.endHp,'peak',a.peakHpCurve,'cross',a.crossRpm); });
console.log('\nCROSS outliers');
out.crossSample.forEach(function(a){ console.log(a.name, 'cross',a.crossRpm); });
console.log('\nLAUNCH spot (slick/DR/street)');
launchSpot.filter(function(r){return !r.missing && (r.tire==='Slick'||r.tire==='Drag Radial'||r.tire==='Street');}).forEach(function(r){
  console.log(r.name, r.tire, 'peakG',r.peakG,'spin',r.spinPct,'et',r.et,'z60',r.z60);
});
console.log('\nLADDERS');
console.log(JSON.stringify(ladders,null,2));
