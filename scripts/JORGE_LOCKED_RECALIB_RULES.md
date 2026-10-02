# Jorge FINAL locked recalib rules (PowerCurve)

**ALL vehicle parameters stay factory.** No permission to change OEM specs.

**Never touch (except noted):**
- `dragCoefficient` / `frontalAreaSqFt` / mass / gears / FD / TX / other OEM
- **Exception:** Jorge’s 2001 Z28 (`2001-chevrolet-camaro-z28-h-c-e-ms3-tsp5-3stage2-5-1-3-4lt-trueduals`) **Cd = 0.34** (his real Cd). Do **not** change his peakHp/curve.

**Allowed exceptions ONLY:**
1. **Tires** — only on cars that need it for times
2. **ICE** — power/curves OK if **`peakHp` never exceeds factory/stock**
3. **EV** — power **up or down** OK, but keep kW **as close to stock as possible** (wiggle only where needed)
4. **Drivetrain loss** — OK if realistic

Prefer honest misses over fake aero/mass/gears/over-stock ICE HP.
Cd/FA restore baseline: tip `d2c50e7` (then Z28 Cd→0.34).
