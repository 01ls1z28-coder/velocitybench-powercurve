# VelocityBench PowerCurve — VERIFY (Phase 4)

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

Source: `/workspace/powercurve-garage-import.json` (333 cars) merged with VelocityBench `garage-data.js` (Cd / area / loss seed / TireType / drive / FI·EV / TX). Gaps filled with class-aware gears, tire radius, RPM bands, and synthesized (or curated) torque curves. Per-car **loss** + **forceScale** (+ tire bump when needed) tuned **trap-first** toward Jorge’s 0-60 / ¼ / 60-130 targets.

**Tolerances:** ET ≤ 0.25 s · trap ≤ 2.5 mph · 0-60 ≤ 0.25 s · 60-130 ≤ 0.75 s.

| Metric | Hits | Rate |
|--------|------|------|
| ¼ ET | 268/328 | **81.7%** |
| ¼ trap | 220/328 | **67.1%** |
| 0–60 | 218/332 | **65.7%** |
| 60–130 (numeric targets only; many Excel rows are `n/a`) | 59/77 | **76.6%** |
| All applicable within tol | 151/333 | **45.3%** |

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
| 2020 Ford Mustang GT | Street (0) | 0-60 3.8 · 12.1 @ 119 · 60-130 11.1 | 3.910 · **12.130 @ 117.2** · 11.234 |
| 1994 Toyota Supra Twin Turbo | Drag Radial (1) | 4.6 · 13.1 @ 108 | 4.366 · **12.937 @ 107.2** · 60-130 16.411 |
| 1965 Shelby Cobra 427 | Drag Radial (1) | 4.3 · 12.2 @ 120 | 3.659 · **12.145 @ 114.6** · 13.538 |
| 2023 Mazda MX-5 Miata Club | Street (0) | 5.7 · 14.3 @ 96 | 5.610 · **14.319 @ 94.1** |
| 2021 Dodge Charger Hellcat Redeye | Drag Radial (1) | 3.6 · 11.5 @ 128 · 60-130 8.1 | 3.207 · **11.281 @ 126.7** · 8.723 |
| 2020 Mustang Shelby GT500 | Drag Radial (1) | 3.4 · 11.3 @ 132 · 60-130 7.6 | 3.160 · **11.006 @ 130.9** · 7.698 |
| 2013 Mustang Boss 302 | Street (0) | 4.3 · 12.7 @ 114 | 4.225 · **12.649 @ 112.9** |
| 2002 Skyline GT-R R34 | Street (0) | 4.8 · 13.3 @ 107 | 4.660 · **13.263 @ 102.6** |

### Environmental / model (measured on tip)

| Check | Result |
|-------|--------|
| 12 mph headwind vs calm (Supra, Drag Radial) | ET **+0.094 s** |
| 12 mph tailwind vs calm (Supra, Drag Radial) | ET **−0.076 s** |

## UI wiring (Phase 4)

- **Playback** — always real-time (`scale = 1`); Realtime checkbox **removed**.
- **60–130 / 100–150** — shown on time slip + live metrics strip.
- **Weather · Wind · Converter · Advanced** — always visible (no click-to-expand).
- **Time slip** — under the graphs (2-column layout: garage | instruments+slip).
- **Gauges** — Lexus LFA–inspired dual-dial brass cluster (`js/gauges.js`).
- **Garage** — 333 baked cars + filter; Custom Builder retained.

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
