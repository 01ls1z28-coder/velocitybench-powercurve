/**
 * Tip: cybertruck-beast-curve-respan
 * Re-span Cybertruck Tri-Motor EV torque curve for OEM FD 15.02 (baked @ FD~7.8).
 * RPM × (15.02/7.8), TQ ÷ span → preserve power@road-speed; then loss/tire/launch.
 * forceScale=1; keep Tesla_EV_Cybertruck + FD 15.02. Prefer Street. No ATC edits.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'cybertruck-beast-curve-respan-report.json');
var OLD_FD = 7.8;
var NEW_FD = 15.02;
var SPAN = NEW_FD / OLD_FD;
var CT_ID = '2024-tesla-cybertruck-tri-motor';
var TGT = { z60: 2.6, et: 11.0, trap: 119, lim: 130 };

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

function respanCurve(curve, span) {
  var keys = Object.keys(curve).map(Number).sort(function (a, b) { return a - b; });
  function tAt(rpm) {
    if (rpm <= keys[0]) return +curve[keys[0]];
    if (rpm >= keys[keys.length - 1]) return +curve[keys[keys.length - 1]];
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (rpm >= a && rpm <= b) {
        var w = (rpm - a) / (b - a);
        return +curve[a] * (1 - w) + +curve[b] * w;
      }
    }
    return +curve[keys[keys.length - 1]];
  }
  var newMax = Math.round((keys[keys.length - 1] * span) / 100) * 100;
  var out = {};
  for (var r = 500; r <= newMax; r += 100) {
    out[r] = Math.round((tAt(r / span) / span) * 10000) / 10000;
  }
  return { curve: out, newMax: newMax };
}

function hits(s) {
  return {
    z60: s.z60 != null && Math.abs(s.z60 - TGT.z60) <= 0.25,
    et: s.et != null && Math.abs(s.et - TGT.et) <= 0.25,
    trap: s.trap != null && Math.abs(s.trap - TGT.trap) <= 2.5,
    lim: s.vmax != null && s.vmax >= 129.5 && String(s.reason || '').indexOf('ev_speed_limiter_') === 0
  };
}

function score(s, tire, cd) {
  var sc = 0;
  if (s.z60 != null) sc += Math.abs(s.z60 - TGT.z60) * 10; else sc += 30;
  if (s.et != null) sc += Math.abs(s.et - TGT.et) * 14; else sc += 40;
  if (s.trap != null) sc += Math.abs(s.trap - TGT.trap) * 0.4; else sc += 30;
  if (!hits(s).lim) sc += 25;
  if (tire === 0) sc += 0;
  else if (tire === 3 || tire === 4) sc += 0.35;
  else if (tire === 1) sc += 0.6;
  else sc += 1.5;
  sc += Math.abs(cd - 0.425) * 0.15;
  return sc;
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
    ' * Cybertruck tip: curve re-span for OEM FD 15.02 (TQ÷span); loss/tire/launch; forceScale=1.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-cybertruck-beast-curve-respan.js',
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

  var seed = JSON.parse(JSON.stringify(beforeCar));
  var spanned = respanCurve(seed.torqueCurve, SPAN);
  seed.torqueCurve = spanned.curve;
  seed.redline = spanned.newMax;
  seed.shiftRpm = spanned.newMax;
  seed.peakTqRpm = Math.round((Number(beforeCar.peakTqRpm) || 2000) * SPAN / 100) * 100;
  seed.peakHpRpm = Math.round((Number(beforeCar.peakHpRpm) || 8000) * SPAN / 100) * 100;
  seed.finalDriveRatio = NEW_FD;
  seed.txKey = 'Tesla_EV_Cybertruck';
  seed.gearRatios = [1];
  seed.forceScale = 1;
  seed.speedLimiterMph = 130;
  seed.weightLbs = 6800;
  seed.peakHp = 845;
  seed.isEv = true;

  var best = null;
  // Compact grid (respan already near C&D)
  var cds = [0.425, 0.34];
  var losses = [0, 1, 2, 4];
  var tires = [0, 3, 4, 1];
  var launches = [200, 300, 400, 500, 700];

  cds.forEach(function (cd) {
    losses.forEach(function (loss) {
      tires.forEach(function (tire) {
        launches.forEach(function (lr) {
          var t = JSON.parse(JSON.stringify(seed));
          t.dragCoefficient = cd;
          t.drivetrainLossPercent = loss;
          t.tireType = tire;
          t.launchRpm = lr;
          var s = runSim(t);
          var sc = score(s, tire, cd);
          if (!best || sc < best.sc) {
            best = { sc: sc, car: t, sim: s, h: hits(s), loss: loss, tire: tire, lr: lr, cd: cd };
          }
        });
      });
    });
  });

  var out = best.car;
  out.forceScale = 1;
  out.finalDriveRatio = NEW_FD;
  out.txKey = 'Tesla_EV_Cybertruck';
  out.gearRatios = [1];
  out.speedLimiterMph = 130;
  out.weightLbs = 6800;
  out.peakHp = 845;
  out.source = (beforeCar.source || '2024 Tesla Cybertruck Tri-Motor') +
    ' | Beast curve-respan tip: RPM×(15.02/7.8) TQ÷span; OEM FD 15.02 kept; loss/tire/launch; C&D 2.6 / 11.0@119 / lim 130';

  GARAGE[gi] = out;
  writeGarage(GARAGE);

  var afterSim = runSim(out);
  var report = {
    tip: 'cybertruck-beast-curve-respan',
    base: '3f673cd5ffe593246440c5114e9746a524bd696b',
    span: SPAN,
    oldFdRef: OLD_FD,
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
    elapsedMs: Date.now() - t0
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();
