# VelocityBench PowerCurve — VERIFY (Phase 3)

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
| Aero/mech equilibrium | \|a\| &lt; **0.05 m/s²** for **0.50 s** | Preferred stop — true Vmax |
| Speed safety cap | **250 mph** | Hard ceiling (documented) |
| Distance safety cap | **26400 ft (5 mi)** | Prevents infinite crawl |
| Time safety cap | **180 s** | Wall-clock bound |

Quarter-mile ET/trap are frozen at the 1320 crossing; time slip / gauges / speed-path chart show the path to top speed. Markers at 60 / 330 / 660 / 1000 / 1320 ft remain.

## Spot checks (tip physics — reproducible)

**Inputs (must match):** 70°F / 45% RH / 29.92 inHg · calm wind · launch=auto · garage sample cars from `js/app.js` (mirrored in `scripts/spotcheck.js`).

**Tires (must set explicitly):** state `tireType` on every row. Drag Radial (`tireType: 1`) for Supra / Cobra / Redeye; Street (`tireType: 0`) for Miata. Omitting `tireType` defaults to Street in physics and yields slower ETs — that is **not** the VERIFY table below.

| Vehicle | Tire (tireType) | Target band | Sim (tip) | Verdict |
|---------|-----------------|-------------|-----------|---------|
| 1994 Supra Turbo (curve ~320 hp @ 5600 / 315 lb-ft @ 4000, 3410 lb, 6-spd, 3.27) | **Drag Radial (1)** | 12.8–13.9 @ 102–112 | **13.490 s @ 102.6 mph**, 60ft 2.082, 4 shifts · Vmax **159.2 mph** (equilibrium) | PASS |
| 1965 Cobra 427 (curve ~425 hp @ 6000 / 480 lb-ft @ 3500, 2450 lb, 4-spd, 3.54) | **Drag Radial (1)** | 11.0–12.8 @ 112–130 | **11.676 s @ 117.4 mph**, 60ft 1.902, 3 shifts · Vmax **154.0 mph** (equilibrium) | PASS |
| 2016 MX-5 Miata (curve ~155 hp @ 6000 / 148 lb-ft @ 4500, 2332 lb) | **Street (0)** | 15.2–16.8 @ 84–93 | **15.286 s @ 88.8 mph**, 60ft 2.210, 4 shifts · Vmax **129.3 mph** (equilibrium) | PASS |
| 2019 Hellcat Redeye (curve ~797 hp @ 6300 / 707 lb-ft @ 4500, 4445 lb, 8-spd, 2.62) | **Drag Radial (1)** | 10.4–12.2 @ 118–138 | **11.669 s @ 121.1 mph**, 60ft 1.891, 5 shifts · Vmax **192.3 mph** (equilibrium) | PASS |

**Street contrast (Supra, tireType 0):** 13.700 s @ 102.4 mph — documents why tireType must be explicit.

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
| 12 mph headwind vs calm (Supra, Drag Radial) | ET **+0.092 s** |
| 12 mph tailwind vs calm (Supra, Drag Radial) | ET **−0.074 s** |
| NA Supra-curve DA 0 → 5000 ft (Drag Radial) | ET **+0.942 s** |
| NA Supra-curve + turbo 12 psi (Drag Radial) | ET **−2.080 s** |
| Extremes 1 hp/20 lb and 15000 hp/120000 lb | both finish; Vmax ~39 / 250 mph (speed cap) |

## UI wiring (confirmed on tip)

- **FactoryTransmissions** — `js/physics.js` exports presets; `js/app.js` populates `#txPreset`.
- **Weather / DA / Wind / FI** — wired into `runQuarterMile`.
- **Dyno chart** — HP/TQ vs RPM with **numeric RPM / HP / TQ axis ticks** + peak & cursor readout (hover scrub; live RPM scrub during playback).
- **Playback** — long Vmax runs compress to ~12 s wall (`scale = max(1, duration/12000)`); optional **Realtime playback** checkbox.
- **Speed path chart** — mph vs feet with ¼-mi markers + Vmax point.
- **Layout** — CSS-only overflow fixes for desktop and mobile ≤800px; brass/dark theme retained.

**Phase 3 spot-check:** physics numbers unchanged from Phase 2 tip; table above still reproduces with `tireType` explicit.

## Re-run

```bash
cd velocitybench-powercurve-git
node scripts/spotcheck.js
```

Open `index.html` in a browser (no build step). Static / baked Pages app — no server, DB, tracking, or secrets. Disclaimer on the time-slip panel.

## Notes

- Phase 2: realistic baked dyno curves (not flat synth blobs); HP/TQ consistent; specs tightened toward published curb/Cd/tires/gearing; sim runs past 1320 to Vmax; GUI overflow fixed.
- Garage FI dyno curves already include boost — use Boost PSI only on an NA baseline.
- Product name is **VelocityBench PowerCurve** only.
- `CalibrationFactor` = **0.95** on this tip (retuned vs Phase 1 0.92 after HP-consistent curve bake).
