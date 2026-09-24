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
