# VelocityBench PowerCurve — VERIFY (Phase 3 ADDENDUM)

Static geared-RPM simulator: **quarter-mile markers + run past 1320 ft to mechanical/aero Vmax**. Spot-checks run with Node against `js/physics.js` (`CalibrationFactor` = **0.95**). Estimates for comparison — not track certified.

## Gearing / RPM model (summary)

1. Speed → wheel RPM from tire radius.
2. `mechRpm = wheelRpm × currentGearRatio × finalDrive` (launch RPM held briefly; optional converter stall/flash).
3. Torque from **baked dyno curve** @ RPM × FI boost model × weather/DA factor × (1 − drivetrain loss).
4. Wheel force from torque / radius; launch & high-speed force scales; traction clamp with weight transfer; aero using wind/gust-relative airspeed + rolling resistance.
5. Integrate with dt = 1 ms; shift when RPM ≥ shift RPM with shift delay.
6. Record 60 / 330 / 1/8 / 1000 / 1/4 and 0–60 / 0–100, then **continue to Vmax**.

**Not** an HP÷weight shortcut. HP and TQ on every baked curve satisfy **HP ≈ TQ×RPM/5252**.

## Run-to-Vmax / safety caps

After the 1320 ft mark is recorded, integration continues until one of:

| Cap / stop | Value | Notes |
|------------|-------|-------|
| Aero/mech equilibrium | \|a\| < **0.05 m/s²** for **0.50 s** | Preferred stop — true Vmax |
| Speed safety cap | **250 mph** | Hard ceiling (documented) |
| Distance safety cap | **26400 ft (5 mi)** | Prevents infinite crawl |
| Time safety cap | **180 s** | Wall-clock bound |

Quarter-mile ET/trap are frozen at the 1320 crossing; time slip / gauges / speed-path chart show the path to top speed. Markers at 60 / 330 / 660 / 1000 / 1320 ft remain.

## Spot checks (tip physics — reproducible)

**Inputs (must match):** 70°F / 45% RH / 29.92 inHg · calm wind · launch=auto · garage sample cars from `js/app.js` (mirrored in `scripts/spotcheck.js`).

**Tires (must set explicitly):** state `tireType` on every row. Drag Radial (`tireType: 1`) for Supra / Cobra / Redeye; Street (`tireType: 0`) for Miata. Omitting `tireType` defaults to Street in physics and yields slower ETs — that is **not** the VERIFY table below.

| Vehicle | Tire (tireType) | Target band | Sim (tip) | Verdict |
|---------|-----------------|-------------|-----------|---------|
| 1994 Supra Turbo (320 hp @ 5600 / 315 lb-ft @ 4000, **3450 lb**, Cd **0.32**, area 21.0, tireR **12.5**, V160 gears, FD **3.133**, loss 12%, RWD, launch/shift/redline 2800/6800/7000) | **Drag Radial (1)** | 12.8–13.9 @ 102–112 | **13.562 s @ 102.0 mph**, 60ft 2.102, 4 shifts · Vmax **157.9 mph** (equilibrium) | PASS |
| 1965 Cobra 427 (425 hp @ 6000 / 480 lb-ft @ 3500, **2520 lb**, Cd **0.55**, area 19.5, tireR **13.0**, close-ratio Toploader **2.20/1.66/1.31/1.00**, FD 3.54, loss 15%, RWD, 3000/6200/6500) | **Drag Radial (1)** | 11.0–12.8 @ 112–130 | **11.798 s @ 115.9 mph**, 60ft 1.905, 3 shifts · Vmax **151.6 mph** (equilibrium) | PASS |
| 2016 MX-5 Miata (155 hp @ 6000 / 148 lb-ft @ 4600, 2332 lb, Cd **0.36**, area 18.8, tireR **12.1**, gears w/ 5th **1.286**, FD **2.866**, loss 12%, RWD, 3500/7200/7500) | **Street (0)** | 15.2–16.8 @ 84–93 | **15.345 s @ 87.9 mph**, 60ft 2.207, 4 shifts · Vmax **123.1 mph** (equilibrium) | PASS |
| 2019 Hellcat Redeye (797 hp @ 6300 / 707 lb-ft @ 4500, **4451 lb**, Cd **0.382**, area **24.2**, tireR **14.3**, ZF8 **4.71/3.14/2.11/1.67/1.28/1.00/0.84/0.67**, FD 2.62, loss 15%, RWD, 2200/6100/6500) | **Drag Radial (1)** | 10.4–12.2 @ 118–138 | **11.664 s @ 121.3 mph**, 60ft 1.891, 5 shifts · Vmax **194.1 mph** (equilibrium) | PASS |

**Street contrast (Supra, tireType 0):** 13.763 s @ 101.8 mph — documents why tireType must be explicit.

### Specs changed vs prior tip (published-leaning)

| Car | Soft / wrong before | Hardened to |
|-----|---------------------|-------------|
| Supra | wt 3410, Cd 0.31, tireR 12.9, FD 3.27 | wt **3450**, Cd **0.32**, tireR **12.5** (255/40R17), FD **3.133** (USDM V160) |
| Cobra | wt 2450, Cd 0.50, gears 2.32/1.69/1.29, tireR 13.5 | wt **2520**, Cd **0.55**, close-ratio **2.20/1.66/1.31**, tireR **13.0** |
| Miata | Cd 0.31 (optimistic soft-top), 5th 1.290, FD 2.87, tireR 12.2 | Cd **0.36**, 5th **1.286**, FD **2.866**, tireR **12.1**, peak TQ @ **4600** |
| Redeye | wt 4445, Cd 0.38, area 25.0, tireR 14.2, 3rd/5th 2.10/1.29 | wt **4451**, Cd **0.382**, area **24.2**, tireR **14.3**, gears **2.11/1.28** |
| R34 (garage) | Supra V160 gears (wrong) | **Getrag** 3.214/1.925/1.302/1.000/0.752/0.634, FD 3.545 |
| GT500 (garage) | Soft DCT ratios 3.25/2.31/… | **Tremec TR-9070** 3.14/2.05/1.43/1.10/0.86/0.68/0.56, wt **4183** |

### Curve peak integrity (baked)

| Car | Peak TQ | Peak HP (TQ×RPM/5252) | Label peakHp |
|-----|---------|------------------------|--------------|
| Supra | 315 @ 4000 | 319.9 @ 5600 | 320 |
| Cobra | 480 @ 3500 | 425.0 @ 6000 | 425 |
| Miata | 148 @ 4500 | 155.4 @ 6000 | 155 |
| Redeye | 707 @ 4500 | 797.7 @ 6300 | 797 |

### Environmental / model (measured on tip)

| Check | Result |
|-------|--------|
| 12 mph headwind vs calm (Supra, Drag Radial) | ET **+0.094 s** |
| 12 mph tailwind vs calm (Supra, Drag Radial) | ET **−0.076 s** |
| NA Supra-curve DA 0 → 5000 ft (Drag Radial) | ET **+0.953 s** |
| NA Supra-curve + turbo 12 psi (Drag Radial) | ET **−2.105 s** |
| Extremes 1 hp/20 lb and 15000 hp/120000 lb | both finish; Vmax ~39 / 250 mph (speed cap) |

## UI wiring (confirmed on tip)

- **FactoryTransmissions** — `js/physics.js` exports presets; `js/app.js` populates `#txPreset`.
- **Weather / DA / Wind / FI** — wired into `runQuarterMile`.
- **Dyno chart** — HP/TQ vs RPM with **numeric RPM / HP / TQ axis ticks** + peak & cursor readout (hover scrub; live RPM scrub during playback).
- **Playback** — long Vmax runs compress to ~12 s wall (`scale = max(1, duration/12000)`); optional **Realtime playback** checkbox.
- **Speed path chart** — mph vs feet with ¼-mi markers + Vmax point.
- **Layout** — tighter desktop columns (300 / 1fr / 280), 2-col tablet ≤1200px, mobile ≤800px; no overflow; brass/dark + gauges retained.

## Re-run

```bash
cd velocitybench-powercurve-git
node scripts/spotcheck.js
```

Open `index.html` in a browser (no build step). Static / baked Pages app — no server, DB, tracking, or secrets. Disclaimer on the time-slip panel.

## Notes

- Phase 3 ADDENDUM: garage specs hardened to published curb/Cd/area/tires/gearing; spotcheck **prints specs used**; VERIFY times+specs match tip; Phase 3 playback (~12 s) + dyno numeric axes retained; layout polished desktop+mobile.
- Garage FI dyno curves already include boost — use Boost PSI only on an NA baseline.
- Product name is **VelocityBench PowerCurve** only.
- `CalibrationFactor` = **0.95** on this tip.
