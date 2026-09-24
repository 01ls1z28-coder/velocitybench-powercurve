/**
 * VelocityBench PowerCurve — calib / source transparency meta (UI).
 * Compact subset of scripts/garage-calib-meta.json + honest-miss list
 * from scripts/recalib-trap-miss-batch22.js. No new physics / metrics.
 * Rebuild: keep in sync when garage-calib-meta tip advances.
 */
'use strict';

var VB_CALIB_META = {
  "tip": "real-tx-phase4-ev-fd",
  "sourcePath": "scripts/garage-calib-meta.json",
  "tol": {
    "z60": 0.25,
    "et": 0.25,
    "trap": 2.5,
    "z60130": 0.75
  },
  "stats": {
    "et": 323,
    "trap": 300,
    "z60": 285,
    "z60130": 72,
    "nEt": 331,
    "nTrap": 331,
    "nZ60": 332,
    "n60130": 76,
    "all4": 249
  },
  "baseline": {
    "tip": "real-tx-phase3-euro-dct@42cae82",
    "et": 324,
    "trap": 301,
    "z60": 284,
    "z60130": 72,
    "all4": 250
  },
  "note": "Real-TX Phase4 EV/oddballs: Tesla_EV_Plaid/Cybertruck FD + Porsche_Taycan_2 + Koenigsegg_KDD; knobs loss/tire/launch only; forceScale=1; Cd/wt/curve untouched; Peak HP wipe + VB_POWERCURVE_GARAGE + launch-tach + P1-P3 intact; NO Merovingian",
  "honestMissCount": 14,
  "honestMissNote": "14 honest-miss cars left untouched (no Cd/wt/curve cheat) \u2014 see VERIFY.md / trap-miss-batch22",
  "honestMissNames": [
    "2007 Lamborghini Murci\u00e9lago LP640",
    "1964 Pontiac GTO",
    "2021 BMW S1000RR",
    "1965 Chevrolet Chevelle SS396",
    "2022 Cadillac Escalade V",
    "2020 Dodge Durango SRT",
    "2021 Range Rover Sport SVR",
    "2007 Audi S6 V10",
    "1972 Oldsmobile 442",
    "2002 Nissan Skyline GT-R R34",
    "2023 Acura TLX Type S",
    "2023 Ford Bronco Raptor",
    "1973 Ford Torino 351",
    "1955 Ford Thunderbird"
  ],
  "caveat": "Compiled estimates toward published Excel track slips \u2014 not lab-certified, not dyno-certified, not track-certified. Local weather, tires, and driver vary.",
  "knobs": "loss / launchRpm / tireType only \u00b7 forceScale = 1"
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VB_CALIB_META;
}
if (typeof window !== "undefined") {
  window.VB_POWERCURVE_CALIB_META = VB_CALIB_META;
} else if (typeof globalThis !== "undefined") {
  globalThis.VB_POWERCURVE_CALIB_META = VB_CALIB_META;
}
