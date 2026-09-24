/**
 * VelocityBench PowerCurve — calib / source transparency meta (UI).
 * Compact subset of scripts/garage-calib-meta.json + honest-miss list
 * from scripts/recalib-trap-miss-batch22.js. No new physics / metrics.
 * Rebuild: keep in sync when garage-calib-meta tip advances.
 */
'use strict';

var VB_CALIB_META = {
  "tip": "real-tx-phase6-euro-supercar-dct",
  "sourcePath": "scripts/garage-calib-meta.json",
  "tol": {
    "z60": 0.25,
    "et": 0.25,
    "trap": 2.5,
    "z60130": 0.75
  },
  "stats": {
    "et": 320,
    "trap": 295,
    "z60": 285,
    "z60130": 71,
    "nEt": 331,
    "nTrap": 331,
    "nZ60": 332,
    "n60130": 76,
    "all4": 248
  },
  "baseline": {
    "tip": "real-tx-phase5-zf8-tr6060@8b47f89",
    "et": 320,
    "trap": 295,
    "z60": 280,
    "z60130": 71,
    "all4": 243
  },
  "note": "Real-TX Phase6 Euro supercar DCT marque split: Ferrari_DCT_7/8 + Ferrari_F1_6 + McLaren_SSG_7 + Lambo_LDF/ISR/EGear + Bugatti_DSG_7 + BMW_M_DCT_7 + GR6; knobs loss/tire/launch only; forceScale=1; Cd/wt/curve untouched; Peak HP wipe + VB_POWERCURVE_GARAGE + launch-tach + P1-P5 intact; NO Merovingian",
  "honestMissCount": 14,
  "honestMissNote": "14 honest-miss cars left untouched (no Cd/wt/curve cheat) — see VERIFY.md / trap-miss-batch22",
  "honestMissNames": [
    "2007 Lamborghini Murciélago LP640",
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
  "caveat": "Compiled estimates toward published Excel track slips — not lab-certified, not dyno-certified, not track-certified. Local weather, tires, and driver vary.",
  "knobs": "loss / launchRpm / tireType only · forceScale = 1"
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = VB_CALIB_META;
}
if (typeof window !== "undefined") {
  window.VB_POWERCURVE_CALIB_META = VB_CALIB_META;
} else if (typeof globalThis !== "undefined") {
  globalThis.VB_POWERCURVE_CALIB_META = VB_CALIB_META;
}
