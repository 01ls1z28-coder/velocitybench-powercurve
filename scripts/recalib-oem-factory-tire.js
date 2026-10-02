/**
 * OEM factory-tire audit + Excel bake (Unprepped SOI).
 * Credit: Jorge Guerra ONLY. HOLD Merovingian.
 * Parent tip: c991fc9 review/no-factory-dr
 *
 * Bar:
 *  - Only Jorge Z28 ships Slick.
 *  - Every other car = documented OEM Street/Summer/UHP/R-Comp (never DR).
 *  - Prefer documented OEM over class seed; flag unknowns in report.
 *  - Excel bake trap→ET→60-130→0-60; forceScale=1; no grip cheats (no DR step-up).
 *  - Prefer honest miss over fake grip. Knobs: tireType (OEM lock) + launchRpm only.
 *
 *   node scripts/recalib-oem-factory-tire.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var TARGETS = require('./excel-corrected-targets.json');

var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'oem-factory-tire-report.json');
var OUT_AUDIT_MD = '/workspace/powercurve-oem-factory-tire-AUDIT.md';
var OUT_VERIFY_JSON = path.join(__dirname, 'fleet-verify-oem-factory-tire-excel-bake.json');

var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };
var Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
var LABELS = { 0: 'Street', 1: 'Drag Radial', 2: 'Slick', 3: 'Summer', 4: 'UHP', 5: 'R-Compound' };

var byName = {};
TARGETS.forEach(function (t) { byName[t.name] = t; });

function log() {
  process.stdout.write(Array.prototype.slice.call(arguments).join(' ') + '\n');
}

/**
 * Documented OEM fitments (id → { tire, oem, source, conf }).
 * conf: documented | strong | pattern
 * Never assign DR (1). Slick only via Z28 lock.
 */
var DOCUMENTED = {
  // ——— R-Compound (Cup 2 / Trofeo R / Corsa as standard OEM) ———
  '2016-ford-mustang-gt350r': {
    tire: 5, oem: 'Michelin Pilot Sport Cup 2 305/30–315/30R19',
    source: 'Ford GT350R equipment; Cup 2 R-model-only', conf: 'documented'
  },
  '2014-chevrolet-camaro-z-28': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R 305/30ZR19',
    source: 'GM media Z/28; first OEM Trofeo R', conf: 'documented'
  },
  '2017-porsche-911-gt2-rs': {
    tire: 5, oem: 'Michelin Pilot Sport Cup 2 / Cup 2 R N-spec',
    source: 'Porsche NHTSA tire bulletin 991.2 GT2 RS', conf: 'documented'
  },
  '2024-porsche-911-gt3-rs': {
    tire: 5, oem: 'Michelin Pilot Sport Cup 2 R',
    source: 'Porsche GT3 RS motorsport summer OEM', conf: 'documented'
  },
  '2020-mclaren-765lt': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R (MC)',
    source: 'Pirelli/McLaren 765LT press', conf: 'documented'
  },
  '2018-mclaren-600lt': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R',
    source: 'McLaren OEM Trofeo R fitment', conf: 'documented'
  },
  '2019-lamborghini-hurac-n-performante': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R',
    source: 'Pirelli/Lambo Performante Nürburgring OEM', conf: 'documented'
  },
  '2012-ford-mustang-boss-302-laguna-seca': {
    tire: 5, oem: 'Pirelli P Zero Corsa System',
    source: 'Boss 302 Laguna Seca track OEM', conf: 'documented'
  },
  '2015-mclaren-p1': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R',
    source: 'McLaren P1 standard Trofeo R', conf: 'documented'
  },
  '2019-lamborghini-aventador-svj': {
    tire: 5, oem: 'Pirelli P Zero Trofeo R',
    source: 'SVJ track-focused Trofeo R OEM', conf: 'documented'
  },
  '2004-porsche-carrera-gt': {
    tire: 5, oem: 'Michelin Pilot Sport Cup',
    source: 'Carrera GT Cup-compound OEM', conf: 'strong'
  },

  // ——— UHP summer (PS4S / Eagle F1 Supercar / P Zero summer) ———
  '2023-chevrolet-camaro-zl1': {
    tire: 4, oem: 'Goodyear Eagle F1 Supercar 3 285/30–305/30R20',
    source: 'Goodyear Camaro ZL1 OE catalog', conf: 'documented'
  },
  '2012-chevrolet-camaro-zl1': {
    tire: 4, oem: 'Goodyear Eagle F1 Supercar G:2',
    source: 'ZL1 gen1 Supercar OE', conf: 'documented'
  },
  '2020-ford-mustang-shelby-gt500': {
    tire: 4, oem: 'Michelin Pilot Sport 4S (Cup 2 Handling Pack optional)',
    source: 'GT500 base PS4S; prefer base OEM not optional Cup', conf: 'documented'
  },
  '2024-ford-mustang-dark-horse': {
    tire: 4, oem: 'Pirelli P Zero PZ4 (Trofeo RS Handling Pack optional)',
    source: 'Pirelli Dark Horse press — base PZ4', conf: 'documented'
  },
  '2018-ford-mustang-gt-pp2': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'PP2 summer UHP OE', conf: 'documented'
  },
  '2020-chevrolet-camaro-ss': {
    tire: 4, oem: 'Goodyear Eagle F1 Asymmetric 3 / summer UHP',
    source: 'Camaro SS performance summer OE', conf: 'strong'
  },
  '2012-chevrolet-corvette-zr1': {
    tire: 4, oem: 'Michelin Pilot Sport 2 ZP (Cup ZP PDE optional)',
    source: 'ZR1 standard PS2; Cup optional — base OEM', conf: 'documented'
  },
  '2023-bmw-x5m-competition': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'X5 M Competition PS4S OE', conf: 'documented'
  },
  '2017-bmw-x6m': {
    tire: 4, oem: 'Michelin Pilot Sport 4S / ContiSportContact',
    source: 'X6 M UHP summer OE', conf: 'strong'
  },
  '2022-tesla-model-s-plaid': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'Model S Plaid PS4S OE', conf: 'documented'
  },
  '2024-tesla-model-3-performance': {
    tire: 4, oem: 'Pirelli P Zero / Hankook iON summer UHP',
    source: 'M3P performance summer OE', conf: 'strong'
  },
  '2022-tesla-model-x-plaid': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'Model X Plaid PS4S OE', conf: 'documented'
  },
  '2023-tesla-model-y-performance': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'MYP PS4S OE', conf: 'documented'
  },
  '2022-porsche-taycan-turbo-s': {
    tire: 4, oem: 'Pirelli P Zero / Michelin PS4S N-spec',
    source: 'Taycan Turbo S UHP summer OE', conf: 'documented'
  },
  '2024-lucid-air-sapphire': {
    tire: 4, oem: 'Pirelli P Zero HL',
    source: 'Sapphire UHP OE', conf: 'strong'
  },
  '2023-hyundai-ioniq-5-n': {
    tire: 4, oem: 'Pirelli P Zero',
    source: 'Ioniq 5 N P Zero OE', conf: 'documented'
  },
  '2023-kia-ev6-gt': {
    tire: 4, oem: 'Michelin Pilot Sport 4S / P Zero',
    source: 'EV6 GT UHP OE', conf: 'strong'
  },
  '2023-ford-mustang-mach-e-gt': {
    tire: 4, oem: 'Pirelli P Zero Elect',
    source: 'Mach-E GT summer UHP OE', conf: 'strong'
  },
  '2023-audi-e-tron-gt': {
    tire: 4, oem: 'Michelin Pilot Sport 4 / Conti',
    source: 'e-tron GT UHP OE', conf: 'strong'
  },
  '2021-bmw-m5-competition': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'M5 Competition PS4S OE', conf: 'documented'
  },
  '2018-bmw-m3-competition': {
    tire: 4, oem: 'Michelin Pilot Super Sport / PS4S',
    source: 'M3 Competition UHP OE', conf: 'strong'
  },
  '2020-audi-rs7': {
    tire: 4, oem: 'Pirelli P Zero / ContiSportContact',
    source: 'RS7 UHP OE', conf: 'strong'
  },
  '2019-audi-rs5-sportback': {
    tire: 4, oem: 'Pirelli P Zero',
    source: 'RS5 UHP OE', conf: 'strong'
  },
  '2017-mercedes-amg-c63-s': {
    tire: 4, oem: 'Michelin Pilot Sport 4S',
    source: 'C63 S UHP OE', conf: 'strong'
  },
  '2023-toyota-gr-corolla': {
    tire: 4, oem: 'Michelin Pilot Sport 4',
    source: 'GR Corolla PS4 OE', conf: 'documented'
  },
  '2018-honda-civic-type-r': {
    tire: 4, oem: 'Continental SportContact 6',
    source: 'FK8 Type R Conti SC6 OE', conf: 'documented'
  },
  '2009-nissan-gt-r': {
    tire: 4, oem: 'Bridgestone Potenza RE070R / Dunlop SP Sport 600',
    source: 'R35 GT-R UHP OE', conf: 'documented'
  },

  // ——— Summer (performance summer, not Cup/Trofeo) ———
  '2020-ford-mustang-gt': {
    tire: 3, oem: 'Pirelli P Zero / Goodyear Eagle F1 summer',
    source: 'S550 GT summer OE (not Cup)', conf: 'documented'
  },
  '2011-ford-mustang-gt-5-0': {
    tire: 3, oem: 'Pirelli P Zero Nero / summer',
    source: 'S197 GT summer OE', conf: 'strong'
  },
  '2007-ford-mustang-gt': {
    tire: 3, oem: 'Goodyear Eagle F1 / P Zero',
    source: 'S197 GT summer OE', conf: 'strong'
  },
  '2013-ford-mustang-boss-302': {
    tire: 3, oem: 'Pirelli P Zero (non-Laguna)',
    source: 'Boss 302 base summer (Laguna = Corsa)', conf: 'documented'
  },
  '2020-subaru-wrx-sti': {
    tire: 3, oem: 'Dunlop SP Sport Maxx / summer',
    source: 'WRX STI summer OE', conf: 'strong'
  },
  '2006-subaru-wrx-sti': {
    tire: 3, oem: 'Dunlop SP Sport 600 / Bridgestone Potenza',
    source: 'GD STI summer OE', conf: 'strong'
  },
  '1998-toyota-supra-turbo-mk4': {
    tire: 3, oem: 'Bridgestone Potenza / Yokohama summer',
    source: 'Mk4 Supra summer OE', conf: 'strong'
  },
  '2002-nissan-skyline-gt-r-r34': {
    tire: 3, oem: 'Bridgestone Potenza RE010',
    source: 'R34 GT-R summer OE', conf: 'strong'
  },

  // ——— Street / all-season / AT / highway ———
  // Hellcat family: long OEM history of P Zero Nero All Season
  '2020-dodge-challenger-hellcat': {
    tire: 0, oem: 'Pirelli P Zero Nero All Season (typical OE)',
    source: 'Hellcat standard all-season OE (summer optional)', conf: 'documented'
  },
  '2015-dodge-challenger-hellcat': {
    tire: 0, oem: 'Pirelli P Zero Nero All Season',
    source: 'Hellcat all-season OE', conf: 'documented'
  },
  '2021-dodge-charger-hellcat-redeye': {
    tire: 0, oem: 'Pirelli P Zero Nero All Season',
    source: 'Redeye all-season OE common', conf: 'strong'
  },
  '2020-dodge-challenger-r-t-scat-pack': {
    tire: 0, oem: 'Goodyear Eagle F1 / P Zero Nero All Season mix',
    source: 'Scat Pack often all-season OE', conf: 'strong'
  },
  '2023-dodge-charger-scat-pack': {
    tire: 0, oem: 'All-season OE typical',
    source: 'Scat Pack all-season OE', conf: 'strong'
  },
  '2010-dodge-challenger-srt8': {
    tire: 0, oem: 'Goodyear Eagle F1 All Season / summer mix',
    source: 'SRT8 often all-season OE', conf: 'strong'
  },
  '2008-dodge-challenger-srt8': {
    tire: 0, oem: 'Goodyear Eagle RS-A / all-season',
    source: 'Early SRT8 all-season OE', conf: 'strong'
  },
  '2007-dodge-charger-srt8': {
    tire: 0, oem: 'Goodyear RSA / all-season',
    source: 'Charger SRT8 all-season OE', conf: 'strong'
  },
  '2006-dodge-charger-r-t': {
    tire: 0, oem: 'All-season OE',
    source: 'LX Charger R/T all-season', conf: 'strong'
  },
  '2009-dodge-challenger-r-t': {
    tire: 0, oem: 'All-season OE',
    source: 'Challenger R/T all-season', conf: 'strong'
  },

  // Trucks / AT
  '2020-ford-f-150-raptor': {
    tire: 0, oem: 'BFGoodrich All-Terrain T/A KO2 LT315/70R17',
    source: '2020 Raptor tech specs', conf: 'documented'
  },
  '2021-ram-trx': {
    tire: 0, oem: 'Goodyear Wrangler Territory All-Terrain',
    source: 'TRX AT OE', conf: 'documented'
  },
  '2023-ford-bronco-raptor': {
    tire: 0, oem: 'BFGoodrich All-Terrain KO2 / Baja-Ready AT',
    source: 'Bronco Raptor AT OE', conf: 'documented'
  },
  '2022-ford-f-150-lightning': {
    tire: 0, oem: 'Goodyear Wrangler Territory / all-season truck',
    source: 'Lightning truck all-season OE', conf: 'documented'
  },
  '2024-tesla-cybertruck-tri-motor': {
    tire: 0, oem: 'Goodyear Wrangler All-Terrain Adventure',
    source: 'Cybertruck AT OE', conf: 'documented'
  },
  '2021-toyota-tundra': {
    tire: 0, oem: 'Michelin Primacy / highway all-season',
    source: 'Tundra highway OE', conf: 'strong'
  },
  '2010-toyota-tundra-5-7': {
    tire: 0, oem: 'Highway all-season',
    source: 'Tundra OE', conf: 'strong'
  },
  '2007-toyota-tundra-4-7': {
    tire: 0, oem: 'Highway all-season',
    source: 'Tundra OE', conf: 'strong'
  },
  '2023-chevrolet-silverado-zr2': {
    tire: 0, oem: 'Goodyear Wrangler Territory MT / AT',
    source: 'ZR2 AT/MT OE', conf: 'documented'
  },

  // Utility EVs → all-season
  '2023-hyundai-kona-electric': {
    tire: 0, oem: 'Hankook / Nexen all-season',
    source: 'Kona EV all-season OE', conf: 'documented'
  },
  '2024-kia-niro-ev': {
    tire: 0, oem: 'Nexen / Hankook all-season',
    source: 'Niro EV all-season OE', conf: 'documented'
  },
  '2023-nissan-ariya-e-4orce': {
    tire: 0, oem: 'All-season OE',
    source: 'Ariya all-season OE', conf: 'strong'
  },
  '2024-subaru-solterra': {
    tire: 0, oem: 'Yokohama Geolandar / all-season',
    source: 'Solterra AWD all-season OE', conf: 'strong'
  },
  '2023-toyota-bz4x-awd': {
    tire: 0, oem: 'All-season OE',
    source: 'bZ4X all-season OE', conf: 'strong'
  },
  '2023-vw-id-4-awd-pro': {
    tire: 0, oem: 'All-season OE',
    source: 'ID.4 all-season OE', conf: 'strong'
  },
  '2022-mercedes-eqb-350': {
    tire: 0, oem: 'All-season OE',
    source: 'EQB all-season OE', conf: 'strong'
  },
  '2024-volvo-ex90-twin-motor': {
    tire: 0, oem: 'All-season OE',
    source: 'EX90 all-season OE', conf: 'strong'
  },
  '2024-volvo-xc40-recharge': {
    tire: 0, oem: 'All-season OE',
    source: 'XC40 Recharge all-season OE', conf: 'strong'
  },
  '2023-audi-q4-e-tron': {
    tire: 0, oem: 'All-season OE',
    source: 'Q4 e-tron all-season OE', conf: 'strong'
  },
  '2024-cadillac-lyriq-awd': {
    tire: 0, oem: 'All-season OE',
    source: 'Lyriq all-season OE', conf: 'strong'
  },

  // SUVs utility
  '2012-chevrolet-tahoe-5-3': {
    tire: 0, oem: 'Highway all-season', source: 'Tahoe OE', conf: 'documented'
  },
  '2010-chevrolet-suburban-5-3': {
    tire: 0, oem: 'Highway all-season', source: 'Suburban OE', conf: 'documented'
  },
  '2013-ford-expedition-5-4': {
    tire: 0, oem: 'Highway all-season', source: 'Expedition OE', conf: 'documented'
  },
  '2014-jeep-wrangler-rubicon': {
    tire: 0, oem: 'BFGoodrich All-Terrain / Mud-Terrain',
    source: 'Rubicon AT/MT OE', conf: 'documented'
  },
  '2009-toyota-4runner-v8': {
    tire: 0, oem: 'Highway / AT OE', source: '4Runner OE', conf: 'strong'
  },
  '2008-toyota-highlander-v6': {
    tire: 0, oem: 'All-season OE', source: 'Highlander OE', conf: 'documented'
  },
  '2009-honda-pilot': {
    tire: 0, oem: 'All-season OE', source: 'Pilot OE', conf: 'documented'
  }
};

/** Category / name seed when no documented row — NEVER returns DR or Slick. */
function factoryTireSeed(car) {
  var cat = String(car.category || '');
  var name = String(car.name || '');
  var hp = Number(car.peakHp) || 0;
  var id = String(car.id || '');

  // Name patterns for R-comp / UHP when not in DOCUMENTED
  if (/\b(gt3\s*rs|gt2\s*rs|gt350r|z\/28|trofeo|cup\s*2|600lt|765lt|performante|svj)\b/i.test(name) &&
      id !== Z28_ID && !/camaro z28 \(h\/c\/e\)/i.test(name)) {
    // Only if looks like track special — seed R-comp; audit will flag pattern
    if (/\b(gt3\s*rs|gt2\s*rs|gt350r|z\/28|600lt|765lt|performante|svj|laguna\s*seca)\b/i.test(name)) {
      return { tire: 5, conf: 'pattern', note: 'name-pattern R-comp track special' };
    }
  }

  if (cat === 'Motorcycle') return { tire: 4, conf: 'seed', note: 'sportbike UHP seed' };
  if (cat === 'Supercars' || cat === 'Hypercars') return { tire: 4, conf: 'seed', note: 'supercar/hyper UHP seed' };
  if (cat === 'Hybrid') return { tire: 4, conf: 'seed', note: 'hybrid performance UHP seed' };
  if (cat === 'EV') {
    // Performance EV names → UHP; utility already documented Street
    if (/\b(plaid|performance|sapphire|amg|m60|ss\b|gt\b|n\b)/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'performance EV UHP seed' };
    }
    return { tire: 0, conf: 'seed', note: 'utility EV Street seed' };
  }
  if (cat === 'Sports Cars') return { tire: 3, conf: 'seed', note: 'sports Summer seed' };
  if (cat === 'Modern Muscle') return { tire: 3, conf: 'seed', note: 'modern muscle Summer seed' };
  if (cat === 'Classic Muscle') return { tire: 0, conf: 'seed', note: 'classic Street seed' };
  if (cat === 'Trucks' || cat === 'SUV') return { tire: 0, conf: 'seed', note: 'truck/SUV Street seed' };
  if (cat === 'Garage') {
    if (/\b(gt-?r|911|ferrari|lamborghini|mclaren|corvette|amg|m3|m5|rs[0-9]|type.?r|sti|evo|supra|skyline)\b/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'garage performance UHP seed' };
    }
    return { tire: hp >= 400 ? 3 : 0, conf: 'seed', note: hp >= 400 ? 'garage hp≥400 Summer seed' : 'garage Street seed' };
  }
  return { tire: 0, conf: 'seed', note: 'default Street seed' };
}

function resolveOem(car) {
  if (car.id === Z28_ID) {
    return {
      tire: 2, oem: 'Hoosier / Mickey Thompson slick (ATC build)',
      source: 'Jorge Z28 ATC — only legal slick', conf: 'documented', locked: true
    };
  }
  var doc = DOCUMENTED[car.id];
  if (doc) {
    return {
      tire: doc.tire, oem: doc.oem, source: doc.source, conf: doc.conf, locked: false
    };
  }
  var seed = factoryTireSeed(car);
  return {
    tire: seed.tire, oem: '(no documented row — ' + seed.note + ')',
    source: seed.note, conf: seed.conf, locked: false
  };
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function runSim(car) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: car.tireType | 0, trackPrep: 'unprepped',
    needSixtyToOneThirty: true, quickMetrics: true
  });
  return {
    et: r.quarterMileTime, trap: r.quarterMileSpeedMph,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty,
    sixty: r.sixtyFootTime
  };
}

function hitFlags(sim, tgt) {
  return {
    et: tgt.et == null || (sim.et != null && Math.abs(sim.et - tgt.et) <= TOL.et),
    trap: tgt.trap == null || (sim.trap != null && Math.abs(sim.trap - tgt.trap) <= TOL.trap),
    z60: tgt.z60 == null || (sim.z60 != null && Math.abs(sim.z60 - tgt.z60) <= TOL.z60),
    z60130: tgt.z60130 == null || (sim.z60130 != null && Math.abs(sim.z60130 - tgt.z60130) <= TOL.z60130)
  };
}

function priorityOk(h, tgt) {
  if (tgt.trap != null && !h.trap) return false;
  if (tgt.et != null && !h.et) return false;
  if (tgt.z60130 != null && !h.z60130) return false;
  if (tgt.z60 != null && !h.z60) return false;
  return true;
}

function cost(sim, tgt) {
  var c = 0, hits = 0, app = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    app++;
    if (sim[k] == null) { c += 100; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    c += (err / tol) * w + err * w * 0.1;
    if (err <= tol) hits++;
  }
  add('trap', 6, TOL.trap);
  add('et', 4, TOL.et);
  add('z60130', 2.5, TOL.z60130);
  add('z60', 2, TOL.z60);
  c -= hits * 5;
  c += (app - hits) * 3;
  return c;
}

function launchCandidates(car) {
  var base = Number(car.launchRpm) || 2500;
  var red = Number(car.redline) || 6500;
  var isEv = !!(car.isEv || car.powerSource === 'ev');
  var deltas = isEv ? [0, -400, 400] : [0, -400, 400, -200, 600, -600, 800];
  var out = [], seen = {};
  deltas.forEach(function (d) {
    var v = Math.round((base + d) / 50) * 50;
    if (isEv) v = Math.max(200, Math.min(red, v));
    else v = Math.max(1200, Math.min(red - 200, v));
    if (!seen[v]) { seen[v] = 1; out.push(v); }
  });
  return out;
}

function fleetMiss(garage) {
  var miss = { trap: 0, et: 0, z60: 0, z60130: 0, pri: 0, n: 0, nTrap: 0, nEt: 0, n60: 0, n60130: 0 };
  var mae = { trap: 0, et: 0, z60: 0, z60130: 0, nTrap: 0, nEt: 0, n60: 0, n60130: 0 };
  garage.forEach(function (car) {
    var tgt = byName[car.name];
    if (!tgt) return;
    if (tgt.et == null && tgt.trap == null && tgt.z60 == null) return;
    miss.n++;
    var sim = runSim(car);
    function chk(k, tol, nk) {
      if (tgt[k] == null) return true;
      miss[nk]++;
      mae[nk]++;
      if (sim[k] != null) mae[k] += Math.abs(sim[k] - tgt[k]);
      var ok = sim[k] != null && Math.abs(sim[k] - tgt[k]) <= tol;
      if (!ok) miss[k]++;
      return ok;
    }
    var h = {
      trap: chk('trap', TOL.trap, 'nTrap'),
      et: chk('et', TOL.et, 'nEt'),
      z60: chk('z60', TOL.z60, 'n60'),
      z60130: chk('z60130', TOL.z60130, 'n60130')
    };
    if (!priorityOk(h, tgt)) miss.pri++;
  });
  return {
    miss: miss,
    mae: {
      trap: mae.nTrap ? +(mae.trap / mae.nTrap).toFixed(3) : null,
      et: mae.nEt ? +(mae.et / mae.nEt).toFixed(3) : null,
      z60: mae.n60 ? +(mae.z60 / mae.n60).toFixed(3) : null,
      z60130: mae.n60130 ? +(mae.z60130 / mae.n60130).toFixed(3) : null
    }
  };
}

// ——— Pass 0: baseline miss (before OEM reseat) ———
var t0 = Date.now();
log('baseline Excel miss…');
var beforeMiss = fleetMiss(GARAGE);
log('before', JSON.stringify(beforeMiss.miss));

// ——— Pass 1: OEM reseat ———
var auditRows = [];
var changes = [];
var unknowns = [];
var histBefore = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
var histAfter = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

GARAGE.forEach(function (car) {
  histBefore[car.tireType | 0]++;
  car.forceScale = 1;
  var prev = car.tireType | 0;
  var oem = resolveOem(car);
  // Never invent DR
  if (oem.tire === 1) oem.tire = 0;
  // Never slick except Z28
  if (oem.tire === 2 && car.id !== Z28_ID) oem.tire = 4;

  car.tireType = oem.tire;
  histAfter[oem.tire]++;

  var row = {
    id: car.id, name: car.name, category: car.category,
    from: prev, to: oem.tire,
    fromLabel: LABELS[prev], toLabel: LABELS[oem.tire],
    oem: oem.oem, source: oem.source, conf: oem.conf,
    changed: prev !== oem.tire
  };
  auditRows.push(row);
  if (row.changed) changes.push(row);
  if (oem.conf === 'seed' || oem.conf === 'pattern') {
    unknowns.push(row);
  }
});

log('OEM reseat changes', changes.length, 'unknown/seed', unknowns.filter(function (u) { return u.conf === 'seed'; }).length);

// ——— Pass 2: Excel bake — tire LOCKED to OEM; launchRpm only ———
var applied = [];
var unchanged = [];
var parked = [];
var matched = 0;

GARAGE.forEach(function (car) {
  car.forceScale = 1;
  var tgt = byName[car.name];
  if (!tgt) return;
  if (tgt.et == null && tgt.trap == null && tgt.z60 == null) return;
  matched++;

  if (car.id === Z28_ID) {
    parked.push({ id: car.id, name: car.name, reason: 'z28-slick-locked' });
    return;
  }

  var lockedTire = car.tireType | 0;
  var beforeLaunch = car.launchRpm;
  var curSim = runSim(car);
  var curH = hitFlags(curSim, tgt);
  if (priorityOk(curH, tgt)) {
    unchanged.push({
      id: car.id, name: car.name, tire: lockedTire, launch: beforeLaunch,
      sim: curSim, hits: curH, fast: true
    });
    return;
  }

  var best = null;
  launchCandidates(car).forEach(function (launch) {
    var trial = clone(car);
    trial.tireType = lockedTire;
    trial.launchRpm = launch;
    trial.forceScale = 1;
    var sim = runSim(trial);
    var c = cost(sim, tgt);
    var h = hitFlags(sim, tgt);
    var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
    var cand = { launch: launch, cost: c, sim: sim, hits: h, nh: nh };
    if (!best || c < best.cost - 1e-9) best = cand;
  });

  if (!best) {
    parked.push({ id: car.id, name: car.name, reason: 'no-cand' });
    return;
  }

  // Prefer honest miss: keep OEM tire even if still missing
  car.tireType = lockedTire;
  car.launchRpm = best.launch;
  car.forceScale = 1;
  var row = {
    id: car.id, name: car.name,
    before: { tire: lockedTire, launch: beforeLaunch },
    after: { tire: lockedTire, launch: best.launch },
    sim: best.sim, hits: best.hits, nh: best.nh, cost: +best.cost.toFixed(3),
    priorityHit: priorityOk(best.hits, tgt)
  };
  if (best.launch !== beforeLaunch) applied.push(row);
  else unchanged.push(row);

  if (matched % 50 === 0) {
    log('bake progress', matched, 'applied', applied.length, 'sec', ((Date.now() - t0) / 1000).toFixed(1));
  }
});

// Safety sweep
var slickResidual = [];
var drResidual = [];
GARAGE.forEach(function (c) {
  c.forceScale = 1;
  if ((c.tireType | 0) === 2 && c.id !== Z28_ID) {
    slickResidual.push(c.name);
    c.tireType = resolveOem(c).tire;
    if (c.tireType === 2) c.tireType = 4;
  }
  if ((c.tireType | 0) === 1) {
    drResidual.push(c.name);
    c.tireType = 0;
  }
});

// Recount hist after bake
histAfter = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
GARAGE.forEach(function (c) { histAfter[c.tireType | 0]++; });

log('after-bake Excel miss…');
var afterMiss = fleetMiss(GARAGE);
log('after', JSON.stringify(afterMiss.miss));

// Write garage
var body = JSON.stringify(GARAGE, null, 2);
var js = [
  '/**',
  ' * VelocityBench PowerCurve — baked garage.',
  ' * OEM factory-tire audit: documented Street/Summer/UHP/R-Comp; never factory DR;',
  ' * slicks only Jorge Z28. Excel Unprepped bake: launchRpm only (tire locked to OEM).',
  ' * Prefer honest miss over fake grip. forceScale=1. Credit: Jorge Guerra.',
  ' * Tip: review/oem-factory-tire. HOLD Merovingian.',
  ' */',
  'var GARAGE = ' + body + ';',
  '',
  'if (typeof module !== "undefined" && module.exports) {',
  '  module.exports = GARAGE;',
  '}',
  'if (typeof window !== "undefined") {',
  '  window.VB_POWERCURVE_GARAGE = GARAGE;',
  '} else if (typeof globalThis !== "undefined") {',
  '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;',
  '}',
  ''
].join('\n');
fs.writeFileSync(OUT_JS, js);

var report = {
  tip: 'oem-factory-tire',
  credit: 'Jorge Guerra',
  parent: 'c991fc99250492677a8ae346f02948f3604a22b3',
  elapsedSec: +((Date.now() - t0) / 1000).toFixed(1),
  knobs: ['tireType(OEM-lock)', 'launchRpm'],
  neverTouch: ['dragCoefficient', 'frontalAreaSqFt', 'weightLbs', 'peakHp', 'gearRatios', 'finalDriveRatio', 'torqueCurve', 'forceScale'],
  bar: {
    onlyZ28Slick: histAfter[2] === 1,
    factoryDR: histAfter[1],
    forceScaleNonOne: GARAGE.filter(function (c) { return +c.forceScale !== 1; }).length
  },
  histBefore: histBefore,
  histAfter: histAfter,
  oemChanges: changes.length,
  changes: changes,
  unknownsSeed: unknowns.filter(function (u) { return u.conf === 'seed'; }),
  unknownsPattern: unknowns.filter(function (u) { return u.conf === 'pattern'; }),
  documentedCount: auditRows.filter(function (r) { return r.conf === 'documented' || r.conf === 'strong'; }).length,
  auditRows: auditRows,
  launchApplied: applied.length,
  launchUnchanged: unchanged.length,
  parked: parked,
  slickResidual: slickResidual,
  drResidual: drResidual,
  excelBefore: beforeMiss,
  excelAfter: afterMiss,
  sampleApplied: applied.slice(0, 40)
};
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));

// VERIFY JSON (fleet numbers)
var verifyJson = {
  tip: 'oem-factory-tire',
  credit: 'Jorge Guerra',
  parent: 'c991fc99250492677a8ae346f02948f3604a22b3',
  soi: 'Unprepped',
  tol: TOL,
  priority: ['trap', 'et', 'z60130', 'z60'],
  before: beforeMiss,
  after: afterMiss,
  tireHistBefore: histBefore,
  tireHistAfter: histAfter,
  oemChanges: changes.length,
  launchApplied: applied.length,
  forceScaleNonOne: report.bar.forceScaleNonOne,
  factoryDR: histAfter[1],
  slickCount: histAfter[2],
  rCompCount: histAfter[5]
};
fs.writeFileSync(OUT_VERIFY_JSON, JSON.stringify(verifyJson, null, 2));

log(JSON.stringify({
  oemChanges: changes.length,
  documented: report.documentedCount,
  seedUnknowns: report.unknownsSeed.length,
  launchApplied: applied.length,
  histBefore: histBefore,
  histAfter: histAfter,
  excelBefore: beforeMiss.miss,
  excelAfter: afterMiss.miss,
  elapsedSec: report.elapsedSec,
  slickResidual: slickResidual.length,
  drResidual: drResidual.length
}, null, 2));
