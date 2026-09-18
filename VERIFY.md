# VelocityBench PowerCurve — VERIFY (Phase 5 — editable dyno 50-RPM · weight distribution · TX/induction)

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
| **NA** | Not FI / not EV. 1971 Demon 340 stays NA (not Hellcat Demon). | **183** |
| **EV** | Unchanged (`isEv`; induction radio stays NA). | **40** |

Classifier lives in `scripts/build-garage.js` → `classifyInduction()` and is baked into `js/garage-data.js`.

### Editable dyno curve
- Dense **50-RPM** TQ mesh; control bullets on that grid (majors every 250 RPM).
- Drag a bullet **up/down** to reshape torque; **HP ≈ TQ×RPM/5252** is derived (drag TQ, HP follows).
- Subsequent **RUN** uses the edited dense `torqueCurve`. **Reset to preset** restores the baked garage curve.
- Pointer Events (+ touch fallback); chart uses `touch-action: none` for mobile drag.


### Editable dyno — 50-RPM dense mesh (V-spike fix)
- Baked `torqueCurve` samples are densified to **50 RPM** (off-grid peak pins retained).
- Editable series / polyline / drag handles share that **50-RPM** mesh (major bullets every 250 RPM for visibility).
- Mid-drag: `state.powerCurve` stays authoritative; only the hit sample’s TQ changes (light ±1 neighbor blend); `car.torqueCurve` is committed as a **dense numeric-key** map — never rebuilt from a sparse post-RUN key list.
- Root cause addressed: coarser native keys (e.g. 500 RPM) after RUN used to replace the editable series, so handles and samples disagreed and mid-edit rebuilds could floor neighbors (~5 lb-ft V-spikes).

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
- Phase 5: Factory TX preset Custom-only; induction `boostModel` baked; editable 250-RPM dyno bullets (HP≈TQ×RPM/5252). Physics spotchecks still reproduce (no calib change).
