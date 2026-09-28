/**
 * Real-TX Phase 7b honest ratios/FD (Jorge via Seraph):
 * Blank OEM TX *names* stay blank when unsure; gearRatios + finalDriveRatio must be
 * period-correct OEM (or best-sourced stock) for that exact year/model — no wrong-family
 * fillers (ZF8 on non-ZF platforms, RX-8 gears on MazdaSpeed, Evo box on Eclipse, etc.).
 * If ratios/FD cannot be sourced → leave prior gears and FLAG in VERIFY (do not invent).
 * Knobs ONLY after gear/FD writes: drivetrainLossPercent + launchRpm + tireType.
 * forceScale=1. No Cd / weight / frontal area / torque-curve / Peak HP edits.
 *
 *   node scripts/recalib-real-tx-phase7b-honest-ratios.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var Phys = require('../js/physics.js');
var GARAGE = require('../js/garage-data.js');
var META_PATH = path.join(__dirname, 'garage-calib-meta.json');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'real-tx-phase7b-honest-ratios-report.json');
var TOL = { z60: 0.25, et: 0.25, trap: 2.5, z60130: 0.75 };

function g(key) { return Phys.FactoryTransmissions[key].gears.slice(); }

/**
 * Remap plan: gearRatios + finalDriveRatio + txKey (provenance / shift-family) +
 * transmission. txFactoryLabel forced '' after write (name stays blank).
 * source: short citation for VERIFY.
 */
var REMAPS = {
  // ----- High-confidence Euro wrong-ZF8 → period OEM -----
  '2012 BMW M5': {
    txKey: 'BMW_M_DCT_7',
    gears: [4.806, 2.593, 1.701, 1.277, 1.000, 0.844, 0.671],
    fd: 3.15, transmission: 'DCT',
    source: 'BMW press F10 M5 M-DCT; FD 3.15 (not E9x 3.462 preset default)'
  },
  '2012 Audi R8 V10': {
    txKey: 'Lambo_EGear_6', // AMT/sequential residual family; blank label
    gears: [4.373, 2.709, 1.925, 1.502, 1.239, 1.035],
    fd: 3.077, transmission: 'Sequential',
    source: 'Audi UK press R8 5.2 R-tronic 6; C&D 2012 R-tronic specs'
  },
  '2007 Porsche 911 Turbo': {
    txKey: 'Chrysler_NAG1_5', // Tiptronic 5 ratios match NAG1/5G family; blank label
    gears: [3.60, 2.19, 1.41, 1.00, 0.83],
    fd: 3.06, transmission: 'Auto',
    source: 'FCP Euro 997 Tiptronic A97.50; forum OEM FD 3.05–3.06'
  },
  '2002 Porsche 911 Turbo (996)': {
    txKey: 'Chrysler_NAG1_5',
    gears: [3.60, 2.19, 1.41, 1.00, 0.83],
    fd: 2.89, transmission: 'Auto',
    source: 'PCA/FCP Tiptronic A96.50; FD 2.89 (not manual 3.44)'
  },
  '2008 Aston Martin DBS': {
    txKey: 'ZF_6HP',
    gears: g('ZF_6HP'),
    fd: 3.46, transmission: 'Auto',
    source: 'Aston Touchtronic 2 = ZF 6HP26; FD 3.46 (Topspeed/AM press)'
  },
  '2015 Aston Martin V12 Vantage S': {
    txKey: 'Ferrari_F1_6', // 7-spd AMT residual via ferrari_ key; blank label
    gears: [3.286, 2.158, 1.609, 1.269, 1.034, 0.848, 0.675],
    fd: 3.727, transmission: 'Sequential',
    source: 'Aston V12 Vantage S Sportshift III tech sheet'
  },
  '2008 Audi S5': {
    txKey: 'ZF_6HP',
    gears: [3.667, 2.050, 1.462, 1.133, 0.919, 0.778],
    fd: 3.889, transmission: 'Auto',
    source: 'Audi 2008 S5 Tiptronic tech sheet (ZF 6HP28AF)'
  },
  '2007 Audi S6 V10': {
    txKey: 'ZF_6HP',
    gears: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69],
    fd: 3.80, transmission: 'Auto',
    source: 'C&D 2007 S6 Tiptronic 6HP; FD 3.80'
  },
  '2005 Mercedes E55 AMG': {
    txKey: 'Chrysler_NAG1_5',
    gears: g('Chrysler_NAG1_5'),
    fd: 2.65, transmission: 'Auto',
    source: 'MB archive E55 AMG 5G-Tronic; FD 2.65'
  },
  '2006 Mercedes CLK55 AMG': {
    txKey: 'Chrysler_NAG1_5',
    gears: g('Chrysler_NAG1_5'),
    fd: 3.06, transmission: 'Auto',
    source: 'MB archive CLK55 AMG 5G-Tronic; FD 3.06'
  },
  '2009 Mercedes CLS550': {
    txKey: 'AMG_SPEEDSHIFT_MCT_7',
    gears: [4.38, 2.86, 1.92, 1.37, 1.00, 0.82, 0.73],
    fd: 2.65, transmission: 'Auto',
    source: '7G-Tronic 722.9 published ratios; CLS550 FD 2.65 (C&D)'
  },
  // 2011 A7 C7 Tiptronic 8 — OEM IS ZF 8HP; fix FD only (keep ZF8 gears)
  '2011 Audi A7 3.0T': {
    txKey: 'ZF8HP',
    gears: g('ZF8HP'),
    fd: 2.848, transmission: 'Auto',
    source: 'C7 A7 3.0T Tiptronic 8HP OEM; FD ~2.848 quattro published-leaning'
  },

  // ----- Modern wrong-family -----
  '2023 Ford Bronco Raptor': {
    txKey: 'Ford_10R80',
    gears: [4.714, 2.997, 2.149, 1.769, 1.521, 1.275, 1.000, 0.853, 0.689, 0.636],
    fd: 4.70, transmission: 'Auto',
    source: 'Ford Bronco tech specs 10R60; Raptor axle 4.70'
  },
  '2023 Acura TLX Type S': {
    txKey: 'Ford_10R80', // 10AT residual/auto family; blank label (Honda 10AT not ZF)
    gears: [5.25, 3.27, 2.19, 1.60, 1.30, 1.00, 0.78, 0.65, 0.58, 0.52],
    fd: 3.59, transmission: 'Auto',
    source: 'Acura 2023 TLX Type S fact sheet 10AT; FD 3.59 SH-AWD'
  },

  // ----- Ram 1500 2013+ IS OEM ZF 8HP70 — keep gears, fix axle FD -----
  '2013 Ram 1500 5.7 Hemi': {
    txKey: 'ZF8HP',
    gears: g('ZF8HP'),
    fd: 3.55, transmission: 'Auto',
    source: '2013+ Ram 1500 Hemi TorqueFlite 8 = ZF 8HP70; common axle 3.55'
  },
  '2016 Ram 1500 5.7 Hemi': {
    txKey: 'ZF8HP',
    gears: g('ZF8HP'),
    fd: 3.55, transmission: 'Auto',
    source: 'Ram 1500 Hemi 8HP70 OEM; axle 3.55'
  },

  // ----- Trucks / SUV off ZF8 filler -----
  '2019 Ford F-250 6.7 PowerStroke': {
    txKey: 'Ford_10R80',
    gears: [4.61, 3.02, 2.03, 1.63, 1.25, 1.00, 0.85, 0.68, 0.59, 0.47],
    fd: 3.55, transmission: 'Auto',
    source: 'Ford TorqShift 10R140 published ratios; common axle 3.55'
  },
  '2005 Ford F-250 V10': {
    txKey: 'Ford_6R80', // 5-speed TorqShift; auto family
    gears: [3.11, 2.20, 1.54, 1.00, 0.71],
    fd: 3.73, transmission: 'Auto',
    source: 'Ford 5R110W TorqShift V10 published-leaning; axle 3.73'
  },
  '2007 Ford F-150 4.6 Triton': {
    txKey: 'Ford_6R80',
    gears: [2.84, 1.55, 1.00, 0.70],
    fd: 3.73, transmission: 'Auto',
    source: 'Ford 4R75E (pre-6R80); F150Hub ratios; axle 3.73'
  },
  '2008 Ford F-150 Harley-Davidson': {
    txKey: 'Ford_6R80',
    gears: [2.84, 1.55, 1.00, 0.70],
    fd: 3.73, transmission: 'Auto',
    source: '2008 F-150 still 4R75E era (6R80 arrives ~2009+ 5.4/6.2); axle 3.73'
  },
  '2013 Ford Expedition 5.4': {
    txKey: 'Ford_6R80',
    gears: g('Ford_6R80'),
    fd: 3.31, transmission: 'Auto',
    source: 'Expedition 5.4 6R80 OEM; FD 3.31 common'
  },
  '2021 Toyota Tundra': {
    txKey: 'Toyota_A340E',
    gears: [3.333, 1.960, 1.353, 1.000, 0.728, 0.588],
    fd: 4.30, transmission: 'Auto',
    source: '2021 = last 2nd-gen AB60E/F 6AT (10AT is 2022+); axle 4.30 common 5.7'
  },
  '2010 Toyota Tundra 5.7': {
    txKey: 'Toyota_A340E',
    gears: [3.333, 1.960, 1.353, 1.000, 0.728, 0.588],
    fd: 4.30, transmission: 'Auto',
    source: 'AB60E/F published ratios; axle 4.30'
  },
  '2013 Toyota Sequoia 5.7': {
    txKey: 'Toyota_A340E',
    gears: [3.333, 1.960, 1.353, 1.000, 0.728, 0.588],
    fd: 4.30, transmission: 'Auto',
    source: 'Sequoia 5.7 AB60F; axle 4.30'
  },
  '2009 Toyota 4Runner V8': {
    txKey: 'Toyota_A340E',
    gears: [3.520, 2.042, 1.400, 1.000, 0.716, 0.588],
    fd: 3.727, transmission: 'Auto',
    source: '4Runner V8 A750F/AB60 family published-leaning; axle 3.727'
  },
  '2007 Toyota Tundra 4.7': {
    txKey: 'Toyota_A340E',
    gears: [3.520, 2.042, 1.400, 1.000, 0.716],
    fd: 3.91, transmission: 'Auto',
    source: 'Tundra 4.7 A750E 5AT published-leaning; axle 3.91'
  },
  '2014 Toyota Tacoma V6': {
    txKey: 'Toyota_A340E',
    gears: [3.520, 2.042, 1.400, 1.000, 0.716],
    fd: 3.727, transmission: 'Auto',
    source: 'Tacoma V6 A750E 5AT; common axle 3.727'
  },
  '2011 Toyota Tacoma 4.0 V6': {
    txKey: 'Toyota_A340E',
    gears: [3.520, 2.042, 1.400, 1.000, 0.716],
    fd: 3.727, transmission: 'Auto',
    source: 'Tacoma 4.0 A750E 5AT; axle 3.727'
  },
  '2008 Toyota Highlander V6': {
    txKey: 'Toyota_A340E',
    gears: [3.300, 1.900, 1.420, 1.000, 0.713],
    fd: 3.478, transmission: 'Auto',
    source: 'Highlander V6 U151E/U250E 5AT published-leaning'
  },
  '2010 Nissan Titan 5.6': {
    txKey: 'ZF_6HP',
    gears: [3.827, 2.368, 1.520, 1.000, 0.834],
    fd: 2.937, transmission: 'Auto',
    source: 'Nissan RE5R05A; 2010 Titan specs PDF; axle 2.937'
  },
  '2012 Nissan Titan Pro-4X': {
    txKey: 'ZF_6HP',
    gears: [3.827, 2.368, 1.520, 1.000, 0.834],
    fd: 3.357, transmission: 'Auto',
    source: 'RE5R05A; Pro-4X axle often 3.357'
  },
  '2015 Nissan Frontier 4.0': {
    txKey: 'ZF_6HP',
    gears: [3.84, 2.35, 1.53, 1.00, 0.84],
    fd: 3.357, transmission: 'Auto',
    source: 'Frontier 5AT published; axle 3.357 common'
  },
  '2012 Scion tC': {
    txKey: 'Toyota_A340E',
    gears: [3.30, 1.90, 1.42, 1.00, 0.71, 0.61],
    fd: 3.82, transmission: 'Auto',
    source: '2012 Scion tC U660E 6AT; FD 3.82 (TheCarConnection)'
  },
  '2009 Honda Pilot': {
    txKey: 'Toyota_A340E',
    gears: [2.697, 1.606, 1.071, 0.766, 0.612],
    fd: 4.312, transmission: 'Auto',
    source: 'Honda Pilot 2009 5AT press; FD 4.312'
  },
  '2014 Jeep Wrangler Rubicon': {
    txKey: 'Chrysler_NAG1_5',
    gears: g('Chrysler_NAG1_5'),
    fd: 3.73, transmission: 'Auto',
    source: 'JK Wrangler W5A580/NAG1; Rubicon axle often 3.73/4.10 — use 3.73'
  },
  '2010 Jeep Commander 5.7': {
    txKey: 'Chrysler_NAG1_5',
    gears: g('Chrysler_NAG1_5'),
    fd: 3.07, transmission: 'Auto',
    source: 'Commander 5.7 W5A580; FD ~3.07'
  },
  '2011 Jeep Liberty 3.7': {
    txKey: 'Chrysler_NAG1_5',
    gears: [2.84, 1.57, 1.00, 0.69],
    fd: 3.73, transmission: 'Auto',
    source: 'Liberty 42RLE 4AT published-leaning; axle 3.73'
  },

  // ----- Classic Fordomatic (not C4/C6) — ratios period Cruise-O-Matic / Fordomatic -----
  '1960 Ford Galaxie 352': {
    txKey: 'Ford_C6',
    gears: [2.40, 1.47, 1.00],
    fd: 3.56, transmission: 'Auto',
    source: 'MX Cruise-O-Matic era (C6 is 1966+); Fordomatic/COM ratios; FD 3.56 common'
  },
  '1955 Ford Thunderbird': {
    txKey: 'Ford_C4',
    gears: [2.40, 1.47, 1.00],
    fd: 3.31, transmission: 'Auto',
    source: 'Fordomatic (C4 is 1964+); period 3-speed ratios; FD 3.31 common'
  },

  // ----- JDM manuals: wrong count / wrong family -----
  '1999 Subaru Impreza 22B STI': {
    txKey: 'Honda_5MT',
    gears: [3.083, 2.062, 1.545, 1.151, 0.825],
    fd: 4.444, transmission: 'Manual',
    source: 'JDM 22B 5MT (not 6MT STI); rallycars/legacy specs FD 4.444'
  },
  '2002 Subaru WRX Wagon': {
    txKey: 'Honda_5MT',
    gears: [3.454, 1.947, 1.366, 0.972, 0.738],
    fd: 3.900, transmission: 'Manual',
    source: 'Bugeye WRX 5MT TY752; FD 3.900'
  },
  '2008 Subaru Legacy GT Spec.B': {
    txKey: 'Subaru_6MT',
    gears: [3.454, 1.947, 1.366, 1.032, 0.825, 0.711], // Spec.B 6MT published-leaning (not STI close-ratio)
    fd: 3.900, transmission: 'Manual',
    source: 'Legacy GT Spec.B 6MT TY856 family; FD 3.90 (not STI TY856WB1AA close-ratio set)'
  },
  '2007 MazdaSpeed3': {
    txKey: 'Mazda_6MT',
    gears: [3.538, 2.238, 1.535, 1.171, 1.085, 0.853],
    fd: 3.941, transmission: 'Manual',
    source: 'Mazda Canada 2007 MS3 press; split FD 3.941(1-4)/3.350(5-6) — sim uses 3.941'
  },
  '2011 MazdaSpeed6': {
    txKey: 'Mazda_6MT',
    gears: [3.538, 2.238, 1.535, 1.171, 1.085, 0.853],
    fd: 3.941, transmission: 'Manual',
    source: 'Mazdaspeed6 OEM 6MT (same gearset family as MS3); FD 3.941'
  },
  '2005 Mitsubishi Eclipse GT': {
    txKey: 'Mitsubishi_5MT',
    gears: [3.583, 1.947, 1.379, 1.031, 0.770],
    fd: 3.727, transmission: 'Manual',
    source: '3G Eclipse GT 5MT (2000-05); NOT Evo VIII box — club3g/published-leaning'
  },
  '2001 Mitsubishi Eclipse GSX': {
    txKey: 'Mitsubishi_5MT',
    gears: [3.083, 1.684, 1.222, 0.886, 0.666],
    fd: 4.312, transmission: 'Manual',
    source: '3G GSX AWD W5M51 published-leaning (garage year overlaps late 2G/3G AWD); FD ~4.312'
  },
  '1995 Mitsubishi Eclipse GSX': {
    txKey: 'Mitsubishi_5MT',
    gears: [3.083, 1.684, 1.222, 0.886, 0.666],
    fd: 4.312, transmission: 'Manual',
    source: '2G GSX 5MT AWD published-leaning; FD 4.312'
  },
  '1997 Honda Civic Type R EK9': {
    txKey: 'Honda_5MT',
    gears: [3.230, 2.105, 1.458, 1.107, 0.848],
    fd: 4.400, transmission: 'Manual',
    source: 'EK9 S4C OEM ratios; FD 4.400'
  },
  '2003 Acura RSX Type-S': {
    txKey: 'Honda_CTR_6',
    gears: [3.267, 2.130, 1.517, 1.147, 0.921, 0.738],
    fd: 4.389, transmission: 'Manual',
    source: 'DC5 Type-S 6MT (was wrongly 5MT Honda_5MT); Acura specs FD 4.389'
  },
  '2006 Honda Accord Euro R': {
    txKey: 'Honda_CTR_6',
    gears: [3.266, 2.130, 1.517, 1.147, 0.921, 0.738],
    fd: 4.764, transmission: 'Manual',
    source: 'CL7 Euro R 6MT RBC3; FD 4.764 (HondaSwap/greeco)'
  },
  '1998 Honda Prelude Type SH': {
    txKey: 'Honda_5MT',
    gears: [3.230, 1.900, 1.360, 1.034, 0.787],
    fd: 4.266, transmission: 'Manual',
    source: 'Prelude SH H22 5MT published-leaning; FD 4.266'
  },
  '1999 Honda Prelude SH': {
    txKey: 'Honda_5MT',
    gears: [3.230, 1.900, 1.360, 1.034, 0.787],
    fd: 4.266, transmission: 'Manual',
    source: 'Prelude SH 5MT; FD 4.266'
  },
  '1993 Honda Accord SiR': {
    txKey: 'Honda_5MT',
    gears: [3.230, 1.900, 1.360, 1.034, 0.787],
    fd: 4.266, transmission: 'Manual',
    source: 'Accord SiR (CD6) 5MT published-leaning; FD 4.266'
  },
  '1996 Honda Integra SiR': {
    txKey: 'Honda_5MT',
    gears: [3.230, 2.105, 1.458, 1.107, 0.848],
    fd: 4.400, transmission: 'Manual',
    source: 'Integra SiR (DC2) S80/YS1 close to EK9 set; FD 4.400'
  },

  // ----- Exotics with published ratios -----
  '2019 Koenigsegg Jesko': {
    txKey: 'Ferrari_DCT_8', // multi-clutch DCT residual; blank label (LST is unique)
    gears: [4.7200, 3.6441, 2.8744, 2.2500, 1.7371, 1.3702, 1.0783, 0.8325, 0.6566],
    fd: 2.73, transmission: 'DCT',
    source: 'Jesko LST 9-spd published (BMW Blog / wiki class); FD ~2.73 class with KDD/Agera family'
  },
  '2014 Hennessey Venom GT': {
    txKey: 'Ford_Ricardo_6',
    gears: [2.61, 1.71, 1.23, 0.94, 0.77, 0.63],
    fd: 3.36, transmission: 'Manual',
    source: 'Venom GT Ricardo 6 (Hennessey); matches Ford GT Ricardo family'
  },
  '2004 Maserati MC12': {
    txKey: 'Ferrari_F1_6',
    gears: [3.15, 2.18, 1.57, 1.19, 0.94, 0.71],
    fd: 4.10, transmission: 'Sequential',
    source: 'MC12 Cambiocorsa 6 (Enzo sister); published-leaning ratios/FD 4.10'
  }
};

/** Cars audited but left flagged — cannot source honest OEM ratios/FD without inventing. */
var FLAGGED_UNSOURCED = [
  { name: '2015 Koenigsegg One:1', reason: '7DCT proprietary; Koenigsegg tech pages omit forward ratios' },
  { name: '2011 Koenigsegg Agera R', reason: 'CIMA 7DCT; no OEM press ratio table found (Motormatchup secondary only)' },
  { name: '2014 Koenigsegg Agera S', reason: 'same CIMA 7DCT — no OEM ratio table' },
  { name: '2010 Pagani Zonda R', reason: 'Xtrac 672 sequential; forward ratios not in OEM docs' },
  { name: '2012 Pagani Huayra', reason: 'Xtrac 1007 7-seq; ratios not publicly disclosed' },
  { name: '2017 Pagani Huayra BC', reason: 'Xtrac Huayra family — ratios not public' },
  { name: '2019 Pagani Huayra Roadster BC', reason: 'Xtrac Huayra family — ratios not public' },
  { name: '2010 Gumpert Apollo Sport', reason: 'Apollo sequential — no reliable OEM ratio table sourced' },
  { name: '2018 Zenvo TSR-S', reason: 'Zenvo 7DCT — no OEM forward-ratio publication found' },
  // Nissan S-chassis / Pulsar / Z: FS5W71-related but exact OEM set contested vs Skyline label
  { name: '1995 Nissan Silvia S14', reason: 'S14 box closely related to FS5W71C but exact OEM set/FD variant not locked — keep prior; blank name' },
  { name: '1991 Nissan 240SX (S13)', reason: 'S13 5MT variants (KA/SR) differ; not locking without chassis-exact source' },
  { name: '1994 Nissan 180SX Type X', reason: 'same S-chassis family uncertainty' },
  { name: '1992 Nissan Pulsar GTI-R', reason: 'GTI-R ATTESA 5MT distinct; exact OEM ratios not locked this tip' },
  { name: '1990 Nissan 300ZX NA', reason: 'Z32 NA FS5R30A/related — not Skyline FS5W71; exact set not locked' },
  // Toyota W58-on-non-Supra: speculative family match — flag rather than invent distinct boxes
  { name: '1998 Toyota Celica GT-Four', reason: 'ST205 E150/E151 family not W58; exact OEM ratios not locked this tip' },
  { name: '1991 Toyota Soarer GT-T', reason: 'JZZ30 auto/manual variants; W58 not confirmed OEM — not inventing' },
  { name: '1997 Toyota Chaser Tourer V', reason: 'JZX100 Getrag/other; W58 speculative — not inventing' }
];

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function curveSig(c) {
  if (!c || !c.torqueCurve) return '';
  return Object.keys(c.torqueCurve).sort(function (a, b) { return +a - +b; })
    .map(function (k) { return k + ':' + c.torqueCurve[k]; }).join('|');
}
function runSim(car, full) {
  var r = Phys.runQuarterMile(car, {
    tempF: 70, humidity: 45, pressureInHg: 29.92,
    windMph: 0, windSpeedMph: 0, windDirDeg: 0, gustMph: 0,
    launch: 'auto', launchMode: 'auto', tireType: car.tireType | 0,
    driverWeightLbs: 200, quickMetrics: !full, needSixtyToOneThirty: true
  });
  return {
    et: r.quarterMileTime || null, trap: r.quarterMileSpeedMph || null,
    z60: r.zeroToSixty, z60130: r.sixtyToOneThirty,
    ft60: r.sixtyFootTime || null, vmax: r.topSpeedMph
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
function allHit(h) { return !!(h && h.et && h.trap && h.z60 && h.z60130); }
function cost(sim, tgt) {
  var c = 0, hits = 0, app = 0;
  function add(k, w, tol) {
    if (tgt[k] == null) return;
    app++;
    if (sim[k] == null) { c += 100; return; }
    var err = Math.abs(sim[k] - tgt[k]);
    c += (err / tol) * w + err * w * 0.15;
    if (err <= tol) hits++;
    else c += (err / tol) * w * 0.8;
  }
  add('et', 8.0, TOL.et);
  add('trap', 5.0, TOL.trap);
  add('z60130', 3.0, TOL.z60130);
  add('z60', 2.0, TOL.z60);
  c -= hits * 5;
  c += (app - hits) * 3;
  return c;
}
function trial(base, tgt, knobs, best) {
  var car = clone(base);
  car.drivetrainLossPercent = knobs.loss;
  car.forceScale = 1;
  car.tireType = knobs.tireType;
  car.launchRpm = knobs.launchRpm;
  if (knobs.hybridAssistFrac != null) car.hybridAssistFrac = knobs.hybridAssistFrac;
  var sim = runSim(car, false);
  var c = cost(sim, tgt);
  var h = hitFlags(sim, tgt);
  var nh = (h.et ? 1 : 0) + (h.trap ? 1 : 0) + (h.z60 ? 1 : 0) + (h.z60130 ? 1 : 0);
  var etErr = (tgt.et != null && sim.et != null) ? Math.abs(sim.et - tgt.et) : 0;
  var cand = { knobs: knobs, cost: c, sim: sim, hits: h, nh: nh, etErr: etErr, car: car };
  if (!best) return cand;
  if (c < best.cost - 1e-9) return cand;
  if (Math.abs(c - best.cost) < 1e-9) {
    if (etErr < best.etErr - 1e-9) return cand;
    if (Math.abs(etErr - best.etErr) < 1e-9 && nh > best.nh) return cand;
  }
  if (allHit(h) && !allHit(best.hits) && c < best.cost + 1.5) return cand;
  return best;
}
function calibrateLossLaunchTire(car, tgt) {
  var isHybrid = !!(car.isHybrid || car.powerSource === 'hybrid');
  var baseLoss = car.drivetrainLossPercent != null ? +car.drivetrainLossPercent : 12;
  var baseLaunch = car.launchRpm != null ? +car.launchRpm : 3000;
  var baseAssist = car.hybridAssistFrac != null ? +car.hybridAssistFrac : 0.22;
  var seedTire = car.tireType | 0;
  var best = trial(car, tgt, {
    loss: baseLoss, tireType: seedTire, launchRpm: baseLaunch,
    hybridAssistFrac: isHybrid ? baseAssist : undefined
  }, null);

  [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 35].forEach(function (loss) {
    best = trial(car, tgt, {
      loss: loss, tireType: seedTire, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined
    }, best);
  });
  var lc = best.knobs.loss;
  [-2, -1, -0.5, 0.5, 1, 2].forEach(function (d) {
    best = trial(car, tgt, {
      loss: Math.max(0, Math.min(35, +(lc + d).toFixed(1))),
      tireType: best.knobs.tireType, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? baseAssist : undefined
    }, best);
  });
  [0, 1, 3, 4, 2].forEach(function (tire) {
    if (tire === best.knobs.tireType) return;
    best = trial(car, tgt, {
      loss: best.knobs.loss, tireType: tire, launchRpm: baseLaunch,
      hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
    }, best);
  });
  if (!best.hits.z60 || !best.hits.et || !best.hits.trap) {
    [-1200, -900, -600, -300, 0, 300, 600, 900, 1200, 1500].forEach(function (d) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: Math.round(Math.max(200, Math.min(7000, baseLaunch + d))),
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
      }, best);
    });
  }
  var bl = best.knobs.loss, bt = best.knobs.tireType, bla = best.knobs.launchRpm;
  [-1.5, -1, -0.5, 0.5, 1, 1.5].forEach(function (d) {
    [-400, -200, 200, 400].forEach(function (ld) {
      best = trial(car, tgt, {
        loss: Math.max(0, Math.min(35, +(bl + d).toFixed(1))),
        tireType: bt,
        launchRpm: Math.round(Math.max(200, Math.min(7000, bla + ld))),
        hybridAssistFrac: isHybrid ? best.knobs.hybridAssistFrac : undefined
      }, best);
    });
  });
  if (isHybrid) {
    [0.18, 0.22, 0.26, 0.28, 0.30, 0.34].forEach(function (af) {
      best = trial(car, tgt, {
        loss: best.knobs.loss, tireType: best.knobs.tireType,
        launchRpm: best.knobs.launchRpm, hybridAssistFrac: af
      }, best);
    });
  }

  var out = best.car;
  out.drivetrainLossPercent = +Number(best.knobs.loss).toFixed(1);
  out.forceScale = 1;
  out.tireType = best.knobs.tireType | 0;
  out.launchRpm = Math.round(best.knobs.launchRpm);
  if (isHybrid && best.knobs.hybridAssistFrac != null) {
    out.hybridAssistFrac = +Number(best.knobs.hybridAssistFrac).toFixed(3);
  }
  var finalSim = runSim(out, true);
  return { car: out, sim: finalSim, hits: hitFlags(finalSim, tgt), cost: best.cost };
}

function writeGarage(cars) {
  var header = [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 7b honest ratios/FD).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph + EV_Single / Tesla / Taycan / KDD presets.',
    ' * Real-TX Phase 7b: blank unsure TX names retained; gearRatios/FD period-OEM where sourced;',
    ' *   knobs loss/tire/launch only after gear/FD; forceScale=1; no Cd/wt/curve.',
    ' * Rebuild: node scripts/recalib-real-tx-phase7b-honest-ratios.js',
    ' */',
    "'use strict';",
    '',
    'var GARAGE = '
  ].join('\n');
  fs.writeFileSync(OUT_JS, header + JSON.stringify(cars, null, 2) +
    ';\n\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = GARAGE;\n}\n' +
    'if (typeof window !== "undefined") {\n  window.VB_POWERCURVE_GARAGE = GARAGE;\n} else if (typeof globalThis !== "undefined") {\n  globalThis.VB_POWERCURVE_GARAGE = GARAGE;\n}\n');
}

function fmt(n, d) { return n == null || !isFinite(n) ? '—' : (+n).toFixed(d); }


function main() {
  var t0 = Date.now();
  var meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  var byNameMeta = {};
  meta.results.forEach(function (r) {
    if (!byNameMeta[r.name]) byNameMeta[r.name] = [];
    byNameMeta[r.name].push(r);
  });

  var outCars = GARAGE.map(clone);
  var report = [];
  var names = Object.keys(REMAPS);
  console.log('Real-TX Phase7b honest ratios/FD — remap + loss/tire/launch recalib');
  console.log('Targets:', names.length, '| Flagged unsourced:', FLAGGED_UNSOURCED.length);

  // Baseline fleet BEFORE remaps
  function fleetStats(cars) {
    var stats = { et: 0, trap: 0, z60: 0, z60130: 0, nEt: 0, nTrap: 0, nZ60: 0, n60130: 0, all4: 0 };
    var nameOcc = {}, metaByNameOcc = {};
    meta.results.forEach(function (r) {
      if (!metaByNameOcc[r.name]) metaByNameOcc[r.name] = [];
      metaByNameOcc[r.name].push(r);
    });
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      var occ = nameOcc[car.name] || 0;
      nameOcc[car.name] = occ + 1;
      var oldMeta = (metaByNameOcc[car.name] || [])[occ];
      if (!oldMeta || !oldMeta.tgt) continue;
      var tgt2 = oldMeta.tgt;
      var simR = runSim(car, false);
      var hits2 = hitFlags(simR, tgt2);
      if (tgt2.et != null) { stats.nEt++; if (hits2.et) stats.et++; }
      if (tgt2.trap != null) { stats.nTrap++; if (hits2.trap) stats.trap++; }
      if (tgt2.z60 != null) { stats.nZ60++; if (hits2.z60) stats.z60++; }
      if (tgt2.z60130 != null) { stats.n60130++; if (hits2.z60130) stats.z60130++; }
      if (hits2.et && hits2.trap && hits2.z60 && hits2.z60130) stats.all4++;
    }
    return stats;
  }
  var beforeStats = fleetStats(outCars);
  console.log('BEFORE fleet ET', beforeStats.et + '/' + beforeStats.nEt,
    'trap', beforeStats.trap + '/' + beforeStats.nTrap,
    '0-60', beforeStats.z60 + '/' + beforeStats.nZ60,
    '60-130', beforeStats.z60130 + '/' + beforeStats.n60130, 'all4', beforeStats.all4);

  names.forEach(function (name) {
    var plan = REMAPS[name];
    var idxs = [];
    for (var i = 0; i < outCars.length; i++) if (outCars[i].name === name) idxs.push(i);
    if (!idxs.length) { console.error('MISSING', name); return; }
    var tgt = (byNameMeta[name] && byNameMeta[name][0] && byNameMeta[name][0].tgt) || {};

    idxs.forEach(function (gi) {
      var before = clone(outCars[gi]);
      var snap = {
        cd: before.dragCoefficient, wt: before.weightLbs,
        area: before.frontalAreaSqFt, curve: curveSig(before)
      };
      var beforeSim = runSim(before, true);
      var beforeHits = hitFlags(beforeSim, tgt);

      var remapped = clone(before);
      remapped.txKey = plan.txKey;
      remapped.gearRatios = plan.gears.slice();
      remapped.finalDriveRatio = plan.fd;
      remapped.transmission = plan.transmission || remapped.transmission || 'Auto';
      remapped.txFactoryLabel = ''; // Jorge: name stays blank when unsure / keep blank
      remapped.forceScale = 1;
      remapped.dragCoefficient = snap.cd;
      remapped.weightLbs = snap.wt;
      remapped.frontalAreaSqFt = snap.area;
      remapped.torqueCurve = before.torqueCurve;

      var calib = calibrateLossLaunchTire(remapped, tgt);
      var afterCar = calib.car;
      afterCar.dragCoefficient = snap.cd;
      afterCar.weightLbs = snap.wt;
      afterCar.frontalAreaSqFt = snap.area;
      afterCar.torqueCurve = before.torqueCurve;
      afterCar.forceScale = 1;
      afterCar.transmission = plan.transmission || afterCar.transmission || 'Auto';
      afterCar.txFactoryLabel = '';
      if (curveSig(afterCar) !== snap.curve) throw new Error('CURVE mutated: ' + name);
      if (afterCar.dragCoefficient !== snap.cd) throw new Error('Cd: ' + name);
      if (afterCar.weightLbs !== snap.wt) throw new Error('wt: ' + name);
      if (afterCar.frontalAreaSqFt !== snap.area) throw new Error('area: ' + name);

      outCars[gi] = afterCar;
      var afterSim = runSim(afterCar, true);
      var afterHits = hitFlags(afterSim, tgt);
      var row = {
        name: name, gi: gi, tgt: tgt, source: plan.source || '',
        before: {
          txKey: before.txKey, nG: (before.gearRatios || []).length, fd: before.finalDriveRatio,
          gears: (before.gearRatios || []).slice(),
          transmission: before.transmission, blank: before.txFactoryLabel === '',
          loss: before.drivetrainLossPercent, tire: before.tireType | 0, launch: before.launchRpm,
          sim: {
            et: beforeSim.et != null ? +beforeSim.et.toFixed(3) : null,
            trap: beforeSim.trap != null ? +beforeSim.trap.toFixed(1) : null,
            z60: beforeSim.z60 != null ? +beforeSim.z60.toFixed(3) : null,
            z60130: beforeSim.z60130 != null ? +beforeSim.z60130.toFixed(3) : null
          },
          hits: beforeHits
        },
        after: {
          txKey: afterCar.txKey, nG: (afterCar.gearRatios || []).length, fd: afterCar.finalDriveRatio,
          gears: (afterCar.gearRatios || []).slice(),
          transmission: afterCar.transmission, blank: afterCar.txFactoryLabel === '',
          loss: afterCar.drivetrainLossPercent, tire: afterCar.tireType | 0, launch: afterCar.launchRpm,
          sim: {
            et: afterSim.et != null ? +afterSim.et.toFixed(3) : null,
            trap: afterSim.trap != null ? +afterSim.trap.toFixed(1) : null,
            z60: afterSim.z60 != null ? +afterSim.z60.toFixed(3) : null,
            z60130: afterSim.z60130 != null ? +afterSim.z60130.toFixed(3) : null
          },
          hits: afterHits
        },
        stillMiss: !(afterHits.et && afterHits.trap)
      };
      report.push(row);
      console.log(
        (afterHits.et && afterHits.trap ? 'HIT ' : 'MISS') +
        ' ' + name +
        '  ' + before.txKey + '/' + (before.gearRatios || []).length + '/' + before.finalDriveRatio +
        ' → ' + afterCar.txKey + '/' + (afterCar.gearRatios || []).length + '/' + afterCar.finalDriveRatio +
        '  Excel ' + fmt(tgt.et, 3) + '@' + fmt(tgt.trap, 1) +
        '  sim ' + fmt(afterSim.et, 3) + '@' + fmt(afterSim.trap, 1) +
        '  knobs ' + afterCar.drivetrainLossPercent + '% / T' + afterCar.tireType + ' / L' + afterCar.launchRpm
      );
    });
  });

  // Ensure flagged cars keep blank label; do not invent ratios
  FLAGGED_UNSOURCED.forEach(function (f) {
    outCars.forEach(function (c) {
      if (c.name === f.name) {
        c.txFactoryLabel = '';
        c.forceScale = 1;
      }
    });
  });

  console.log('\nFleet re-sim…');
  var stats = fleetStats(outCars);
  var newResults = [];
  var worstEt = [], worstTrap = [];
  var nameOcc = {}, metaByNameOcc = {};
  meta.results.forEach(function (r) {
    if (!metaByNameOcc[r.name]) metaByNameOcc[r.name] = [];
    metaByNameOcc[r.name].push(r);
  });
  nameOcc = {};
  for (var i = 0; i < outCars.length; i++) {
    var car = outCars[i];
    car.forceScale = 1;
    var occ = nameOcc[car.name] || 0;
    nameOcc[car.name] = occ + 1;
    var oldMeta = (metaByNameOcc[car.name] || [])[occ];
    if (!oldMeta || !oldMeta.tgt) continue;
    var tgt2 = oldMeta.tgt;
    var simR = runSim(car, false);
    var sim2 = {
      et: simR.et != null ? +simR.et.toFixed(3) : null,
      trap: simR.trap != null ? +simR.trap.toFixed(1) : null,
      z60: simR.z60 != null ? +simR.z60.toFixed(3) : null,
      z60130: simR.z60130 != null ? +simR.z60130.toFixed(3) : null,
      vmax: simR.vmax != null ? +simR.vmax.toFixed(1) : null
    };
    var hits2 = hitFlags(simR, tgt2);
    if (tgt2.et != null && !hits2.et) worstEt.push({ name: car.name, tgt: tgt2.et, sim: sim2.et, d: sim2.et != null ? +(sim2.et - tgt2.et).toFixed(3) : null, abs: sim2.et != null ? Math.abs(sim2.et - tgt2.et) : 99 });
    if (tgt2.trap != null && !hits2.trap) worstTrap.push({ name: car.name, tgt: tgt2.trap, sim: sim2.trap, d: sim2.trap != null ? +(sim2.trap - tgt2.trap).toFixed(1) : null, abs: sim2.trap != null ? Math.abs(sim2.trap - tgt2.trap) : 99 });
    newResults.push({
      name: car.name, gi: i, tgt: tgt2, sim: sim2, hits: hits2,
      knobs: { loss: car.drivetrainLossPercent, tire: car.tireType | 0, launch: car.launchRpm },
      txKey: car.txKey, nG: (car.gearRatios || []).length, fd: car.finalDriveRatio,
      blank: car.txFactoryLabel === ''
    });
  }
  worstEt.sort(function (a, b) { return b.abs - a.abs; });
  worstTrap.sort(function (a, b) { return b.abs - a.abs; });

  var fsBad = outCars.filter(function (c) { return +c.forceScale !== 1; });
  if (fsBad.length) throw new Error('forceScale!=1: ' + fsBad.map(function (c) { return c.name; }).join(', '));

  // Integrity: TR6060 leftovers must remain ZL1/Z28/Viper only
  var leftoverTr = outCars.filter(function (c) { return c.txKey === 'TR6060_6'; }).map(function (c) { return c.name; });
  var expectTr = ['2012 Chevrolet Camaro ZL1', '2014 Chevrolet Camaro Z/28', '2013 SRT Viper GTS'];
  leftoverTr.forEach(function (n) {
    if (expectTr.indexOf(n) < 0) throw new Error('Unexpected TR6060: ' + n);
  });
  expectTr.forEach(function (n) {
    if (leftoverTr.indexOf(n) < 0) throw new Error('Missing OEM TR6060: ' + n);
  });

  // Phase heroes intact
  var cyber = outCars.find(function (c) { return c.name === '2024 Tesla Cybertruck Tri-Motor'; });
  if (!cyber || Math.abs(+cyber.finalDriveRatio - 15.02) > 0.01) throw new Error('Phase4 Cybertruck FD broken');
  var zl1 = outCars.find(function (c) { return c.name === '2012 Chevrolet Camaro ZL1'; });
  if (!zl1 || zl1.txKey !== 'TR6060_6') throw new Error('ZL1 TR6060 broken');
  var m5 = outCars.find(function (c) { return c.name === '2012 BMW M5'; });
  if (!m5 || (m5.gearRatios || []).length !== 7 || Math.abs(+m5.finalDriveRatio - 3.15) > 0.01) throw new Error('M5 M-DCT remap broken');
  if (m5.txFactoryLabel !== '') throw new Error('M5 should stay blank-named');

  var blankCount = outCars.filter(function (c) {
    return Object.prototype.hasOwnProperty.call(c, 'txFactoryLabel') &&
      (c.txFactoryLabel == null || c.txFactoryLabel === '');
  }).length;
  var zf8BlankWrong = outCars.filter(function (c) {
    return c.txKey === 'ZF8HP' && c.txFactoryLabel === '' &&
      ['2013 Ram 1500 5.7 Hemi', '2016 Ram 1500 5.7 Hemi', '2011 Audi A7 3.0T'].indexOf(c.name) < 0 &&
      FLAGGED_UNSOURCED.every(function (f) { return f.name !== c.name; });
  });
  // After remap, blanked non-OEM-ZF8 / non-flagged should not remain on ZF8HP
  var stillZf8Blank = outCars.filter(function (c) {
    return c.txKey === 'ZF8HP' && c.txFactoryLabel === '';
  }).map(function (c) { return c.name; });

  writeGarage(outCars);
  fs.writeFileSync(META_PATH, JSON.stringify({
    tip: 'real-tx-phase7b-honest-ratios',
    tol: TOL, stats: stats, changedN: report.length, batchN: report.length,
    baseline: {
      tip: 'real-tx-phase7-blank-unsure',
      et: beforeStats.et, trap: beforeStats.trap, z60: beforeStats.z60,
      z60130: beforeStats.z60130, all4: beforeStats.all4,
      nEt: beforeStats.nEt, nTrap: beforeStats.nTrap, nZ60: beforeStats.nZ60, n60130: beforeStats.n60130
    },
    leftover: { TR6060_6: leftoverTr.length, TR6060_names: leftoverTr, ZF8HP_blank: stillZf8Blank },
    flaggedUnsourced: FLAGGED_UNSOURCED,
    note: 'Phase7b honest ratios/FD: sourced OEM gears+FD on fixable blanked/wrong-family rows; blank labels retained; flagged unsourced left untouched (no invented numbers); knobs loss/tire/launch only; forceScale=1; Cd/wt/curve untouched; credit Jorge Guerra',
    results: newResults,
    worst15Et: worstEt.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    worst15Trap: worstTrap.slice(0, 15).map(function (w) { return { name: w.name, tgt: w.tgt, sim: w.sim, d: w.d }; }),
    batch: report
  }, null, 2));
  fs.writeFileSync(OUT_REPORT, JSON.stringify({
    tip: 'real-tx-phase7b-honest-ratios',
    elapsedMs: Date.now() - t0,
    beforeStats: beforeStats,
    stats: stats,
    ratiosFdFixed: report.length,
    flaggedUnsourced: FLAGGED_UNSOURCED,
    fleetBlankLabels: blankCount,
    leftover: { TR6060_names: leftoverTr, ZF8HP_blank: stillZf8Blank },
    report: report,
    fsBad: fsBad.length
  }, null, 2));

  var hitBoth = report.filter(function (r) { return r.after.hits.et && r.after.hits.trap; }).length;
  var stillMiss = report.filter(function (r) { return r.stillMiss; });
  console.log('\nBatch ET+trap HIT', hitBoth + '/' + report.length, 'still miss', stillMiss.length);
  console.log('AFTER  fleet ET', stats.et + '/' + stats.nEt, 'trap', stats.trap + '/' + stats.nTrap,
    '0-60', stats.z60 + '/' + stats.nZ60, '60-130', stats.z60130 + '/' + stats.n60130, 'all4', stats.all4);
  console.log('Blank labels:', blankCount, '| Flagged unsourced:', FLAGGED_UNSOURCED.length);
  console.log('Leftover TR6060', leftoverTr.join(', '));
  console.log('ZF8 still blank-named:', stillZf8Blank.length, stillZf8Blank.join(' | '));
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  stillMiss.forEach(function (r) {
    console.log('  MISS', r.name,
      'ΔET', r.after.sim.et != null && r.tgt.et != null ? (r.after.sim.et - r.tgt.et).toFixed(3) : '—',
      'Δtrap', r.after.sim.trap != null && r.tgt.trap != null ? (r.after.sim.trap - r.tgt.trap).toFixed(1) : '—');
  });
}

main();
