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
Sim (Street tireType 0): **8.823 s @ 162.3 mph** · 0-60 **1.897** · 60-130 **3.878** (Excel ~1.9 / 8.675@159 / 60-130 3.87).

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
