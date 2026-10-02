# VERIFY — µ ↔ 60ft Mustang GT Jorge deltas

**Credit:** Jorge Guerra only
**Branch:** `review/mu-60ft-mustang-deltas`
**Base:** `3a55f8d` (LIVE main — OEM tire + EV power)
**Repo:** `01ls1z28-coder/velocitybench-powercurve`
**Pages / main:** HOLD — tip only (no deploy)
**Report:** `scripts/mu-60ft-calibrate-report.json`
**Bake:** `node scripts/recalib-mu-60ft.js --apply`

## Method

1. Measure LIVE 60ft on `2020-ford-mustang-gt` (Street/all-season factory) for each tireType × unprep/prep.
2. Target = current + Jorge Δ (seconds; slower = higher 60ft).
3. Binary-search µ so sim 60ft ≈ target (forceScale=1, driver 200, launch=auto, wx 70/45/29.92).
4. Bake `TIRE_MU_BY_PREP` + `TARGET_60FT_BY_PREP`.

## Jorge deltas (s)

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Unprep | +0.70 | +0.20 | +0.12 | +0.80 | +0.70 | +0.13 |
| Prep | +0.30 | +0.25 | +0.20 | +0.14 | −0.01 | −0.05 |

## Mustang GT before → after 60ft

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Unprep before | 2.130 | 1.903 | 1.804 | 1.745 | 1.739 | 1.778 |
| Unprep **after** | 2.828 | 2.103 | 1.923 | 2.545 | 2.439 | 1.908 |
| Unprep target | 2.830 | 2.103 | 1.924 | 2.545 | 2.439 | 1.908 |
| Unprep Δ achieved | +0.698 | +0.200 | +0.119 | +0.800 | +0.700 | +0.130 |
| Prep before | 1.740 | 1.739 | 1.738 | 1.739 | 1.739 | 1.738 |
| Prep **after** | 2.040 | 1.989 | 1.938 | 1.879 | 1.739 | 1.738 |
| Prep target | 2.040 | 1.989 | 1.938 | 1.879 | 1.729 | 1.688 |
| Prep Δ achieved | +0.300 | +0.250 | +0.200 | +0.140 | +0.000 | +0.000 |

## New µ table (`TIRE_MU_BY_PREP`)

| tireType | Unprep µ (was→new) | Prep µ (was→new) |
|----------|-------------------:|-----------------:|
| 0 Street | 1.200→**0.822** | 1.800→**1.255** |
| 3 Summer | 1.340→**1.196** | 1.950→**1.273** |
| 4 UHP | 1.440→**1.317** | 2.150→**1.303** |
| 5 R-Compound | 1.640→**0.894** | 2.000→**1.338** |
| 1 Drag Radial | 1.850→**0.929** | 1.900→**1.900** |
| 2 Slick | 1.470→**1.293** | 2.200→**2.200** |

## Power-floor notes

Mustang GT power floor ≈ **1.738s** (µ=8, forceScale=1, driver 200).
- prepped Drag Radial: power-floor: cannot reach target 1.729 (floor 1.738); kept LIVE µ 1.900
- prepped Slick: power-floor: cannot reach target 1.688 (floor 1.738); kept LIVE µ 2.200

## Code / bind / secrets

- `js/physics.js`: baked `TIRE_MU_BY_PREP` + `TARGET_60FT_BY_PREP`
- `scripts/recalib-mu-60ft.js`: Mustang-delta calibrator
- `window.VB_POWERCURVE_GARAGE` bind **preserved**
- Secrets: **none**

