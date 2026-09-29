/**
 * Tip: fleet-published-miss-batch (Sati)
 * Honest bake only: curve / FD / Cd / loss / tire. forceScale=1 always.
 * No fake TX names (keep existing txKey). No Z28 ATC / launch / Cybertruck / ZR1X tip edits
 * unless a listed car overlaps (Cybertruck already fixed on 3aae3e5; ZR1X/Z28 skipped).
 *
 * Parent: 3aae3e5. Credit Jorge Guerra (specs / Excel). Published = C&D/MT/OEM.
 *
 *   node scripts/recalib-fleet-published-miss-batch.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '../js/garage-data.js');
var REPORT = path.join(__dirname, 'fleet-published-miss-batch-report.json');

var WX = {
  tempF: 70, humidity: 45, pressureInHg: 29.92,
  windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto'
};
var TOL = { z60: 0.25, et: 0.25, trap: 2.5 };

function envFor(tireType) {
  return Object.assign({}, WX, {
    tireType: tireType | 0,
    tireLabel: Phys.tireLabelForType(tireType | 0)
  });
}
function runSim(car) {
  var r = Phys.runQuarterMile(car, envFor(car.tireType));
  return {
    z60: r.zeroToSixty, et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    vmax: r.topSpeedMph, z60130: r.sixtyToOneThirty
  };
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hit(s, t) {
  return {
    z60: t.z60 == null || (s.z60 != null && Math.abs(s.z60 - t.z60) <= TOL.z60),
    et: t.et == null || (s.et != null && Math.abs(s.et - t.et) <= TOL.et),
    trap: t.trap == null || (s.trap != null && Math.abs(s.trap - t.trap) <= TOL.trap)
  };
}
function allHit(h) { return h.z60 && h.et && h.trap; }

/** ICE curve pinning published peak TQ + peak HP; optional SC/turbo plateau. Caps HP ≤ 1.03×. */
function makeIceCurve(peakHp, peakTq, peakTqRpm, peakHpRpm, redline, opts) {
  opts = opts || {};
  var plateauEnd = opts.plateauEnd != null ? opts.plateauEnd : peakTqRpm;
  var rise = opts.rise != null ? opts.rise : 0.55;
  var tqAtPeakHp = (peakHp * 5252) / peakHpRpm;
  var curve = {};
  for (var r = 1000; r <= redline; r += 100) {
    var tq;
    if (r <= peakTqRpm) {
      var u = r / Math.max(1, peakTqRpm);
      tq = peakTq * (rise + (1 - rise) * Math.pow(u, 0.65));
    } else if (r <= plateauEnd) {
      tq = peakTq;
    } else if (r <= peakHpRpm) {
      var v = (r - plateauEnd) / Math.max(1, peakHpRpm - plateauEnd);
      tq = peakTq + (tqAtPeakHp - peakTq) * (0.25 * v + 0.75 * v * v);
    } else {
      var w = (r - peakHpRpm) / Math.max(1, redline - peakHpRpm);
      tq = tqAtPeakHp * (1 - 0.2 * w - 0.25 * w * w);
    }
    var maxTq = (peakHp * 1.03 * 5252) / Math.max(1, r);
    curve[r] = Math.max(10, Math.min(tq, maxTq));
  }
  curve[peakTqRpm] = Math.min(peakTq, (peakHp * 1.03 * 5252) / peakTqRpm);
  if (plateauEnd > peakTqRpm) {
    for (var p = peakTqRpm; p <= plateauEnd; p += 100) {
      curve[p] = Math.min(peakTq, (peakHp * 1.03 * 5252) / p);
    }
  }
  curve[peakHpRpm] = tqAtPeakHp;
  return curve;
}

/** EV: flat TQ so HP@holdRpm = rated peakHp; fade after peakHpRpm. No inventing continuous HP. */
function makeEvCurve(peakHp, holdRpm, peakHpRpm, redline, fadeExp) {
  fadeExp = fadeExp != null ? fadeExp : 0.55;
  var tqHold = (peakHp * 5252) / holdRpm;
  var tqAtPeak = (peakHp * 5252) / peakHpRpm;
  var out = {};
  for (var r = 500; r <= redline; r += 100) {
    var tq;
    if (r <= holdRpm) tq = tqHold;
    else if (r <= peakHpRpm) {
      var v = (r - holdRpm) / Math.max(1, peakHpRpm - holdRpm);
      tq = tqHold + (tqAtPeak - tqHold) * v;
    } else {
      var w = (r - peakHpRpm) / Math.max(1, redline - peakHpRpm);
      tq = tqAtPeak * (1 - fadeExp * w - (1 - fadeExp) * 0.9 * w * w);
    }
    out[r] = Math.max(12, tq);
  }
  out[holdRpm] = tqHold;
  out[peakHpRpm] = tqAtPeak;
  return out;
}

/**
 * Recipes keyed by garage id.
 * tgt = published (C&D/MT/OEM/Excel). status: fix | residual | park
 */
var RECIPES = [
  {
    id: '2005-mercedes-e55-amg',
    tgt: { z60: 4.5, et: 12.7, trap: 117 },
    src: 'C&D W211 E55; OEM 469@6100 / 516@2650–4500; Cd~0.28; FD 2.65',
    note: 'Trap-priority: published SC curve + Cd 0.28; loss0. 0–60/ET stay optimistic vs C&D (ET–trap conflict).',
    apply: function (c) {
      c.peakTqRpm = 2650; c.peakHpRpm = 6100; c.redline = 6500; c.shiftRpm = 6200;
      c.torqueCurve = makeIceCurve(469, 516, 2650, 6100, 6500, { plateauEnd: 4500, rise: 0.72 });
      c.dragCoefficient = 0.28; c.drivetrainLossPercent = 0; c.tireType = 3; c.launchRpm = 2000;
      // FD already OEM 2.65; txKey kept
    }
  },
  {
    id: '1996-chevrolet-impala-ss',
    tgt: { z60: 6.5, et: 15.0, trap: 92 },
    src: 'C&D 1994 Impala SS 6.5 / 15.0@92; OEM LT1 260@5000 / 330@2400; FD 3.08',
    note: 'Published LT1 powerband + Cd 0.34 + Drag Radial. Residual trap/0–60 short after honest bake — parked further knobs.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 2400; c.peakHpRpm = 5000; c.redline = 5700; c.shiftRpm = 5400;
      c.torqueCurve = makeIceCurve(260, 330, 2400, 5000, 5700, { rise: 0.65 });
      c.dragCoefficient = 0.34; c.drivetrainLossPercent = 0; c.tireType = 1; c.launchRpm = 1600;
    }
  },
  {
    id: '1984-chevrolet-corvette-c4',
    tgt: { z60: 6.7, et: 15.2, trap: 90 },
    src: 'C&D 1984 C4 6.7 / 15.2@90; OEM L83 205@4300 / 290@2800; FD 3.07; Cd 0.34',
    apply: function (c) {
      c.peakTqRpm = 2800; c.peakHpRpm = 4300; c.redline = 5200; c.shiftRpm = 5000;
      c.torqueCurve = makeIceCurve(205, 290, 2800, 4300, 5200, { rise: 0.6 });
      c.drivetrainLossPercent = 0; c.tireType = 0; c.launchRpm = 2000;
    }
  },
  {
    id: '2008-dodge-challenger-srt8',
    tgt: { z60: 4.8, et: 13.3, trap: 108 },
    src: 'C&D/MT 2008 SRT8 ~4.8 / 13.3@108; OEM 425@6200 / 420@4800; FD 3.06; Cd~0.36',
    apply: function (c) {
      c.peakTqRpm = 4800; c.peakHpRpm = 6200; c.redline = 6400; c.shiftRpm = 6200;
      c.torqueCurve = makeIceCurve(425, 420, 4800, 6200, 6400, { rise: 0.55 });
      c.dragCoefficient = 0.36; c.drivetrainLossPercent = 0; c.tireType = 0; c.launchRpm = 2200;
    }
  },
  {
    id: '2022-cadillac-escalade-v',
    tgt: { z60: 4.3, et: 12.7, trap: 111 },
    src: 'C&D Escalade-V 4.3 / 12.7@111; OEM 682@6000 / 653@4400 (80% TQ@2000); FD 3.23; Cd~0.36',
    note: 'Trap-priority published LT4 curve + Cd 0.36 + Summer + loss4. 0–60/ET optimistic vs C&D.',
    apply: function (c) {
      c.peakTqRpm = 4400; c.peakHpRpm = 6000; c.redline = 6300; c.shiftRpm = 6100;
      c.torqueCurve = makeIceCurve(682, 653, 4400, 6000, 6300, { rise: 0.80 });
      c.torqueCurve[2000] = 653 * 0.80;
      c.torqueCurve[2500] = 653 * 0.88;
      c.torqueCurve[3000] = 653 * 0.94;
      c.torqueCurve[3500] = 653 * 0.98;
      c.dragCoefficient = 0.36; c.drivetrainLossPercent = 4; c.tireType = 3; c.launchRpm = 1500;
    }
  },
  {
    id: '2021-range-rover-sport-svr',
    tgt: { z60: 4.3, et: 12.8, trap: 111 },
    src: 'C&D RR Sport SVR class ~4.3 / 12.8@111; 575 hp / 516 lb-ft SC V8 band; FD 3.15',
    note: 'Published SC powerband + Summer + loss0. Trap in tol; 0–60/ET optimistic.',
    apply: function (c) {
      c.peakTqRpm = 3500; c.peakHpRpm = 6000; c.redline = 6500; c.shiftRpm = 6200;
      c.torqueCurve = makeIceCurve(575, 516, 3500, 6000, 6500, { plateauEnd: 5500, rise: 0.75 });
      c.drivetrainLossPercent = 0; c.tireType = 3; c.launchRpm = 1800;
    }
  },
  {
    id: '2023-acura-tlx-type-s',
    tgt: { z60: 4.6, et: 13.3, trap: 105 },
    src: 'C&D TLX Type S ~4.6 / 13.3@105; OEM 355@5500 / 354@1400–5000; FD 3.59',
    note: 'Published turbo plateau curve + Summer. Residual trap short (~103–104) after honest bake — parked Cd invent.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 1400; c.peakHpRpm = 5500; c.redline = 6500; c.shiftRpm = 6200;
      c.torqueCurve = makeIceCurve(355, 354, 1400, 5500, 6500, { plateauEnd: 5000, rise: 0.9 });
      c.drivetrainLossPercent = 3; c.tireType = 3; c.launchRpm = 1500;
    }
  },
  {
    id: '2021-bmw-s1000rr',
    tgt: { z60: 2.9, et: 10.1, trap: 152 },
    src: 'Cycle World/class ~2.7–3.1 / ~9.9–10.3@150–156; OEM ~205@13500 / 83 lb-ft@11000',
    apply: function (c) {
      c.peakTqRpm = 11000; c.peakHpRpm = 13500; c.redline = 14600; c.shiftRpm = 14000;
      c.torqueCurve = makeIceCurve(205, 83, 11000, 13500, 14600, { rise: 0.45 });
      c.drivetrainLossPercent = 15; c.tireType = 2; c.launchRpm = 4500;
    }
  },
  {
    id: '2024-lucid-air-touring',
    tgt: { z60: 3.0, et: 11.0, trap: 126 },
    src: 'C&D Lucid Air Touring 3.0 / 11.0@126',
    apply: function (c) {
      c.torqueCurve = makeEvCurve(620, 4000, 7000, 14000, 0.4);
      c.peakHp = 620; c.peakTqRpm = 4000; c.peakHpRpm = 7000;
      c.redline = 14000; c.shiftRpm = 14000;
      c.drivetrainLossPercent = 0; c.tireType = 3;
    }
  },
  {
    id: '2023-mercedes-eqe-amg-53',
    tgt: { z60: 2.8, et: 11.2, trap: 119 },
    src: 'C&D EQE AMG 53 ~2.8 / 11.2@119 (Excel peer ~3.2 / 11.6@120)',
    apply: function (c) {
      c.torqueCurve = makeEvCurve(677, 3500, 6000, 14000, 0.85);
      c.peakHp = 677; c.peakTqRpm = 3500; c.peakHpRpm = 6000;
      c.redline = 14000; c.shiftRpm = 14000;
      c.drivetrainLossPercent = 4; c.tireType = 3;
    }
  },
  {
    id: '2022-bmw-ix-m60',
    tgt: { z60: 3.2, et: 11.5, trap: 120 },
    src: 'C&D iX M60 3.2 / 11.5@120 (Excel 3.6 / 12.1@114 — prefer C&D)',
    apply: function (c) {
      c.torqueCurve = makeEvCurve(610, 3500, 6000, 14000, 0.4);
      c.peakHp = 610; c.peakTqRpm = 3500; c.peakHpRpm = 6000;
      c.redline = 14000; c.shiftRpm = 14000;
      c.drivetrainLossPercent = 0; c.tireType = 3;
    }
  },
  {
    id: '1968-dodge-dart-gts-383',
    tgt: { z60: 6.5, et: 14.9, trap: 95 },
    src: 'Peer card ~6.5 / 14.9@95 (no fresh C&D) — 383 band ~300 hp / ~390 lb-ft',
    note: 'Peer-sourced powerband; trap improved. Residual 0–60/ET quick vs peer — no invent.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 2800; c.peakHpRpm = 4600; c.redline = 5500; c.shiftRpm = 5200;
      c.torqueCurve = makeIceCurve(300, 390, 2800, 4600, 5500, { rise: 0.58 });
      c.drivetrainLossPercent = 16; c.tireType = 0; c.launchRpm = 2000;
    }
  },
  {
    id: '1971-dodge-demon-340',
    tgt: { z60: 6.5, et: 14.9, trap: 94 },
    src: 'Peer ~6.5 / 14.9@94; OEM-era 275@5000 / 340@3200',
    note: 'Published-era 340 curve; trap improved. Residual 0–60/ET quick vs peer.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 3200; c.peakHpRpm = 5000; c.redline = 5600; c.shiftRpm = 5300;
      c.torqueCurve = makeIceCurve(275, 340, 3200, 5000, 5600, { rise: 0.58 });
      c.drivetrainLossPercent = 14; c.tireType = 0; c.launchRpm = 2000;
    }
  },
  {
    id: '1965-chevrolet-chevelle-ss396',
    tgt: { z60: 6.0, et: 14.5, trap: 99 },
    src: 'Peer ~6.0 / 14.5@99; 375 hp SS396 band ~415 lb-ft@3600',
    note: 'Period powerband; trap near peer. Residual 0–60/ET quick.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 3600; c.peakHpRpm = 5600; c.redline = 6000; c.shiftRpm = 5800;
      c.torqueCurve = makeIceCurve(375, 415, 3600, 5600, 6000, { rise: 0.55 });
      c.drivetrainLossPercent = 18; c.tireType = 0; c.launchRpm = 1800;
    }
  },
  {
    id: '2006-mercedes-clk55-amg',
    tgt: { z60: 4.7, et: 13.2, trap: 107 },
    src: 'C&D CLK55 4.7 / 13.2@107; 362 hp / ~376 lb-ft NA M113',
    note: 'Published NA curve + Summer + loss6. Residual mild miss — parked aero invent.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 4000; c.peakHpRpm = 5750; c.redline = 6500; c.shiftRpm = 6200;
      c.torqueCurve = makeIceCurve(362, 376, 4000, 5750, 6500, { rise: 0.58 });
      c.drivetrainLossPercent = 6; c.tireType = 3; c.launchRpm = 2200;
    }
  },
  {
    id: '2007-porsche-911-turbo',
    tgt: { z60: 3.4, et: 11.6, trap: 122 },
    src: 'C&D 997 Turbo Tip 3.4 / 11.6@122; OEM ~480@6000 / 460@1950–5000',
    note: 'Trap-priority FI plateau + Summer + loss0. 0–60 optimistic vs C&D Tip; txKey kept.',
    apply: function (c) {
      c.peakTqRpm = 1950; c.peakHpRpm = 6000; c.redline = 6750; c.shiftRpm = 6500;
      c.torqueCurve = makeIceCurve(480, 460, 1950, 6000, 6750, { plateauEnd: 5000, rise: 0.82 });
      c.drivetrainLossPercent = 0; c.tireType = 3; c.launchRpm = 2200;
    }
  },
  {
    id: '2007-ford-f-150-4-6-triton',
    tgt: { z60: 8.5, et: 16.6, trap: 84 },
    src: 'Peer/Excel ~8.5 / 16.6@84 — 4.6 Triton ~248@4750 / 294@4000',
    note: 'Powerband bake only. Residual slow vs peer (brick Cd×FA + weight) — parked further invent.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 4000; c.peakHpRpm = 4750; c.redline = 5500; c.shiftRpm = 5200;
      c.torqueCurve = makeIceCurve(248, 294, 4000, 4750, 5500, { rise: 0.62 });
      c.drivetrainLossPercent = 0; c.tireType = 0; c.launchRpm = 1800;
    }
  },
  {
    id: '2008-ford-f-150-harley-davidson',
    tgt: { z60: 7.4, et: 15.8, trap: 88 },
    src: 'Peer ~7.4 / 15.8@88 — 5.4 3V ~300@5000 / 365@3750',
    note: 'Powerband bake. Residual vs peer — parked.',
    residual: true,
    apply: function (c) {
      c.peakTqRpm = 3750; c.peakHpRpm = 5000; c.redline = 5600; c.shiftRpm = 5300;
      c.torqueCurve = makeIceCurve(300, 365, 3750, 5000, 5600, { rise: 0.62 });
      c.drivetrainLossPercent = 0; c.tireType = 0; c.launchRpm = 1800;
    }
  }
];

var SKIP = {
  '2024-tesla-cybertruck-tri-motor': 'already fixed on parent 3aae3e5',
  '2026-chevrolet-corvette-zr1x': 'separate ZR1X tip — do not include',
  '2001-chevrolet-camaro-z28-hce-ms3-tsp53stage25-134lt-trueduals': 'Z28 ATC — do not touch'
};

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
    ' * Fleet published-miss batch: honest curve/FD/Cd/loss/tire vs C&D/MT/OEM; fs=1; no fake TX.',
    ' * Rebuild: node scripts/build-garage.js · Recalib: node scripts/recalib-fleet-published-miss-batch.js',
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
  var byId = {};
  for (var i = 0; i < GARAGE.length; i++) byId[GARAGE[i].id] = i;

  var results = [];
  var fixed = 0, residual = 0;

  RECIPES.forEach(function (rec) {
    var gi = byId[rec.id];
    if (gi == null) {
      results.push({ id: rec.id, status: 'missing', note: 'not in public garage' });
      return;
    }
    var beforeCar = clone(GARAGE[gi]);
    var beforeSim = runSim(beforeCar);
    var out = clone(beforeCar);
    rec.apply(out);
    out.forceScale = 1;
    // Never invent TX names
    out.txKey = beforeCar.txKey;
    out.gearRatios = beforeCar.gearRatios;
    var srcNote = ' | Fleet miss-batch: ' + rec.src + (rec.note ? ' — ' + rec.note : '');
    out.source = (beforeCar.source || beforeCar.name) + srcNote;

    GARAGE[gi] = out;
    var afterSim = runSim(out);
    var h = hit(afterSim, rec.tgt);
    var status = allHit(h) ? 'HIT' : (rec.residual ? 'RESIDUAL' : 'PARTIAL');
    if (status === 'HIT') fixed++;
    else if (status === 'RESIDUAL') residual++;
    else fixed++; // still applied bake

    results.push({
      id: rec.id,
      name: out.name,
      status: status,
      tgt: rec.tgt,
      src: rec.src,
      note: rec.note || null,
      before: {
        z60: beforeSim.z60, et: beforeSim.et, trap: beforeSim.trap,
        Cd: beforeCar.dragCoefficient, FD: beforeCar.finalDriveRatio,
        loss: beforeCar.drivetrainLossPercent, tire: beforeCar.tireType,
        peakTqRpm: beforeCar.peakTqRpm, peakHpRpm: beforeCar.peakHpRpm,
        redline: beforeCar.redline, fs: beforeCar.forceScale, txKey: beforeCar.txKey
      },
      after: {
        z60: afterSim.z60, et: afterSim.et, trap: afterSim.trap,
        Cd: out.dragCoefficient, FD: out.finalDriveRatio,
        loss: out.drivetrainLossPercent, tire: out.tireType,
        peakTqRpm: out.peakTqRpm, peakHpRpm: out.peakHpRpm,
        redline: out.redline, fs: out.forceScale, txKey: out.txKey,
        curvePeakHp: Phys.peakHpFromCurve(out.torqueCurve)
      },
      hits: h,
      delta: {
        d60: afterSim.z60 - beforeSim.z60,
        dEt: afterSim.et - beforeSim.et,
        dTrap: afterSim.trap - beforeSim.trap
      }
    });
  });

  writeGarage(GARAGE);

  var report = {
    tip: 'fleet-published-miss-batch',
    parent: '3aae3e5',
    branch: 'review/fleet-published-miss-batch',
    credit: 'Jorge Guerra',
    forceScale: 1,
    skipped: SKIP,
    wx: WX,
    tol: TOL,
    applied: results.length,
    hitCount: results.filter(function (r) { return r.status === 'HIT'; }).length,
    residualCount: results.filter(function (r) { return r.status === 'RESIDUAL'; }).length,
    partialCount: results.filter(function (r) { return r.status === 'PARTIAL'; }).length,
    ms: Date.now() - t0,
    results: results
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    applied: report.applied,
    hit: report.hitCount,
    residual: report.residualCount,
    partial: report.partialCount,
    ms: report.ms
  }, null, 2));
  results.forEach(function (r) {
    if (!r.before) return;
    console.log(
      r.status,
      r.name,
      'before', r.before.z60.toFixed(2) + '/' + r.before.et.toFixed(2) + '@' + r.before.trap.toFixed(1),
      '→', r.after.z60.toFixed(2) + '/' + r.after.et.toFixed(2) + '@' + r.after.trap.toFixed(1),
      'tgt', r.tgt.z60 + '/' + r.tgt.et + '@' + r.tgt.trap
    );
  });
}

main();
