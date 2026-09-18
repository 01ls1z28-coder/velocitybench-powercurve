# VelocityBench PowerCurve

Static **geared RPM** simulator: factory transmission ratios, shift points, weather/density altitude, wind & gusts, FI boost models, **baked dyno curves**, Lexus LFA–inspired brass gauges, quarter-mile time slip (with **60–130** / **100–150**), and **run past 1320 ft to mechanical/aero Vmax**.

**User-visible name:** VelocityBench PowerCurve only.

- **Hub:** [guerra-tools-hub](https://github.com/01ls1z28-coder/guerra-tools-hub)
- **Race sibling:** [forcemetric-web](https://github.com/01ls1z28-coder/forcemetric-web)
- **Live (after deploy):** https://01ls1z28-coder.github.io/velocitybench-powercurve/

## Physics

**Phase 5:** Factory TX preset is Custom Builder–only; induction defaults (turbo/SC) baked per car; editable dyno TQ bullets every 250 RPM (HP≈TQ×RPM/5252).

Ports the CarTestClone `PhysicsEngine` geared-RPM loop (wheel RPM → gear × final drive → torque curve → traction/aero), with VelocityBench-class weather/DA, wind, FI boost, and run-to-Vmax. **333 garage cars** baked from Jorge’s Excel import + VelocityBench garage merge; HP-consistent curves (`HP ≈ TQ×RPM/5252`). Playback is always real-time. Fleet calib (trap/0-60/ET) all-applicable **~63%** — see `VERIFY.md` (`node scripts/spotcheck.js`).

This is **not** an HP/weight shortcut ET formula.

## Files

| File | Role |
|------|------|
| `index.html` | App shell (2-col: garage \| instruments + slip under graphs) |
| `css/styles.css` | Family Brass / dark theme (desktop + mobile) |
| `js/physics.js` | Geared RPM simulator + Vmax + quickMetrics |
| `js/gauges.js` | LFA-style dual-dial brass gauges |
| `js/garage-data.js` | Baked 333-car fleet (static) |
| `js/app.js` | UI, garage filter, dyno + speed charts, slip/metrics |
| `scripts/build-garage.js` | Import → merge → synthesize → calibrate → bake |
| `scripts/spotcheck.js` | Node VERIFY harness (tireType explicit) |
| `scripts/garage-calib-meta.json` | Fleet hit-rate + residuals |
| `VERIFY.md` | Calibration / caps / spot-checks |
| `README.md` | This file |

## Run

Static only — open `index.html` or publish with GitHub Pages. No server, database, secrets, or tracking.

Rebuild garage (optional): `node scripts/build-garage.js`

## Disclaimer

Estimates for comparison and education. Not dyno- or track-certified. Created by Jorge Guerra.
