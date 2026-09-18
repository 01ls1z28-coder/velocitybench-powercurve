/**
 * Phase 4/5 — bake 333-car PowerCurve garage (+ Phase 5 induction boostModel) from Excel import + VelocityBench garage-data.
 * Merges Cd/area/loss/tire/drive/FI/EV/TX from VB; synthesizes gears/curves/RPM; calibrates
 * loss + forceScale + TireType + launchRpm toward Jorge's 0-60 / ¼ / 60-130 (trap-first).
 *
 *   node scripts/build-garage.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');

var ROOT = path.join(__dirname, '..');
var IMPORT_PATH = '/workspace/powercurve-garage-import.json';
var VB_GARAGE_PATH = '/workspace/forcemetric-web-git/js/garage-data.js';
var OUT_JS = path.join(ROOT, 'js/garage-data.js');
var OUT_META = path.join(ROOT, 'scripts/garage-calib-meta.json');

var TX_MAP = {
  Auto: 'ZF8HP',
  Manual: 'TR6060_6',
  DCT: 'DCT_7_AMG',
  Sequential: 'GR6_DCT'
};

/** Map VB TireType (0 AllSeason,1 Summer,2 UHP,3 Soft,4 Slicks) → PowerCurve tireType */
function mapVbTire(t) {
  t = t | 0;
  if (t <= 0) return 0;      // Street
  if (t === 1) return 3;     // Summer
  if (t === 2) return 4;     // UHP
  if (t === 3) return 1;     // Soft → Drag Radial
  return 2;                  // Slicks → Slick
}


/**
 * Phase 5 — induction UI default (baked boostModel).
 * Dyno curves already include boost (boostPsi stays 0); this only drives the Induction radios.
 * SC: factory supercharged name cues. Turbo: explicit turbo / isFI default. NA/EV unchanged.
 */

function densifyTorqueCurve50(curve, redline) {
  if (!curve) return curve;
  var keys = Object.keys(curve).map(Number).filter(isFinite).sort(function (a, b) { return a - b; });
  if (!keys.length) return curve;
  var minR = keys[0];
  var maxR = Math.max(keys[keys.length - 1], redline || keys[keys.length - 1]);
  var start = Math.floor(minR / 50) * 50;
  if (start < minR) start += 50;
  if (start < 500) start = Math.max(500, start);
  var out = {}, prev = null;
  for (var r = start; r <= maxR + 0.01; r += 50) {
    var rpm = Math.round(r);
    var tq = Phys.getTorqueAtRpm(curve, rpm);
    if (!isFinite(tq) || tq <= 0) tq = prev != null ? prev : 5;
    out[rpm] = tq;
    prev = tq;
  }
  keys.forEach(function (k) {
    if (k % 50 !== 0) {
      var t = Number(curve[k]);
      if (isFinite(t) && t > 0) out[k] = t;
    }
  });
  return out;
}

function bakeWeightDistribution(car) {
  var sug = Phys.suggestedWeightDistribution
    ? Phys.suggestedWeightDistribution(car)
    : { frontWeightPercent: 45, rearWeightPercent: 55, leftWeightPercent: 50, rightWeightPercent: 50 };
  car.frontWeightPercent = sug.frontWeightPercent;
  car.rearWeightPercent = sug.rearWeightPercent;
  car.leftWeightPercent = sug.leftWeightPercent;
  car.rightWeightPercent = sug.rightWeightPercent;

  // Phase 5 densify: 50-RPM torque mesh + layout/drive weight bake
  if (car.torqueCurve) car.torqueCurve = densifyTorqueCurve50(car.torqueCurve, car.redline);
  bakeWeightDistribution(car);

  return car;
}

function classifyInduction(name, isFI, isEv) {
  if (isEv) return { boostModel: 'na', isFI: false, isNA: false };
  var n = String(name || '').toLowerCase();
  // Factory supercharger platforms (not turbo GNX / not 1971 Demon 340)
  var isSC =
    /supercharg|kompressor|whipple|eaton|magnuson|rotrex|vortech|procharger/.test(n) ||
    /hellcat|redeye|trackhawk/.test(n) ||
    /\bzl1\b/.test(n) ||
    (/corvette/.test(n) && /\bzr1\b/.test(n) && !/turbo/.test(n)) ||
    /shelby gt500|mustang shelby gt500/.test(n) ||
    /terminator|cobra \(terminator\)/.test(n) ||
    /challenger.*\bdemon\b|charger.*\bdemon\b|hellcat.*demon|\bdemon 170\b/.test(n) ||
    /\blt4\b|\blsa\b|\bls9\b/.test(n) ||
    /escalade[- ]?v\b|cts-v|ct[45]-v|\bv-series\b/.test(n) ||
    /\bram trx\b|ram 1500 trx/.test(n) ||
    /ninja h2|kawasaki h2/.test(n) ||
    /\be55\b|\bsl55\b|\bcl55\b|range rover.*svr/.test(n);
  var isTurboName =
    /turbo|twin.?turbo|biturbo|ecoboost|tfsi|tdi|t-?jet|powerstroke|power.?stroke/.test(n) ||
    /\bgnx\b|grand national/.test(n) ||
    /skyline|gt-r|\bgtr\b|wrx|\bsti\b|lancer evolution|mazdaspeed|gt-four|pulsar gti-r|soarer gt-t|chaser tourer/.test(n) ||
    /integra type s|tlx type s|golf r|gr corolla|gr supra|bronco raptor|f-150 raptor/.test(n) ||
    // FK8/FL5 Type R are turbo; EK9/EP3/FN2 era are NA — require 2015+ year cue
    (/civic type r/.test(n) && /\b(201[5-9]|202\d)\b/.test(n)) ||
    /m5 competition|x5m|x6m|\b135i\b|\b335i\b|\btt rs\b|rs[ ]?[3567]\b/.test(n) ||
    /amg.*(biturbo|turbo)|sf90|chiron|veyron|huayra|jesko|agera|venom|765lt|720s|600lt|mp4-12c|mclaren p1|speedtail|elva|sabre|\bford gt\b/.test(n);

  if (isSC) {
    return { boostModel: 'supercharger', isFI: true, isNA: false };
  }
  if (isTurboName || isFI) {
    return { boostModel: 'turbo', isFI: true, isNA: false };
  }
  return { boostModel: 'na', isFI: false, isNA: true };
}

function slugId(name) {
  return String(name || 'car')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function parseTargets(s) {
  s = String(s || '');
  var out = {};
  var m = s.match(/0-60:\s*([\d.]+)\s*s?/i);
  if (m) out.z60 = +m[1];
  m = s.match(/1\/4:\s*([\d.]+)\s*s\s*@\s*([\d.]+)\s*mph/i);
  if (m) { out.et = +m[1]; out.trap = +m[2]; }
  m = s.match(/60-130:\s*(n\/?a|—|-)/i);
  if (!m) {
    m = s.match(/60-130:\s*([\d.]+)\s*s?/i);
    if (m) out.z60130 = +m[1];
  }
  m = s.match(/100-150:\s*(n\/?a|—|-)/i);
  if (!m) {
    m = s.match(/100-150:\s*([\d.]+)\s*s?/i);
    if (m) out.z100150 = +m[1];
  }
  return out;
}

function loadVbGarage() {
  var src = fs.readFileSync(VB_GARAGE_PATH, 'utf8');
  var m = src.match(/window\.GARAGE_DATA\s*=\s*(\[[\s\S]*\]);?\s*$/);
  if (!m) throw new Error('Could not parse VB garage-data.js');
  var arr = JSON.parse(m[1]);
  var byName = Object.create(null);
  arr.forEach(function (c) { byName[c.Name] = c; });
  return { list: arr, byName: byName };
}

function pickTxKey(vb, name, hp, isEv, year) {
  if (isEv) return 'EV_Single';
  var tx = vb && vb.Transmission;
  if (tx && TX_MAP[tx]) return TX_MAP[tx];
  var n = (name || '').toLowerCase();
  if (/pdk|dct|dual.?clutch|tremec tr-9070|gr6/.test(n)) return 'DCT_7_AMG';
  if (year && year < 1975) {
    if (hp >= 350) return 'Toploader_4';
    return 'Muncie_M21';
  }
  if (year && year < 1990) return 'T5_5';
  if (hp >= 600) return 'ZF8HP';
  return 'TR6060_6';
}

function guessYear(name) {
  var m = String(name).match(/\b(19\d{2}|20\d{2})\b/);
  return m ? +m[1] : null;
}

function guessCategory(name, vb) {
  var n = (name || '').toLowerCase();
  if (vb && vb.IsEv) return 'EV';
  if (/bugatti|koenigsegg|mclaren senna|chiron|jesko|nevera|rimac/.test(n)) return 'Hypercars';
  if (/ferrari|lamborghini|mclaren|porsche 911|hurac|aventador|720s|gt2|gt3|r8/.test(n)) return 'Supercars';
  if (/supra|skyline|gtr|wrx|evo|civic type|rx-7|s2000|miata|mx-5|350z|370z/.test(n)) return 'Sports Cars';
  if (/mustang|camaro|challenger|charger|corvette|hellcat|gt500|viper|trans am|firebird|gto|cuda/.test(n)) {
    var y = guessYear(name);
    return y && y < 1985 ? 'Classic Muscle' : 'Modern Muscle';
  }
  if (/truck|f-150|silverado|ram |tundra|raptor|sierra/.test(n)) return 'Trucks';
  if (/suv|tahoe|suburban|expedition|navigator|cayenne|urus|macan|x5|gle/.test(n)) return 'SUV';
  return 'Garage';
}

function guessTireRadius(weightLbs, drive, isEv, name) {
  var n = (name || '').toLowerCase();
  if (/f1|formula|open.?wheel/.test(n)) return 11.5;
  if (/truck|f-150|silverado|ram |raptor|tundra/.test(n)) return 15.2;
  if (/suv|tahoe|urus|cayenne|suburban/.test(n)) return 14.8;
  if (isEv) return weightLbs > 4500 ? 14.0 : 13.4;
  if (weightLbs < 2500) return 12.2;
  if (weightLbs < 3200) return 12.8;
  if (weightLbs < 3800) return 13.2;
  if (weightLbs < 4500) return 13.8;
  return 14.2;
}

function guessRpmBand(hp, isEv, isFI, year, name) {
  if (isEv) {
    return { launch: 0, shift: 12000, redline: 14000, peakTqRpm: 2000, peakHpRpm: 8000 };
  }
  var n = (name || '').toLowerCase();
  var highRev = /ferrari|honda|s2000|boss 302|gt3|viper|rotary|rx-7|bike|hayabusa/.test(n);
  var redline, peakHpRpm, peakTqRpm, launch, shift;
  if (year && year < 1980) {
    redline = hp > 400 ? 6500 : 5800;
    peakHpRpm = Math.round(redline * 0.88);
    peakTqRpm = Math.round(redline * 0.55);
    launch = 2800; shift = Math.round(redline * 0.94);
  } else if (isFI) {
    redline = highRev ? 7500 : (hp > 700 ? 6500 : 6800);
    peakHpRpm = Math.round(redline * 0.90);
    peakTqRpm = Math.round(redline * 0.55);
    launch = 2400; shift = Math.round(redline * 0.93);
  } else if (highRev) {
    redline = 8200; peakHpRpm = 7600; peakTqRpm = 5500; launch = 3500; shift = 7800;
  } else {
    redline = hp > 450 ? 7200 : 6800;
    peakHpRpm = Math.round(redline * 0.90);
    peakTqRpm = Math.round(redline * 0.62);
    launch = 3000; shift = Math.round(redline * 0.94);
  }
  return { launch: launch, shift: shift, redline: redline, peakTqRpm: peakTqRpm, peakHpRpm: peakHpRpm };
}

function guessCdArea(vb, weightLbs, name, isEv) {
  var n = (name || '').toLowerCase();
  // Motorcycles / sportbikes — tiny frontal area (Excel trap otherwise impossible)
  if (/ninja|hayabusa|yamaha|suzuki gsx|honda cbr|kawasaki|ducati|bmw s1000|motorcycle|bike\b/.test(n)) {
    return { cd: 0.45, area: 6.8 };
  }
  if (vb && vb.DragCoefficient && vb.FrontalAreaSqFt) {
    return { cd: vb.DragCoefficient, area: vb.FrontalAreaSqFt };
  }
  if (/truck|f-150|silverado|ram /.test(n)) return { cd: 0.44, area: 32 };
  if (/suv|tahoe|suburban|urus|cayenne/.test(n)) return { cd: 0.36, area: 28 };
  if (isEv) return { cd: 0.24, area: 23.5 };
  if (weightLbs < 2800) return { cd: 0.32, area: 19.5 };
  if (weightLbs > 4500) return { cd: 0.38, area: 25 };
  return { cd: 0.34, area: 22.5 };
}

/** Published-leaning curated overrides keyed by import Name (exact). */
var CURATED = {
  '1965 Shelby Cobra 427': {
    weightLbs: 2520, dragCoefficient: 0.55, frontalAreaSqFt: 19.5, tireRadiusInches: 13.0,
    finalDriveRatio: 3.54, gearRatios: [2.20, 1.66, 1.31, 1.00],
    torqueCurve: {1500:380,2000:420,2500:450,3000:470,3500:480,4000:475,4500:460,5000:430,5500:400,6000:372,6500:330},
    isNA: true, isFI: false, driveType: 'RWD', shiftRpm: 6200, launchRpm: 3000, redline: 6500,
    drivetrainLossPercent: 15, peakHp: 425, peakTqRpm: 3500, peakHpRpm: 6000, txKey: 'Toploader_4',
    tireType: 1, forceScale: 1
  },
  '1994 Toyota Supra Twin Turbo': {
    weightLbs: 3450, dragCoefficient: 0.32, frontalAreaSqFt: 21.0, tireRadiusInches: 12.5,
    finalDriveRatio: 3.133, gearRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
    torqueCurve: {2000:185,2500:230,3000:275,3500:300,4000:315,4500:310,5000:305,5500:302,5600:300,6000:275,6500:250,7000:225},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6800, launchRpm: 2800, redline: 7000, drivetrainLossPercent: 12,
    peakHp: 320, peakTqRpm: 4000, peakHpRpm: 5600, txKey: 'Aisin_6', tireType: 1, forceScale: 1
  },
  '2002 Nissan Skyline GT-R R34': {
    weightLbs: 3395, dragCoefficient: 0.34, frontalAreaSqFt: 21.5, tireRadiusInches: 12.9,
    finalDriveRatio: 3.545, gearRatios: [3.214, 1.925, 1.302, 1.000, 0.752, 0.634],
    torqueCurve: {2500:200,3000:230,3500:260,4000:280,4400:289,5000:275,5500:255,6000:235,6500:220,6800:213,7000:205,7500:185,8000:165},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'AWD',
    shiftRpm: 7600, launchRpm: 3500, redline: 8000, drivetrainLossPercent: 14,
    peakHp: 276, peakTqRpm: 4400, peakHpRpm: 6800, txKey: 'Getrag_R34', tireType: 0, forceScale: 1
  },
  '2013 Ford Mustang Boss 302': {
    weightLbs: 3631, dragCoefficient: 0.36, frontalAreaSqFt: 22.7, tireRadiusInches: 13.4,
    finalDriveRatio: 3.73, gearRatios: [3.66, 2.43, 1.69, 1.32, 1.00, 0.65],
    torqueCurve: {2000:250,2500:280,3000:310,3500:340,4000:365,4500:380,5000:375,5500:360,6000:345,6500:330,7000:320,7400:315,7500:300},
    isNA: true, driveType: 'RWD', shiftRpm: 7400, launchRpm: 3200, redline: 7500,
    drivetrainLossPercent: 12, peakHp: 444, peakTqRpm: 4500, peakHpRpm: 7400, txKey: 'Getrag_MT82',
    tireType: 0, forceScale: 1
  },
  '2020 Ford Mustang Shelby GT500': {
    weightLbs: 4183, dragCoefficient: 0.37, frontalAreaSqFt: 23.2, tireRadiusInches: 13.6,
    finalDriveRatio: 3.73, gearRatios: [3.14, 2.05, 1.43, 1.10, 0.86, 0.68, 0.56],
    torqueCurve: {2000:420,2500:480,3000:540,3500:580,4000:605,4500:620,5000:625,5500:615,6000:595,6500:575,7000:555,7300:547,7500:520},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 7500, launchRpm: 3000, redline: 7500, drivetrainLossPercent: 10,
    peakHp: 760, peakTqRpm: 5000, peakHpRpm: 7300, txKey: 'DCT_7_AMG', tireType: 1, forceScale: 1
  },
  '2021 Porsche 911 Turbo S': {
    weightLbs: 3640, dragCoefficient: 0.33, frontalAreaSqFt: 21.5, tireRadiusInches: 13.6,
    finalDriveRatio: 3.09, gearRatios: [3.91, 2.29, 1.58, 1.19, 0.97, 0.83, 0.67],
    torqueCurve: {2000:450,2500:590,3000:590,3500:590,4000:590,4500:585,5000:570,5500:550,6000:525,6500:505,6750:498,7000:475,7200:450},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'AWD',
    shiftRpm: 7000, launchRpm: 3500, redline: 7200, drivetrainLossPercent: 10,
    peakHp: 640, peakTqRpm: 2500, peakHpRpm: 6750, txKey: 'PDK_7', tireType: 1, forceScale: 1
  },
  '2021 Dodge Charger Hellcat Redeye': {
    weightLbs: 4451, dragCoefficient: 0.382, frontalAreaSqFt: 24.2, tireRadiusInches: 14.3,
    finalDriveRatio: 2.62, gearRatios: [4.71, 3.14, 2.11, 1.67, 1.28, 1.00, 0.84, 0.67],
    torqueCurve: {1500:420,2000:520,2500:600,3000:650,3500:685,4000:700,4500:707,5000:700,5500:688,6000:675,6300:665,6500:640},
    isFI: true, isNA: false, boostModel: 'na', boostPsi: 0, driveType: 'RWD',
    shiftRpm: 6100, launchRpm: 2200, redline: 6500, drivetrainLossPercent: 15,
    peakHp: 797, peakTqRpm: 4500, peakHpRpm: 6300, txKey: 'ZF8HP', tireType: 1, forceScale: 1
  },
  '2023 Mazda MX-5 Miata Club': {
    weightLbs: 2332, dragCoefficient: 0.36, frontalAreaSqFt: 18.8, tireRadiusInches: 12.1,
    finalDriveRatio: 2.866, gearRatios: [5.087, 2.991, 2.035, 1.594, 1.286, 1.000],
    torqueCurve: {2000:105,2500:118,3000:128,3500:138,4000:145,4500:148,4600:148,5000:145,5500:140,6000:136,6500:125,7000:112,7500:98},
    isNA: true, driveType: 'RWD', shiftRpm: 7200, launchRpm: 3500, redline: 7500,
    drivetrainLossPercent: 12, peakHp: 181, peakTqRpm: 4600, peakHpRpm: 6000, txKey: 'Aisin_6',
    tireType: 0, forceScale: 1
  }
};

var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };

function cost(sim, tgt) {
  var c = 0;
  var hits = 0;
  var applicable = 0;
  function add(key, w, tol) {
    if (tgt[key] == null) return;
    applicable++;
    if (sim[key] == null) { c += 50; return; }
    var err = Math.abs(sim[key] - tgt[key]);
    c += (err / tol) * w;
    if (err <= tol) hits++;
  }
  // Trap-first, then ET, then 0-60 (raised weight), then 60-130
  add('trap', 4, TOL.trap);
  add('et', 3, TOL.et);
  add('z60', 2.5, TOL.z60);
  add('z60130', 1.5, TOL.z60130);
  // Prefer more in-tolerance hits (pushes all-applicable rate)
  c -= hits * 3.0;
  c += (applicable - hits) * 1.25;
  return c;
}

function countHits(h) {
  return (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
}

function hitFlags(sim, tgt) {
  return {
    et: tgt.et == null || (sim.et != null && Math.abs(sim.et - tgt.et) <= TOL.et),
    trap: tgt.trap == null || (sim.trap != null && Math.abs(sim.trap - tgt.trap) <= TOL.trap),
    z60: tgt.z60 == null || (sim.z60 != null && Math.abs(sim.z60 - tgt.z60) <= TOL.z60),
    z60130: tgt.z60130 == null || (sim.z60130 != null && Math.abs(sim.z60130 - tgt.z60130) <= TOL.z60130)
  };
}

function runSim(car) {
  var env = {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launchMode: 'auto',
    tireType: car.tireType | 0,
    tireLabel: Phys.tireLabelForType(car.tireType | 0),
    quickMetrics: true,
    needSixtyToOneThirty: true,
    needHundredToOneFifty: false
  };
  var r = Phys.runQuarterMile(car, env);
  return {
    et: r.quarterMileTime || null,
    trap: r.quarterMileSpeedMph || null,
    z60: r.zeroToSixty,
    z60130: r.sixtyToOneThirty,
    z100150: r.hundredToOneFifty,
    finished: r.finished
  };
}

function better(best, cand) {
  if (!best || cand.cost < best.cost - 1e-9) return cand;
  if (Math.abs(cand.cost - best.cost) < 1e-9 && cand.nh > best.nh) return cand;
  return best;
}

function trial(car, tgt, loss, fs, tire, launch, best) {
  car.drivetrainLossPercent = loss;
  car.forceScale = fs;
  car.tireType = tire;
  if (launch != null) car.launchRpm = launch;
  var sim = runSim(car);
  var h = hitFlags(sim, tgt);
  var cand = {
    loss: loss,
    forceScale: fs,
    tireType: tire,
    launchRpm: car.launchRpm,
    cost: cost(sim, tgt),
    sim: sim,
    hits: h,
    nh: countHits(h)
  };
  return better(best, cand);
}

function allHit(h) {
  return !!(h && h.et && h.trap && h.z60 && h.z60130);
}

function calibrateCar(car, tgt) {
  var lossLo = 0, lossHi = 32;
  var baseLoss = car.drivetrainLossPercent != null ? car.drivetrainLossPercent : 15;
  var seedTire = car.tireType | 0;
  var baseLaunch = car.launchRpm != null ? car.launchRpm : 3000;
  var best = null;

  // Phase 1 — coarse loss on seed tire @ forceScale=1 (fast path for most of fleet)
  var losses = [];
  for (var L = lossLo; L <= lossHi; L += 2) losses.push(L);
  if (losses.indexOf(Math.round(baseLoss)) < 0) losses.push(Math.round(baseLoss));
  losses.sort(function (a, b) { return a - b; });
  for (var li = 0; li < losses.length; li++) {
    best = trial(car, tgt, losses[li], 1, seedTire, baseLaunch, best);
  }

  // Phase 1b — fine loss around best
  if (best) {
    var lc0 = best.loss;
    for (var d0 = -1.5; d0 <= 1.5; d0 += 0.5) {
      var loss0 = Math.max(lossLo, Math.min(lossHi, +(lc0 + d0).toFixed(1)));
      best = trial(car, tgt, loss0, 1, seedTire, baseLaunch, best);
    }
  }

  // Phase 2 — forceScale joint at best loss (trap / ET / 0-60 balance)
  var scales = [0.75, 0.85, 0.92, 1.0, 1.08, 1.15, 1.25, 1.35, 1.5, 1.7];
  if (best && !allHit(best.hits)) {
    var lc = best.loss;
    for (var d = -2; d <= 2; d += 1) {
      var loss = Math.max(lossLo, Math.min(lossHi, lc + d));
      for (var si = 0; si < scales.length; si++) {
        best = trial(car, tgt, loss, scales[si], best.tireType, baseLaunch, best);
      }
    }
  }

  // Phase 3 — TireType ladder only when still missing (launch-limited or trap-skewed)
  if (best && !allHit(best.hits)) {
    var tireLadder = [3, 4, 1, 2, 0].filter(function (t) { return t !== (best.tireType | 0); });
    var lc2 = best.loss;
    var fs2 = best.forceScale;
    for (var ti = 0; ti < tireLadder.length; ti++) {
      var tire = tireLadder[ti];
      // loss band × a few scales at this tire
      for (var d2 = -3; d2 <= 3; d2 += 1.5) {
        var loss2 = Math.max(lossLo, Math.min(lossHi, +(lc2 + d2).toFixed(1)));
        best = trial(car, tgt, loss2, fs2, tire, baseLaunch, best);
        best = trial(car, tgt, loss2, 1.0, tire, baseLaunch, best);
        best = trial(car, tgt, loss2, 1.2, tire, baseLaunch, best);
        best = trial(car, tgt, loss2, 0.9, tire, baseLaunch, best);
      }
      if (allHit(best.hits) && best.cost < 1.0) break;
    }
  }

  // Phase 4 — launchRpm knobs when 0-60 still off (static-baked)
  if (best && best.hits && !best.hits.z60) {
    var launchDeltas = [-600, -400, -200, 200, 400, 600, 800];
    for (var di = 0; di < launchDeltas.length; di++) {
      var lr = Math.max(800, Math.min(5500, baseLaunch + launchDeltas[di]));
      best = trial(car, tgt, best.loss, best.forceScale, best.tireType, lr, best);
      best = trial(car, tgt, best.loss, Math.max(0.7, +(best.forceScale - 0.1).toFixed(3)), best.tireType, lr, best);
      best = trial(car, tgt, best.loss, Math.min(1.7, +(best.forceScale + 0.1).toFixed(3)), best.tireType, lr, best);
    }
  }

  car.drivetrainLossPercent = +Number(best.loss).toFixed(1);
  car.forceScale = +Number(best.forceScale).toFixed(3);
  car.tireType = best.tireType | 0;
  if (best.launchRpm != null) car.launchRpm = Math.round(best.launchRpm);
  return { best: best, hits: best.hits || hitFlags(best.sim || {}, tgt) };
}

function buildCar(row, vb) {
  var name = row.Name;
  var hp = Number(row.Horsepower) || 300;
  var wt = Number(row.WeightLbs) || 3500;
  var tgt = parseTargets(row['0-60 / 1/4 ']);
  var year = guessYear(name);
  var isEv = !!(vb && vb.IsEv);
  var isFI = !!(vb && vb.IsForcedInduction);
  // Heuristic FI/EV from name if no VB match
  if (!vb) {
    var nl = name.toLowerCase();
    isEv = /\bev\b|electric|model [syx3]|taycan|etron|i4|i7|lucid|rivian|nevera|rimac/.test(nl);
    isFI = /turbo|supercharg|hellcat|gt500|terminator|ecoboost|twin.?turbo|kompressor|fi\b/.test(nl);
  }
  var aero = guessCdArea(vb, wt, name, isEv);
  var rpm = guessRpmBand(hp, isEv, isFI, year, name);
  var txKey = pickTxKey(vb, name, hp, isEv, year);
  var tx = Phys.FactoryTransmissions[txKey] || Phys.FactoryTransmissions.TR6060_6;
  var tireType = vb ? mapVbTire(vb.TireType) : 0;
  var loss = vb && vb.DrivetrainLossPercent != null ? Number(vb.DrivetrainLossPercent) : (tx.loss || 15);
  // Clamp VB loss into PowerCurve-friendly band as starting point
  if (loss < 4) loss = 8;
  if (loss > 28) loss = 22;

  var car = {
    id: slugId(name),
    name: name,
    category: guessCategory(name, vb),
    peakHp: hp,
    weightLbs: wt,
    dragCoefficient: aero.cd,
    frontalAreaSqFt: aero.area,
    tireRadiusInches: guessTireRadius(wt, vb && vb.DriveType, isEv, name),
    finalDriveRatio: tx.finalDrive,
    gearRatios: tx.gears.slice(),
    txKey: txKey,
    drivetrainLossPercent: loss,
    driveType: (vb && vb.DriveType) || 'RWD',
    isEv: isEv,
    isFI: isFI && !isEv,
    isNA: !isFI && !isEv,
    boostModel: 'na',
    boostPsi: 0,
    launchRpm: rpm.launch,
    shiftRpm: rpm.shift,
    redline: rpm.redline,
    peakTqRpm: rpm.peakTqRpm,
    peakHpRpm: rpm.peakHpRpm,
    shiftTimeSeconds: (vb && vb.Transmission === 'DCT') ? 0.06 : (vb && vb.Transmission === 'Manual') ? 0.18 : 0.10,
    tireType: tireType,
    forceScale: 1,
    hasAftermarketConverter: false,
    engineLayout: (vb && vb.EngineLayout) || 'Front',
    transmission: (vb && vb.Transmission) || null,
    source: (vb && vb.Source) || 'heuristic+import',
    targets: tgt
  };

  // Phase 5: bake induction UI default (turbo vs SC vs NA)
  var ind = classifyInduction(name, isFI && !isEv, isEv);
  car.boostModel = ind.boostModel;
  car.isFI = ind.isFI;
  car.isNA = ind.isNA;
  // Keep boostPsi at 0 — baked dyno already includes boost; radios are labels only unless user adds PSI.

    // EV single-speed FD tweak by power/weight
  if (isEv) {
    // Lower FD = more top-end; high-power EVs need it for trap
    car.finalDriveRatio = hp > 1000 ? 6.5 : (hp > 600 ? 7.8 : 9.2);
    car.gearRatios = [1.0];
    car.shiftTimeSeconds = 0.01;
    car.drivetrainLossPercent = Math.min(loss, 8);
    car.launchRpm = 500;
    car.shiftRpm = car.redline;
    car.tireType = Math.max(car.tireType | 0, 3); // Summer floor for EV launch
  }

  // Apply curated published overrides (keeps VERIFY integrity)
  if (CURATED[name]) {
    Object.keys(CURATED[name]).forEach(function (k) {
      car[k] = CURATED[name][k];
    });
    car.peakHp = hp; // keep import HP label if different? prefer curated peakHp
    if (CURATED[name].peakHp) car.peakHp = CURATED[name].peakHp;
    car.weightLbs = CURATED[name].weightLbs || wt;
  }

  if (!car.torqueCurve) {
    if (isEv) {
      // EV: near-flat peak torque early, HP rises to peakHpRpm then falls
      var peakTq = (car.peakHp * 5252) / Math.max(1000, car.peakHpRpm);
      // EVs often advertise "peak TQ" ~1.2–1.6× TQ-at-peak-HP
      peakTq *= 1.45;
      var curve = {};
      for (var r = 0; r <= car.redline; r += 50) {
        var tq;
        if (r <= car.peakTqRpm) tq = peakTq;
        else if (r <= car.peakHpRpm) {
          var u = (r - car.peakTqRpm) / Math.max(1, car.peakHpRpm - car.peakTqRpm);
          var tqHp = (car.peakHp * 5252) / car.peakHpRpm;
          tq = peakTq + (tqHp - peakTq) * u;
        } else {
          var w = (r - car.peakHpRpm) / Math.max(1, car.redline - car.peakHpRpm);
          var tqHp2 = (car.peakHp * 5252) / car.peakHpRpm;
          tq = tqHp2 * (1 - 0.55 * w);
        }
        curve[r] = Math.max(20, tq);
      }
      curve[car.peakHpRpm] = (car.peakHp * 5252) / car.peakHpRpm;
      car.torqueCurve = curve;
    } else {
      car.torqueCurve = Phys.synthesizeTorqueCurve(car.peakHp, car.peakTqRpm, car.redline, car.peakHpRpm);
    }
  }

  return car;
}

function main() {
  console.log('Loading import + VB garage…');
  var imp = JSON.parse(fs.readFileSync(IMPORT_PATH, 'utf8'));
  var vb = loadVbGarage();
  console.log('Import:', imp.length, 'VB:', vb.list.length);

  var cars = [];
  var missingVb = [];
  imp.forEach(function (row) {
    var match = vb.byName[row.Name];
    if (!match) missingVb.push(row.Name);
    cars.push(buildCar(row, match || null));
  });
  console.log('Built shells:', cars.length, '| missing VB match:', missingVb.length);
  if (missingVb.length) console.log('  ', missingVb.join(' | '));

  console.log('Calibrating fleet (trap-first)…');
  var t0 = Date.now();
  var stats = { et: 0, trap: 0, z60: 0, z60130: 0, nEt: 0, nTrap: 0, nZ60: 0, n60130: 0, all4: 0 };
  var rows = [];

  cars.forEach(function (car, i) {
    var tgt = car.targets || {};
    var cal = calibrateCar(car, tgt);
    var sim = cal.best.sim || {};
    var hits = cal.hits;
    if (tgt.et != null) { stats.nEt++; if (hits.et) stats.et++; }
    if (tgt.trap != null) { stats.nTrap++; if (hits.trap) stats.trap++; }
    if (tgt.z60 != null) { stats.nZ60++; if (hits.z60) stats.z60++; }
    if (tgt.z60130 != null) { stats.n60130++; if (hits.z60130) stats.z60130++; }
    if (hits.et && hits.trap && hits.z60 && hits.z60130) stats.all4++;

    rows.push({
      name: car.name,
      tireType: car.tireType,
      loss: car.drivetrainLossPercent,
      forceScale: car.forceScale,
      tgt: tgt,
      sim: {
        et: sim.et != null ? +sim.et.toFixed(3) : null,
        trap: sim.trap != null ? +sim.trap.toFixed(1) : null,
        z60: sim.z60 != null ? +sim.z60.toFixed(3) : null,
        z60130: sim.z60130 != null ? +sim.z60130.toFixed(3) : null
      },
      hits: hits,
      cost: +cal.best.cost.toFixed(3)
    });

    if ((i + 1) % 25 === 0 || i === cars.length - 1) {
      var pct = (((i + 1) / cars.length) * 100).toFixed(0);
      console.log('  ' + (i + 1) + '/' + cars.length + ' (' + pct + '%)  elapsed ' +
        ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  });

  // Strip targets from baked runtime objects (keep calib meta separately)
  var baked = cars.map(function (c) {
    var o = {};
    Object.keys(c).forEach(function (k) {
      if (k === 'targets') return;
      o[k] = c[k];
    });
    return o;
  });

  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 4).',
    ' * ' + baked.length + ' cars from powercurve-garage-import.json + VB garage-data merge.',
    ' * Specs: Cd/area/loss/tire/drive/FI/EV/TX from VB where matched; gears/curves synthesized',
    ' * or curated; loss+forceScale calibrated toward Excel 0-60 / ¼ / 60-130 (trap-first).',
    ' * Static / no server. Estimates — not track certified.',
    ' * Generated by scripts/build-garage.js — do not hand-edit (re-run builder).',
    ' */',
    '(function (global) {',
    "  'use strict';",
    '  var GARAGE_DATA = '
  ].join('\n');

  var body = JSON.stringify(baked, null, 2);
  var footer = [
    ';',
    '  global.VB_POWERCURVE_GARAGE = GARAGE_DATA;',
    "  if (typeof module !== 'undefined' && module.exports) module.exports = GARAGE_DATA;",
    '})(typeof window !== \'undefined\' ? window : globalThis);',
    ''
  ].join('\n');

  fs.writeFileSync(OUT_JS, header + body + footer);
  var summary = {
    generatedAt: new Date().toISOString(),
    fleetCount: baked.length,
    missingVbMatch: missingVb,
    tolerances: TOL,
    hitRates: {
      et: stats.et + '/' + stats.nEt,
      trap: stats.trap + '/' + stats.nTrap,
      z60: stats.z60 + '/' + stats.nZ60,
      z60130: stats.z60130 + '/' + stats.n60130,
      all4: stats.all4 + '/' + baked.length,
      etPct: +(100 * stats.et / Math.max(1, stats.nEt)).toFixed(1),
      trapPct: +(100 * stats.trap / Math.max(1, stats.nTrap)).toFixed(1),
      z60Pct: +(100 * stats.z60 / Math.max(1, stats.nZ60)).toFixed(1),
      z60130Pct: +(100 * stats.z60130 / Math.max(1, stats.n60130)).toFixed(1),
      all4Pct: +(100 * stats.all4 / baked.length).toFixed(1)
    },
    elapsedSec: +((Date.now() - t0) / 1000).toFixed(1),
    sample: rows.filter(function (r) {
      return /Mustang GT$|Supra Twin|Cobra 427|Miata Club|Hellcat Redeye|Shelby GT500|Boss 302$|Skyline GT-R R34$/.test(r.name);
    }),
    worst: rows.slice().sort(function (a, b) { return b.cost - a.cost; }).slice(0, 15)
  };
  fs.writeFileSync(OUT_META, JSON.stringify(summary, null, 2));
  console.log('\nWrote', OUT_JS);
  console.log('Wrote', OUT_META);
  console.log('Hit-rates:', JSON.stringify(summary.hitRates, null, 2));
}

main();
