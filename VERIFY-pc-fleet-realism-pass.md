# VERIFY — PowerCurve fleet realism pass

**Branch:** `review/pc-fleet-realism-pass`  
**Parent tip:** `79bef38` (dyno fall + launch g spin tracking)  
**Credit:** Jorge Guerra only  
**Pages:** not updated (left on review — trap miss regression vs tip)  
**VERIFY JSON:** `/workspace/powercurve-fleet-verify-pc-fleet-realism-pass.json`  
**Also:** `scripts/fleet-verify-pc-fleet-realism-pass.json`, `scripts/fleet-et-first-accuracy-report.json`

## Goals

| Goal | Result |
|------|--------|
| Dyno fall past peakHpRpm (all ICE) | **PASS** — 0 upticks / 0 shallow&lt;10% of 277 ICE after sanitize; sim path sanitizes+caps ICE only |
| Peak HP readout ≤ car.peakHp | **PASS** — capTorqueCurveToPeakHp on sync/read + ICE sim |
| Launch g tracks spin (fleet) | **PASS** — kinetic ceil; AWD ×1.25 µ double-dip removed; spot peakG vs spin sane |
| Tire ladder Street→…→Slick | **PASS** — DR 1.30 / Slick 1.38; Mustang ΔET ~1.0s Street→Slick |
| HP/TQ crossover ~5250 | **PASS** — median/p10/p90 = **5252** fleet-wide on shared-axis series |
| Fleet Excel ET/trap | **PARTIAL** — ET improved; trap still messy (blocker for FF) |

## Fleet Corrected Excel (tol z60±0.25 / et±0.25 / trap±2.5)

| | tip 79bef38 baseline | this pass |
|--|----------------------|-----------|
| ET hits | 245/313 (miss **68**) | **282/313** (miss **31**) |
| Trap hits | 242/313 (miss **71**) | 210/313 (miss **103**) |
| 0–60 hits | 186/315 (miss **129**) | **231/315** (miss **84**) |
| 60–130 | 43/61 | 39/61 |
| priorityAll | 132/315 | **147/315** |
| ET MAE | 0.153 | **0.092** |
| Trap MAE | 2.01 | 2.43 |
| forceScale≠1 | 0 | 0 |

## Key physics changes (`js/physics.js`)

1. **sanitizeTorqueCurvePostPeak** — target tip fall 18–28% (short/long span); rewrite too-shallow knots; do not pin peakHpRpm at/near redline (bikes).
2. **ICE sim path** — clone + sanitize + cap so every ICE run matches display honesty; **EVs skipped** (motor maps).
3. **AWD µ** — removed invented `muBase *= 1.25` (both axles already sum in tracLim).
4. **spinN shadow bug** — stock launch tach `var spinN` renamed `spinFrac` so wheelspin% average is not corrupted (e.g. Turbo S 265% → ~26%).

## Garage bake

- Reused `scripts/recalib-fleet-et-first-accuracy.js` (loss/launch/tire only, **fs=1**).
- Searched 304 / applied 272 / parked 32 / unchangedTight 9.
- Skip list unchanged (Cybertruck / ZR1X / Jorge Z28 ATC).

## Spot peakG vs spin (default car tire)

| Car | tire | peakG | spin% | notes |
|-----|------|-------|-------|-------|
| 2014 Camaro Z/28 | Street | ~0.83 | ~22 | spin limits g |
| 2020 Mustang GT | DR | ~1.21 | ~82 | traction fight |
| Scat Pack | UHP | ~0.98 | ~47 | muscle auto |
| 911 Turbo S | Slick | ~1.69 | ~26 | AWD hooked, no ×1.25 |
| Model S Plaid | Slick | ~1.73 | ~25 | EV AWD |
| Civic Type R | Slick | ~1.05 | ~48 | FWD limited |
| Cybertruck | Summer | ~1.29 | ~25 | locked LIVE bake |

## Blockers for FF-merge → main

- **Trap misses 103** (was 71 on tip) — many cars already at loss=0; need sourced Cd/curve or physics-honest trap path, not invented Excel/µ.
- Prefer leave on `review/pc-fleet-realism-pass` until trap batch recovers without re-inventing AWD grip.

## node --check

`js/physics.js`, `js/app.js`, `js/garage-data.js` — OK.
