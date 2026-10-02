# Tip: weight-distribution visual + remove dead Flash RPM / Boost PSI

Base: `bd5ed4f` (LIVE). Pages **NOT** shipped.

## Weight distribution (UI only)
- Top-down car silhouette + brass CG crosshair + FL/FR/RL/RR pads.
- Corner % = axle × side (`FL = front% × left% / 100`, etc.).
- Drag CG or wheel pads; edit corner or F/R · L/R numbers. Pairs auto-sum to 100%.
- Underlying `frontWeightPct` / `rearWeightPct` / `leftWeightPct` / `rightWeightPct` still feed physics.

## Flash RPM — removed
- UI box gone. Aftermarket converter stall path unchanged: physics auto-derives flash from stall when `car.flashRpm` unset.
- Stall RPM control kept.

## Boost PSI — removed (dead)
- Trace: form forced `boostPsi=0` on NA/EV; garage all bake `boostPsi:0`; RUN wipe `if (base.torqueCurve && (… || base.boostPsi === 0))` cleared any UI value for every garage (and Custom after first curve synth).
- `boostTorqueMult` remains in physics but is identity at psi 0. Tire / induction controls kept.

## Credits / bind
- Jorge Guerra only. `VB_POWERCURVE_GARAGE` bind preserved.
