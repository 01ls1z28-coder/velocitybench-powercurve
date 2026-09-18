# VelocityBench PowerCurve

Static **geared RPM** quarter-mile simulator: factory transmission ratios, shift points, weather/density altitude, wind & gusts, FI boost models, power curve, brass gauges, and a time slip.

**User-visible name:** VelocityBench PowerCurve only.

- **Hub:** [guerra-tools-hub](https://github.com/01ls1z28-coder/guerra-tools-hub)
- **Race sibling:** [forcemetric-web](https://github.com/01ls1z28-coder/forcemetric-web)

## Physics

Ports the CarTestClone `PhysicsEngine` geared-RPM loop (wheel RPM → gear × final drive → torque curve → traction/aero), with VelocityBench-class weather/DA, wind, and FI boost extensions. See `VERIFY.md` for spot-checks.

This is **not** an HP/weight shortcut ET formula.

## Files

| File | Role |
|------|------|
| `index.html` | App shell |
| `css/styles.css` | Family Brass / dark theme |
| `js/physics.js` | Geared RPM simulator |
| `js/gauges.js` | Brass RPM / speed gauges |
| `js/app.js` | UI, garage samples, charts, slip |
| `VERIFY.md` | Calibration spot-checks |
| `README.md` | This file |

## Run

Static only — open `index.html` or publish with GitHub Pages. No server, database, secrets, or tracking.

## Disclaimer

Estimates for comparison and education. Not dyno- or track-certified. Created by Jorge Guerra.
