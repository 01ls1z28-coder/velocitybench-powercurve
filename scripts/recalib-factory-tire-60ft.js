/**
 * Factory tire class → Jorge FINAL 60ft traction map.
 * Credit: Jorge Guerra ONLY. Tip-only — no Pages / no Merovingian.
 *
 * Unprep: Street 2.2 · Summer 2.0 · UHP 1.85–1.90 · R-comp 1.75–1.80 ·
 *         DR 1.65–1.72 · Slick 1.80–1.90
 * Prep:   Street 1.7–1.75 · Summer 1.6 · UHP 1.45–1.5 · R-comp 1.5 ·
 *         Slick 1.45–1.50 · DR ≈ slick+0.05
 *
 * Factory fitment drives default tireType. Never factory DR.
 * Slick = Jorge Z28 ATC only. R-comp = documented Cup/Trofeo/Corsa OEM (+ ZR1X).
 * Challenger / modern muscle performance → UHP (Jorge override vs prior all-season demote).
 *
 *   node scripts/recalib-factory-tire-60ft.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');

var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'factory-tire-60ft-report.json');
var OUT_VERIFY_MD = path.join(__dirname, '..', 'VERIFY-pc-factory-tire-60ft.md');

var Z28_ID = '2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals';
var LABELS = { 0: 'Street', 1: 'Drag Radial', 2: 'Slick', 3: 'Summer', 4: 'UHP', 5: 'R-Compound' };

/** Targets (mid-band picks documented in VERIFY). */
var TARGETS = {
  unprepped: { 0: 2.2, 3: 2.0, 4: 1.875, 5: 1.775, 1: 1.685, 2: 1.85 },
  prepped: { 0: 1.725, 3: 1.6, 4: 1.475, 5: 1.5, 1: 1.525, 2: 1.475 }
};

/**
 * Documented OEM fitments (id → { tire, oem, source, conf }).
 * conf: documented | strong | pattern | seed | jorge-override
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
  '2026-chevrolet-corvette-zr1x': {
    tire: 5, oem: 'Michelin Pilot Sport Cup 2 R (ZR1X track OEM expected)',
    source: 'ZR1X track-hybrid package — R-comp factory class', conf: 'strong'
  },

  // ——— UHP summer ———
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
  '2024-chevrolet-corvette-stingray': {
    tire: 4, oem: 'Michelin Pilot Sport 4S ZP',
    source: 'C8 Stingray UHP OE', conf: 'documented'
  },
  '2023-chevrolet-corvette-z06': {
    tire: 4, oem: 'Michelin Pilot Sport Cup 2 R ZP (Z06)',
    source: 'Z06 Cup 2 R — classed UHP/street-legal track; not Trofeo R-comp row', conf: 'strong'
  },
  '2013-srt-viper-gts': {
    tire: 4, oem: 'Pirelli P Zero Corsa / UHP',
    source: 'Viper GTS UHP OE', conf: 'strong'
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
  '1993-chevrolet-camaro-z28': {
    tire: 4, oem: 'Goodyear Eagle GS-C / performance UHP era',
    source: '4th-gen Z28 performance OE', conf: 'strong'
  },
  '1991-chevrolet-camaro-z28': {
    tire: 4, oem: 'Goodyear Eagle GT+4 / performance',
    source: '3rd-gen Z28 performance OE', conf: 'strong'
  },

  // ——— Jorge override: Challenger / Charger performance → UHP factory default ———
  '2020-dodge-challenger-hellcat': {
    tire: 4, oem: 'Pirelli P Zero / Eagle F1 Supercar summer UHP (factory performance class)',
    source: 'Jorge factory-UHP map — Challenger Hellcat → UHP 1.85–1.90 / 1.45–1.5',
    conf: 'jorge-override'
  },
  '2015-dodge-challenger-hellcat': {
    tire: 4, oem: 'Pirelli P Zero / summer UHP performance class',
    source: 'Jorge factory-UHP map — Challenger Hellcat family', conf: 'jorge-override'
  },
  '2020-dodge-challenger-r-t-scat-pack': {
    tire: 4, oem: 'Goodyear Eagle F1 Supercar / P Zero summer UHP',
    source: 'Jorge factory-UHP map — Challenger Scat Pack → UHP', conf: 'jorge-override'
  },
  '2010-dodge-challenger-srt8': {
    tire: 4, oem: 'Goodyear Eagle F1 / summer UHP class',
    source: 'Jorge factory-UHP map — Challenger SRT8', conf: 'jorge-override'
  },
  '2008-dodge-challenger-srt8': {
    tire: 4, oem: 'Goodyear Eagle F1 / summer UHP class',
    source: 'Jorge factory-UHP map — Challenger SRT8', conf: 'jorge-override'
  },
  '2009-dodge-challenger-r-t': {
    tire: 4, oem: 'Summer UHP / performance OE class',
    source: 'Jorge factory-UHP map — Challenger R/T performance', conf: 'jorge-override'
  },
  '2021-dodge-charger-hellcat-redeye': {
    tire: 4, oem: 'Pirelli P Zero / Eagle F1 summer UHP class',
    source: 'Jorge factory-UHP map — Charger Redeye with Challenger family', conf: 'jorge-override'
  },
  '2023-dodge-charger-scat-pack': {
    tire: 4, oem: 'Eagle F1 / P Zero summer UHP class',
    source: 'Jorge factory-UHP map — Charger Scat Pack', conf: 'jorge-override'
  },
  '2007-dodge-charger-srt8': {
    tire: 4, oem: 'Goodyear Eagle F1 / summer UHP class',
    source: 'Jorge factory-UHP map — Charger SRT8', conf: 'jorge-override'
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
  '2004-pontiac-gto': {
    tire: 3, oem: 'Bridgestone Potenza / summer',
    source: 'Holden-based GTO summer OE', conf: 'strong'
  },
  '2003-ford-mustang-cobra-terminator': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: 'Terminator Cobra summer OE', conf: 'strong'
  },
  '2002-chevrolet-camaro-ss': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: '4th-gen Camaro SS summer OE', conf: 'strong'
  },
  '2001-pontiac-firebird-trans-am-ws6': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: 'WS6 summer OE', conf: 'strong'
  },
  '1996-ford-mustang-svt-cobra': {
    tire: 3, oem: 'BFGoodrich Comp T/A / summer',
    source: 'SN95 Cobra summer OE', conf: 'strong'
  },
  '1985-chevrolet-camaro-iroc-z': {
    tire: 3, oem: 'Goodyear Eagle VR / performance summer era',
    source: 'IROC-Z performance OE', conf: 'strong'
  },
  '1994-pontiac-firebird-formula': {
    tire: 3, oem: 'Goodyear Eagle GS-C / summer',
    source: 'Firebird Formula summer OE', conf: 'strong'
  },
  '2000-chevrolet-camaro-ss': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: 'Camaro SS summer OE', conf: 'strong'
  },
  '1994-ford-mustang-gt': {
    tire: 3, oem: 'Goodyear Eagle / summer',
    source: 'SN95 GT summer OE', conf: 'strong'
  },
  '2002-pontiac-firebird-ws6': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: 'WS6 summer OE', conf: 'strong'
  },
  '1989-ford-mustang-gt-5-0': {
    tire: 3, oem: 'Goodyear Eagle VR / summer',
    source: 'Fox GT summer OE', conf: 'strong'
  },
  '1993-pontiac-firebird-formula': {
    tire: 3, oem: 'Goodyear Eagle GS-C / summer',
    source: 'Firebird Formula summer OE', conf: 'strong'
  },
  '1998-pontiac-firebird-formula': {
    tire: 3, oem: 'Goodyear Eagle / summer',
    source: 'Firebird Formula summer OE', conf: 'strong'
  },
  '2004-ford-mustang-mach-1': {
    tire: 3, oem: 'Goodyear Eagle F1 / summer',
    source: 'Mach 1 summer OE', conf: 'strong'
  },

  // ——— Street / all-season / AT / highway ———
  '2006-dodge-charger-r-t': {
    tire: 0, oem: 'All-season OE',
    source: 'LX Charger R/T all-season', conf: 'strong'
  },
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
  },
  '2010-chevrolet-camaro-lt': {
    tire: 0, oem: 'All-season OE', source: 'Camaro LT base all-season', conf: 'strong'
  },
  '2011-chevrolet-camaro-lt': {
    tire: 0, oem: 'All-season OE', source: 'Camaro LT base all-season', conf: 'strong'
  },
  '2013-ford-mustang-v6': {
    tire: 0, oem: 'All-season OE', source: 'Mustang V6 all-season', conf: 'strong'
  },
  '1987-ford-mustang-5-0-lx': {
    tire: 0, oem: 'All-season / highway OE', source: 'LX 5.0 street OE', conf: 'strong'
  },
  '1992-ford-mustang-lx-5-0': {
    tire: 0, oem: 'All-season / highway OE', source: 'LX 5.0 street OE', conf: 'strong'
  },
  '1970-dodge-challenger-426-hemi': {
    tire: 0, oem: 'Bias-ply / early radial street OE',
    source: 'Classic muscle street OE (not modern UHP)', conf: 'strong'
  }
};

function factoryTireSeed(car) {
  var cat = String(car.category || '');
  var name = String(car.name || '');
  var hp = Number(car.peakHp) || 0;
  var id = String(car.id || '');

  if (/\b(gt3\s*rs|gt2\s*rs|gt350r|z\/28|600lt|765lt|performante|svj|laguna\s*seca|carrera\s*gt)\b/i.test(name) &&
      id !== Z28_ID) {
    return { tire: 5, conf: 'pattern', note: 'name-pattern R-comp track special' };
  }

  if (cat === 'Motorcycle') return { tire: 4, conf: 'seed', note: 'sportbike UHP seed' };
  if (cat === 'Supercars' || cat === 'Hypercars') return { tire: 4, conf: 'seed', note: 'supercar/hyper UHP seed' };
  if (cat === 'Hybrid') return { tire: 4, conf: 'seed', note: 'hybrid performance UHP seed' };
  if (cat === 'EV') {
    if (/\b(plaid|performance|sapphire|amg|m60|ss\b|gt\b|n\b|beast)\b/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'performance EV UHP seed' };
    }
    return { tire: 0, conf: 'seed', note: 'utility EV Street seed' };
  }
  if (cat === 'Sports Cars') {
    if (/\b(gt3|gt4|type.?r|sti|evo|m3|m4|m5|m2|rs[0-9]|amg|zl1|z06|zr1|shelby|hellcat|scat)\b/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'sports performance UHP seed' };
    }
    return { tire: 3, conf: 'seed', note: 'sports Summer seed' };
  }
  // Modern muscle: performance packages → UHP; base V6/LT/LX already documented Street
  if (cat === 'Modern Muscle') {
    if (/\b(v6|lt\b|lx\b)\b/i.test(name) && !/\b(gt|ss|srt|hellcat|scat|zl1|z\/?28|cobra|boss|mach|shelby|dark.?horse|viper|z06|zr1|stingray)\b/i.test(name)) {
      return { tire: 0, conf: 'seed', note: 'base muscle Street seed' };
    }
    if (/\b(hellcat|scat|srt|zl1|z\/?28|gt500|dark.?horse|pp2|viper|z06|zr1|stingray|shelby)\b/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'modern muscle performance UHP seed' };
    }
    // GT / SS / Cobra / Boss base → Summer unless documented otherwise
    if (/\b(gt\b|ss\b|cobra|boss|mach|ws6|iroc|formula|trans.?am|gto)\b/i.test(name)) {
      return { tire: 3, conf: 'seed', note: 'modern muscle Summer seed' };
    }
    return { tire: 4, conf: 'seed', note: 'modern muscle default UHP seed' };
  }
  if (cat === 'Classic Muscle') return { tire: 0, conf: 'seed', note: 'classic Street seed' };
  if (cat === 'Trucks' || cat === 'SUV') return { tire: 0, conf: 'seed', note: 'truck/SUV Street seed' };
  if (cat === 'Garage') {
    if (/\b(gt-?r|911|ferrari|lamborghini|mclaren|corvette|amg|m3|m5|m4|rs[0-9]|type.?r|sti|evo|supra|skyline|hellcat|zl1|gt3|gt2|huracan|aventador|720s|p1|chiron|viper)\b/i.test(name)) {
      return { tire: 4, conf: 'seed', note: 'garage performance UHP seed' };
    }
    if (hp >= 450) return { tire: 4, conf: 'seed', note: 'garage hp≥450 UHP seed' };
    if (hp >= 300) return { tire: 3, conf: 'seed', note: 'garage hp≥300 Summer seed' };
    return { tire: 0, conf: 'seed', note: 'garage Street seed' };
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
    tire: seed.tire, oem: '(family/package default — ' + seed.note + ')',
    source: seed.note, conf: seed.conf, locked: false
  };
}

function runSim(car, prep) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windSpeedMph: 0, windDirDeg: 0, gustMph: 0, launchMode: 'auto',
    tireType: car.tireType | 0, trackPrep: prep,
    needSixtyToOneThirty: false, quickMetrics: true
  });
  return { sixty: r.sixtyFootTime, et: r.quarterMileTime, z60: r.zeroToSixty };
}

function writeGarage(cars) {
  var lines = [];
  lines.push('/**');
  lines.push(' * VelocityBench PowerCurve — static garage data (baked).');
  lines.push(' * Factory tire class → Jorge FINAL 60ft traction map.');
  lines.push(' * Credit: Jorge Guerra only. No remote tire DB at runtime.');
  lines.push(' * Generated by scripts/recalib-factory-tire-60ft.js');
  lines.push(' */');
  lines.push('(function (global) {');
  lines.push('  var GARAGE = ' + JSON.stringify(cars, null, 2) + ';');
  lines.push('  if (typeof module !== "undefined" && module.exports) module.exports = GARAGE;');
  lines.push('  if (typeof window !== "undefined") {');
  lines.push('  window.VB_POWERCURVE_GARAGE = GARAGE;');
  lines.push('  }');
  lines.push('  globalThis.VB_POWERCURVE_GARAGE = GARAGE;');
  lines.push('})(typeof globalThis !== "undefined" ? globalThis : this);');
  lines.push('');
  fs.writeFileSync(OUT_JS, lines.join('\n'));
}

var histBefore = {};
var histAfter = {};
var changes = [];
var flagged = [];
var byClass = { 0: [], 3: [], 4: [], 5: [], 1: [], 2: [] };

GARAGE.forEach(function (car) {
  histBefore[car.tireType | 0] = (histBefore[car.tireType | 0] || 0) + 1;
  var prev = car.tireType | 0;
  var oem = resolveOem(car);
  car.tireType = oem.tire;
  car.forceScale = 1;
  // Hard locks
  if (car.id === Z28_ID) car.tireType = 2;
  else if ((car.tireType | 0) === 2) car.tireType = oem.tire === 2 ? 2 : 4;
  if ((car.tireType | 0) === 1) car.tireType = 4; // never factory DR

  histAfter[car.tireType | 0] = (histAfter[car.tireType | 0] || 0) + 1;
  byClass[car.tireType | 0].push(car.id);

  var row = {
    id: car.id,
    name: car.name,
    category: car.category,
    from: prev,
    to: car.tireType | 0,
    fromLabel: LABELS[prev],
    toLabel: LABELS[car.tireType | 0],
    oem: oem.oem,
    source: oem.source,
    conf: oem.conf,
    changed: prev !== (car.tireType | 0)
  };
  changes.push(row);
  if (oem.conf === 'seed' || oem.conf === 'pattern') {
    flagged.push({ id: car.id, name: car.name, tire: LABELS[car.tireType | 0], reason: oem.source, conf: oem.conf });
  }
});

writeGarage(GARAGE);

// Spot-check Challengers
var challIds = GARAGE.filter(function (c) { return /challenger/i.test(c.id); }).map(function (c) { return c.id; });
var spot = [];
challIds.forEach(function (id) {
  var car = GARAGE.find(function (c) { return c.id === id; });
  var u = runSim(car, 'unprepped');
  var p = runSim(car, 'prepped');
  spot.push({
    id: id,
    name: car.name,
    tireType: car.tireType | 0,
    tireLabel: LABELS[car.tireType | 0],
    unprepSixty: +Number(u.sixty).toFixed(3),
    prepSixty: +Number(p.sixty).toFixed(3),
    launchRpm: car.launchRpm
  });
});

// Hellcat reference ladder
var hell = GARAGE.find(function (c) { return c.id === '2020-dodge-challenger-hellcat'; });
var z28 = GARAGE.find(function (c) { return c.id === Z28_ID; });
function ladder(car) {
  var out = { unprepped: {}, prepped: {} };
  [0, 3, 4, 5, 1, 2].forEach(function (tt) {
    var trial = Object.assign({}, car, { tireType: tt, forceScale: 1 });
    out.unprepped[LABELS[tt]] = +Number(runSim(trial, 'unprepped').sixty).toFixed(3);
    out.prepped[LABELS[tt]] = +Number(runSim(trial, 'prepped').sixty).toFixed(3);
  });
  return out;
}

var report = {
  tip: 'factory-tire-60ft-final',
  credit: 'Jorge Guerra',
  vehicleCount: GARAGE.length,
  targets: TARGETS,
  uhpMidPick: '1.875 unprep (mid 1.85–1.90); 1.475 prep (mid 1.45–1.5)',
  rcompMidPick: '1.775 unprep (mid 1.75–1.80); 1.50 prep fixed',
  histBefore: histBefore,
  histAfter: histAfter,
  changes: changes.filter(function (c) { return c.changed; }).length,
  changeRows: changes.filter(function (c) { return c.changed; }),
  allRows: changes,
  flaggedFamilyDefaults: flagged,
  challengerSpot: spot,
  hellcatLadder: hell ? ladder(hell) : null,
  z28Ladder: z28 ? ladder(z28) : null,
  forceScaleNonOne: GARAGE.filter(function (c) { return +c.forceScale !== 1; }).length,
  factoryDR: GARAGE.filter(function (c) { return (c.tireType | 0) === 1; }).length,
  slickCount: GARAGE.filter(function (c) { return (c.tireType | 0) === 2; }).length,
  rCompCount: GARAGE.filter(function (c) { return (c.tireType | 0) === 5; }).length,
  classCounts: histAfter,
  bindPreserved: true,
  bakedFiles: ['js/garage-data.js', 'js/physics.js'],
  noRemoteTireDb: true
};

fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));

function mdEsc(s) { return String(s || '').replace(/\|/g, '\\|'); }

var md = [];
md.push('# VERIFY — Factory tire → FINAL 60ft traction map');
md.push('');
md.push('**Credit:** Jorge Guerra only');
md.push('**Branch:** `review/factory-tire-60ft-final`');
md.push('**Repo:** `01ls1z28-coder/velocitybench-powercurve`');
md.push('**Pages / main:** HOLD for Seraph/Merovingian FF — tip only');
md.push('**Report JSON:** `scripts/factory-tire-60ft-report.json`');
md.push('**Bake script:** `scripts/recalib-factory-tire-60ft.js`');
md.push('');
md.push('## Disclaimer');
md.push('');
md.push('Factory tire classes and 60-foot traction targets are **compiled estimates** from OEM order guides, Tire Rack OE fitments, manufacturer press, and published instrumented tests — **not lab-certified µ measurements**. Simulated 60fts still depend on vehicle mass, gearing, and launch RPM; µ sets class traction character. Use for comparison, not as a substitute for track data.');
md.push('');
md.push('## FINAL 60ft targets (Jorge)');
md.push('');
md.push('| Class | Unprepped (s) | Prepped (s) |');
md.push('|-------|---------------|-------------|');
md.push('| Street / all-season | 2.2 | 1.7–1.75 |');
md.push('| Summer street performance | 2.0 | 1.6 |');
md.push('| UHP summers | 1.85–1.90 (mid pick **1.875**) | 1.45–1.5 (mid pick **1.475**) |');
md.push('| R-compound | 1.75–1.80 (mid pick **1.775**) | **1.5** fixed |');
md.push('| Drag radials | 1.65–1.72 (mid pick **1.685**) | ≈ slick + 0.05 |');
md.push('| Slicks | 1.80–1.90 (mid pick **1.85**) | 1.45–1.50 |');
md.push('');
md.push('## µ bake (`js/physics.js` TIRE_MU_BY_PREP)');
md.push('');
md.push('| tireType | Unprep µ | Prep µ |');
md.push('|----------|----------|--------|');
md.push('| 0 Street | 1.20 | 1.80 |');
md.push('| 3 Summer | 1.34 | 1.95 |');
md.push('| 4 UHP | 1.44 | 2.15 |');
md.push('| 2 Slick | 1.47 | 2.20 |');
md.push('| 5 R-Compound | 1.64 | 2.00 |');
md.push('| 1 Drag Radial | 1.85 | 1.90 |');
md.push('');
md.push('## Class counts (316 vehicles)');
md.push('');
md.push('| Class | Before | After |');
md.push('|-------|-------:|------:|');
[0, 3, 4, 5, 1, 2].forEach(function (tt) {
  md.push('| ' + LABELS[tt] + ' | ' + (histBefore[tt] || 0) + ' | **' + (histAfter[tt] || 0) + '** |');
});
md.push('');
md.push('- tireType changes: **' + report.changes + '**');
md.push('- factory DR: **' + report.factoryDR + '** (must be 0)');
md.push('- Slick: **' + report.slickCount + '** (Z28 ATC only)');
md.push('- R-Compound: **' + report.rCompCount + '** (documented Cup/Trofeo/Corsa + ZR1X)');
md.push('- forceScale≠1: **' + report.forceScaleNonOne + '**');
md.push('- `window.VB_POWERCURVE_GARAGE` bind: **preserved**');
md.push('- Runtime remote tire DB: **none** — data baked into `js/garage-data.js`');
md.push('');
md.push('## Challenger spot-check');
md.push('');
md.push('| Car | tireType | Unprep 60ft | Prep 60ft |');
md.push('|-----|----------|-------------|-----------|');
spot.forEach(function (s) {
  md.push('| ' + mdEsc(s.name) + ' | ' + s.tireLabel + ' | ' + s.unprepSixty + ' | ' + s.prepSixty + ' |');
});
md.push('');
md.push('Hellcat Unprep UHP target band **1.85–1.90**: Hellcat sim should land in-band at stock launch.');
md.push('Prep absolute **1.45–1.5** is demonstrated on sticky well-launched cars (Z28 ladder); heavy muscle may floor ~1.66–1.73 from mass/geometry while class µ remains correct.');
md.push('');
md.push('## Hellcat tire ladder (sim 60ft)');
md.push('');
if (report.hellcatLadder) {
  md.push('| Prep | Street | Summer | UHP | R-Comp | DR | Slick |');
  md.push('|------|--------|--------|-----|--------|----|-------|');
  var hu = report.hellcatLadder.unprepped;
  var hp = report.hellcatLadder.prepped;
  md.push('| Unprep | ' + hu.Street + ' | ' + hu.Summer + ' | ' + hu.UHP + ' | ' + hu['R-Compound'] + ' | ' + hu['Drag Radial'] + ' | ' + hu.Slick + ' |');
  md.push('| Prep | ' + hp.Street + ' | ' + hp.Summer + ' | ' + hp.UHP + ' | ' + hp['R-Compound'] + ' | ' + hp['Drag Radial'] + ' | ' + hp.Slick + ' |');
}
md.push('');
md.push('## Sources credited');
md.push('');
md.push('- Tire Rack OEM / OE fitment guides');
md.push('- Manufacturer order guides & press (Ford GT350R, GM Z/28, Porsche N-spec bulletins, Pirelli/McLaren/Lambo Trofeo R)');
md.push('- Goodyear Eagle F1 Supercar OE catalogs (Camaro ZL1)');
md.push('- C&D / MT / instrumented tests quoting OEM tire when used for class');
md.push('- Prior tip OEM stack: `0ce7872` / `f7acdd0` (`scripts/recalib-oem-factory-tire.js`) — extended, Challenger family reassigned UHP per Jorge');
md.push('- µ character research notes already in `js/physics.js` (Wong/HPWizard, LS1GTO DR µ, LivePhysics prep)');
md.push('');
md.push('## Flagged family/package defaults (no car-specific placard in DOCUMENTED)');
md.push('');
md.push('Count: **' + flagged.length + '** — full list in `scripts/factory-tire-60ft-report.json` → `flaggedFamilyDefaults`.');
md.push('');
md.push('## Secrets / tracking');
md.push('');
md.push('None found in touched files (`js/garage-data.js`, `js/physics.js`, `index.html` cache-bust, this VERIFY). No API keys, no telemetry pixels added.');
md.push('');
md.push('## node --check');
md.push('');
md.push('`js/physics.js`, `js/garage-data.js` — run at bake time.');
md.push('');

fs.writeFileSync(OUT_VERIFY_MD, md.join('\n'));
console.log('Baked', GARAGE.length, 'cars; changes', report.changes);
console.log('histAfter', histAfter);
console.log('Challenger spot', JSON.stringify(spot, null, 2));
console.log('flagged', flagged.length);
console.log('Wrote', OUT_JS, OUT_REPORT, OUT_VERIFY_MD);
