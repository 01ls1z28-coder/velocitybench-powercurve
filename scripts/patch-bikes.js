/**
 * One-shot: retune garage motorcycles to published-leaning redline / shift / gears / powerband.
 * Does NOT recalibrate the ICE fleet. Run: node scripts/patch-bikes.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');

var OUT = path.join(__dirname, '..', 'js', 'garage-data.js');
var GARAGE = require('../js/garage-data.js');

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto'
};

/** Per-name published-leaning RPM / class overrides. */
var BIKE_SPEC = {
  '2021 Kawasaki Ninja ZX-10R': { cls: 'sport', redline: 13500, shift: 12800, launch: 6000, peakTqRpm: 11200, peakHpRpm: 13200 },
  '2016 Kawasaki Ninja ZX-10R': { cls: 'sport', redline: 13500, shift: 12800, launch: 6000, peakTqRpm: 11200, peakHpRpm: 13000 },
  '2020 Suzuki GSX-R1000': { cls: 'sport', redline: 14500, shift: 13800, launch: 6000, peakTqRpm: 10800, peakHpRpm: 13200 },
  '2020 Suzuki GSX-R1000R': { cls: 'sport', redline: 14500, shift: 13800, launch: 6000, peakTqRpm: 10800, peakHpRpm: 13200 },
  '2020 Yamaha YZF-R1': { cls: 'sport', redline: 14500, shift: 13800, launch: 6500, peakTqRpm: 11500, peakHpRpm: 13500 },
  '2020 Yamaha YZF-R1M': { cls: 'sport', redline: 14500, shift: 13800, launch: 6500, peakTqRpm: 11500, peakHpRpm: 13500 },
  '2021 BMW S1000RR': { cls: 'sport', redline: 14600, shift: 14000, launch: 6000, peakTqRpm: 11000, peakHpRpm: 13750 },
  '2021 Honda CBR1000RR-R Fireblade': { cls: 'sport', redline: 14500, shift: 14000, launch: 6500, peakTqRpm: 12500, peakHpRpm: 14500 },
  '2022 Suzuki Hayabusa': { cls: 'hyper', redline: 11000, shift: 10500, launch: 4500, peakTqRpm: 7800, peakHpRpm: 9700 },
  '2020 Kawasaki Ninja ZX-14R': { cls: 'hyper', redline: 11000, shift: 10500, launch: 4500, peakTqRpm: 7500, peakHpRpm: 10000 },
  '2021 Ducati Panigale V4': { cls: 'sport', redline: 14500, shift: 14000, launch: 6500, peakTqRpm: 12500, peakHpRpm: 14500 },
  '2021 Kawasaki Ninja H2': { cls: 'h2', redline: 14000, shift: 13200, launch: 5000, peakTqRpm: 10500, peakHpRpm: 13500 }
};

var TX = {
  sport: Phys.FactoryTransmissions.Bike_Sport_6,
  hyper: Phys.FactoryTransmissions.Bike_Hyper_6,
  h2: Phys.FactoryTransmissions.Bike_Sport_6
};

function densify(curve, redline) {
  var keys = Object.keys(curve).map(Number).filter(isFinite).sort(function (a, b) { return a - b; });
  var out = {}, prev = null;
  var start = Math.max(500, Math.floor(keys[0] / 100) * 100);
  for (var r = start; r <= redline + 0.01; r += 100) {
    var rpm = Math.round(r);
    var tq = Phys.getTorqueAtRpm(curve, rpm);
    if (!isFinite(tq) || tq <= 0) tq = prev != null ? prev : 5;
    out[rpm] = tq;
    prev = tq;
  }
  keys.forEach(function (k) {
    if (k % 100 === 0) return;
    var t = Number(curve[k]);
    if (isFinite(t) && t > 0) out[k] = t;
  });
  return out;
}

function sim(car) {
  return Phys.runQuarterMile(car, Object.assign({}, WX, {
    tireType: car.tireType | 0,
    tireLabel: Phys.tireLabelForType(car.tireType | 0)
  }));
}

function tuneForceScale(car, targetEt, targetTrap) {
  // Binary-ish search forceScale so 1/4 ET stays near Excel (trap soft).
  var lo = 0.7, hi = 1.55, best = 1, bestErr = 1e9;
  for (var i = 0; i < 14; i++) {
    var mid = (lo + hi) / 2;
    car.forceScale = +mid.toFixed(3);
    var r = sim(car);
    var et = r.quarterMileTime;
    var err = Math.abs(et - targetEt) + 0.02 * Math.abs((r.quarterMileSpeedMph || 0) - (targetTrap || et * 14));
    if (err < bestErr) { bestErr = err; best = car.forceScale; }
    if (et > targetEt) lo = mid; else hi = mid;
  }
  car.forceScale = best;
  return sim(car);
}

function parseEtTrap(src) {
  // "Perf: ... ~2.8 / ~10.3@146" or Excel-style in source
  var m = String(src || '').match(/(\d+\.\d+)\s*@\s*(\d+)/);
  if (m) return { et: +m[1], trap: +m[2] };
  return null;
}

var patched = 0;
var report = [];

GARAGE.forEach(function (car) {
  var spec = BIKE_SPEC[car.name];
  if (!spec) return;
  var tx = TX[spec.cls];
  var tgt = parseEtTrap(car.source) || { et: 10.2, trap: 147 };
  // Prefer Excel-ish from source Cycle World numbers when present
  var m2 = String(car.source || '').match(/~\d+\.\d+\s*\/\s*~(\d+\.\d+)@(\d+)/);
  if (m2) tgt = { et: +m2[1], trap: +m2[2] };

  car.category = 'Motorcycle';
  car.redline = spec.redline;
  car.shiftRpm = spec.shift;
  car.launchRpm = spec.launch;
  car.peakTqRpm = spec.peakTqRpm;
  car.peakHpRpm = spec.peakHpRpm;
  car.gearRatios = tx.gears.slice();
  car.finalDriveRatio = tx.finalDrive;
  car.txKey = spec.cls === 'hyper' ? 'Bike_Hyper_6' : 'Bike_Sport_6';
  car.tireRadiusInches = spec.cls === 'hyper' ? 12.6 : 12.4;
  car.dragCoefficient = car.dragCoefficient || 0.45;
  car.frontalAreaSqFt = 6.8;
  car.driveType = 'RWD';
  car.engineLayout = 'Mid';
  car.shiftTimeSeconds = 0.08;
  car.drivetrainLossPercent = Math.min(18, Math.max(10, Number(car.drivetrainLossPercent) || 12));
  // Keep H2 supercharger identity
  if (/h2/i.test(car.name) && !car.boostModel) car.boostModel = 'supercharger';
  car.frontWeightPercent = 48;
  car.rearWeightPercent = 52;
  car.leftWeightPercent = 50;
  car.rightWeightPercent = 50;

  var sparse = Phys.synthesizeTorqueCurve(car.peakHp, car.peakTqRpm, car.redline, car.peakHpRpm);
  car.torqueCurve = densify(sparse, car.redline);

  var r = tuneForceScale(car, tgt.et, tgt.trap);
  patched++;
  report.push({
    name: car.name,
    redline: car.redline,
    shift: car.shiftRpm,
    peakHpRpm: car.peakHpRpm,
    peakTq: Math.round(Math.max.apply(null, Object.keys(car.torqueCurve).map(function (k) { return car.torqueCurve[k]; }))),
    forceScale: car.forceScale,
    et: +r.quarterMileTime.toFixed(3),
    trap: +r.quarterMileSpeedMph.toFixed(1),
    z60: r.zeroToSixty != null ? +r.zeroToSixty.toFixed(3) : null,
    shifts: r.totalShifts,
    tgtEt: tgt.et,
    tgtTrap: tgt.trap
  });
});

var header =
  '/**\n' +
  ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).\n' +
  ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).\n' +
  ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized\n' +
  ' * + trap-first calib (loss/forceScale/TireType/launchRpm). Rebuild: node scripts/build-garage.js\n' +
  ' * Bike retune only: node scripts/patch-bikes.js\n' +
  ' */\n' +
  '(function (root) {\n' +
  '  var data = ';

var footer =
  ';\n' +
  '  if (typeof module !== \'undefined\' && module.exports) module.exports = data;\n' +
  '  root.VB_POWERCURVE_GARAGE = data;\n' +
  '})(typeof window !== \'undefined\' ? window : globalThis);\n';

fs.writeFileSync(OUT, header + JSON.stringify(GARAGE, null, 2) + footer);
console.log('Patched', patched, 'motorcycles →', OUT);
report.forEach(function (r) {
  console.log(
    r.name +
    ' | RL ' + r.redline + ' shift ' + r.shift + ' pkHP@' + r.peakHpRpm +
    ' | TQ~' + r.peakTq + ' lbft | fs ' + r.forceScale +
    ' | sim ' + r.et + '@' + r.trap + ' (tgt ' + r.tgtEt + '@' + r.tgtTrap + ')' +
    ' shifts=' + r.shifts + ' 0-60=' + r.z60
  );
});
