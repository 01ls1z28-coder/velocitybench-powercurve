'use strict';
/**
 * Tip: OEM EV speedLimiterMph + M3P 60′/60-130 retune (HP≤510).
 * Credits: Jorge Guerra only. Tip-only — do NOT ship Pages.
 */
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var FACTORY_M3P_HP = 510;

var OEM_VMAX = {
  '2021-rimac-nevera': { mph: 258, note: 'Rimac Nevera 412 km/h (258 mph)', src: 'Rimac' },
  '2022-bmw-ix-m60': { mph: 155, note: 'iX M60 limited 250 km/h', src: 'BMW / EV-DB' },
  '2022-ford-f-150-lightning': { mph: 110, note: 'F-150 Lightning OEM ~110 mph', src: 'Ford' },
  '2022-mercedes-eqb-350': { mph: 99, note: 'EQB 350 160 km/h', src: 'MB / EV-DB' },
  '2022-porsche-taycan-turbo-s': { mph: 162, note: 'Taycan Turbo S top track 162 mph', src: 'Porsche USA' },
  '2022-tesla-model-s-plaid': { mph: 200, note: 'Model S Plaid advertised 200 mph', src: 'Tesla.com' },
  '2022-tesla-model-x-plaid': { mph: 163, note: 'Model X Plaid 163 mph (22" summer)', src: 'Tesla' },
  '2023-audi-e-tron-gt': { mph: 152, note: 'e-tron GT 245 km/h', src: 'Audi / EV-DB' },
  '2023-audi-q4-e-tron': { mph: 112, note: 'Q4 e-tron 180 km/h', src: 'Audi / EV-DB' },
  '2023-bmw-i7-xdrive60': { mph: 149, note: 'i7 xDrive60 240 km/h', src: 'BMW / EV-DB' },
  '2023-ford-mustang-mach-e-gt': { mph: 124, note: 'Mach-E GT 200 km/h', src: 'Ford / EV-DB' },
  '2023-genesis-gv60-performance': { mph: 146, note: 'GV60 Performance 235 km/h', src: 'Genesis / EV-DB' },
  '2023-hyundai-ioniq-5-n': { mph: 161, note: 'IONIQ 5 N 161 mph', src: 'Hyundai US tech sheet' },
  '2023-hyundai-kona-electric': { mph: 107, note: 'Kona Electric 172 km/h', src: 'EV-DB' },
  '2023-kia-ev6-gt': { mph: 161, note: 'EV6 GT 260 km/h / 161 mph', src: 'Kia / EV-DB' },
  '2023-mercedes-eqe-amg-53': { mph: 137, note: 'EQE 53 sedan 220 km/h base', src: 'MB AMG / EV-DB' },
  '2023-mercedes-eqs-580-suv': { mph: 130, note: 'EQS SUV 580 210 km/h', src: 'MB / EV-DB' },
  '2023-nissan-ariya-e-4orce': { mph: 124, note: 'Ariya e-4ORCE 200 km/h', src: 'Nissan / EV-DB' },
  '2023-polestar-2-performance': { mph: 127, note: 'Polestar 2 Perf 205 km/h', src: 'Polestar / EV-DB' },
  '2023-tesla-model-y-performance': { mph: 155, note: 'Model Y Performance 155 mph', src: 'Tesla.com' },
  '2023-toyota-bz4x-awd': { mph: 99, note: 'bZ4X AWD 160 km/h', src: 'Toyota / EV-DB' },
  '2023-vw-id-4-awd-pro': { mph: 112, note: 'ID.4 AWD Pro 180 km/h', src: 'VW / EV-DB' },
  '2024-bmw-i5-m60': { mph: 143, note: 'i5 M60 230 km/h', src: 'BMW / EV-DB' },
  '2024-cadillac-lyriq-awd': { mph: 130, note: 'LYRIQ AWD 210 km/h', src: 'Cadillac / EV-DB' },
  '2024-chevrolet-blazer-ev-ss': { mph: 130, note: 'Blazer EV SS limited 130 mph', src: 'Chevy' },
  '2024-fisker-ocean-extreme': { mph: 127, note: 'Ocean Extreme ~205 km/h', src: 'EVspecs' },
  '2024-hyundai-ioniq-6-awd': { mph: 115, note: 'Ioniq 6 AWD 185 km/h', src: 'EV-DB' },
  '2024-kia-niro-ev': { mph: 104, note: 'Niro EV ~167 km/h / 104 mph', src: 'Kia' },
  '2024-lucid-air-sapphire': { mph: 205, note: 'Air Sapphire 205 mph', src: 'Lucid Motors' },
  '2024-lucid-air-touring': { mph: 140, note: 'Air Touring 140 mph', src: 'Lucid 2024 PDF' },
  '2024-mercedes-eqs-450': { mph: 130, note: 'EQS 450+ 210 km/h', src: 'MB / EV-DB' },
  '2024-rivian-r1s-quad-motor': { mph: 125, note: 'R1S Quad ~125 mph', src: 'Rivian' },
  '2024-subaru-solterra': { mph: 99, note: 'Solterra 160 km/h', src: 'Subaru / EV-DB' },
  '2024-tesla-cybertruck-tri-motor': { mph: 130, note: 'Cyberbeast 130 mph', src: 'Tesla.com' },
  '2024-tesla-model-3-performance': { mph: 163, note: 'M3P Highland 262 km/h / 163 mph', src: 'Tesla / auto-data' },
  '2024-tesla-model-s-long-range': { mph: 149, note: 'Model S LR 149 mph', src: 'Tesla.com' },
  '2024-tesla-model-x-long-range': { mph: 149, note: 'Model X LR 149 mph', src: 'Tesla.com' },
  '2024-volvo-ex90-twin-motor': { mph: 112, note: 'EX90 Twin 180 km/h', src: 'Volvo / EV-DB' },
  '2024-volvo-xc40-recharge': { mph: 112, note: 'XC40 Recharge 180 km/h', src: 'Volvo / EV-DB' }
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function scaleCurve(curve, s) {
  if (!curve || !(s > 0) || Math.abs(s - 1) < 1e-9) return curve;
  var o = {}; Object.keys(curve).forEach(function (k) { o[k] = Math.round(curve[k] * s * 10000) / 10000; });
  return o;
}
function applyPower(car, newHp) {
  var old = Number(car.peakHp) || 1;
  car.peakHp = Math.round(newHp);
  if (car.torqueCurve) car.torqueCurve = scaleCurve(car.torqueCurve, newHp / old);
}
function runSim(car, fullVmax) {
  var c = clone(car); c.forceScale = 1;
  var r = Phys.runQuarterMile(c, {
    tempF: 70, humidity: 45, pressureInHg: 29.92, windSpeedMph: 0, windDirDeg: 0,
    gustMph: 0, launchMode: 'auto', trackPrep: 'unprepped', driverWeightLbs: 200,
    tireType: c.tireType | 0, tireLabel: Phys.tireLabelForType(c.tireType | 0),
    needSixtyToOneThirty: true, quickMetrics: !fullVmax
  });
  return {
    z60: r.zeroToSixty != null ? +Number(r.zeroToSixty).toFixed(3) : null,
    et: r.quarterMileTime != null ? +Number(r.quarterMileTime).toFixed(3) : null,
    trap: r.quarterMileSpeedMph != null ? +Number(r.quarterMileSpeedMph).toFixed(2) : null,
    z60130: r.sixtyToOneThirty != null ? +Number(r.sixtyToOneThirty).toFixed(3) : null,
    ft60: r.sixtyFootTime != null ? +Number(r.sixtyFootTime).toFixed(3) : null,
    vmax: r.topSpeedMph != null ? +Number(r.topSpeedMph).toFixed(2) : null,
    vmaxReason: r.vmaxReason || ''
  };
}

var cars = clone(GARAGE);
var vmaxTable = []; var changed = 0, unchanged = 0, missing = 0;
cars.forEach(function (car) {
  if (!car.isEv) return;
  var oem = OEM_VMAX[car.id]; var old = car.speedLimiterMph;
  if (!oem) {
    missing++; vmaxTable.push({ id: car.id, name: car.name, old: old, neu: old, status: 'UNSURE', note: 'no OEM entry' });
    return;
  }
  var neu = oem.mph;
  var status = (Math.abs(Number(old) - neu) < 0.05) ? 'UNCHANGED' : 'CHANGED';
  car.speedLimiterMph = neu;
  if (status === 'CHANGED') {
    car.source = ((car.source || '') + ' | OEM EV Vmax: ' + oem.note + ' (was lim ' + old + ' → ' + neu + ' mph; credit Jorge Guerra)').replace(/^\s*\|\s*/, '');
    changed++;
  } else unchanged++;
  vmaxTable.push({ id: car.id, name: car.name, old: old, neu: neu, status: status, note: oem.note, src: oem.src });
});

var m3pIdx = cars.findIndex(function (c) { return c.id === '2024-tesla-model-3-performance'; });
var m3pBeforeCar = clone(cars[m3pIdx]);
var m3pBefore = runSim(m3pBeforeCar, true);
var base = clone(cars[m3pIdx]);
base.speedLimiterMph = 163;

function evalCfg(hp, drive, mu) {
  var c = clone(base);
  applyPower(c, hp);
  c.evLaunchDriveMult = +clamp(drive, 0.70, 1.85).toFixed(3);
  c.evLaunchMuMult = +clamp(mu, 0.85, 1.40).toFixed(3);
  c.speedLimiterMph = 163; c.forceScale = 1;
  var sim = runSim(c, false);
  var ftPen = 0, zPen = 0;
  if (sim.ft60 == null) ftPen = 100;
  else if (sim.ft60 < 1.68) ftPen = (1.68 - sim.ft60) * 100;
  else if (sim.ft60 > 1.70) ftPen = (sim.ft60 - 1.70) * 100;
  else ftPen = Math.abs(sim.ft60 - 1.69) * 2;
  if (sim.z60130 == null) zPen = 100;
  else if (sim.z60130 < 9.0) zPen = (9.0 - sim.z60130) * 80;
  else if (sim.z60130 > 9.2) zPen = (sim.z60130 - 9.2) * 80;
  else zPen = Math.abs(sim.z60130 - 9.1) * 2;
  var score = ftPen + zPen + (drive - 1) * 0.05 + (mu - 1) * 0.05 + Math.abs(FACTORY_M3P_HP - hp) * 0.002;
  return { car: c, sim: sim, hp: hp, drive: c.evLaunchDriveMult, mu: c.evLaunchMuMult, score: score };
}

var best = null;
function accept(r) { if (!best || r.score < best.score - 1e-9) best = r; return r; }

// Phase A: find launch for 60' at hp=480
process.stderr.write('Phase A: 60-ft launch\n');
for (var d = 1.50; d <= 1.85 + 1e-9; d += 0.025) {
  for (var m = 0.95; m <= 1.25 + 1e-9; m += 0.025) accept(evalCfg(480, d, m));
}
process.stderr.write('  A best ft60=' + best.sim.ft60 + ' z613=' + best.sim.z60130 + ' d=' + best.drive + ' mu=' + best.mu + '\n');

// Phase B: binary-ish HP raise at fixed launch for 60-130
process.stderr.write('Phase B: HP for 60-130\n');
var driveB = best.drive, muB = best.mu;
for (var hp = 480; hp <= FACTORY_M3P_HP; hp += 5) accept(evalCfg(hp, driveB, muB));
// also nudge launch slightly at best HP
var hpB = best.hp;
for (var d2 = driveB - 0.05; d2 <= driveB + 0.05 + 1e-9; d2 += 0.01) {
  for (var m2 = Math.max(0.85, muB - 0.05); m2 <= muB + 0.05 + 1e-9; m2 += 0.01) {
    accept(evalCfg(hpB, d2, m2));
    if (hpB < FACTORY_M3P_HP) accept(evalCfg(FACTORY_M3P_HP, d2, m2));
    if (hpB > 480) accept(evalCfg(hpB - 5, d2, m2));
  }
}
process.stderr.write('  B best ft60=' + best.sim.ft60 + ' z613=' + best.sim.z60130 + ' hp=' + best.hp + ' d=' + best.drive + ' mu=' + best.mu + '\n');

// Phase C: fine
process.stderr.write('Phase C: fine\n');
for (var hp3 = Math.max(480, best.hp - 4); hp3 <= Math.min(FACTORY_M3P_HP, best.hp + 4); hp3++) {
  for (var d3 = best.drive - 0.02; d3 <= best.drive + 0.02 + 1e-9; d3 += 0.005) {
    for (var m3 = Math.max(0.85, best.mu - 0.02); m3 <= best.mu + 0.02 + 1e-9; m3 += 0.005) {
      accept(evalCfg(hp3, d3, m3));
    }
  }
}
process.stderr.write('  FINAL ft60=' + best.sim.ft60 + ' z613=' + best.sim.z60130 + ' hp=' + best.hp + ' d=' + best.drive + ' mu=' + best.mu + '\n');

var inBand = best.sim.ft60 >= 1.68 && best.sim.ft60 <= 1.70 && best.sim.z60130 >= 9.0 && best.sim.z60130 <= 9.2;
cars[m3pIdx] = best.car;
cars[m3pIdx].source = ((cars[m3pIdx].source || '') +
  ' | M3P tip retune: 60′ ' + best.sim.ft60 + ' / 60-130 ' + best.sim.z60130 +
  ' via launch drive=' + best.drive + ' mu=' + best.mu + ' hp=' + best.hp +
  '≤factory 510; OEM lim 163 (credit Jorge Guerra)').replace(/^\s*\|\s*/, '');

var m3pAfter = runSim(cars[m3pIdx], true);

var header = [
  '/*',
  ' * VelocityBench PowerCurve — garage data',
  ' * Credits: Jorge Guerra only',
  ' * Tip: OEM EV speedLimiterMph (real top speeds) + M3P 60′/60-130 retune',
  ' * Generated: ' + new Date().toISOString(),
  ' */',
  'var VB_POWERCURVE_GARAGE = '
].join('\n');
var footer = ';\nif (typeof module !== "undefined" && module.exports) module.exports = VB_POWERCURVE_GARAGE;\n';
fs.writeFileSync(path.join(__dirname, '../js/garage-data.js'), header + JSON.stringify(cars, null, 2) + footer);

delete require.cache[require.resolve('../js/garage-data.js')];
var reloaded = require('../js/garage-data.js');
var evs = reloaded.filter(function (c) { return c.isEv; });
var samples = ['2024-tesla-model-3-performance','2022-tesla-model-s-plaid','2024-lucid-air-sapphire','2022-porsche-taycan-turbo-s','2024-tesla-cybertruck-tri-motor']
  .map(function (id) { var c = reloaded.find(function (x) { return x.id === id; }); return { id: id, lim: c && c.speedLimiterMph, name: c && c.name }; });

var report = {
  tipNote: 'OEM EV speedLimiterMph + M3P 60′/60-130; Pages NOT shipped; Jorge Guerra',
  field: 'speedLimiterMph',
  evCount: evs.length,
  vmax: { changed: changed, unchanged: unchanged, unsure: missing, table: vmaxTable },
  m3p: {
    before: { knobs: { peakHp: m3pBeforeCar.peakHp, drive: m3pBeforeCar.evLaunchDriveMult, mu: m3pBeforeCar.evLaunchMuMult, lim: m3pBeforeCar.speedLimiterMph }, sim: m3pBefore },
    after: { knobs: { peakHp: cars[m3pIdx].peakHp, drive: cars[m3pIdx].evLaunchDriveMult, mu: cars[m3pIdx].evLaunchMuMult, lim: cars[m3pIdx].speedLimiterMph }, sim: m3pAfter },
    inBand: !!inBand, factoryHpCap: FACTORY_M3P_HP
  },
  verify: { bindVar: 'VB_POWERCURVE_GARAGE', evCount: evs.length, samples: samples, totalCars: reloaded.length }
};
fs.writeFileSync(path.join(__dirname, 'tip-ev-oem-vmax-m3p-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  vmaxChanged: changed, vmaxUnchanged: unchanged, vmaxUnsure: missing,
  m3pBefore: m3pBefore, m3pAfter: m3pAfter,
  m3pKnobs: report.m3p.after.knobs, inBand: inBand,
  evCount: evs.length, samples: samples
}, null, 2));
