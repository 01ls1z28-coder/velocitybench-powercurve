# VelocityBench PowerCurve — VERIFY

Static geared-RPM quarter-mile simulator. Spot-checks run with Node against `js/physics.js` (`CalibrationFactor` ≈ 0.92). Estimates for comparison — not track certified.

## Gearing / RPM model (summary)

1. Speed → wheel RPM from tire radius.
2. `mechRpm = wheelRpm × currentGearRatio × finalDrive` (launch RPM held briefly; optional converter stall/flash).
3. Torque from curve @ RPM × FI boost model × weather/DA factor × (1 − drivetrain loss).
4. Wheel force from torque / radius; launch & high-speed force scales; traction clamp with weight transfer; aero using wind/gust-relative airspeed + rolling resistance.
5. Integrate with dt = 1 ms; shift when RPM ≥ shift RPM with shift delay.
6. Record 60 / 330 / 1/8 / 1000 / 1/4 and 0–60 / 0–100.

**Not** an HP÷weight shortcut.

## Spot checks (~70°F / 45% RH / 29.92 inHg)

| Vehicle | Target band | Sim | Verdict |
|---------|-------------|-----|---------|
| 1994 Supra Turbo (curve ~320 hp, 3450 lb, 6-spd, 3.27) | 12.8–13.9 @ 102–112 | **12.986 s @ 109.4 mph**, 60ft 2.160, 3 shifts | PASS |
| 1965 Cobra 427 (curve ~425 hp, 2450 lb, 4-spd, 3.54) | 11.0–12.8 @ 112–130 | **11.192 s @ 127.0 mph**, 60ft 1.938, 3 shifts | PASS |
| 2016 MX-5 Miata (street tire) | 15.2–16.8 @ 84–93 | **15.425 s @ 89.4 mph**, 60ft 2.284 | PASS |
| 2019 Hellcat Redeye (~797 hp synth, 4445 lb, 8-spd) | 10.4–12.2 @ 118–138 | **11.888 s @ 119.2 mph**, 60ft 1.930, 4 shifts | PASS |

### Environmental / model

| Check | Result |
|-------|--------|
| 12 mph headwind vs calm (Supra) | ET **+0.087 s** |
| 12 mph tailwind vs calm | ET **−0.070 s** |
| NA car DA 0 → 5000 ft | ET **+0.944 s** |
| NA curve + turbo 12 psi | ET **−2.311 s** |
| Extremes 1 hp/20 lb and 15000 hp/120000 lb | both finish |

## Re-run

```bash
cd velocitybench-powercurve-git
node -e "require('./js/physics.js'); console.log('ok', Object.keys(require('./js/physics.js')))"
```

Open `index.html` in a browser (no build step).

## Notes

- Redeye trap sits soft in-band (synth curve + traction); drag radials / converter help.
- Garage FI dyno curves already include boost — use Boost PSI only on an NA baseline.
- UI product name is **VelocityBench PowerCurve** only (no CarTestClone chrome).
