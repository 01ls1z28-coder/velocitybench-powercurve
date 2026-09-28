/**
 * Jorge rule follow-up (Phase 7 blank-unsure):
 * If we do NOT know exactly what transmission a car has, leave the display
 * name blank — do not guess Tremec/ZF/Aisin labels. Keep gearRatios +
 * finalDriveRatio (+ txKey for ratio provenance) so the sim stays accurate.
 *
 *   node scripts/blank-unsure-tx-names.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var GARAGE = require('../js/garage-data.js');
var OUT_JS = path.join(__dirname, '..', 'js', 'garage-data.js');
var OUT_REPORT = path.join(__dirname, 'real-tx-phase7-blank-unsure-report.json');

/**
 * Cars whose OEM box identity is low-confidence / speculative filler.
 * Ratios+FD stay; txFactoryLabel forced to '' so UI shows blank.
 */
var BLANK_NAMES = new Set([
  // Phase 7 filler marque manuals (generic Honda_5MT covering many distinct boxes)
  '1997 Honda Civic Type R EK9',
  '1998 Honda Prelude Type SH',
  '1999 Honda Prelude SH',
  '2003 Acura RSX Type-S',
  '2006 Honda Accord Euro R',
  '1993 Honda Accord SiR',
  '1996 Honda Integra SiR',

  // Subaru_6MT (STI) misapplied: 22B is 5MT; WRX Wagon 5MT; Spec.B not STI set
  '1999 Subaru Impreza 22B STI',
  '2002 Subaru WRX Wagon',
  '2008 Subaru Legacy GT Spec.B',

  // Mitsubishi_5MT (Evo VIII) misapplied to Eclipse
  '2005 Mitsubishi Eclipse GT',
  '2001 Mitsubishi Eclipse GSX',
  '1995 Mitsubishi Eclipse GSX',

  // Nissan_FS5W71_5 labeled Skyline — S-chassis / Z / Pulsar use related-but-distinct boxes
  '1991 Nissan 240SX (S13)',
  '1995 Nissan Silvia S14',
  '1994 Nissan 180SX Type X',
  '1990 Nissan 300ZX NA',
  '1992 Nissan Pulsar GTI-R',

  // Mazda_6MT (RX-8) misapplied to MazdaSpeed
  '2007 MazdaSpeed3',
  '2011 MazdaSpeed6',

  // Toyota_W58 (Supra/MR2) speculative on Celica GT-Four / Soarer / Chaser
  '1998 Toyota Celica GT-Four',
  '1991 Toyota Soarer GT-T',
  '1997 Toyota Chaser Tourer V',

  // Classic Ford autos before the named box existed
  '1960 Ford Galaxie 352',   // pre-C6 (Cruise-O-Matic era)
  '1955 Ford Thunderbird',   // pre-C4 (Fordomatic era)

  // Ford 6R80 before F-150 adoption (~2009+)
  '2008 Ford F-150 Harley-Davidson',
  '2007 Ford F-150 4.6 Triton',

  // ----- Leftover ZF8HP best-guess filler (exotics / trucks / older Tiptronic) -----
  // Exotics — not ZF 8HP
  '2015 Koenigsegg One:1',
  '2019 Koenigsegg Jesko',
  '2011 Koenigsegg Agera R',
  '2014 Koenigsegg Agera S',
  '2010 Pagani Zonda R',
  '2012 Pagani Huayra',
  '2017 Pagani Huayra BC',
  '2019 Pagani Huayra Roadster BC',
  '2010 Gumpert Apollo Sport',
  '2014 Hennessey Venom GT',
  '2018 Zenvo TSR-S',
  '2004 Maserati MC12',

  // Euro Tiptronic / AMT eras wrongly on ZF8 filler
  '2012 Audi R8 V10',
  '2007 Porsche 911 Turbo',
  '2002 Porsche 911 Turbo (996)',
  '2008 Aston Martin DBS',
  '2015 Aston Martin V12 Vantage S',
  '2008 Audi S5',
  '2007 Audi S6 V10',
  '2009 Mercedes CLS550',
  '2006 Mercedes CLK55 AMG',
  '2005 Mercedes E55 AMG',
  '2012 BMW M5',              // F10 = M DCT 7, not ZF8
  '2011 Audi A7 3.0T',        // early may be 8HP but kept blank-leaning with Tiptronic cohort

  // Compact / crossover / truck autos that are NOT ZF 8HP
  '2012 Scion tC',
  '2019 Ford F-250 6.7 PowerStroke',
  '2021 Toyota Tundra',
  '2016 Ram 1500 5.7 Hemi',
  '2014 Toyota Tacoma V6',
  '2013 Ram 1500 5.7 Hemi',
  '2010 Toyota Tundra 5.7',
  '2010 Nissan Titan 5.6',
  '2013 Toyota Sequoia 5.7',
  '2011 Toyota Tacoma 4.0 V6',
  '2015 Nissan Frontier 4.0',
  '2005 Ford F-250 V10',
  '2007 Toyota Tundra 4.7',
  '2012 Nissan Titan Pro-4X',
  '2013 Ford Expedition 5.4',
  '2014 Jeep Wrangler Rubicon',
  '2009 Toyota 4Runner V8',
  '2011 Jeep Liberty 3.7',
  '2008 Toyota Highlander V6',
  '2009 Honda Pilot',
  '2010 Jeep Commander 5.7',

  // Modern but wrong family still on ZF8 filler
  '2023 Ford Bronco Raptor',  // 10R60, not ZF8
  '2023 Acura TLX Type S'     // 10AT, not ZF8
]);

/**
 * High-confidence named OEM — leave FactoryTransmissions name visible.
 * (Documented in VERIFY; not mutated here.)
 */
var KEEP_NAMED_SPOTS = [
  // Jorge examples
  '2004 Pontiac GTO',
  '2003 Ford Mustang Cobra (Terminator)',
  '2012 Chevrolet Camaro ZL1',
  '2014 Chevrolet Camaro Z/28',
  '2013 SRT Viper GTS',
  '1984 Chevrolet Corvette C4',
  '1985 Chevrolet Camaro IROC-Z',
  '1996 Chevrolet Impala SS',
  '2011 Ford Mustang GT 5.0',
  // Phase 7 high-conf remaps (sample)
  '1993 Chevrolet Camaro Z28',
  '2002 Chevrolet Camaro SS',
  '2016 Ford Mustang GT350R',
  '2018 Honda Civic Type R',
  '2005 Nissan 350Z',
  '2003 BMW M3 E46',
  '2004 Porsche Carrera GT',
  '2020 Subaru WRX STI',
  '2003 Mitsubishi Lancer Evolution VIII',
  '2020 Dodge Challenger Hellcat',
  '2021 BMW M5 Competition',
  '2023 Toyota GR Supra 3.0'
];

function header() {
  return [
    '/**',
    ' * VelocityBench PowerCurve — baked garage (Phase 7 blank-unsure Jorge rule).',
    ' * Motorcycle tip: published-leaning redline/shift/gears/powerband (Bike_Sport_6 / Bike_Hyper_6).',
    ' * EV tip: speedLimiterMph + EV_Single / Tesla / Taycan / KDD presets.',
    ' * Real-TX Phase 7: OEM boxes; blank-unsure: txFactoryLabel:\'\' when OEM name unknown.',
    ' * Do not edit by hand — regenerate via scripts/blank-unsure-tx-names.js / recalib tips.',
    ' */',
    "'use strict';",
    'var GARAGE = '
  ].join('\n');
}

function footer() {
  return [
    ';',
    'if (typeof module !== "undefined" && module.exports) {',
    '  module.exports = GARAGE;',
    '} else if (typeof window !== "undefined") {',
    '  window.VB_POWERCURVE_GARAGE = GARAGE;',
    '} else if (typeof globalThis !== "undefined") {',
    '  globalThis.VB_POWERCURVE_GARAGE = GARAGE;',
    '}',
    ''
  ].join('\n');
}

var blanked = [];
var keptNamed = [];
var already = 0;
var missingBlank = [];

GARAGE.forEach(function (car, i) {
  if (BLANK_NAMES.has(car.name)) {
    var before = {
      txKey: car.txKey,
      nG: (car.gearRatios || []).length,
      fd: car.finalDriveRatio,
      hadLabel: Object.prototype.hasOwnProperty.call(car, 'txFactoryLabel') ? car.txFactoryLabel : undefined
    };
    // Force blank display name; keep txKey + ratios + FD
    car.txFactoryLabel = '';
    if (!car.gearRatios || !car.gearRatios.length) {
      throw new Error('missing gearRatios on blank candidate: ' + car.name);
    }
    if (!(car.finalDriveRatio > 0)) {
      throw new Error('missing finalDriveRatio on blank candidate: ' + car.name);
    }
    blanked.push({
      gi: i,
      name: car.name,
      txKey: car.txKey,
      nG: car.gearRatios.length,
      fd: car.finalDriveRatio,
      transmission: car.transmission,
      before: before
    });
  }
});

// Verify every BLANK_NAMES entry was found (allow dup names)
BLANK_NAMES.forEach(function (n) {
  if (!GARAGE.some(function (c) { return c.name === n; })) missingBlank.push(n);
});

KEEP_NAMED_SPOTS.forEach(function (n) {
  var cars = GARAGE.filter(function (c) { return c.name === n; });
  cars.forEach(function (c) {
    var blank = Object.prototype.hasOwnProperty.call(c, 'txFactoryLabel') &&
      (c.txFactoryLabel == null || c.txFactoryLabel === '');
    keptNamed.push({
      name: c.name,
      txKey: c.txKey,
      nG: (c.gearRatios || []).length,
      fd: c.finalDriveRatio,
      blanked: blank
    });
  });
});

var namedCount = GARAGE.filter(function (c) {
  return !Object.prototype.hasOwnProperty.call(c, 'txFactoryLabel') ||
    (c.txFactoryLabel != null && c.txFactoryLabel !== '');
}).length;
var blankCount = GARAGE.filter(function (c) {
  return Object.prototype.hasOwnProperty.call(c, 'txFactoryLabel') &&
    (c.txFactoryLabel == null || c.txFactoryLabel === '');
}).length;

var report = {
  tip: 'real-tx-phase7-blank-unsure',
  blankRequested: BLANK_NAMES.size,
  blankAppliedRows: blanked.length,
  blankUniqueNames: new Set(blanked.map(function (b) { return b.name; })).size,
  missingBlankRequests: missingBlank,
  fleetBlankLabels: blankCount,
  fleetNamedLabels: namedCount,
  fleetTotal: GARAGE.length,
  forceScaleAll1: GARAGE.every(function (c) { return +c.forceScale === 1; }),
  blanked: blanked,
  keepNamedSpots: keptNamed
};

fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 2));
fs.writeFileSync(OUT_JS, header() + JSON.stringify(GARAGE, null, 2) + footer());

console.log('Blanked rows:', blanked.length, '/ requested names:', BLANK_NAMES.size);
console.log('Missing:', missingBlank.length ? missingBlank.join(', ') : '(none)');
console.log('Fleet blank labels:', blankCount, '| named:', namedCount, '| total:', GARAGE.length);
console.log('forceScale=1 all:', report.forceScaleAll1);
console.log('Wrote', OUT_JS);
console.log('Wrote', OUT_REPORT);
