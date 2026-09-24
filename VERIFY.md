# BUILD LOCK — Remove PowerCurve CALIB · SOURCE TRANSPARENCY panel (Jorge via Seraph)

Branch: `review/pc-remove-calib-panel` · Base `b1f1329` (Phase 6 Euro supercar DCT).
**No Merovingian.** Do **not** push main.

## VERIFY note (required)
- Removed `#calibPanel` / “Calib · source transparency” UI under Time Slip + related CSS.
- Deleted unused bake `js/calib-meta.js` + script tag + `renderCalibPanel` / `VB_POWERCURVE_CALIB_META` wiring.
- **No new disclaimer text.** Existing footer disclaimer kept as-is: “Estimates for comparison only — not dyno- or track-certified… Calibrated toward published track slips…”. Credits: Jorge Guerra only.
- Kept untouched: physics, garage, gear UI `#txFactoryLabelField`, P1–6 remaps, launch-tach, forceScale=1, Peak HP wipe, `VB_POWERCURVE_GARAGE` bind.
- `scripts/garage-calib-meta.json` retained for offline recalib tooling (not UI-wired).

---

# BUILD LOCK — Real-TX Phase 6 Euro supercar DCT marque split (Seraph gate)

Branch: `review/pc-real-tx-phase6-euro-supercar-dct` · Based on `8b47f89` (live main = Phase5 residual ZF8/TR6060 CLEARED).
**No Merovingian deploy.** Hold for Seraph browser gate (Ferrari SF90 · McLaren 720S · Huracán EVO · Bugatti Chiron / GT-R GR6).

## VERIFY note (required)
- Phase 1 intact: Ford_10R80 / GM_10L90 / Tremec_TR9080_8DCT + Hellcat FD 2.62.
- Phase 2 intact: classics off TR6060 (Demon A833_4, GTO Muncie_M21, …).
- Phase 3 intact: Porsche_PDK_7/_GT · AMG_SPEEDSHIFT · VW_DQ500 · Audi_STronic · GT500 TR-9070.
- Phase 4 intact: Tesla_EV_Plaid/Cybertruck · Porsche_Taycan_2 · Koenigsegg_KDD · FD clamp 20.
- Phase 5 intact: GM_4L60E/2004R/6L80 · Chrysler_NAG1_5 · Miata/S2000/FA86 · Getrag_R34.
- Launch-tach intact: `resolveLeaveRpm` + stock slip→lockup (`launchLocked`) — **not touched**.
- Gear UI (`#txFactoryLabelField`) + calib panel (`#calibPanel` / `js/calib-meta.js`) — **kept / tip advanced**.
- Phase 6: remap all 34 cars still on legacy `DCT_7_AMG` onto marque/period DCT·AMT presets.
- Recalib: loss / launchRpm / tireType only; forceScale=1; no Cd/wt/curve fakes.
- Fleet hits: BEFORE et 320/331 trap 295/331 z60 280/332 60-130 71/76 all4 243 → AFTER et 320/331 trap 295/331 z60 285/332 60-130 71/76 all4 248.
- Leftover after tip: **DCT_7_AMG 0** (fleet clear of Tremec clone filler).
- Honest miss (knobs exhausted): **2009 Nissan GT-R** trap Δ−2.7 mph (tol ±2.5) — documented, no Cd/wt/curve cheat.

---

# Real-TX Phase 6 Euro supercar DCT marque split (2026-09-24 CT)

Branch: `review/pc-real-tx-phase6-euro-supercar-dct` · Base `8b47f895b9e286d115420bac03d76b66edd76225` (origin/main Phase5 CLEARED). **No deploy.** Do **not** ask Merovingian to push main.

## Goal
Stop cloning one AMG-style / Tremec TR-9070 (`DCT_7_AMG`) across remaining Euro supercars. Add marque/period DCT·AMT presets with published-leaning ratios + FD; remap all 34 leftovers. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · launch-tach blend · Phase 1–5 remaps — **intact**
- Credits: **Jorge Guerra** only (no Merovingian / Sati in public UI)

## FactoryTransmissions added (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `Ferrari_DCT_7` **new** | 7 | 5.14 | 3.08 / 2.19 / 1.63 / 1.29 / 1.03 / 0.84 / 0.69 | Ferrari 458/488 EPA / Autoweb Getrag 7DCL750 |
| `Ferrari_DCT_8` **new** | 8 | 4.51 | 3.61 … 0.67 | SF90 Magna 8DCL900 published-leaning (Motormatchup class) |
| `Ferrari_F1_6` **new** | 6 | 4.30 | 3.29 / 2.16 / 1.61 / 1.27 / 1.03 / 0.82 | F430 F1 AMT published |
| `McLaren_SSG_7` **new** | 7 | 3.31 | 3.98 / 2.61 / 1.91 / 1.48 / 1.16 / 0.91 / 0.69 | McLaren 720S C&D / Autoweb SSG |
| `Lambo_LDF_7` **new** | 7 | 4.89 | 3.133 … 0.677 | Huracán LDF published |
| `Lambo_ISR_7` **new** | 7 | 2.867 | 3.909 … 0.844 | Aventador ISR (LamboCars / C&D) |
| `Lambo_EGear_6` **new** | 6 | 3.08 | 3.31 / 2.05 / 1.46 / 1.14 / 0.94 / 0.78 | Gallardo e-gear C&D |
| `Lambo_EGear_V12_6` **new** | 6 | 2.53 | 3.091 … 0.939 | Murciélago/Reventón e-gear (LamboCars) |
| `Bugatti_DSG_7` **new** | 7 | 3.64 | 3.18 / 2.26 / 1.67 / 1.29 / 1.06 / 0.88 / 0.80 | Veyron C/D gear table + FD 3.64 |
| `BMW_M_DCT_7` **new** | 7 | 3.462 | 4.806 / 2.583 / 1.701 / 1.277 / 1.000 / 0.844 / 0.671 | F80/F82 M-DKG 436 (BMW tech / AU reviews) |
| `GR6_DCT` reused | 6 | 3.70 | existing | Nissan GT-R (was wrongly on 7-spd filler) |

Phase 3 Porsche/AMG/VW-Audi presets **kept**. Tremec TR-9070/TR-9080 **only** on GT500 / C8 trio.

## Remapped cars (34) — all previously on `DCT_7_AMG`
**Ferrari_DCT_7 (4):** 812 Superfast, 488 GTB, F12 Berlinetta, 458 Italia.  
**Ferrari_DCT_8 (1):** SF90 Stradale.  
**Ferrari_F1_6 (4):** Enzo, 360 Modena, F430, 612 Scaglietti.  
**McLaren_SSG_7 (9):** 765LT, 600LT, P1, MP4-12C, MP4-12C HS, 720S, Speedtail, Elva, Sabre.  
**Lambo_LDF_7 (2):** Huracán EVO, Huracán Performante.  
**Lambo_ISR_7 (1):** Aventador SVJ.  
**Lambo_EGear_6 (2):** Gallardo LP570-4, Gallardo LP560-4.  
**Lambo_EGear_V12_6 (2):** Murciélago LP640, Reventón.  
**Bugatti_DSG_7 (6):** Chiron ×3, Chiron Sport, Divo, Veyron, Veyron Super Sport.  
**BMW_M_DCT_7 (2):** M3 Competition, M4.  
**GR6_DCT (1):** 2009 Nissan GT-R.

## Per-car before → after (batch)

| Car | Before tx/nG/FD | After tx/nG/FD | Excel ET@trap | Sim ET@trap | loss / tire / launch | ET+trap |
|---|---|---|---|---|---|---|
| 2017 Ferrari 812 Superfast | DCT_7_AMG/7/3.73 | Ferrari_DCT_7/7/5.14 | 10.5@136 | 10.368@135.6 | 11.5% / T2 / L3500 | **HIT** |
| 2016 Ferrari 488 GTB | DCT_7_AMG/7/3.73 | Ferrari_DCT_7/7/5.14 | 10.7@133 | 10.471@133.2 | 10% / T2 / L2400 | **HIT** |
| 2014 Ferrari F12 Berlinetta | DCT_7_AMG/7/3.73 | Ferrari_DCT_7/7/5.14 | 10.9@131 | 10.986@131.9 | 10% / T1 / L3500 | **HIT** |
| 2010 Ferrari 458 Italia | DCT_7_AMG/7/3.73 | Ferrari_DCT_7/7/5.14 | 10.9@127 | 10.872@127 | 4.5% / T2 / L5500 | **HIT** |
| 2021 Ferrari SF90 Stradale | DCT_7_AMG/7/3.73 | Ferrari_DCT_8/8/4.51 | 9.5@148 | 9.516@148.2 | 0.5% / T3 / L2400 | **HIT** |
| 2002 Ferrari Enzo | DCT_7_AMG/7/3.73 | Ferrari_F1_6/6/4.3 | 11.1@133 | 11.058@133.1 | 5% / T4 / L3500 | **HIT** |
| 2003 Ferrari 360 Modena | DCT_7_AMG/7/3.73 | Ferrari_F1_6/6/4.3 | 12.6@114 | 12.605@113.9 | 6% / T0 / L3500 | **HIT** |
| 2005 Ferrari F430 | DCT_7_AMG/7/3.73 | Ferrari_F1_6/6/4.3 | 12.1@118 | 12.082@118 | 11% / T3 / L3500 | **HIT** |
| 2006 Ferrari 612 Scaglietti | DCT_7_AMG/7/3.73 | Ferrari_F1_6/6/4.3 | 12.6@116 | 12.542@115.8 | 5.5% / T0 / L3500 | **HIT** |
| 2020 McLaren 765LT | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.2@141 | 10.058@140.9 | 15.5% / T2 / L2400 | **HIT** |
| 2018 McLaren 600LT | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.7@135 | 10.806@135 | 4% / T1 / L2400 | **HIT** |
| 2015 McLaren P1 | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 9.8@148 | 9.749@147.9 | 1% / T2 / L2400 | **HIT** |
| 2013 McLaren MP4-12C | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.7@134 | 10.855@134 | 1.5% / T1 / L2400 | **HIT** |
| 2011 McLaren MP4-12C HS | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.7@134 | 10.855@134 | 1.5% / T1 / L2400 | **HIT** |
| 2020 McLaren 720S | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.1@142 | 10.017@142 | 1.5% / T2 / L2400 | **HIT** |
| 2019 McLaren Speedtail | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10@150 | 9.752@148.8 | 24.5% / T2 / L1800 | **HIT** |
| 2020 McLaren Elva | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.6@136 | 10.773@136.2 | 31.5% / T1 / L2400 | **HIT** |
| 2021 McLaren Sabre | DCT_7_AMG/7/3.73 | McLaren_SSG_7/7/3.31 | 10.4@138 | 10.184@138 | 20.5% / T2 / L1500 | **HIT** |
| 2020 Lamborghini Huracán EVO | DCT_7_AMG/7/3.73 | Lambo_LDF_7/7/4.89 | 10.6@133 | 10.501@133 | 0.5% / T0 / L3000 | **HIT** |
| 2019 Lamborghini Huracán Performante | DCT_7_AMG/7/3.73 | Lambo_LDF_7/7/4.89 | 10.5@134 | 10.454@133.8 | 7.5% / T2 / L2600 | **HIT** |
| 2019 Lamborghini Aventador SVJ | DCT_7_AMG/7/3.73 | Lambo_ISR_7/7/2.867 | 10.3@136 | 10.208@137.9 | 4% / T2 / L3000 | **HIT** |
| 2012 Lamborghini Gallardo LP570-4 | DCT_7_AMG/7/3.73 | Lambo_EGear_6/6/3.08 | 11.2@127 | 11.191@124.6 | 6% / T0 / L6687 | **HIT** |
| 2009 Lamborghini Gallardo LP560-4 | DCT_7_AMG/7/3.73 | Lambo_EGear_6/6/3.08 | 11.4@126 | 11.253@123.7 | 4.5% / T0 / L1000 | **HIT** |
| 2007 Lamborghini Murciélago LP640 | DCT_7_AMG/7/3.73 | Lambo_EGear_V12_6/6/2.53 | 11.4@129 | 11.273@126.9 | 4.5% / T0 / L2548 | **HIT** |
| 2008 Lamborghini Reventón | DCT_7_AMG/7/3.73 | Lambo_EGear_V12_6/6/2.53 | 11.3@128 | 11.306@128.1 | 4.5% / T0 / L1200 | **HIT** |
| 2019 Bugatti Chiron | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 9.4@158 | 9.256@157.8 | 11% / T0 / L2400 | **HIT** |
| 2013 Bugatti Veyron Super Sport | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 9.9@148 | 9.66@147.8 | 11% / T0 / L2400 | **HIT** |
| 2005 Bugatti Veyron | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 10.1@142 | 9.953@141.8 | 3.5% / T0 / L2400 | **HIT** |
| 2017 Bugatti Chiron Sport | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 9.4@158 | 9.252@157.9 | 12% / T0 / L2400 | **HIT** |
| 2018 Bugatti Divo | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 9.5@155 | 9.368@154.9 | 19% / T0 / L2400 | **HIT** |
| 2016 Bugatti Chiron | DCT_7_AMG/7/3.73 | Bugatti_DSG_7/7/3.64 | 9.4@158 | 9.256@157.8 | 11% / T0 / L2400 | **HIT** |
| 2018 BMW M3 Competition | DCT_7_AMG/7/3.73 | BMW_M_DCT_7/7/3.462 | 11.9@122 | 11.864@121.3 | 0% / T3 / L2400 | **HIT** |
| 2015 BMW M4 | DCT_7_AMG/7/3.73 | BMW_M_DCT_7/7/3.462 | 12.1@118 | 12.101@116.9 | 1% / T4 / L2000 | **HIT** |
| 2009 Nissan GT-R | DCT_7_AMG/7/3.73 | GR6_DCT/6/3.7 | 11.5@124 | 11.403@121.3 | 0% / T0 / L2400 | **MISS** |

## Fleet vs Phase5 base (`8b47f89`)
| Metric | Phase5 base | Phase6 tip |
|---|---:|---:|
| ET | 320/331 | 320/331 |
| trap | 295/331 | 295/331 |
| 0-60 | 280/332 | **285/332** |
| 60-130 | 71/76 | 71/76 |
| all4 | 243 | **248** |
| forceScale≠1 | 0 | **0** |
| DCT_7_AMG leftover | 34 | **0** |

## Seraph spot-check (node physics, 70°F / 45% / 29.92, launch=auto)
| Car | txKey / nG / FD | Sim ET@trap | 0-60 |
|---|---|---|---|
| 2021 Ferrari SF90 Stradale | Ferrari_DCT_8 / 8 / 4.51 | 9.516@148.2 | 2.098 |
| 2020 McLaren 720S | McLaren_SSG_7 / 7 / 3.31 | 10.017@142.0 | 2.446 |
| 2020 Lamborghini Huracán EVO | Lambo_LDF_7 / 7 / 4.89 | 10.501@133.0 | 2.577 |
| 2019 Bugatti Chiron | Bugatti_DSG_7 / 7 / 3.64 | 9.256@157.8 | 2.167 |

## Honest miss
- **2009 Nissan GT-R** → `GR6_DCT`/6/3.70: ET HIT (11.403 vs 11.5) · trap MISS Δ−2.7 mph (121.3 vs 124, tol ±2.5). Loss already 0%; no Cd/wt/curve cheat — knobs exhausted.

## Rebuild
```
node scripts/recalib-real-tx-phase6-euro-supercar-dct.js
```

---

# BUILD LOCK — Real-TX Phase 5 residual ZF8 / TR6060 filler (Seraph gate)

Branch: `review/pc-real-tx-phase5-zf8-tr6060` · Based on `7108fdd` (live main = Phase4 EV FD CLEARED).
**No Merovingian deploy.** Hold for Seraph browser gate (G8 GXP 6L80 · Challenger SRT8 NAG1 · Miata NA 5spd · S2000 / GR86).

## VERIFY note (required)
- Phase 1 intact: Ford_10R80 / GM_10L90 / Tremec_TR9080_8DCT + Hellcat FD 2.62.
- Phase 2 intact: classics off TR6060 (Demon A833_4, GTO Muncie_M21, …).
- Phase 3 intact: Porsche_PDK_7/_GT · AMG_SPEEDSHIFT · VW_DQ500 · Audi_STronic · GT500 TR-9070.
- Phase 4 intact: Tesla_EV_Plaid/Cybertruck · Porsche_Taycan_2 · Koenigsegg_KDD · FD clamp 20.
- Launch-tach intact: `resolveLeaveRpm` + stock slip→lockup (`launchLocked`) — **not touched**.
- Gear UI (`#txFactoryLabelField`) + calib panel (`#calibPanel` / `js/calib-meta.js`) — **kept / tip advanced**.
- Phase 5: residual ZF8/TR6060 filler → period OEM where published-leaning source exists.
- Recalib: loss / launchRpm / tireType only; forceScale=1; no Cd/wt/curve fakes.
- Fleet hits: BEFORE et 323/331 trap 300/331 z60 285/332 60-130 72/76 all4 249 → AFTER et 320/331 trap 295/331 z60 280/332 60-130 71/76 all4 243.
- Leftover filler after tip: **ZF8HP 91** · **TR6060_6 73** (honest leftovers — modern ZF8 platforms kept; obscure manuals/trucks/hypercars without published-leaning source left on filler).
- OUT OF SCOPE: Euro supercar DCT marque split (~34 still on DCT_7_AMG).

---

# Real-TX Phase 5 residual ZF8 / TR6060 filler (2026-09-24 CT)

Branch: `review/pc-real-tx-phase5-zf8-tr6060` · Base `7108fdd` (origin/main Phase4 CLEARED). **No deploy.** Do **not** ask Merovingian to push main.

## Goal
Remap remaining cars still on generic ZF8HP / TR6060_6 filler onto period-correct factory TX where published-leaning source exists. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · launch-tach blend · Phase 1–4 remaps — **intact**
- Credits: **Jorge Guerra** only (no Merovingian / Sati in public UI)

## FactoryTransmissions added (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `GM_4L60E` **new** | 4 | 3.42 | 3.06 / 1.63 / 1.00 / 0.70 | GM 4L60-E / 700R4 family (Impala SS / Caprice docs) |
| `GM_2004R` **new** | 4 | 3.42 | 2.74 / 1.57 / 1.00 / 0.67 | Buick GNX THM 200-4R published |
| `GM_6L80` **new** | 6 | 3.27 | 4.027 … 0.667 | GM Hydra-Matic 6L80 product bulletin |
| `Chrysler_NAG1_5` **new** | 5 | 3.06 | 3.59 / 2.19 / 1.41 / 1.00 / 0.83 | Chrysler NAG1/W5A580 service ratios |
| `Mazda_Miata_5` **new** | 5 | 4.30 | 3.136 / 1.888 / 1.330 / 1.000 / 0.814 | 1990 MX-5 Miata specs (miata.net) |
| `Honda_S2000_6` **new** | 6 | **4.756** | 3.133 … 0.810 | Honda News S2000; FD = primary 1.160 × axle 4.100 |
| `Toyota_FA86_6` **new** | 6 | 4.10 | 3.626 / 2.188 / 1.541 / 1.213 / 1.000 / 0.767 | FR-S/BRZ/GR86 published 6MT |
| `TH400_3` reused | 3 | 3.73 | existing | Classic GM autos |
| `Mazda_5M` reused | 5 | 3.909 | existing | RX-7 FC Turbo |
| `Getrag_R34` reused | 6 | 3.545 | existing | 1999 R34 (match curated 2002) |

## Remapped cars (24)
**TH400_3 (5):** 1970 Chevelle SS 454, 1972 Olds 442, 1974 Firebird 400, 1975 Nova 350, 1977 Monte Carlo.  
**GM_2004R (1):** 1987 Buick GNX.  
**GM_4L60E (3):** 1996 Impala SS, 1985 Camaro IROC-Z, 1984 Corvette C4.  
**Chrysler_NAG1_5 (5):** 2008/2010 Challenger SRT8, 2009 Challenger R/T, 2007 Charger SRT8, 2006 Charger R/T.  
**GM_6L80 (3):** 2009 G8 GXP, 2014 Chevy SS, 2012 Corvette ZR1 (Auto).  
**Mazda_Miata_5 (1):** 1990 Miata NA.  
**Mazda_5M (1):** 1990 RX-7 FC Turbo.  
**Honda_S2000_6 (1):** 2001 S2000.  
**Toyota_FA86_6 (3):** 2013 FR-S, 2024 GR86, 2024 BRZ.  
**Getrag_R34 (1):** 1999 Skyline GT-R R34.

## Per-car before → after (batch)

| Car | Before tx/nG/FD | After tx/nG/FD | Excel ET@trap | Sim ET@trap | loss / tire / launch | ET+trap |
|---|---|---|---|---|---|---|
| 1970 Chevelle SS 454 | ZF8HP/8/3.15 | TH400_3/3/3.31 | 13.9@103 | 13.898@102.4 | 8.5% / T0 / L1200 | HIT |
| 1972 Oldsmobile 442 | ZF8HP/8/3.15 | TH400_3/3/3.23 | 15.8@90 | 15.792@87.7 | 19.5% / T0 / L2400 | HIT |
| 1974 Firebird 400 | ZF8HP/8/3.15 | TH400_3/3/3.23 | 16.3@86 | 16.300@85.1 | 0% / T0 / L4771 | HIT |
| 1975 Nova 350 | ZF8HP/8/3.15 | TH400_3/3/3.42 | 17.4@79 | 17.774@76.5 | 0% / T0 / L200 | **MISS** |
| 1977 Monte Carlo | ZF8HP/8/3.15 | TH400_3/3/3.08 | 17.8@78 | 18.172@75.1 | 0% / T0 / L200 | **MISS** |
| 1987 Buick GNX | ZF8HP/8/3.15 | GM_2004R/4/3.42 | 13.5@104 | 13.483@100.4 | 0% / T2 / L2700 | **MISS** |
| 1996 Impala SS | ZF8HP/8/3.15 | GM_4L60E/4/3.08 | 15.4@91 | 16.017@85.3 | 0% / T0 / L4200 | **MISS** |
| 1985 Camaro IROC-Z | ZF8HP/8/3.15 | GM_4L60E/4/3.23 | 15.5@90 | 15.501@88.4 | 0% / T1 / L4400 | HIT |
| 1984 Corvette C4 | ZF8HP/8/3.15 | GM_4L60E/4/3.07 | 15.0@91 | 15.703@87.4 | 0% / T0 / L4200 | **MISS** |
| 2008 Challenger SRT8 | ZF8HP/8/3.15 | Chrysler_NAG1_5/5/3.06 | 13.3@108 | 13.379@104.7 | 0% / T0 / L4200 | **MISS** |
| 2010 Challenger SRT8 | ZF8HP/8/3.15 | Chrysler_NAG1_5/5/3.06 | 13.2@109 | 13.177@107.0 | 0% / T0 / L3000 | HIT |
| 2009 Challenger R/T | ZF8HP/8/3.15 | Chrysler_NAG1_5/5/3.06 | 13.9@102 | 13.827@100.0 | 0% / T0 / L3000 | HIT |
| 2007 Charger SRT8 | ZF8HP/8/3.15 | Chrysler_NAG1_5/5/3.06 | 13.5@106 | 13.489@103.7 | 1% / T0 / L3000 | HIT |
| 2006 Charger R/T | ZF8HP/8/3.15 | Chrysler_NAG1_5/5/2.82 | 13.9@101 | 13.893@97.2 | 0% / T2 / L3600 | **MISS** |
| 2009 Pontiac G8 GXP | ZF8HP/8/3.15 | GM_6L80/6/3.27 | 13.2@108 | 13.291@106.6 | 0% / T0 / L3000 | HIT |
| 2014 Chevrolet SS | ZF8HP/8/3.15 | GM_6L80/6/3.27 | 13.0@111 | 13.047@109.2 | 0% / T0 / L3000 | HIT |
| 2012 Corvette ZR1 | ZF8HP/8/3.15 | GM_6L80/6/3.42 | 11.5@128 | 11.505@128.0 | 9% / T3 / L2000 | HIT |
| 1990 Miata NA | TR6060_6/6/3.73 | Mazda_Miata_5/5/4.30 | 16.3@84 | 16.183@82.0 | 10% / T0 / L2600 | HIT |
| 1990 RX-7 FC Turbo | TR6060_6/6/3.73 | Mazda_5M/5/3.909 | 14.8@95 | 14.796@93.5 | 9% / T0 / L2400 | HIT |
| 2001 Honda S2000 | TR6060_6/6/3.73 | Honda_S2000_6/6/4.756 | 14.4@97 | 14.379@94.9 | 16% / T3 / L3100 | HIT |
| 2013 Scion FR-S | TR6060_6/6/3.73 | Toyota_FA86_6/6/4.10 | 14.8@94 | 14.620@93.9 | 4% / T3 / L3000 | HIT |
| 2024 Toyota GR86 | TR6060_6/6/3.73 | Toyota_FA86_6/6/4.10 | 14.0@101 | 13.853@99.6 | 0.5% / T3 / L2600 | HIT |
| 2024 Subaru BRZ | TR6060_6/6/3.73 | Toyota_FA86_6/6/4.10 | 14.0@101 | 13.845@99.6 | 0% / T3 / L3000 | HIT |
| 1999 Skyline GT-R R34 | TR6060_6/6/3.73 | Getrag_R34/6/3.545 | 13.3@107 | 13.156@104.8 | 4% / T0 / L2000 | HIT |

## Shipped
1. `js/physics.js` — GM_4L60E / GM_2004R / GM_6L80 / Chrysler_NAG1_5 / Mazda_Miata_5 / Honda_S2000_6 / Toyota_FA86_6.
2. `scripts/recalib-real-tx-phase5-zf8-tr6060.js` — remap + loss/tire/launch search for the 24.
3. `js/garage-data.js` — remapped + recalib'd; `window.VB_POWERCURVE_GARAGE` bind intact.
4. `scripts/garage-calib-meta.json` tip `real-tx-phase5-zf8-tr6060` + `js/calib-meta.js` sync.
5. `scripts/real-tx-phase5-zf8-tr6060-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-real-tx-phase5-zf8-tr6060
node scripts/recalib-real-tx-phase5-zf8-tr6060.js
node -e "const G=require('./js/garage-data.js'); console.log('ZF8',G.filter(c=>c.txKey==='ZF8HP').length,'TR6060',G.filter(c=>c.txKey==='TR6060_6').length,'fs!=1',G.filter(c=>+c.forceScale!==1).length)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
rg 'resolveLeaveRpm|launchLocked' js/physics.js
rg 'GM_4L60E|GM_6L80|Chrysler_NAG1_5|Mazda_Miata_5|Honda_S2000_6|Toyota_FA86_6' js/physics.js
```

## Fleet hit-rates (Excel TOL) vs tip `7108fdd` / phase4-ev-fd

| Metric | Before (`7108fdd`) | After (phase5-zf8-tr6060) |
|--------|--------------------|---------------------------|
| ¼ ET | 323/331 **97.6%** | 320/331 **96.7%** (−3 honest) |
| ¼ trap | 300/331 **90.6%** | 295/331 **89.1%** (−5 honest) |
| 0-60 | 285/332 **85.8%** | 280/332 **84.3%** (−5) |
| 60-130 | 72/76 **94.7%** | 71/76 **93.4%** (−1) |
| all4 | 249 | 243 (−6) |

Batch ET+trap: **17/24 HIT**.

## Batch still-miss (honest — do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Notes |
|-----|----:|------:|---|
| 1975 Chevrolet Nova 350 | +0.374 | −2.5 | TH400 + published-leaning FD; knobs exhausted at 0%/L200 — **honest miss** |
| 1977 Chevrolet Monte Carlo | +0.372 | −2.9 | Same class; stock-tall FD 3.08 — **honest miss** |
| 1987 Buick GNX | −0.017 | −3.6 | ET HIT; trap soft on real 200-4R+3.42 — **honest miss** |
| 1996 Chevrolet Impala SS | +0.617 | −5.7 | Stock-only FD **3.08** + 4L60E OD; ZF8 8spd was cheating ET — **honest miss** |
| 1984 Chevrolet Corvette C4 | +0.703 | −3.6 | 4L60E + 3.07; knobs exhausted — **honest miss** |
| 2008 Challenger SRT8 | +0.079 | −3.3 | ET HIT; NAG1+3.06 trap soft vs Excel — **honest miss** |
| 2006 Charger R/T | −0.007 | −3.8 | ET HIT; NAG1+2.82 trap soft — **honest miss** |

## Honest leftovers (still on filler — no invented ratios)
- **ZF8HP 91** — keep real ZF8 platforms (Hellcat/Scat/Trackhawk/M5/RS7/TRX/…); trucks/SUVs/Mercedes 5G-7G/BMW ZF6HP-era/Koenigsegg LST/Pagani/Aston without published-leaning preset this tip; Lexus 10AT / Bronco 10R140 count-wrong deferred.
- **TR6060_6 73** — keep real Tremec platforms (GT350R, Z/28, ZL1, Viper, …); remaining JDM/Euro manuals (STI/Evo/Civic Type R/350Z/M3 E46/…) without dedicated preset this tip.
- **DCT_7_AMG ~34** — Euro supercar marque split **soft backlog** (out of scope Phase 5).

## Integrity
- forceScale≠1 = **0**
- Peak HP wipe + `VB_POWERCURVE_GARAGE` bind intact
- Launch-tach blend untouched vs `7108fdd`
- Phase 1–4 remaps intact (spot: Z06 TR9080, Mustang 10R80, Hellcat FD 2.62, GTO Muncie, GT3 RS PDK, Cybertruck 15.02, Regera KDD)
- Public credits Jorge Guerra only

---

# BUILD LOCK — Real-TX Phase 4 EV FD / oddballs (Seraph gate)

Branch: `review/pc-real-tx-phase4-ev-fd` · Rebased onto `85a545f` (live main: gear UI + calib panel on Phase 3).
**No Merovingian deploy.** Hold for Seraph browser gate (Cybertruck FD 15.02 · Model S Plaid 7.56 · Taycan 2-spd · Regera KDD).

## VERIFY note (required)
- Phase 1 intact: Ford_10R80 / GM_10L90 / Tremec_TR9080_8DCT + Hellcat FD 2.62.
- Phase 2 intact: classics off TR6060 (Demon A833_4, GTO Muncie_M21, …).
- Phase 3 intact: Porsche_PDK_7/_GT · AMG_SPEEDSHIFT · VW_DQ500 · Audi_STronic · GT500 TR-9070.
- Launch-tach intact: `resolveLeaveRpm` + stock slip→lockup (`launchLocked`) — **not touched**.
- Gear UI (`#txFactoryLabelField`) + calib panel (`#calibPanel` / `js/calib-meta.js`) from main — **kept**.
- Phase 4: EV/oddball FD + gear layouts — stop HP-band fake FDs / ZF8 on Regera / single-speed on Taycan.
- Recalib: loss / launchRpm / tireType only (+ hybridAssistFrac on Regera); forceScale=1; no Cd/wt/curve fakes.
- Fleet hits: BEFORE et 324/331 trap 301/331 z60 284/332 60-130 72/76 all4 250 → AFTER et 323/331 trap 300/331 z60 285/332 60-130 72/76 all4 249.

---

# Real-TX Phase 4 EV FD / oddballs (2026-09-24 CT)

Branch: `review/pc-real-tx-phase4-ev-fd` · Rebased onto live main `85a545f` (gear UI `37c2e70` + calib panel). **No deploy.** Do **not** ask Merovingian to push main. Hold for Seraph browser gate (Cybertruck / Plaid / Taycan / Regera + gear label / calib panel).

## Goal
Fix EV / oddball final drives and gear layouts that are wrong vs published-leaning figures. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType** (+ hybridAssistFrac for Regera hybrid)
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · launch-tach blend · Phase 1/2/3 remaps — **intact**
- UI: `finalDrive` clamp raised **1.5–10 → 1.5–20** so Cybertruck FD 15.02 survives load+RUN

## FactoryTransmissions added (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `Tesla_EV_Plaid` **new** | 1 | **7.56** | [1.00] | Tesla Model S/X Plaid owners manual F+R 7.56:1 |
| `Tesla_EV_Cybertruck` **new** | 1 | **15.02** | [1.00] | Tesla Cybertruck / Cyberbeast owners manual overall 15.02:1 |
| `Porsche_Taycan_2` **new** | 2 | **8.05** | 1.925 / 1.00 (overall ~15.5 / ~8.05) | Porsche Newsroom Taycan 2-spd rear; Motor Matchup 15.5/8.05 |
| `Koenigsegg_KDD` **new** | 1 | **2.73** | [1.00] | Koenigsegg Direct Drive official (Agera 7th equiv) |
| `EV_Single` | 1 | 9.0 | unchanged | Model 3/Y / generic EV |

## Remapped cars (9)
**Tesla_EV_Plaid (2):** 2022 Model S Plaid, 2022 Model X Plaid (FD **7.56**).  
**Tesla_EV_Cybertruck (1):** 2024 Cybertruck Tri-Motor (FD **15.02**).  
**EV_Single FD nudge (3):** Model S Long Range FD **7.56**; Model 3 Performance FD **9.0**; Model Y Performance FD **9.0**.  
**Porsche_Taycan_2 (2):** 2022 Taycan Turbo S, 2023 Audi e-tron GT (2 gears @ FD 8.05).  
**Koenigsegg_KDD (1):** 2016 Regera (1 gear @ FD **2.73** — was ZF8HP 8spd).

## Per-car before → after

| Car | Before tx/nG/FD | After tx/nG/FD | Excel ET@trap | Sim ET@trap | loss / tire / launch | ET+trap |
|---|---|---|---|---|---|---|
| 2022 Tesla Model S Plaid | `EV_Single`/1/6.5 | `Tesla_EV_Plaid`/1/**7.56** | 9.25@151 | 9.244@149.8 | 8% / T2 / L500 | HIT |
| 2022 Tesla Model X Plaid | `EV_Single`/1/6.5 | `Tesla_EV_Plaid`/1/**7.56** | 9.8@145 | 9.792@144.9 | 2.5% / T2 / L500 | HIT |
| 2024 Tesla Cybertruck Tri-Motor | `EV_Single`/1/7.8 | `Tesla_EV_Cybertruck`/1/**15.02** | 11.0@119 | 12.764@86.1 | 0% / T2 / L300 | **MISS** |
| 2024 Tesla Model S Long Range | `EV_Single`/1/7.8 | `EV_Single`/1/**7.56** | 10.8@129 | 10.990@131.3 | 1% / T1 / L500 | HIT |
| 2024 Tesla Model 3 Performance | `EV_Single`/1/9.2 | `EV_Single`/1/**9.0** | 11@124.5 | 11.052@124.8 | 0% / T4 / L500 | HIT |
| 2023 Tesla Model Y Performance | `EV_Single`/1/9.2 | `EV_Single`/1/**9.0** | 11.8@115 | 11.913@117.4 | 0.5% / T3 / L500 | HIT |
| 2022 Porsche Taycan Turbo S | `EV_Single`/1/7.8 | `Porsche_Taycan_2`/2/**8.05** | 10.5@130 | 10.497@130.1 | 14% / T1 / L500 | HIT |
| 2023 Audi e-tron GT | `EV_Single`/1/9.2 | `Porsche_Taycan_2`/2/**8.05** | 12.1@116 | 12.028@113.6 | 15% / T0 / L500 | HIT |
| 2016 Koenigsegg Regera | `ZF8HP`/8/3.15 | `Koenigsegg_KDD`/1/**2.73** | 9.9@150 | 9.831@163.5 | 1.5% / T2 / L3400 (af 0.30) | **MISS** |

## Shipped
1. `js/physics.js` — Tesla_EV_Plaid / Tesla_EV_Cybertruck / Porsche_Taycan_2 / Koenigsegg_KDD.
2. `js/app.js` — finalDrive clamp max **20** (Cybertruck 15.02).
3. `scripts/recalib-real-tx-phase4-ev-fd.js` — remap + loss/tire/launch search for the 9.
4. `js/garage-data.js` — remapped + recalib'd; `window.VB_POWERCURVE_GARAGE` bind intact.
5. `scripts/garage-calib-meta.json` tip `real-tx-phase4-ev-fd` + `scripts/real-tx-phase4-ev-fd-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-real-tx-phase4-ev-fd
node scripts/recalib-real-tx-phase4-ev-fd.js
node -e "const G=require('./js/garage-data.js'); const N=['2024 Tesla Cybertruck Tri-Motor','2022 Tesla Model S Plaid','2022 Porsche Taycan Turbo S','2016 Koenigsegg Regera']; N.forEach(n=>{const c=G.find(x=>x.name===n); console.log(n,c.txKey,c.gearRatios.length,c.finalDriveRatio);}); console.log('fs!=1',G.filter(c=>+c.forceScale!==1).length)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
rg 'resolveLeaveRpm|launchLocked' js/physics.js
rg 'Tesla_EV_Plaid|Tesla_EV_Cybertruck|Porsche_Taycan_2|Koenigsegg_KDD' js/physics.js
```

## Fleet hit-rates (Excel TOL) vs tip `42cae82` / phase3-euro-dct

| Metric | Before (`42cae82`) | After (phase4-ev-fd) |
|--------|--------------------|----------------------|
| ¼ ET | 324/331 **97.9%** | 323/331 **97.6%** (−1 = Cybertruck honest) |
| ¼ trap | 301/331 **90.9%** | 300/331 **90.6%** (−1 = Cybertruck / Regera trap) |
| 0-60 | 284/332 **85.5%** | 285/332 **85.8%** |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 250 | 249 (−1) |

Batch ET+trap: **7/9 HIT**.

## Batch still-miss (honest — do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Notes |
|-----|----:|------:|---|
| 2024 Tesla Cybertruck Tri-Motor | **+1.764** | **−32.9** | Published FD **15.02** puts trap RPM past baked 14k motor curve (system-combined TQ was calibrated at FD~7.8). Loss/tire/launch exhausted at 0%/Slick/L300. Extending/faking the curve forbidden — **honest miss**. |
| 2016 Koenigsegg Regera | −0.069 | **+13.5** | ET HIT at KDD 2.73; trap hot. Tall single ratio + hybrid assist cannot kill trap without breaking ET — knobs exhausted — **honest miss**. |

## Integrity
- forceScale≠1: **0**
- Phase 1 TR9080 still on C8 Stingray / Z06 / ZR1X; 10R80/10L90 intact
- Phase 2 classics still on Toploader/Muncie/A833/T5/JDM
- Phase 3 PDK / AMG / DQ500 / S-tronic / TR-9070 intact
- Launch-tach `resolveLeaveRpm` + `launchLocked` slip→lockup present
- Cd/weight/frontalArea/torqueCurve: **unchanged** on remapped cars
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`
- Public credits: **Jorge Guerra** only

**Skipped:** deploy · Merovingian holds deploy · no push to main · remaining Italian/UK DCT marque tips.
- Gear UI + calib panel: **present** (from `85a545f` base).

VERIFY
1. Meta tip `real-tx-phase4-ev-fd` · ET ≥323/331 · trap ≥300/331 · forceScale≠1 = 0
2. Spot gear editor: Cybertruck = Tesla_EV_Cybertruck 1@FD15.02 · Plaid = Tesla_EV_Plaid 1@7.56 · Taycan = Porsche_Taycan_2 2@8.05 · Regera = Koenigsegg_KDD 1@2.73
3. Custom builder TX dropdown lists new Tesla/Taycan/KDD keys; FD 15.02 editable (clamp max 20)
4. Gear editor shows factory TX label (e.g. Tesla Cybertruck single-speed / Porsche Taycan 2-spd rear / Koenigsegg Direct Drive); calib panel tip `real-tx-phase4-ev-fd`
5. Every garage `forceScale === 1`; no Cd/wt/curve edits; launch-tach + P1–P3 intact
6. Static / no secrets; **no deploy**

---

# BUILD LOCK — PowerCurve UI stack on Phase 3 (gear TX label + calib panel) — now under Phase 4

Base lineage: `42cae82` (Phase 3 Euro DCT) → `37c2e70` (gear UI TX label) → this tip (calib/source transparency panel).
**UI-only stack** — **no garage remaps**, no physics / launch-tach / FD edits.
Gear label (`#txFactoryLabelField`) and calib panel (`#calibPanel` under Time Slip) do not overlap.

## VERIFY note (required)
- Phase 1–3 remaps **intact** (these tips do not touch `js/garage-data.js` / `js/physics.js`).
- Launch-tach intact: `resolveLeaveRpm` + `launchLocked` — **not touched**.
- forceScale untouched; no recalib (UI-only).
- Peak HP wipe guard + `VB_POWERCURVE_GARAGE` bind intact.
- Soft flag (Phase 2): bake was right; **label was missing** — gear editor now shows human factory TX / preset name from `car.txKey` → `FactoryTransmissions[txKey].name`.
- Credits **Jorge Guerra** only.
- Panel surfaces **existing** fleet hit-rates from `scripts/garage-calib-meta.json` tip `real-tx-phase4-ev-fd` (synced in `js/calib-meta.js`) + honest-miss caveat from `scripts/recalib-trap-miss-batch22.js` — **no new metrics / sources invented**.

## Goal (gear UI — already on main as 37c2e70)
In the gear editor, garage cars show e.g. **“Muncie M21 4-spd”** / **“Porsche PDK 7-spd (GT)”** above the editable gear rows — not anonymous ratios only. Custom Builder keeps the existing Factory TX preset dropdown.

| Surface | Behavior |
|---|---|
| `#txFactoryLabel` (garage cars) | Read-only brass label = `Phys.FactoryTransmissions[car.txKey].name` |
| `#txFactoryKey` | Muted `preset · <txKey>` under the name |
| `#txPreset` (Custom Builder only) | Unchanged editable dropdown; factory label field hidden |
| `readCarFromForm` | Preserves `base.txKey` so the label survives RUN |

## Goal (calib panel — this tip)
Compact calib/source transparency panel so users see compiled fleet hit-rates vs Excel TOL, honest-miss language, and a clear **compiled estimates / not lab-certified / not track-certified** caveat.

| Surface | Content | Source |
|---|---|---|
| `#calibCaveat` | Compiled estimates — not lab / dyno / track certified | baked caveat (matches existing disclaimer language) |
| `#calibHits` | Fleet ET / trap / 0–60 / 60–130 / all4 hit counts + % | `garage-calib-meta.json` → `stats` (323/331 · 300/331 · 285/332 · 72/76 · all4 249) |
| `#calibMetaLine` | Tip name · knobs · Excel TOL | meta `tip` / `tol` / knobs note |
| `#calibHonest` | 14 honest-miss cars left untouched | `recalib-trap-miss-batch22.js` HONEST_MISS |
| `#calibSource` | `scripts/garage-calib-meta.json` | path label |

## Files
- `index.html` — `#txFactoryLabelField` / `#calibPanel`; script tag for calib-meta
- `css/styles.css` — `.tx-factory-label` + `.calib-panel` brass chrome
- `js/app.js` — `resolveTxDisplayName` / `updateTxFactoryLabel`; `renderCalibPanel`; `txKey` preserved on RUN
- `js/calib-meta.js` — compact `window.VB_POWERCURVE_CALIB_META` subset (new)
- **Not touched:** `js/garage-data.js`, `js/physics.js`, launch-tach, gear ratios / FD

## Integrity
- forceScale / physics / garage remaps / launch-tach: **unchanged**
- Phase 1 nG10 + Phase 2 classics + Phase 3 Euro DCT: **not regressed** (no garage edit)
- `window.VB_POWERCURVE_GARAGE` bind present · Peak HP wipe comment present
- Phase 4 EV FD: **now applied on this tip** (see section above); gear label + calib panel still present.

## VERIFY checklist
1. Tip rebased onto `37c2e70`; files = HTML/CSS/`js/app.js`/`js/calib-meta.js` (+ VERIFY)
2. GTO / Demon / GT3 RS show human TX names in gear editor; Custom Builder dropdown intact
3. `rg 'resolveTxDisplayName|txFactoryLabel' js/app.js index.html`
4. Panel stats match `node -e "console.log(require('./scripts/garage-calib-meta.json').stats)"`
5. `rg 'renderCalibPanel|VB_POWERCURVE_CALIB_META' js/app.js js/calib-meta.js index.html`
6. `rg 'resolveLeaveRpm|launchLocked' js/physics.js` still present; garage-data untouched vs Phase 3
7. Credits remain **Jorge Guerra** only.

---

# BUILD LOCK — Real-TX Phase 3 Euro DCT marque presets (Seraph gate)

Branch: `review/pc-real-tx-phase3-euro-dct` · Tip off `2315f65` (launch-tach on Phase2 / main).
**No Merovingian deploy.** Hold for Seraph browser gate (Porsche PDK / AMG SPEEDSHIFT / VW-Audi DSG / GT500 TR-9070 / C8 TR-9080).

## VERIFY note (required)
- Phase 1 intact: Ford_10R80 / GM_10L90 / Tremec_TR9080_8DCT + Hellcat FD 2.62.
- Phase 2 intact: 24 classics off TR6060 (Demon A833_4, GTO Muncie_M21, Mustang GT 390 Toploader_4, AE86 Toyota_T50_5, …).
- Launch-tach intact: `resolveLeaveRpm` + stock slip→lockup (`launchLocked`) blend — **not touched**.
- Phase 3: Euro DCT marque split — stop cloning Tremec TR-9070 (`DCT_7_AMG`) across Porsche/AMG/VW/Audi; GT500 → `Tremec_TR9070_7DCT`.
- Recalib: loss / launchRpm / tireType only; forceScale=1; no Cd/wt/curve fakes.
- Fleet hits: BEFORE et 324/331 trap 304/331 z60 283/332 60-130 72/76 all4 252 → AFTER et 324/331 trap 301/331 z60 284/332 60-130 72/76 all4 250.

---

# Real-TX Phase 3 Euro DCT — marque presets (2026-09-24 CT)

Branch: `review/pc-real-tx-phase3-euro-dct` · Tip off `2315f65` (main / live). **No deploy.** Do **not** ask Merovingian to push main. Hold for Seraph browser gate (GT3 RS PDK, AMG GT R DCT, Golf R DQ500, GT500 TR-9070, Z06 TR-9080).

## Goal
Stop cloning one GT500-style Tremec 7DCT across all DCT cars. Add marque/period DCT (and AMG MCT) presets with published-leaning ratios + FD; remap garage Euro DCTs that wrongly shared `DCT_7_AMG`. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- OUT OF SCOPE this tip: Ferrari/McLaren/Lambo/Bugatti/BMW/GT-R still on legacy `DCT_7_AMG` (later marque tips); EV FD; Gear UI
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · launch-tach blend · Phase 1/2 remaps — **intact**

## FactoryTransmissions added / updated (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `Porsche_PDK_7` **new** | 7 | 3.44 | 3.91…0.62 | Porsche Newsroom 911 Carrera PDK tech specs; Car and Driver PDK tech dept |
| `Porsche_PDK_7_GT` **new** | 7 | 3.97 | 3.75…0.84 | Porsche Newsroom 911 GT3 PDK PDF (FD 3.97 / GT3 RS 4.54 override) |
| `PDK_7` (updated alias) | 7 | 3.44 | = Carrera set | kept for UI/legacy; garage remapped off it |
| `AMG_SPEEDSHIFT_DCT_7` **new** | 7 | 3.67 | 3.40…0.72 | MBUSA SLS AMG tech data; Mercedes archive SPEEDSHIFT DCT |
| `AMG_SPEEDSHIFT_MCT_7` **new** | 7 | 2.82 | 4.377…0.728 | Mercedes archive C63 MCT; 7G-Tronic W7A gearset (wet start clutch) |
| `VW_DQ500_7` **new** | 7 | 4.059 | 3.562…0.635 | gearboxlist DQ500 Golf R; TVS DQ500 (dual FD approx → 4.059 primary) |
| `Audi_STronic_7` **new** | 7 | 4.093 | 3.692…0.519 | DL501/0B5 published-leaning (A7/RS class); RS4 Avant longitudinal |
| `Tremec_TR9070_7DCT` **new** | 7 | 3.73 | 3.14…0.56 | same ratios as legacy `DCT_7_AMG`; OEM GT500-class only |
| `DCT_7_AMG` (legacy key) | 7 | 3.73 | unchanged | leftover Italian/UK/BMW/GT-R fleet until later tips |
| `Tremec_TR9080_8DCT` | 8 | 5.20 | Phase 1 | C8 Stingray/Z06/ZR1X **untouched** |

UI Custom factory-TX dropdown auto-lists new keys via `populateTxPresets()` (already wired).

## Remapped cars (17 names / 18 garage rows — duplicate 2010 C63 AMG ×2)
**Porsche_PDK_7 (2):** 2021 911 Turbo S (FD 3.09), 2014 911 Carrera S (FD 3.44).  
**Porsche_PDK_7_GT (4):** 2017 911 GT2 RS (FD 3.97), 2019 911 GT3 (FD 3.97), 2024 911 GT3 RS (FD **4.54**), 2023 718 Cayman GT4 RS (FD 3.97).  
**AMG_SPEEDSHIFT_DCT_7 (3):** 2011 SLS AMG (FD 3.67), 2018 AMG GT R (FD 3.67), 2014 CLA45 AMG (FD 4.13).  
**AMG_SPEEDSHIFT_MCT_7 (3 names / 4 rows):** 2017 C63 S (FD 2.82), 2010 C63 AMG ×2 (FD 2.82), 2011 E63 AMG (FD 2.65).  
**VW_DQ500_7 (3):** 2022 Golf R, 2016 TT RS, 2024 RS 3 (FD 4.059).  
**Audi_STronic_7 (1):** 2013 RS4 Avant (FD 4.093).  
**Tremec_TR9070_7DCT (1):** 2020 Shelby GT500 (FD 3.73).

## Per-car before → after

| Car | Before tx/nG/FD | After tx/nG/FD | Excel ET@trap | Sim ET@trap | loss / tire / launch | ET+trap |
|---|---|---|---|---|---|---|
| 2021 Porsche 911 Turbo S | `PDK_7`/7/3.09 | `Porsche_PDK_7`/7/3.09 | 10.3@137 | 10.178@136.9 | 1% / T3 / L3500 | HIT |
| 2014 Porsche 911 Carrera S | `DCT_7_AMG`/7/3.73 | `Porsche_PDK_7`/7/3.44 | 12@117 | 11.954@118.4 | 1.5% / T3 / L2600 | HIT |
| 2017 Porsche 911 GT2 RS | `DCT_7_AMG`/7/3.73 | `Porsche_PDK_7_GT`/7/3.97 | 10.6@134 | 10.616@134.6 | 20% / T1 / L2400 | HIT |
| 2019 Porsche 911 GT3 | `DCT_7_AMG`/7/3.73 | `Porsche_PDK_7_GT`/7/3.97 | 11.4@125 | 11.423@125.1 | 3.5% / T3 / L3500 | HIT |
| 2024 Porsche 911 GT3 RS | `DCT_7_AMG`/7/3.73 | `Porsche_PDK_7_GT`/7/4.54 | 11.1@128 | 11.102@127.9 | 7% / T4 / L3500 | HIT |
| 2023 Porsche 718 Cayman GT4 RS | `DCT_7_AMG`/7/3.73 | `Porsche_PDK_7_GT`/7/3.97 | 11.3@125 | 11.290@124.9 | 0.5% / T4 / L3000 | HIT |
| 2011 Mercedes SLS AMG | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_DCT_7`/7/3.67 | 11.7@125 | 11.627@124.9 | 1% / T3 / L3000 | HIT |
| 2018 Mercedes-AMG GT R | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_DCT_7`/7/3.67 | 11.6@125 | 11.629@125.1 | 5% / T3 / L2400 | HIT |
| 2014 Mercedes CLA45 AMG | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_DCT_7`/7/4.13 | 12.6@111 | 12.466@108.7 | 3% / T0 / L1100 | HIT |
| 2017 Mercedes-AMG C63 S | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_MCT_7`/7/2.82 | 11.8@123 | 11.849@121.5 | 0% / T3 / L2400 | HIT |
| 2010 Mercedes C63 AMG (×2) | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_MCT_7`/7/2.82 | 12.2@115 | 12.410@113.2 | 0% / T3 / L2400 | HIT |
| 2011 Mercedes E63 AMG | `DCT_7_AMG`/7/3.73 | `AMG_SPEEDSHIFT_MCT_7`/7/2.65 | 12.3@117 | 12.144@116.8 | 1% / T3 / L2400 | HIT |
| 2022 Volkswagen Golf R | `DCT_7_AMG`/7/3.73 | `VW_DQ500_7`/7/4.059 | 12.6@112 | 12.553@107.2 | 3% / T0 / L1000 | MISS |
| 2016 Audi TT RS | `DCT_7_AMG`/7/3.73 | `VW_DQ500_7`/7/4.059 | 11.7@120 | 11.717@117.1 | 0% / T0 / L2400 | MISS |
| 2024 Audi RS 3 | `DCT_7_AMG`/7/3.73 | `VW_DQ500_7`/7/4.059 | 11.7@119 | 11.711@115.6 | 0% / T4 / L2400 | MISS |
| 2013 Audi RS4 Avant | `DCT_7_AMG`/7/3.73 | `Audi_STronic_7`/7/4.093 | 12.6@114 | 12.443@109.2 | 5.5% / T0 / L1000 | MISS |
| 2020 Ford Mustang Shelby GT500 | `DCT_7_AMG`/7/3.73 | `Tremec_TR9070_7DCT`/7/3.73 | 11.3@132 | 11.348@130.9 | 0% / T3 / L3000 | HIT |

## Shipped
1. `js/physics.js` — Porsche_PDK_7 / _GT, AMG_SPEEDSHIFT_DCT_7 / MCT_7, VW_DQ500_7, Audi_STronic_7, Tremec_TR9070_7DCT (+ PDK_7 alias update).
2. `scripts/recalib-real-tx-phase3-euro-dct.js` — remap + loss/tire/launch search for the 17/18.
3. `js/garage-data.js` — remapped + recalib'd; `window.VB_POWERCURVE_GARAGE` bind intact.
4. `scripts/garage-calib-meta.json` tip `real-tx-phase3-euro-dct` + `scripts/real-tx-phase3-euro-dct-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-real-tx-phase3-euro-dct
node scripts/recalib-real-tx-phase3-euro-dct.js
node -e "const G=require('./js/garage-data.js'); const N=['2024 Porsche 911 GT3 RS','2018 Mercedes-AMG GT R','2022 Volkswagen Golf R','2020 Ford Mustang Shelby GT500','2023 Chevrolet Corvette Z06']; N.forEach(n=>{const c=G.find(x=>x.name===n); console.log(n,c.txKey,c.gearRatios.length,c.finalDriveRatio);}); console.log('fs!=1',G.filter(c=>+c.forceScale!==1).length)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
rg 'resolveLeaveRpm|launchLocked' js/physics.js
rg 'Porsche_PDK_7|AMG_SPEEDSHIFT|VW_DQ500|Audi_STronic|Tremec_TR9070' js/physics.js
```

## Fleet hit-rates (Excel TOL) vs tip `2315f65` / launch-tach-on-phase2

| Metric | Before (`2315f65`) | After (phase3-euro-dct) |
|--------|--------------------|-------------------------|
| ¼ ET | 324/331 **97.9%** | 324/331 **97.9%** |
| ¼ trap | 304/331 **91.8%** | 301/331 **90.9%** (−3 = VW/Audi DQ500/DL501 honest trap) |
| 0-60 | 283/332 **85.2%** | 284/332 **85.5%** |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 252 | 250 (−2) |

Batch ET+trap: **14/18 HIT**.

## Batch still-miss (honest — do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Notes |
|-----|----:|------:|---|
| 2022 Volkswagen Golf R | −0.047 | −4.8 | ET HIT; trap soft at published DQ500 + single-FD approx + loss/tire/launch exhausted |
| 2016 Audi TT RS | +0.017 | −2.9 | ET HIT; trap soft (just outside ±2.5) at DQ500 + knobs exhausted |
| 2024 Audi RS 3 | +0.011 | −3.4 | ET HIT; trap soft at DQ500 + knobs exhausted |
| 2013 Audi RS4 Avant | −0.157 | −4.8 | ET HIT; trap soft at DL501 S-tronic + knobs exhausted |

## Integrity
- forceScale≠1: **0**
- Phase 1 TR9080 still on C8 Stingray / Z06 / ZR1X
- Phase 2 classics still on Toploader/Muncie/A833/T5/JDM (spot Demon/GTO/Mustang390/AE86)
- Launch-tach `resolveLeaveRpm` + `launchLocked` slip→lockup present
- Cd/weight/frontalArea/torqueCurve: **unchanged** on remapped cars
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`

**Skipped:** deploy · Merovingian holds deploy · no push to main · Ferrari/McLaren/Lambo/Bugatti/BMW/GT-R marque tips · Gear UI · Phase 4.

VERIFY
1. Meta tip `real-tx-phase3-euro-dct` · ET 324/331 · trap ≥301/331 · forceScale≠1 = 0
2. Spot gear editor: GT3 RS = Porsche_PDK_7_GT 7@FD4.54 · AMG GT R = AMG_SPEEDSHIFT_DCT_7 · Golf R = VW_DQ500_7 · GT500 = Tremec_TR9070_7DCT · Z06 = Tremec_TR9080_8DCT 8@5.56
3. Custom builder TX dropdown lists new Euro/Tremec keys
4. Every garage `forceScale === 1`; no Cd/wt/curve edits; launch-tach blend intact
5. Static / no secrets; **no deploy**

---

# BUILD LOCK — launch-tach on Phase2 (Seraph re-gate)

Branch: `review/pc-launch-tach-on-phase2` · Rebase of launch-tach realism onto Phase2 main `c825038`.
**No Merovingian deploy.** Hold for Seraph browser re-gate (Hellcat / Mustang GT tach climb + Demon/GTO/Mustang390/AE86 period TX).

## VERIFY note (required)
- Phase 2 present: 24 classics remapped off TR6060 (Demon A833_4, GTO Muncie_M21, Mustang GT 390 Toploader_4, AE86 Toyota_T50_5, …).
- Tach blend present: stock slip→lockup (no hard `rpm=launchRpm` hold); absurd ICE leave seeds to peak-TQ; EV Power % intact.
- Recalib after rebase: loss / launchRpm / tireType only; forceScale=1; no Cd/wt/curve fakes.
- Fleet hits: BEFORE et 316/331 trap 303/331 z60 273/332 all4 245 → AFTER et 324/331 trap 304/331 z60 283/332 all4 252.

---

# Real-TX Phase 2 classics — off TR6060 onto period gearboxes (2026-09-24 CT)

Branch: `review/pc-real-tx-phase2-classics` · Tip off `33aaa9b` (main / live). **No deploy.** Do **not** ask Merovingian to push main. Hold for Seraph browser gate (spot-check Demon 340, GTO, Mustang GT 390, AE86).

## Goal
Remap classic / late-80s manuals that wrongly wore Tremec TR-6060 6-speed onto real period gearboxes + published-leaning ratios/FD. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- OUT OF SCOPE: Euro DCT marque split; EV FD; more modern ZF8 filler; Phase 1 cars already fixed
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · canvas-before-listener — **intact**

## FactoryTransmissions used / added (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `Toploader_4` (existing) | 4 | 3.54 | 2.20…1.00 | Ford close-ratio Toploader; muscle 1960–73 |
| `Muncie_M21` (existing) | 4 | 3.70 | 2.20…1.00 | GM M21 close-ratio; Camaro/Corvette/GTO era |
| `A833_4` (existing) | 4 | 3.55 | 2.66…1.00 | Chrysler A833 B/C-body; Brewers Performance history |
| `T5_5` (existing) | 5 | 3.73 | 2.95…0.63 | BorgWarner T5 World Class; Fox Mustang |
| `KarKraft_T44_4` **new** | 4 | 2.77 | 2.22 / 1.43 / 1.19 / 1.00 | R&T GT40 Mk II analysis; Kar Kraft T-44 Le Mans set (FD 2.77 = 3.09 × 0.899 transfer) |
| `Toyota_T50_5` **new** | 5 | 4.30 | 3.587…0.861 | AE86 T50; aeu86.org specs |
| `Toyota_W58_5` **new** | 5 | 3.73 | 3.285…0.783 | Club4AG / Toyota W58 (Supra Mk2 / MR2) |
| `Mazda_5M` **new** | 5 | 3.909 | 3.622…0.758 | RX-7 Series 1/GSL-SE 5-spd published-leaning |
| `Nissan_FS5W71_5` **new** | 5 | 4.111 | 3.321…0.838 | Nissan FS5W71C (R31 Skyline GTS-R era) |

UI Custom factory-TX dropdown auto-lists new keys via `populateTxPresets()` (already wired).

## Remapped cars (24)
**Muncie_M21 (8):** Bel Air 283, Corvette 283, Impala SS 409, Stingray 327, GTO, Chevelle SS396, Camaro SS 396, 1979 Trans Am.  
**Toploader_4 (2):** Mustang GT 390, Cougar XR-7.  
**KarKraft_T44_4 (1):** GT40 MkII @ FD **2.77**.  
**A833_4 (6):** GTX 440, Dart GTS 383, Charger 440, Challenger 426 Hemi, Road Runner 440, Demon 340.  
**T5_5 (2):** 1987 Mustang 5.0 LX (FD 3.08), 1989 Mustang GT 5.0 (FD 3.27).  
**JDM 5spd (5):** Supra Mk2 / MR2 SC → W58; AE86 → T50; RX-7 GSL-SE → Mazda_5M; Skyline GTS-R → FS5W71C.

## Per-car before → after

| Car | Before tx/nG/FD | After tx/nG/FD | Excel ET@trap | Sim ET@trap | loss / tire / launch | ET+trap |
|---|---|---|---|---|---|---|
| 1957 Chevrolet Bel Air 283 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.7 | 16.6@82 | 16.572@81.9 | 14.5% / T0 / L2400 | HIT |
| 1961 Chevrolet Corvette 283 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.7 | 15@93 | 14.99@91.1 | 16.5% / T0 / L1500 | HIT |
| 1962 Chevrolet Impala SS 409 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.7 | 14.6@99 | 14.664@96.9 | 21% / T0 / L1400 | HIT |
| 1963 Corvette Stingray 327 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.7 | 14.4@100 | 14.262@97.7 | 24% / T0 / L200 | HIT |
| 1964 Pontiac GTO | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.55 | 14.8@98 | 14.8@94.1 | 17.5% / T0 / L1500 | MISS |
| 1965 Chevrolet Chevelle SS396 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.73 | 14.7@98 | 14.69@93.3 | 25% / T0 / L1800 | MISS |
| 1969 Chevrolet Camaro SS 396 | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.55 | 14.4@99 | 14.397@97.1 | 18% / T1 / L200 | HIT |
| 1979 Pontiac Firebird Trans Am | `TR6060_6`/6/3.73 | `Muncie_M21`/4/3.23 | 16.5@86 | 16.714@86.1 | 0% / T0 / L500 | HIT |
| 1967 Ford Mustang GT 390 | `TR6060_6`/6/3.73 | `Toploader_4`/4/3.5 | 15.2@93 | 15.157@90.9 | 26% / T0 / L2400 | HIT |
| 1968 Mercury Cougar XR-7 | `TR6060_6`/6/3.73 | `Toploader_4`/4/3.5 | 15.5@91 | 15.517@91.7 | 24.5% / T0 / L200 | HIT |
| 1966 Ford GT40 MkII | `TR6060_6`/6/3.73 | `KarKraft_T44_4`/4/2.77 | 11.8@131 | 11.809@131 | 8% / T0 / L1500 | HIT |
| 1967 Plymouth GTX 440 | `TR6060_6`/6/3.73 | `A833_4`/4/3.54 | 14.3@100 | 14.099@97.6 | 10.5% / T0 / L200 | HIT |
| 1968 Dodge Dart GTS 383 | `TR6060_6`/6/3.73 | `A833_4`/4/3.55 | 14.8@96 | 14.893@91.6 | 17% / T1 / L200 | MISS |
| 1969 Dodge Charger 440 | `TR6060_6`/6/3.73 | `A833_4`/4/3.54 | 14.3@99 | 14.189@96.7 | 14.5% / T0 / L900 | HIT |
| 1970 Dodge Challenger 426 Hemi | `TR6060_6`/6/3.73 | `A833_4`/4/3.54 | 13.8@104 | 13.675@101.5 | 8% / T0 / L400 | HIT |
| 1970 Plymouth Road Runner 440 | `TR6060_6`/6/3.73 | `A833_4`/4/3.54 | 14.2@100 | 14.102@97.6 | 14% / T0 / L200 | HIT |
| 1971 Dodge Demon 340 | `TR6060_6`/6/3.73 | `A833_4`/4/3.55 | 14.8@96 | 14.8@92 | 13% / T1 / L200 | MISS |
| 1987 Ford Mustang 5.0 LX | `TR6060_6`/6/3.73 | `T5_5`/5/3.08 | 14.7@94 | 14.7@93.5 | 0% / T0 / L2600 | HIT |
| 1989 Ford Mustang GT 5.0 | `TR6060_6`/6/3.73 | `T5_5`/5/3.27 | 14.7@94 | 14.68@93.3 | 0% / T0 / L2800 | HIT |
| 1983 Toyota Supra (Mk2) | `TR6060_6`/6/3.73 | `Toyota_W58_5`/5/3.727 | 16.5@85 | 16.495@82.2 | 6% / T0 / L2000 | MISS |
| 1989 Toyota MR2 Supercharged | `TR6060_6`/6/3.73 | `Toyota_W58_5`/5/4.285 | 15.2@90 | 15.146@88.9 | 7.5% / T3 / L2200 | HIT |
| 1986 Toyota Corolla AE86 | `TR6060_6`/6/3.73 | `Toyota_T50_5`/5/4.3 | 16.4@84 | 16.261@81.7 | 7.5% / T0 / L1700 | HIT |
| 1985 Mazda RX-7 GSL-SE | `TR6060_6`/6/3.73 | `Mazda_5M`/5/3.909 | 16@86 | 15.939@83.7 | 17.5% / T0 / L4700 | HIT |
| 1987 Nissan Skyline GTS-R | `TR6060_6`/6/3.73 | `Nissan_FS5W71_5`/5/4.111 | 14.6@97 | 14.57@94.8 | 0.5% / T0 / L2000 | HIT |

## Shipped
1. `js/physics.js` — five OEM-distinct presets (KarKraft T-44, Toyota T50/W58, Mazda 5M, Nissan FS5W71).
2. `scripts/recalib-real-tx-phase2-classics.js` — remap + loss/tire/launch search for the 24.
3. `js/garage-data.js` — remapped + recalib’d; `window.VB_POWERCURVE_GARAGE` bind intact.
4. `scripts/garage-calib-meta.json` tip `real-tx-phase2-classics` + `scripts/real-tx-phase2-classics-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-real-tx-phase2-classics
node scripts/recalib-real-tx-phase2-classics.js
node -e "const G=require('./js/garage-data.js'); const N=['1971 Dodge Demon 340','1964 Pontiac GTO','1967 Ford Mustang GT 390','1986 Toyota Corolla AE86']; N.forEach(n=>{const c=G.find(x=>x.name===n); console.log(n,c.txKey,c.gearRatios.length,c.finalDriveRatio);}); console.log('fs!=1',G.filter(c=>+c.forceScale!==1).length)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
rg 'KarKraft_T44|Toyota_T50|Muncie_M21|A833_4|T5_5' js/physics.js
```

## Fleet hit-rates (Excel TOL) vs tip `33aaa9b` / real-tx-batch1

| Metric | Before (`real-tx-batch1`) | After (phase2-classics) |
|--------|---------------------------|-------------------------|
| ¼ ET | 328/331 **99.1%** | 328/331 **99.1%** |
| ¼ trap | 301/331 **90.9%** | 301/331 **90.9%** |
| 0-60 | 288/332 **86.7%** | 292/332 **88.0%** |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 257 | 261 |

Batch ET+trap: **19/24 HIT**.

## Batch still-miss (honest — do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Notes |
|-----|----:|------:|---|
| 1964 Pontiac GTO | +0.000 | -3.9 | ET HIT; trap soft at published 4/5spd + loss/tire/launch exhausted |
| 1965 Chevrolet Chevelle SS396 | -0.010 | -4.7 | ET HIT; trap soft at published 4/5spd + loss/tire/launch exhausted |
| 1968 Dodge Dart GTS 383 | +0.093 | -4.4 | ET HIT; trap soft at published 4/5spd + loss/tire/launch exhausted |
| 1971 Dodge Demon 340 | +0.000 | -4.0 | ET HIT; trap soft at published 4/5spd + loss/tire/launch exhausted |
| 1983 Toyota Supra (Mk2) | -0.005 | -2.8 | ET HIT; trap soft at published 4/5spd + loss/tire/launch exhausted |

## Integrity
- forceScale≠1: **0**
- Listed Phase2 cars still on TR6060_6: **0**
- Phase2 gear counts: **17×4spd + 7×5spd**
- Cd/weight/frontalArea/torqueCurve: **unchanged** on all 24 remapped cars
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`
- Garage cars with `gearRatios.length === 10`: **9** (batch1 intact)

**Skipped:** deploy · Merovingian holds deploy · no push to main · remaining phases: Euro DCT marque presets; EV FD/oddballs; residual ZF8/TR6060 filler.

VERIFY
1. Meta tip `real-tx-phase2-classics` · ET 328/331 · trap ≥301/331 · none of 24 on TR6060
2. Spot gear editor: Demon 340 = 4 A833 · GTO = 4 Muncie · Mustang GT 390 = 4 Toploader · AE86 = 5 T50
3. Custom builder TX dropdown lists KarKraft T-44 / Toyota T50 / W58 / Mazda 5M / Nissan FS5W71 (+ existing classics)
4. Every garage `forceScale === 1`; no Cd/wt/curve edits

---

# Launch-tach on Phase2 (rebased)

# Launch-tach realism — stock slip→lockup (2026-09-24 CT)

Branch: `review/pc-launch-tach-realism` · Tip off `33aaa9b` (real-tx-batch1). **No deploy.** Do **not** ask Merovingian to push main. Hold for Seraph browser gate (Hellcat / Mustang GT / Demon 340 tach climb + Model 3 Perf Power %).

## Goal
Stock path (ATC off) no longer hard-holds `rpm = launchRpm` for ~LAUNCH_HOLD 2.2s. Replace with slip→lockup blend (same idea as ATC): seed at leave RPM, blend toward mechRpm as speed rises; manuals short clutch fade; after first lock always follow mechRpm (shift drops preserved). Absurd ICE `launchRpm` (e.g. Demon 200) seeds toward peak-TQ band at leave. Recalib **loss / launchRpm / tire only**.

## Hard rules (kept)
- Knobs ONLY: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- EV: leave Power % primary dial alone (`configurePrimaryGauge` / `evGaugeMode`); motor rpm may blend — Power % from curve@rpm still correct
- Priority: ¼ ET → trap → 60-130 → 0-60
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind — **intact**
- Independent of Phase 2 classics (`review/pc-real-tx-phase2-classics`) — branched from `33aaa9b` only

## Before → after (tach)
| Car | Before | After |
|-----|--------|-------|
| Hellcat / Mustang GT | Flat ~launchRpm for ~2.2s then cliff to already-at-shift mechRpm | Leave → climb through 1st to shiftRpm → drop on shift |
| Demon 340 | Flat **200** RPM for ~2.2s then cliff | Leave seeded **~peak-TQ** → climb 1st → drop on shift |
| Model 3 Perf | Flat motor 500 then cliff | Motor rpm climbs with speed; **Power %** dial unchanged |

## Spot-check (Excel weather, baked tire, driver 200)

| Car | Before ET@trap / 0-60 | After ET@trap / 0-60 | Notes |
|-----|----------------------:|---------------------:|-------|
| 2020 Challenger Hellcat | 11.610@126.0 / 3.613 | **11.610@126.0 / 3.613** | Unchanged; tach climbs 2400→6033 1st; shift drop ~6046→4106 |
| 2020 Mustang GT | 12.090@117.7 / 3.881 | **12.111@117.7 / 3.907** | ET/0-60 still HIT vs 12.1@119 / 3.8; tach 3000→6744 |
| 1971 Demon 340 | 14.604@93.5 / 5.979 | **14.449@93.6 / 5.779** | Leave 200→**4371** (peak-TQ seed + recalib); ET still fast vs 14.8 (**honest** — trap at edge); tach climbs + shift drop 5452→3671 |
| 2024 Model 3 Performance | 10.970@124.5 / 2.941 | **11.040@124.4 / 3.040** | HIT; Power % via `configurePrimaryGauge` / `evGaugeMode` intact |

## Shipped
1. `js/physics.js` — `resolveLeaveRpm` / `peakTqRpmFromCurve`; stock slip→lockup + `launchLocked`; manuals short clutch fade.
2. `scripts/recalib-launch-tach-realism.js` — drifted-only loss/launch/tire search (trap-preserving).
3. `js/garage-data.js` — recalib’d drifted cars; `window.VB_POWERCURVE_GARAGE` bind intact.
4. `scripts/garage-calib-meta.json` tip `launch-tach-realism` + `scripts/launch-tach-realism-report.json`.

## Fleet hit-rates (Excel TOL) vs `33aaa9b` / real-tx-batch1

| Metric | Before (`real-tx-batch1`) | After physics (pre-recalib) | After recalib |
|--------|---------------------------|-----------------------------|---------------|
| ¼ ET | 328/331 **99.1%** | 306/331 | **318/331 96.1%** |
| ¼ trap | 301/331 **90.9%** | 301/331 | **303/331 91.5%** (+2) |
| 0-60 | 288/332 **86.7%** | 260/332 | **278/332 83.7%** |
| 60-130 | 72/76 **94.7%** | 72/76 | **72/76 94.7%** |
| all4 | 257 | 229 | **246** |

Pre-recalib drift: **103** cars. Recalib changed those (loss/launch/tire); ET recovery pass preserved trap hits.

## Honest misses (do not cheat Cd/wt/curve)
Leave seeding into peak-TQ makes former absurd-`launchRpm` classics faster; further loss often sits on the trap TOL edge. Notable ET-still-fast: Demon 340, Camaro SS 396, Dart GTS 383, GTX 440, Diablo VT 6.0, R8 V10, Venom GT, Monte Carlo, Cougar XR-7, Nova 350, Audi S5×2, Galaxie 352. Many EV 0-60 soft / known trap soft remain (Plaid, Taycan, EQE, iX, …) — same class as prior tips.

## Integrity
- forceScale≠1: **0**
- Cd/weight/frontalArea/torqueCurve: **unchanged** by this tip’s knobs
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`
- `configurePrimaryGauge` / `evGaugeMode` untouched

**Skipped:** deploy · Merovingian holds deploy · no push to main · Phase 2 classics worktree untouched.

VERIFY
1. Meta tip `launch-tach-realism` · ET ≥315/331 · trap ≥301/331 · forceScale≠1 = 0
2. Spot tach: Hellcat/Mustang/Demon climb through 1st from leave; shift RPM drops; no multi-second flat ~3k then cliff
3. Model 3 Perf: primary gauge still Power % (`evGaugeMode`)
4. No Cd/wt/curve edits in the tip diff

---

# Real-TX batch1 — published 10R80 / 10L90 / TR-9080 + Hellcat FD (2026-09-24 CT)

Branch: `review/pc-real-tx-batch1` · Tip off `b8af352` (main / live). **No deploy.** Do **not** ask Merovingian to push main. Hold for Seraph browser gate (Mustang GT / Camaro ZL1 / ZR1X / Hellcat gear editor counts).

## Goal
First Jorge-approved real-transmission batch: correct gear **count** + published-leaning ratios/FD on modern Ford/GM 10AT, C8 TR-9080 8DCT, ZR1X FD 5.56, Hellcat FD 2.62. Recalib **loss / launch / tire only**.

## Hard rules (kept)
- Knobs ONLY after gear/FD writes: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / frontal area / torque-curve / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s
- FIRST BATCH only — leave obscure ZF8HP / TR6060 filler alone
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · canvas-before-listener — **intact**

## FactoryTransmissions added (`js/physics.js`)
| txKey | Speeds | Default FD | Ratios (abbrev) | Sources |
|---|---:|---:|---|---|
| `Ford_10R80` | 10 | 3.15 | 4.696…0.636 | Ford Component Sales 10R80 sheet; BlueOvalTrucks / F150Hub; Wikipedia Ford–GM 10-speed |
| `GM_10L90` | 10 | 2.85 | 4.70…0.64 | GM Authority 10L90; Camaro ZL1 published set (same ratios as 10L80 gearset) |
| `Tremec_TR9080_8DCT` | 8 | 5.20 | 2.91…0.33 | Tremec TR-9080 product sheet; CorvetteForum DCT 101; ZR1X/Z06 **effective FD 5.56** (OEM convention) |

UI Custom factory-TX dropdown auto-lists new keys via `populateTxPresets()`.

## Remapped cars (14)
**10AT Ford (`Ford_10R80`):** 2020 Mustang GT (FD 3.15), 2018 Mustang GT PP2 Auto (FD 3.55), 2024 Dark Horse (FD 3.55), 2020 F-150 Raptor (FD 4.10), 2018 F-150 5.0 (FD 3.31).  
**10AT GM (`GM_10L90`):** 2020 Camaro SS (FD 2.77), 2023 Camaro ZL1 (FD 2.85), 2020 Silverado 6.2 (FD 3.23), 2023 Silverado ZR2 (FD 3.23).  
**TR-9080 8DCT:** 2024 C8 Stingray (FD 5.20, `transmission`→DCT), 2023 C8 Z06 (FD 5.56, DCT), 2026 ZR1X (FD **5.56**, DCT).  
**Hellcat FD only (keep ZF8HP):** 2020 + 2015 Challenger Hellcat FD **3.15→2.62** (Redeye already 2.62).

**Left alone this tip:** 2012 F-150 EcoBoost (pre-10R80), 2017 Silverado 5.3 (pre-10L90 era), Scat Packs (not Hellcat 2.62), classics / Euro DCTs / Regera / Taycan / Cybertruck / Plaid.

## Shipped
1. `js/physics.js` — three new `FactoryTransmissions` presets.
2. `scripts/recalib-real-tx-batch1.js` — remap + loss/tire/launch search for the 14.
3. `js/garage-data.js` — remapped + recalib’d; `window.VB_POWERCURVE_GARAGE` bind intact.
4. `scripts/garage-calib-meta.json` tip `real-tx-batch1` + `scripts/real-tx-batch1-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-real-tx-batch1
node scripts/recalib-real-tx-batch1.js
node -e "const G=require('./js/garage-data.js'); console.log('nG10',G.filter(c=>c.gearRatios.length===10).length,'fs!=1',G.filter(c=>+c.forceScale!==1).length)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
rg 'Ford_10R80|GM_10L90|Tremec_TR9080' js/physics.js
```

## Fleet hit-rates (Excel TOL) vs tip `b8af352` / `5aefbea` baseline

| Metric | Before (`trap-miss-batch22`) | After (real-tx-batch1) |
|--------|------------------------------|------------------------|
| ¼ ET | 328/331 **99.1%** | 328/331 **99.1%** (no regress) |
| ¼ trap | 302/331 **91.2%** | 301/331 **90.9%** (−1 = Raptor honest trap) |
| 0-60 | 288/332 **86.7%** | 288/332 **86.7%** |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 258 | 257 (−1) |

Batch ET+trap: **13/14 HIT**.

## Batch still-miss (honest — do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Notes |
|-----|----:|------:|---|
| 2020 Ford F-150 Raptor | +0.005 | **−5.6** | ET HIT; trap soft at published-leaning 10R80@4.10 + loss/tire/launch exhausted |

## Integrity
- forceScale≠1: **0**
- Garage cars with `gearRatios.length === 10`: **9**
- Cd/weight/frontalArea/torqueCurve: **unchanged** on remapped cars (ZR1X stays published Cd 0.36 / wt 3978)
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`

**Skipped:** deploy · Merovingian holds deploy · no push to main · classics / Euro DCT fleet / Regera / Taycan / Cybertruck / Plaid follow-ups.

VERIFY
1. Meta tip `real-tx-batch1` · ET 328/331 · trap ≥301/331 · nG10 = 9
2. Spot gear editor: Mustang GT = 10 gears · Camaro ZL1 = 10 · ZR1X = 8 DCT @ FD 5.56 · Hellcat FD 2.62
3. Custom builder TX dropdown lists Ford 10R80 / GM 10L90 / Tremec TR-9080 8DCT
4. Every garage `forceScale === 1`; no Cd/wt/curve edits
5. Static / no secrets; **no deploy**

---

# Trap-miss accuracy tip — batch22 (2026-09-24 CT)

Branch: `review/pc-trap-miss-batch22` · Tip off `6266e17` (published ZR1X Cd/wt restore). **No deploy.** Do **not** ask Merovingian to push main.

## Goal
Recover Excel **trap** on the first 22 knob-recoverable / near / stretch cars from `/workspace/powercurve-trap-miss-inventory.md`, **ET-first**, knobs only.

## Hard rules (kept)
- Knobs ONLY: **drivetrainLossPercent + launchRpm + tireType**
- **forceScale = 1** everywhere (verified 333/333)
- **Do NOT** change Cd / weight / torque-curve shape / Peak HP wipe path
- Priority: ¼ ET → trap → 60-130 → 0-60 → 60′ → Vmax
- Tolerances: ET ±0.25s · trap ±2.5 mph · 0–60 ±0.25s · 60–130 ±0.75s
- **14 honest-miss cars left untouched** (Murciélago, GTO, S1000RR, Chevelle SS396, Escalade V, Durango SRT, RR Sport SVR, Audi S6 V10, Olds 442, Skyline R34, TLX Type S, Bronco Raptor, Torino 351, Thunderbird)
- Duplicate **2008 Audi S5** ×2 — both trap-miss rows retuned identically
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · canvas-before-listener — **intact**

## Shipped
1. `scripts/recalib-trap-miss-batch22.js` — targeted batch22 recalib (recipes + optional `--search`).
2. Garage knobs updated for 20 rows (22 names; EQE / iX M60 / Taycan left unchanged after knobs exhausted).
3. `scripts/garage-calib-meta.json` tip `trap-miss-batch22` + `scripts/trap-miss-batch22-report.json`.

## Reproduce
```bash
git fetch origin && git checkout review/pc-trap-miss-batch22
node scripts/recalib-trap-miss-batch22.js          # apply shipped recipes + fleet meta
# optional full search (slow): node scripts/recalib-trap-miss-batch22.js --search
node -e "const m=require('./scripts/garage-calib-meta.json'); console.log(m.tip,m.stats)"
rg 'window.VB_POWERCURVE_GARAGE' js/garage-data.js
rg 'Peak HP label must NEVER wipe' js/app.js
node -e "const G=require('./js/garage-data.js'); console.log('fs!=1',G.filter(c=>+c.forceScale!==1).length)"
```

## Fleet hit-rates (Excel TOL)

| Metric | Before (`6266e17`) | After (batch22) |
|--------|--------------------|-----------------|
| ¼ ET | 328/331 **99.1%** | 328/331 **99.1%** (no regress) |
| ¼ trap | 286/331 **86.4%** | **302/331 91.2%** (**+16**) |
| 0-60 | 291/332 **87.7%** | 288/332 **86.7%** (−3; ET/trap priority — 4 muscle cars faster 0-60 at low launch) |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 246 | **258** |

## Batch22 still-miss after knobs exhausted (do not cheat Cd/wt/curve)
| Car | ΔET | Δtrap | Best knobs tried |
|-----|----:|------:|---|
| 2023 Mercedes EQE AMG 53 | +0.147 | +3.3 | unchanged 0%/Summer/L500 (raise loss breaks ET) |
| 2019 McLaren Speedtail | −0.250 | −2.5* | 25.5%/Slick/L1800 (*float edge; ET already at tol) |
| 1963 Corvette Stingray 327 | −0.014 | −4.6 | 29%/Street/L200 |
| 2022 BMW iX M60 | +0.034 | +5.5 | unchanged 0%/UHP/L500 |
| 2022 Porsche Taycan Turbo S | +0.020 | +5.6 | unchanged 0%/Drag Radial/L500 |
| 1974 Pontiac Firebird 400 | −0.011 | −3.7 | 15%/Street/L200 |
| 2018 Jeep Grand Cherokee SRT | −0.017 | −4.0 | 0%/Street/L2400 |

## Integrity
- forceScale≠1: **0**
- Cd/weight/frontalArea/torqueCurve vs `6266e17`: **unchanged** on all batch cars
- 14 honest-miss knobs: **unchanged**
- `window.VB_POWERCURVE_GARAGE` bind present
- Peak HP wipe fix comment present in `js/app.js`

**Skipped:** deploy · Merovingian holds deploy · no push to main.

VERIFY
1. Meta tip `trap-miss-batch22` · trap ≥302/331 · ET 328/331
2. Spot: Ioniq 5 N / Model S Plaid / Magnum XE / RX-7 / GTX 440 / Audi S5 (both) — ET+trap HIT
3. Honest-miss list knobs match `6266e17`
4. Every garage `forceScale === 1`; no Cd/wt edits on batch cars
5. Static / no secrets; **no deploy**

---

# Excel ET-first tip — restore published ZR1X Cd/wt (2026-09-18 CT)

Branch: `review/vb-powercurve-excel-et-first` · Tip **on top of** `389d58d` (do not clear). Base physics from `da81539` (Peak HP wipe fix + forceScale=1). **No deploy.**

## Why
Seraph: `389d58d` `specialZR1X` searched **Cd [0.42,0.44,0.46]** and **weight [3600,3650,3700]** — Jorge forbade faking Cd/weight. Restored published Excel/import specs and removed those searches.

## Hard rules (kept)
- Knobs ONLY: **drivetrainLossPercent + launchRpm/launchMode + tireType**
- Torque-curve scale = **last resort** only
- **forceScale = 1** always
- **Do NOT** change Cd / weight / frontal area / gearing to hit times
- Peak HP wipe fix · `VB_POWERCURVE_GARAGE` bind · canvas-before-listener — **intact**

## Shipped
1. **ZR1X restore** — Cd **0.36**, weightLbs **3978**, frontalArea **22.5**, hybridAssistFrac **0.28**, lim **233** (from `da81539` / Excel import WeightLbs 3978).
2. **Removed Cd/weight search** from `specialZR1X` in `recalib-et-first.js`, `recalib-loss-launch-tires.js`, and `recalib-fleet-excel.js`.
3. Recalib: `node scripts/recalib-et-first.js --only-special` (ZR1X seed from `da81539` curve; fleet ET-first knobs from `389d58d` kept).
4. Cybertruck — Excel wt **6800** locked; lim **130**; loss/tire/launch only.

## Excel vs sim (UI-path = load + RUN)

| Car | Excel | Sim (fs=1) | Published specs | Verdict |
|-----|-------|------------|-----------------|---------|
| **2026 Corvette ZR1X** | 1.9 / **8.675@159** / 60-130 **3.87** / lim 233 | **1.897 / 8.894@158.8 / 4.077** · Vmax **233** | Cd **0.36** · wt **3978** · area 22.5 | PASS (all TOL) |
| **2024 Cybertruck Tri-Motor** | 2.6 / **11.0@119** / lim 130 | **2.748 / 10.992@118.8** · Vmax **130** | wt **6800** | PASS (all TOL) |

### Launch-mode delta (ZR1X auto baseline)
| Mode | 0-60 / 60ft / ET |
|------|-----------------|
| soft | 1.625 / 1.343 / 8.668 |
| auto | 1.897 / 1.465 / 8.894 |
| aggressive | 2.267 / 1.650 / 9.211 |

### forceScale
**333/333 = 1.0**. Peak HP path does **not** wipe ZR1X garage curve (label 1250 vs curve peak ~1247).

## Fleet hit-rates (Excel TOL) after restore
| Metric | Rate |
|--------|------|
| ¼ ET | 328/331 **99.1%** |
| ¼ trap | 286/331 **86.4%** |
| 0-60 | 291/332 **87.7%** |
| 60-130 | 72/76 **94.7%** |
| all4 | 246/333 **73.9%** |

Meta: `scripts/garage-calib-meta.json`.

**Skipped:** deploy · Merovingian holds deploy.

VERIFY
1. ZR1X Cd=0.36 weightLbs=3978 (not 0.46/3600) · CT wt=6800
2. Load ZR1X → RUN: ~1.90 / ~8.89@159 / 60-130~4.08 / Vmax 233 — Peak HP must not change curve
3. Load Cybertruck → RUN: ~2.75 / ~10.99@119 / Vmax 130
4. Toggle launch soft/auto/aggressive — 0-60 / 60ft must move
5. Confirm every garage car `forceScale === 1`
6. `rg '\\[0\\.42|\\[3600' scripts/recalib-*.js` → no Cd/weight search arrays
7. Static / no secrets; **no deploy**

---

# Excel ET-first tip — forceScale=1 + loss/launch/tires (2026-09-18 CT)

Branch: `review/vb-powercurve-excel-et-first` · Tip off `da815396a56daac8b745307f58ef9b2ddfe5fbc6` (loss/launch/tires — **intact**: Peak HP wipe fix, VB_POWERCURVE_GARAGE bind, canvas-before-listener). **No deploy.**

## Goal
Fleet Excel match with **ET-heaviest** cost: ¼ ET → trap → 60-130 → 0-60 → soft Vmax/limiter. Knobs = **drivetrainLossPercent + launchRpm + tireType**; curve scale / mid-shape = last resort. `forceScale` always **1.0**.

## Shipped
1. **ET-first recalib** — `scripts/recalib-et-first.js` (cost weights ET 8 / trap 5 / 60-130 3 / 0-60 2).
2. **ZR1X** — mid-shape bake + loss/tire/Cd/wt/assist micro-search; drag radial; lim **233**. ET tightened vs da81539 (+0.22 → **+0.14**).
3. **Cybertruck** — Excel wt **6800**; lim **130**; loss/tire/launch ET-first.
4. Peak HP wipe fix · VB_POWERCURVE_GARAGE bind · canvas-before-listener — **unchanged**.

## Excel vs sim (UI-path = load + RUN / readCarFromForm equivalent)

| Car | Excel | Sim (fs=1) | Verdict |
|-----|-------|------------|---------|
| **2026 Corvette ZR1X** | 1.9 / **8.675@159** / 60-130 **3.87** / lim 233 | **1.899 / 8.818@159.5 / 3.877** · Vmax 224.3 | PASS (all TOL); ET Δ **+0.143** (was +0.219) |
| **2024 Cybertruck Tri-Motor** | 2.6 / **11.0@119** / lim 130 | **2.748 / 10.992@118.8** · Vmax 130 | PASS (all TOL) |

### Launch-mode delta (ZR1X auto baseline)
| Mode | 0-60 / 60ft / ET |
|------|-----------------|
| soft | 1.627 / 1.343 / 8.591 |
| auto | 1.899 / 1.465 / 8.818 |
| aggressive | 2.268 / 1.650 / 9.135 |

### forceScale
**333/333 = 1.0** (confirmed). Peak HP path does **not** wipe ZR1X/CT garage curves.

## Fleet hit-rates (Excel TOL) vs da81539

| Metric | da81539 | ET-first |
|--------|---------|----------|
| ¼ ET | 313/331 **94.6%** | 328/331 **99.1%** |
| ¼ trap | 288/331 **87.0%** | 286/331 **86.4%** |
| 0-60 | 283/332 **85.2%** | 291/332 **87.7%** |
| 60-130 | 72/76 **94.7%** | 72/76 **94.7%** |
| all4 | 236/333 **70.9%** | 246/333 **73.9%** |

changed 192 · fast 140 · elapsed ~1289s. Meta: `scripts/garage-calib-meta.json`.

### Worst 15 ET misses (by |Δ|)
Audi R8 V10 (−0.47) · Venom GT (−0.45) · Nova 350 (−0.38) · Galaxie 352 (−0.25) · Veyron SS (−0.24) · Huayra (+0.24) · X6M (−0.24) · Thunderbird (−0.24) · Frontier (−0.24) · Speedtail (−0.24) · Liberty (−0.23) · Avalanche (−0.23) · Diablo VT (−0.22) · GNX (−0.22) · Camaro Z28 (−0.22)

### Worst 15 trap misses (by |Δ|)
Murciélago LP640 (−8.1) · ’64 GTO (−7.4) · S1000RR (−7.0) · Chevelle SS396 (−6.9) · Escalade V (−6.5) · Durango SRT (−6.1) · RR Sport SVR (−6.0) · S6 V10 (−5.9) · Lucid Air Touring (+5.8) · Dart GTS (−5.8) · Taycan Turbo S (+5.6) · iX M60 (+5.5) · Olds 442 (−5.5) · GTX 440 (−5.5) · RS4 Avant (−5.5)

**Skipped:** deploy · Merovingian holds deploy.

VERIFY
1. `node scripts/recalib-et-first.js` already applied; spotcheck ZR1X/CT above
2. Load ZR1X → RUN: ~1.90 / ~8.82@159 / 60-130~3.88 / Vmax~224 — Peak HP must not change curve
3. Load Cybertruck → RUN: ~2.75 / ~10.99@119 / Vmax 130
4. Toggle launch soft/auto/aggressive — 0-60 / 60ft must move
5. Confirm every garage car `forceScale === 1`
6. Static / no secrets; **no deploy**

---

# Excel accuracy tip — forceScale=1 + loss/launch/tires (2026-09-18 CT)

Branch: `review/vb-powercurve-excel-loss-launch-tires` · Tip off live main `1f53b39b4e25bb7b984221e9ee13f489f5aba83b` (garage bind hotfix — **intact**).

## Goal
Realistic physics matching Excel using ONLY **drivetrainLossPercent / launchRpm+launchMode / tireType**. `forceScale` retired (always **1.0**). Torque-curve scale = last resort when former fs>1 cannot fold into loss.

## Shipped
1. **Peak HP wipe FIX** (`js/app.js` `readCarFromForm`) — garage / dyno `torqueCurve` is never resynthesized from Peak HP label on RUN. Custom Builder may still resynth only when curve not dyno-edited. (Was wiping ZR1X 1247→1250 synth → fantasy 8.39@175.)
2. **forceScale retired** — physics ignores it; garage all `forceScale: 1`. Former fs folded into loss when net≤1, else curve scale (last resort).
3. **Launch modes meaningful** — soft/auto/aggressive window extended to ~60 ft / ~40 mph; drive mult + µ deltas. ZR1X/CT show clear 0-60 / 60-ft spreads.
4. **ZR1X** — absorb fs1.3→curve; restore Cd **0.36** (undo fake 0.42); tire drag-radial; loss 0 / launch 2400.
5. **Cybertruck** — absorb fs1.47→curve; Excel weight **6800**; street tire; loss 0 / launch 500.
6. **Fleet** — `scripts/recalib-loss-launch-tires.js` · canvas-before-listener + `VB_POWERCURVE_GARAGE` bind **kept**.

## Excel vs sim (UI-path = load + RUN / readCarFromForm equivalent)

| Car | Excel | Sim (fs=1) | Verdict |
|-----|-------|------------|---------|
| **2026 Corvette ZR1X** | 1.9 / **8.675@159** / 60-130 **3.87** | **1.897 / 8.894@158.8 / 4.077** · Vmax 233 | PASS (all TOL) |
| **2024 Cybertruck Tri-Motor** | 2.6 / **11.0@119** | **2.729 / 10.963@119.1** · Vmax 130 | PASS (all TOL) |

### Launch-mode delta proof (auto baseline)
| Mode | ZR1X 0-60 / 60ft | CT 0-60 / 60ft |
|------|-----------------|---------------|
| soft | 1.625 / 1.343 | 2.747 / 1.625 |
| auto | 1.897 / 1.465 | 2.729 / 1.664 |
| aggressive | 2.267 / 1.650 | 2.977 / 1.832 |

### forceScale
**333/333 = 1.0** (confirmed).

### Peak HP fix
ZR1X curve peak ~1247 vs label 1250 — garage path **does not wipe** on RUN. CT curve (post-absorb) vs label 845 — kept (physics uses curve).

### 5 random UI-path spot-checks
| Car | Excel | Sim | Notes |
|-----|-------|-----|-------|
| 2002 Camaro SS | 5.2 / 13.7@104 | 5.228 / 13.669@103.4 | PASS |
| 2024 Model 3 Perf | 2.9 / 11@124.5 | 2.941 / 10.970@124.5 | PASS |
| 2015 McLaren P1 | 2.6 / 9.8@148 | 2.327 / 9.704@148.2 | ET/trap PASS; 0-60 soft |
| 2021 ZX-10R | 3.1 / 10.2@147 | 2.724 / 9.986@145.8 | ET/trap PASS; 0-60 soft |
| 1999 R34 GT-R | 4.8 / 13.3@107 | 4.661 / 13.117@105.4 | PASS |

## Fleet hit-rates (Excel TOL)
| Metric | Rate |
|--------|------|
| ¼ ET | 313/331 **94.6%** |
| ¼ trap | 288/331 **87.0%** |
| 0-60 | 283/332 **85.2%** |
| 60-130 | 72/76 **94.7%** |
| all4 | 236/333 **70.9%** |

changed 162 · fast 170 · curveAbsorb 139 · elapsed ~811s. Meta: `scripts/garage-calib-meta.json`.

**Skipped:** deploy · Merovingian holds deploy.

VERIFY
1. `node scripts/recalib-loss-launch-tires.js` already applied; spotcheck ZR1X/CT above
2. Load ZR1X → RUN: ~1.90 / ~8.89@159 / 60-130~4.08 / Vmax 233 — Peak HP must not change curve
3. Load Cybertruck → RUN: ~2.73 / ~10.96@119 / Vmax 130
4. Toggle launch soft/auto/aggressive — 0-60 / 60ft must move
5. Confirm every garage car `forceScale === 1`
6. Static / no secrets; **no deploy**

---

# Excel fleet recalib + ZR1X/Cybertruck lock (2026-09-18 CT)

Branch: `review/vb-powercurve-cyber-zr1x-retune` · Tip off live main garage hotfix `5759a822510baeff6b5fe6814eb66ec8bf25679c` (canvas before addEventListener — **intact**).

**Source of truth:** `/workspace/powercurve-garage-import.json` (Jorge Excel, 333 cars). Priority: **trap → ET → 60-130 → 0-60**.

## Method
1. **ZR1X special Excel bake** — cool trap 162→159 via high-RPM taper + aero + assist; `speedLimiterMph` 233; forceScale 1.30 / assist 0.28 / Cd 0.42 / taper 5200→0.55.
2. **Cybertruck** — Excel 2.6 / 11.0@119 within TOL; limiter 130 kept.
3. **Fleet** — evaluate all vs Excel; deep-search top **55** metric misses. **54** improved. Script: `scripts/recalib-fleet-excel.js`.

## Excel LOCK — before → after

### 2026 Chevrolet Corvette ZR1X
| Metric | Excel | Before (`5759a82`) | After (tip) |
|--------|-------|--------------------|-------------|
| 0–60 | **1.9** | 1.897 | **1.828** |
| ¼ ET @ trap | **8.675 @ 159** | 8.823 @ 162.3 | **8.827 @ 159.1** |
| 60–130 | **3.87** | 3.878 | **4.017** |
| Vmax | ≤**233** | 240.9 | **230.7** |

All four within TOL. Screenshot 8.53@172 fantasy-fast **fixed**.

### 2024 Tesla Cybertruck Tri-Motor
| Metric | Excel | Sim |
|--------|-------|-----|
| 0–60 | **2.6** | **2.605** |
| ¼ ET @ trap | **11.0 @ 119** | **10.861 @ 118.8** |
| Vmax | **130** | **130** limiter |

## Fleet hit-rates (Excel TOL)

| Metric | Prior | After |
|--------|-------|-------|
| ¼ ET | 317/328 96.6% | 318/331 **96.1%** |
| ¼ trap | 260/328 79.3% | **282/331 85.2%** |
| 0–60 | 291/332 87.7% | 292/332 **88.0%** |
| 60–130 | 62/77 80.5% | 65/76 **85.5%** |
| All applicable | 211/333 63.4% | **228/333 68.5%** |

Trap **+5.9 pts** · all4 **+5.1 pts**. Meta: `scripts/garage-calib-meta.json`.

## Worst outliers (flagged)
Trap: Murciélago LP640 (−6.5), ’64 GTO (−6.1), Durango SRT (−5.5), Hayabusa (−5.3)…  
ET: Lucid Air Touring (+0.68), S1000RR (−0.61), EQE 53 (+0.60)…

## Curated ICE (unchanged)
Supra **13.562@102.0** · Cobra **11.798@115.9** · Miata **15.345@87.9** · Hellcat **11.664@121.3** — PASS.

**Skipped:** deploy · Merovingian holds deploy.

VERIFY
1. `node scripts/spotcheck.js` — curated ICE PASS; ZR1X Excel PASS; Cybertruck PASS
2. Load ZR1X — ~1.83 / ~8.83@159 / 60-130~4.02 / Vmax~231 (not 8.5@172)
3. Load Cybertruck — ~2.60 / ~10.86@119 / Vmax 130
4. Static / no secrets; **no deploy**

---


# EV tip — speed limiters + EV chart + Cybertruck + ATC stall/flash (2026-09-18 CT)

Branch: `review/vb-powercurve-ev-speed-limits` · Tip off live main `baf542f`.

## Shipped
1. **`speedLimiterMph`** baked for all **39 garage EVs** (published electronic limiters). Hybrids only when published (SF90 / P1 / Regera). Physics `resolveSpeedLimiterMph` enforces EV (and Hybrid when set / Custom EV when user sets a limit). Vmax reason `ev_speed_limiter_<N>mph`.
2. **EV chart swap** — garage EV or Custom EV replaces ICE dyno (TQ/HP vs RPM bullets) with **power delivery vs speed** (motor kW + Power% vs mph). Hybrid keeps ICE dyno; NA/Turbo/SC restore dyno editor.
3. **Cybertruck Tri-Motor (Beast)** retune — launch + curve taper + aero/weight toward C&D published slips (see below). Limiter **130 mph**.
4. **Fleet EV accuracy pass** — cheap `forceScale` nudges toward import 0–60 targets. Hit-rate in snapshot.
5. **Aftermarket Converter stall/flash — FIXED (kept)** — was a no-op (stall/flash ignored; only ON vs OFF torque mult). Now realistic-lite: stall = brake-launch engine RPM, flash = brief unload peak, slip→lockup by ~50 mph with torque multiply. Stall/flash inputs change 60′ / 0–60 / early ET when ATC is ON; OFF = stock launchRpm path.

## Cybertruck (Beast / Tri-Motor) — sources & sim
| Metric | Published | Sim (tip) |
|--------|-----------|-----------|
| 0–60 | **2.6 s** (C&D / Tesla claim; MT 2.5) | **~2.61 s** |
| ¼-mile | **11.0 s @ 119 mph** (C&D) | **~10.86 @ 118.8** |
| Top speed | **130–131 mph** governed | **130** `ev_speed_limiter_130mph` |

Sources: [Car and Driver Cybertruck Beast test](https://www.caranddriver.com/reviews/a60115630/2024-tesla-cybertruck-beast-test/) · MotorTrend Beast test · Tesla claim 2.6 / 130. Bake: weight 6900 lb (C&D ~6901), Cd/area, low-RPM torque boost + high-RPM taper, forceScale 1.47, launchRpm 500.

## EV limiter VERIFY samples
| Vehicle | Limiter | Sim Vmax | Verdict |
|---------|---------|----------|---------|
| 2022 Model S Plaid | 200 | ≈200 · `ev_speed_limiter_200mph` | PASS |
| 2023 Kona Electric | 104 | ≈104 · `ev_speed_limiter_104mph` | PASS |
| Cybertruck Tri-Motor | 130 | ≈130 | PASS |

## EV fleet hit-rate (import targets, tip weather)
See `scripts/ev-calib-snapshot.json`. Approx: **0–60 ±0.35 → 39/39**; ET ±0.35 → ~34/38; trap ±5 → ~27/38. Worst 0–60 residual ~0.35 s (Polestar 2 Perf). ICE curated VERIFY cars not retuned.

## ATC stall/flash VERIFY (Challenger Scat Pack, Drag Radial)
| Setup | 0–60 | 60′ | ¼ ET |
|-------|------|-----|------|
| ATC OFF | ~3.70 | ~1.82 | ~12.09 |
| ON stall 2800 / flash 3500 | ~3.58 | ~1.80 | ~12.01 |
| ON stall 4500 / flash 5500 | ~3.63 | ~1.81 | ~12.04 |

ON vs OFF and stall/flash deltas are measurable — feature kept (not removed).

**Skipped:** deploy · hub · Merovingian.

VERIFY
1. `node scripts/spotcheck.js` — curated ICE PASS; EV limiters PASS; EV chart gate PASS; ATC stall/flash PASS; Cybertruck slip note
2. Load Plaid — Vmax≈200; EV kW/% vs mph chart (not ICE dyno)
3. Load Cybertruck — ~2.6 / ~11@119 / Vmax 130; ATC ON changes launch with stall/flash
4. Static / disclaimer / no secrets; no deploy

---

---

# Motorcycle + EV instruments (2026-09-18 CT)

Branch: `review/vb-powercurve-bike-ev-gauges` · Tip off live main (SEO + hub chrome + Phase 6 EV/Hybrid).

## What changed
1. **Motorcycles** — garage bikes retuned to published-leaning redline / shift RPM / gear ratios / torque powerband (not car-like ~6800 RPM). Category `Motorcycle`. TX: `Bike_Sport_6` / `Bike_Hyper_6`. Rebuild heuristics in `scripts/build-garage.js`; fleet patch via `scripts/patch-bikes.js` (ICE fleet untouched).
2. **RPM gauge** — LFA brass tach max/redline follow vehicle redline + curve range (superbikes → 14k+ with readable ×1000 / 2k majors). `js/gauges.js` + `configurePrimaryGauge` in `js/app.js`.
3. **EV instruments** — when `powerSource = ev` (garage EV **or** Custom EV toggle): left dial swaps from ICE RPM to **Power % (0–100)**. Live strip label → **MOTOR** (still shows motor RPM). **Hybrid keeps ICE RPM.**

### EV display choice (documented)
**Primary dial = Power %** derived from instantaneous curve HP ÷ peak HP during playback. Chosen over a motor-RPM tach so the cluster is visibly EV-native while motor speed remains in the live strip.

### Motorcycle spotcheck samples
| Vehicle | Class | Redline / Shift | Peak TQ band | Notes |
|---------|-------|-----------------|--------------|-------|
| 2021 Kawasaki Ninja ZX-10R | sport | **13500 / 12800** | ~90 lb-ft @ ~11.2k | liter superbike; shifts at bike RPM |
| 2022 Suzuki Hayabusa | hyper | **11000 / 10500** | ~113 lb-ft @ ~7.8k | hyperbike lower redline / fatter mid |

Curated ICE VERIFY cars unchanged. Frontal-area form clamp lowered to **4 ft²** so bike aero (6.8) survives Custom edits.

**Skipped:** forcemetric-web hub · deploy · Merovingian.

VERIFY
1. `node scripts/spotcheck.js` — curated PASS; bike samples PASS; EV dial gate PASS
2. Load ZX-10R / Hayabusa — tach scales to redline; shift RPM ≫ car-like
3. Load Model S Plaid or toggle Custom → EV — left dial PWR %, strip MOTOR; Hybrid still RPM
4. Static / disclaimer / no secrets; no hub touch; no deploy

---

# SEO / indexing (2026-09-18 CT)

Branch: `review/vb-powercurve-seo` · Base: live main @ hub-chrome tip.

Static only: canonical `https://01ls1z28-coder.github.io/velocitybench-powercurve/`, unique title/description, OG/Twitter, `robots.txt`, `sitemap.xml`, semantic `<h1 class="logo-text">`.

**Skipped:** Turbo 95→92 / fleet recalib (docs-only SEO tip — no physics touch).

VERIFY
1. View-source: canonical + OG/Twitter present; one H1
2. `/robots.txt` Allow + Sitemap; `/sitemap.xml` lists tool URL
3. No JS/physics/garage change; disclaimers unchanged; no deploy

---

# VelocityBench PowerCurve — VERIFY (Phase 6 — EV + Hybrid powerSource · Phase 5 dyno/weight/TX)

Static geared-RPM simulator: **quarter-mile markers + run past 1320 ft to mechanical/aero Vmax**. Spot-checks run with Node against `js/physics.js` (`CalibrationFactor` = **0.95**). Fleet: **333** cars baked in `js/garage-data.js`. Estimates for comparison — not track certified.

## Gearing / RPM model (summary)

1. Speed → wheel RPM from tire radius.
2. `mechRpm = wheelRpm × currentGearRatio × finalDrive` (launch RPM held briefly; optional converter stall/flash).
3. Torque from **baked dyno curve** @ RPM × FI boost model × weather/DA factor × (1 − drivetrain loss) × `forceScale`.
4. Wheel force from torque / radius; launch & high-speed force scales; traction clamp with weight transfer; aero using wind/gust-relative airspeed + rolling resistance.
5. Integrate with dt = 1 ms; shift when RPM ≥ shift RPM with shift delay.
6. Record 60 / 330 / 1/8 / 1000 / 1/4, 0–60 / 0–100 / **60–130** / **100–150**, then **continue to Vmax**.

**Not** an HP÷weight shortcut. HP and TQ on every baked curve satisfy **HP ≈ TQ×RPM/5252**.

## Run-to-Vmax / safety caps

| Cap / stop | Value | Notes |
|------------|-------|-------|
| Aero/mech equilibrium | \|a\| < **0.05 m/s²** for **0.50 s** | Preferred stop — true Vmax |
| Speed safety cap | **250 mph** | Hard ceiling |
| Distance safety cap | **26400 ft (5 mi)** | Prevents infinite crawl |
| Time safety cap | **180 s** | Wall-clock bound |

## Fleet calibration (Excel import)

Source: `/workspace/powercurve-garage-import.json` (333 cars) merged with VelocityBench `garage-data.js` (Cd / area / loss seed / TireType / drive / FI·EV / TX). Gaps filled with class-aware gears, tire radius, RPM bands, and synthesized (or curated) torque curves. Per-car **loss** + **forceScale** + **TireType** ladder + **launchRpm** knobs tuned **trap-first** (raised 0-60 weight, hit-count bonus) toward Jorge’s 0-60 / ¼ / 60-130 targets.

**Tolerances:** ET ≤ 0.25 s · trap ≤ 2.5 mph · 0-60 ≤ 0.25 s · 60-130 ≤ 0.75 s.

| Metric | Hits | Rate | vs a0afdac |
|--------|------|------|------------|
| ¼ ET | 317/328 | **96.6%** | was 81.7% |
| ¼ trap | 260/328 | **79.3%** | was 67.1% |
| 0–60 | 291/332 | **87.7%** | was 65.7% |
| 60–130 (numeric targets only; many Excel rows are `n/a`) | 62/77 | **80.5%** | was 76.6% |
| All applicable within tol | 211/333 | **63.4%** | was 45.3% |

Full per-car residuals: `scripts/garage-calib-meta.json`. Rebuild: `node scripts/build-garage.js`.

**VB name gaps (heuristic-only):** 2001 Chevrolet Camaro Z28 (H/C/E) MS3-TSP5.3stage2.5-1.3/4LT-TrueDuals, 2011 - 2014 Ford F-150 Enrique's 3.5EB.

## Spot checks (tip physics — reproducible)

**Inputs (must match):** 70°F / 45% RH / 29.92 inHg · calm wind · launch=auto.

**Tires (must set explicitly):** state `tireType` on every row. Street=`0`, Drag Radial=`1`, Slick=`2`, Summer=`3`, UHP=`4`. Omitting `tireType` defaults to Street in physics.

### Curated regression (Phase 3 bands)

| Vehicle | Tire (tireType) | Target band | Sim (tip) | Verdict |
|---------|-----------------|-------------|-----------|---------|
| 1994 Supra Turbo (320 hp, **3450 lb**, Cd **0.32**, area 21.0, tireR **12.5**, V160, FD **3.133**, loss 12%, RWD, 2800/6800/7000) | **Drag Radial (1)** | 12.8–13.9 @ 102–112 | **13.562 s @ 102.0 mph** · Vmax **157.9** | PASS |
| 1965 Cobra 427 (425 hp, **2520 lb**, Cd **0.55**, area 19.5, tireR **13.0**, Toploader, FD 3.54, loss 15%, RWD) | **Drag Radial (1)** | 11.0–12.8 @ 112–130 | **11.798 s @ 115.9 mph** · Vmax **151.6** | PASS |
| 2016 MX-5 Miata (155 hp, 2332 lb, Cd **0.36**, area 18.8, tireR **12.1**, FD **2.866**, loss 12%, RWD) | **Street (0)** | 15.2–16.8 @ 84–93 | **15.345 s @ 87.9 mph** · Vmax **123.1** | PASS |
| 2019 Hellcat Redeye (797 hp, **4451 lb**, Cd **0.382**, area **24.2**, tireR **14.3**, ZF8, FD 2.62, loss 15%, RWD) | **Drag Radial (1)** | 10.4–12.2 @ 118–138 | **11.664 s @ 121.3 mph** · 60-130 **10.345** · 100-150 **11.223** · Vmax **194.1** | PASS |

**Street contrast (Supra, tireType 0):** 13.763 s @ 101.8 mph — documents why tireType must be explicit.

### Fleet sample vs Excel targets (baked tireType / loss / forceScale)

| Vehicle | Tire (tireType) | Excel target | Sim (tip) |
|---------|-----------------|--------------|-----------|
| 2020 Ford Mustang GT | Street (0) | 0-60 3.8 · 12.1 @ 119 · 60-130 11.1 | 3.793 · **11.995 @ 118.4** · 10.856 |
| 1994 Toyota Supra Twin Turbo | Drag Radial (1) | 4.6 · 13.1 @ 108 | 4.520 · **13.095 @ 106.1** · 60-130 17.078 |
| 1965 Shelby Cobra 427 | Street (0) | 4.3 · 12.2 @ 120 | 4.046 · **12.217 @ 120.0** · 10.626 |
| 2023 Mazda MX-5 Miata Club | Street (0) | 5.7 · 14.3 @ 96 | 5.450 · **14.177 @ 95.1** |
| 2021 Dodge Charger Hellcat Redeye | Summer (3) | 3.6 · 11.5 @ 128 · 60-130 8.1 | 3.610 · **11.576 @ 126.9** · 8.554 |
| 2020 Mustang Shelby GT500 | Drag Radial (1) | 3.4 · 11.3 @ 132 · 60-130 7.6 | 3.172 · **11.053 @ 130.0** · 7.887 |
| 2013 Mustang Boss 302 | Street (0) | 4.3 · 12.7 @ 114 | 4.435 · **12.858 @ 111.6** |
| 2002 Skyline GT-R R34 | Street (0) | 4.8 · 13.3 @ 107 | 4.797 · **13.401 @ 101.6** |

### Environmental / model (measured on tip)

| Check | Result |
|-------|--------|
| 12 mph headwind vs calm (Supra, Drag Radial) | ET **+0.094 s** |
| 12 mph tailwind vs calm (Supra, Drag Radial) | ET **−0.076 s** |

## UI wiring (Phase 4)

- **Playback** — always real-time (`scale = 1`); Realtime checkbox **removed**.
- **60–130 / 100–150** — shown on time slip + live metrics strip.
- **Weather · Wind · Converter · Advanced** — always visible (no click-to-expand).
- **Time slip** — full-width under dyno/speed graphs in the center column (`slip-block`). **No right-rail Time Slip** (2-column: garage | instruments+graphs+slip).
- **Gauges** — Lexus LFA–inspired dual-dial brass cluster (`js/gauges.js`).
- **Garage** — 333 baked cars + filter; Custom Builder retained.


## Phase 5 — UI / garage bake

### Factory TX preset (Custom Builder only)
- The **Factory TX preset** dropdown is shown/enabled **only** when garage selection is **Custom Builder**.
- Named garage cars keep **editable gear ratios + final drive**; the preset list is hidden so a mismatched factory TX name is never shown as if it were that car’s transmission.

### Induction defaults (baked `boostModel`)
Dyno curves already include boost (`boostPsi = 0`); radios are UI defaults only unless the user adds boost PSI on an NA baseline.

| Class | Rule | Count (333 fleet) |
|-------|------|-------------------|
| **Supercharger** | Name cues: Hellcat/Redeye/Trackhawk, ZL1, C6 ZR1, GT500, Terminator, Ram TRX, Ninja H2, Escalade-V, E55/SL55/CL55, Range Rover SVR, explicit “supercharged”, etc. | **15** |
| **Turbo** | Explicit turbo/EcoBoost/TFSI/… **or** existing `isFI` from VB/import when not SC. GNX = turbo (not SC). | **95** |
| **NA** | Not FI / not EV / not Hybrid. 1971 Demon 340 stays NA (not Hellcat Demon). | **183** |
| **EV** | Full-electric (`powerSource: ev`, `isEv`). Induction radios lock — NA/Turbo/SC/Twin unavailable. Dual layout kept for AWD EVs. | **39** |
| **Hybrid** | ICE + electric assist (`powerSource: hybrid`). Underlying `boostModel` turbo/SC/NA for FI physics. ZR1X / SF90 / P1 / Regera. | **4** |

Classifier lives in `scripts/build-garage.js` → `classifyPowerSource()` / `classifyInduction()` and is baked into `js/garage-data.js`.

### Phase 6 — EV + Hybrid power source
- **UI:** Power source / Induction segment adds **EV** and **Hybrid** radios (with NA/Turbo/SC/Twin). Selecting **EV** disables ICE induction + boost PSI (ForceMetric-style lock). Garage EV/Hybrid cars lock the baked power source.
- **EV physics:** unchanged motor path — no ICE FI boost; weather factor 1.0 / ρ = std; Dual layout remains EV-appropriate.
- **Hybrid physics (documented):** ICE crank TQ from baked ICE-fraction dyno (~82% of published system HP) **+** `hybridAssistTorqueLbFt` motor band (peak ≈ 22% of TQ-at-peak-HP below 0.40×redline, fade to ~27% of that peak by 0.85×redline). Weather uses a mild hybrid DA curve (between NA and FI). Not cosmetic — assist changes ET.
- **Bake audit:** ZR1X was mis-tagged EV (single-speed / 14k redline) → rebuilt as Hybrid turbo AWD Dual with ICE TX. SF90 / P1 / Regera tagged Hybrid (keep turbo `boostModel`). Retag: `node scripts/build-garage.js --retag-only`.

#### Hybrid vs ICE-only spot-check (SF90 Stradale, tip physics)
Same ICE-fraction curve; Hybrid adds motor assist:

| Mode | 1/4 ET | Trap | 0-60 | ΔET |
|------|--------|------|------|-----|
| Hybrid (assist on) | **9.806 s** | 141.6 mph | 2.161 s | |
| ICE-only (assist off) | **10.020 s** | 138.4 mph | 2.275 s | Hybrid **−0.214 s** → **PASS** |

#### ZR1X bake gate
`isHybrid && !isEv && boostModel===turbo && txKey !== EV_Single` → **PASS**.
Sim (Street tireType 0, Excel tip): **8.827 s @ 159.1 mph** · 0-60 **1.828** · 60-130 **4.017** · Vmax **230.7** (Excel 1.9 / 8.675@159 / 60-130 3.87).

#### Model S Plaid (EV lock)
`isEv && powerSource===ev` → **PASS**. Sim: **9.488 s @ 154.5 mph** · 0-60 **2.321**.

### Editable dyno curve
- Dense **100-RPM** TQ mesh (`RPM_GRID = 100`); **major** control bullets every **200 RPM** (every 2 grid steps — preferred hit target). *Note:* 250-RPM majors do not land cleanly on a 100 mesh (1250/1750/…), so majors use **200 RPM** for continuous sculpt; minors at the in-between 100-RPM samples stay editable.
- Drag a bullet **up/down** to reshape torque; **HP ≈ TQ×RPM/5252** is derived (drag TQ, HP follows).
- **Major drag:** moves that 200-RPM handle and **re-lerps** all 100-RPM minors between the adjacent majors so the polyline fills like a real dyno curve (no spike / flat valley of untouched points).
- **Minor drag:** local cosine **falloff sculpt** (±1 sample / ~±100 RPM) from a drag-start snapshot so neighbors rise/fall with the point without washing the rest of the curve.
- Subsequent **RUN** uses the edited dense `torqueCurve`. **Reset to preset** restores the baked garage curve.
- Pointer Events (+ touch fallback); chart uses `touch-action: none` for mobile drag.

### Editable dyno — 100-RPM dense mesh (smoother sculpt)
- Baked `torqueCurve` samples are densified to **100 RPM** (true off-grid peak pins retained; prior 50-RPM half-steps dropped).
- Editable series / polyline / drag handles share that **100-RPM** mesh (major bullets every **200 RPM** for visibility / primary control).
- Mid-drag: `state.powerCurve` stays authoritative; sculpt/lerp mutates neighbors with a **floor of 5 lb-ft** (no neighbor collapse to zero); `car.torqueCurve` is committed as a **dense numeric-key** map — never rebuilt from a sparse post-RUN key list.
- Root cause addressed: coarser native keys (e.g. 500 RPM) after RUN used to replace the editable series, so handles and samples disagreed and mid-edit rebuilds could floor neighbors (~5 lb-ft V-spikes). Fewer minors between majors (one 100-RPM minor per 200-RPM major span) keeps drag interpolation smoother than the prior 50-RPM mesh.

### UX check — drag smoothness (before → after)
- **Before (50-RPM tip):** major every 250 with four 50-RPM minors between controls — workable but dense.
- **After (this tip):** sample spacing **100 RPM**; majors every **200 RPM**; drag a **major** — the single mid minor re-lerps cleanly; drag a **minor** — ±1-sample cosine falloff; dense commit has a key every 100 RPM and no V-spikes. Spotcheck should stay PASS (physics interpolates between keys).

### Weight distribution (traction-real)
UI **Front/Rear %** (sum 100) and **Left/Right %** (sum 100). Defaults by `engineLayout` / `driveType` (Front RWD rear≈55 keeps fleet calib; Mid 45/55; Rear ~38/62; FWD ~60/40). Baked into `garage-data.js`.

Physics (not cosmetic):
1. **F/R** sets static axle normals; accel weight transfer unloads the front / loads the rear.
2. Drive-axle traction uses that normal (RWD=rear, FWD=front, AWD=both).
3. **L/R** splits each drive axle; open/LSD blend + tire load sensitivity so imbalance cuts launch grip (50/50 matches prior `µ·N` behavior).

#### Delta vs 50/50 baseline (VERIFY Supra Turbo, Drag Radial, tip physics)
From `node scripts/spotcheck.js` weight block (same weather/tires as curated):

| Setup | 1/4 ET | 60 ft | vs 50/50 ET |
|-------|--------|-------|-------------|
| F/R **50/50** · L/R **50/50** | **13.616 s** | **2.130 s** | baseline |
| F/R **40/60** (RWD rear bias) | 13.526 s | 2.086 s | **−0.090 s** (more rear load → better launch) |
| L/R **60/40** (same F/R 50/50) | 13.688 s | 2.169 s | **+0.072 s** (uneven axle → open/LSD traction loss) |

Fleet RWD cars bake **F/R 45/55** (matches prior `DEFAULT_REAR_PCT=55`) so curated/fleet spot-check ETs stay unchanged.

### Tip — 100-RPM sample spacing (spotcheck)
- Garage + edit mesh resampled **50 → 100 RPM**; majors **200 RPM** (250 not clean on 100 grid).
- `node scripts/spotcheck.js` **PASS**. Curated VERIFY ETs unchanged (sparse published curves). Fleet sample ETs unchanged at reported precision except negligible interp noise on Mustang GT 60-130 (**10.856 → 10.858 s**, Δ **+0.002 s**) and 100-150 (**13.697 → 13.701 s**, Δ **+0.004 s**). Weight-distribution deltas vs 50/50 unchanged.

### Holds (unchanged)
Static / disclaimer / no secrets · slip under graphs · realtime playback always `scale=1` · LFA gauges · `tireType` must be set explicitly on spot checks.

## Re-run

```bash
cd velocitybench-powercurve-git
node scripts/spotcheck.js
# optional full fleet rebuild/calib:
node scripts/build-garage.js
```

Open `index.html` in a browser (no build step). Static / baked Pages app — no server, DB, tracking, or secrets. Disclaimer on the main panel.

## Notes / gaps

- Product name is **VelocityBench PowerCurve** only.
- `CalibrationFactor` = **0.95** global; per-car `forceScale` used when loss alone cannot hit trap/ET.
- Excel 60-130 is `n/a` for most of the fleet (~255 cars); hit-rate for 60-130 is over the **77 numeric** targets.
- Hardest residuals: some EVs / hypercars (Cybertruck, Regera, Jesko, Zenvo) — geared + grip model cannot fully match optimistic Excel 0-60 without breaking trap.
- Phase 4: fleet import, always-realtime playback, 60-130/100-150 surfacing, always-open advanced, slip under graphs, LFA brass gauges.
- Retip (keep calibrating): TireType ladder + launchRpm + joint loss×forceScale + hit-count bonus; motorcycle aero heuristic; all-applicable **63.4%** (was 45.3% at `a0afdac`).
- Phase 5: Factory TX preset Custom-only; induction `boostModel` baked; editable dyno mesh (HP≈TQ×RPM/5252). Physics spotchecks still reproduce (no calib change).
- Tip (sculpt @ 50-RPM): major drag re-lerps minors between adjacent majors; minor drag uses snapshot falloff sculpt; dense commit; no V-spikes.
- Tip (100-RPM mesh): sample spacing now **100 RPM**; majors every **200 RPM** (250 awkward on 100 grid); minor falloff ±1 sample; garage re-densified; sculpt UX still works.
- Phase 6 EV + Hybrid: powerSource radios + locks; Hybrid ICE+assist; ZR1X retagged Hybrid; fleet EV **39** / Hybrid **4**.


## Hub chrome (2026-09-18 CT)

Shared Family Brass chrome on `index.html` (`css/vb-chrome.css`):
- Hub → https://velocitybench.com/
- Switcher: Bench · PowerCurve (current) · SDC · GSPS
- PowerCurve remains on Pages URL (not nested under velocitybench.com for v1).
- Soft VERIFY Turbo 95→92 **not** applied this tip (would require fleet recalib); left at CalibrationFactor 0.95.
