# VelocityBench PowerCurve

Static **geared RPM** simulator: factory transmission ratios, shift points, weather/density altitude, wind & gusts, FI boost models, **baked dyno curves**, brass gauges, quarter-mile time slip, and **run past 1320 ft to mechanical/aero Vmax**.

**User-visible name:** VelocityBench PowerCurve only.

- **Hub:** [guerra-tools-hub](https://github.com/01ls1z28-coder/guerra-tools-hub)
- **Race sibling:** [forcemetric-web](https://github.com/01ls1z28-coder/forcemetric-web)
- **Live (after deploy):** https://01ls1z28-coder.github.io/velocitybench-powercurve/

## Physics

Ports the CarTestClone `PhysicsEngine` geared-RPM loop (wheel RPM → gear × final drive → torque curve → traction/aero), with VelocityBench-class weather/DA, wind, FI boost, and Phase 2 run-to-Vmax. Garage cars use HP-consistent baked curves (`HP ≈ TQ×RPM/5252`). See `VERIFY.md` for spot-checks (`node scripts/spotcheck.js`).

This is **not** an HP/weight shortcut ET formula.

## Files

| File | Role |
|------|------|
| `index.html` | App shell |
| `css/styles.css` | Family Brass / dark theme (desktop + mobile ≤800px) |
| `js/physics.js` | Geared RPM simulator + Vmax |
| `js/gauges.js` | Brass RPM / speed gauges |
| `js/app.js` | UI, garage samples, dyno + speed charts, slip |
| `scripts/spotcheck.js` | Node VERIFY harness |
| `VERIFY.md` | Calibration / Vmax caps / spot-checks |
| `README.md` | This file |

## Run

Static only — open `index.html` or publish with GitHub Pages. No server, database, secrets, or tracking.

## Disclaimer

Estimates for comparison and education. Not dyno- or track-certified. Created by Jorge Guerra.
