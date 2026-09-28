/**
 * Tip: cybertruck-beast-trap-119
 * Parent tip 8e68a05 is ~11.00@117.9 with OEM FD 15.02 / forceScale=1.
 * Raise trap to ~119 (C&D) via honest Cd→0.34 (Tesla published ~0.34) + Summer tire;
 * keep loss/launch/curve/FD/tx/limiter. No ATC/Z28 / physics.js edits. No fake TX.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'cybertruck-beast-trap-119-report.json');
var CT_ID = '2024-tesla-cybertruck-tri-motor';
var TGT = { z60: 2.6, et: 11.0, trap: 119, lim: 130 };
var FD = 15.02;

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto'
};

function envFor(tireType) {
  return Object.assign({}, WX, {
    tireType: tireType | 0,
    tireLabel: Phys.tireLabelForType(tireType | 0)
  });
}

function runSim(car) {
  var r = Phys.runQuarterMile(car, envFor(car.tireType));
  return {
    z60: r.zeroToSixty,
    et: r.quarterMileTime,
    trap: r.quarterMileSpeedMph,
    vmax: r.topSpeedMph,
    reason: r.vmaxReason,
    z60130: r.sixtyToOneThirty,
    t0130: (String(r.vmaxReason || '').indexOf('ev_speed_limiter_') === 0) ? r.topSpeedTime : null
  };
}

function hits(s) {
  return {
    z60: s.z60 != null && Math.abs(s.z60 - TGT.z60) <= 0.25,
    et: s.et != null && Math.abs(s.et - TGT.et) <= 0.25,
    trap: s.trap != null && Math.abs(s.trap - TGT.trap) <= 1.5,
    lim: s.vmax != null && s.vmax >= 129.5 && String(s.reason || '').indexOf('ev_speed_limiter_') === 0
  };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 6 EV + Hybrid powerSource).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph + EV_Single / Tesla / Taycan / KDD presets.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/Hybrid/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+launch+tire calibrated toward Excel (forceScale retired = 1.0 always).',
    ' * Excel source: /workspace/powercurve-garage-import.json',
    ' * Cybertruck tip: OEM FD 15.02 + curve-respan; trap-119 via Cd→0.34 + Summer; forceScale=1.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-cybertruck-beast-trap-119.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function main() {
  var t0 = Date.now();
  var gi = -1;
  for (var i = 0; i < GARAGE.length; i++) {
    if (GARAGE[i].id === CT_ID || /cybertruck/i.test(GARAGE[i].name || '')) { gi = i; break; }
  }
  if (gi < 0) throw new Error('Cybertruck missing');

  var beforeCar = JSON.parse(JSON.stringify(GARAGE[gi]));
  var beforeSim = runSim(beforeCar);

  // Chosen knobs from search (honest published Cd ~0.34; Summer tire):
  // Cd 0.34 / loss 4 / tire 3 / launch 200 → ~11.005@118.98 / lim 130
  var out = JSON.parse(JSON.stringify(beforeCar));
  out.dragCoefficient = 0.34;
  out.drivetrainLossPercent = 4;
  out.tireType = 3; // Summer
  out.launchRpm = 200;
  out.forceScale = 1;
  out.finalDriveRatio = FD;
  out.txKey = 'Tesla_EV_Cybertruck';
  out.gearRatios = [1];
  out.speedLimiterMph = 130;
  out.weightLbs = 6800;
  out.peakHp = 845;
  out.isEv = true;
  out.source = (beforeCar.source || '2024 Tesla Cybertruck Tri-Motor') +
    ' | Beast trap-119 tip: Cd→0.34 (pub) + Summer; OEM FD 15.02 / fs=1 kept; C&D 2.6 / 11.0@119 / lim 130';

  GARAGE[gi] = out;
  writeGarage(GARAGE);

  var afterSim = runSim(out);
  var report = {
    tip: 'cybertruck-beast-trap-119',
    parent: '8e68a054ed16a43d460370a56b6cca48a3ab1acc',
    fd: out.finalDriveRatio,
    txKey: out.txKey,
    redline: out.redline,
    shiftRpm: out.shiftRpm,
    peakTqRpm: out.peakTqRpm,
    peakHpRpm: out.peakHpRpm,
    curvePeakHp: Phys.peakHpFromCurve(out.torqueCurve),
    knobs: {
      loss: out.drivetrainLossPercent,
      tire: out.tireType,
      tireLabel: Phys.tireLabelForType(out.tireType),
      launch: out.launchRpm,
      Cd: out.dragCoefficient,
      forceScale: out.forceScale,
      weightLbs: out.weightLbs
    },
    before: beforeSim,
    after: afterSim,
    hits: hits(afterSim),
    targets: TGT,
    mechanism: 'Cd 0.425→0.34 (Tesla published) + tire UHP→Summer; loss/launch/curve/FD/fs unchanged',
    elapsedMs: Date.now() - t0
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();
