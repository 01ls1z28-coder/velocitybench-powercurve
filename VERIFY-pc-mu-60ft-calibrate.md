# VERIFY — µ ↔ 60ft calibrate

**Credit:** Jorge Guerra only
**Branch:** `review/mu-60ft-calibrate`
**Base:** `6464c65` (`review/oem-tire-ev-power-batch`) — sibling tip (EV worktree was dirty; no clobber)
**Tip SHA:** _(filled after commit)_
**Repo:** `01ls1z28-coder/velocitybench-powercurve`
**Pages / main:** HOLD for Seraph — tip only
**Report:** `scripts/mu-60ft-calibrate-report.json`
**Bake:** `node scripts/recalib-mu-60ft.js --apply`

## Disclaimer

Engine has **no closed-form** µ→60ft. Path: µ → tracLim≈µ×N_axle → softTractionForce → integrate → sixtyFootTime at dist≥60ft. Idealized `t=sqrt(2s/a)` with `a≈µ_eff·g·driveAxleShare` is a sanity check only; sim includes gripMultSmooth, kinetic fall, launch mode, and driveline. Absolute 60ft depends on mass/launch; µ sets class traction character.

## Conditions

- driverWeightLbs **200**, forceScale **1**, launchMode **auto**
- wx 70°F / 45% RH / 29.92 inHg, wind 0

## Reference cars

| Role | Car | Why |
|------|-----|-----|
| Hellcat-class | 2020 Dodge Challenger Hellcat (4449 lb, WD 57/43, launch 2300) | All **unprep** classes + **Street prep**. Power floor **1.725s** |
| Sticky / race | 2001 Camaro Z28 ATC (3340 lb, WD 45/55, launch 3000, factory Slick) | **Prep** Summer/UHP/R-comp/DR/Slick. Power floor **1.486s** |

## (1) µ ↔ 60ft relationship

### Idealized vs sim (Hellcat Unprep UHP, rearShare=0.43)

| µ | Idealized t | Sim 60ft | Ideal−Sim |
|--:|----------:|--------:|----------:|
| 1.00 | 2.945 | 2.513 | 0.432 |
| 1.10 | 2.808 | 2.345 | 0.463 |
| 1.20 | 2.689 | 2.194 | 0.495 |
| 1.30 | 2.583 | 2.053 | 0.530 |
| 1.40 | 2.489 | 1.919 | 0.570 |
| 1.50 | 2.405 | 1.833 | 0.572 |
| 1.60 | 2.328 | 1.790 | 0.538 |
| 1.70 | 2.259 | 1.755 | 0.504 |
| 1.80 | 2.195 | 1.727 | 0.468 |
| 1.90 | 2.137 | 1.725 | 0.412 |
| 2.00 | 2.083 | 1.725 | 0.358 |
| 2.10 | 2.032 | 1.725 | 0.307 |
| 2.20 | 1.986 | 1.725 | 0.261 |
| 2.30 | 1.942 | 1.725 | 0.217 |
| 2.40 | 1.901 | 1.725 | 0.176 |

### Idealized vs sim (Z28 Prep Slick, rearShare=0.55)

| µ | Idealized t | Sim 60ft | Ideal−Sim |
|--:|----------:|--------:|----------:|
| 1.00 | 2.604 | 2.145 | 0.459 |
| 1.10 | 2.483 | 2.013 | 0.470 |
| 1.20 | 2.377 | 1.896 | 0.481 |
| 1.30 | 2.284 | 1.796 | 0.488 |
| 1.40 | 2.201 | 1.715 | 0.486 |
| 1.50 | 2.126 | 1.651 | 0.475 |
| 1.60 | 2.059 | 1.595 | 0.464 |
| 1.70 | 1.997 | 1.544 | 0.453 |
| 1.80 | 1.941 | 1.505 | 0.436 |
| 1.90 | 1.889 | 1.492 | 0.397 |
| 2.00 | 1.841 | 1.491 | 0.350 |
| 2.10 | 1.797 | 1.490 | 0.307 |
| 2.20 | 1.756 | 1.490 | 0.266 |
| 2.30 | 1.717 | 1.489 | 0.228 |
| 2.40 | 1.681 | 1.489 | 0.192 |

Idealized is consistently **slower** than sim at the same µ (weight transfer, softTraction overshoot, and launch raise effective axle load above static rear share).

## (2) Previous µ → off-target 60fts (before this tip)

| Prep | Class | Ref | Prev µ | Prev 60ft | Target mid | Δ (s) | In band? |
|------|-------|-----|-------:|----------:|-----------:|------:|----------|
| unprepped | Street | Hellcat | 1.20 | 2.251 | 2.200 | +0.051 | NO |
| unprepped | Summer | Hellcat | 1.34 | 2.011 | 2.000 | +0.011 | NO |
| unprepped | UHP | Hellcat | 1.44 | 1.868 | 1.875 | -0.007 | yes |
| unprepped | R-Compound | Hellcat | 1.64 | 1.771 | 1.775 | -0.004 | yes |
| unprepped | Drag Radial | Hellcat | 1.85 | 1.725 | 1.685 | +0.040 | yes |
| unprepped | Slick | Hellcat | 1.47 | 1.823 | 1.850 | -0.027 | yes |
| prepped | Street | Hellcat | 1.80 | 1.728 | 1.725 | +0.003 | yes |
| prepped | Summer | Z28 | 1.95 | 1.493 | 1.600 | -0.107 | NO |
| prepped | UHP | Z28 | 2.15 | 1.491 | 1.475 | +0.016 | yes |
| prepped | R-Compound | Z28 | 2.00 | 1.491 | 1.500 | -0.009 | NO |
| prepped | Drag Radial | Z28 | 1.90 | 1.492 | 1.542 | -0.050 | NO |
| prepped | Slick | Z28 | 2.20 | 1.490 | 1.475 | +0.015 | yes |

## (3) Corrected µ values

| tireType | Unprep µ (was→new) | Prep µ (was→new) |
|----------|-------------------:|-----------------:|
| 0 Street | 1.200→**1.233** | 1.800→**1.803** |
| 3 Summer | 1.340→**1.349** | 1.950→**1.655** |
| 4 UHP | 1.440→**1.436** | 2.150→**1.880** |
| 5 R-Compound | 1.640→**1.627** | 2.000→**1.823** |
| 1 Drag Radial | 1.850→**1.787** | 1.900→**1.715** |
| 2 Slick | 1.470→**1.432** | 2.200→**1.900** |

### Hellcat ladder — before → after

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Unprep before | 2.251 | 2.011 | 1.868 | 1.771 | 1.725 | 1.823 |
| Unprep **after** | **2.2** | **1.999** | **1.876** | **1.775** | **1.73**† | **1.85** |
| Prep before | 1.728 | 1.725 | 1.725 | 1.725 | 1.725 | 1.725 |
| Prep after | 1.728 | 1.772 | 1.725 | 1.725 | 1.744 | 1.725 |

† Hellcat DR unprep floors at **1.725–1.730s** (target band 1.65–1.72 needs stickier PW). Z28 ATC with same µ runs **~1.51s**.

### Z28 ATC ladder — after (sticky prep refs)

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Unprep | 2.013 | 1.843 | 1.751 | 1.603 | 1.514 | 1.702 |
| Prep | 1.515 | **1.601** | **1.494** | **1.501** | **1.542** | **1.492** |

Prep UHP/Slick land **1.49x** (in 1.45–1.50 band) at Z28 power floor **1.486s**. DR prep = slickSim+0.05 → **1.542**.

## (4) Code changes (explicit / tunable mapping)

- `js/physics.js`: corrected `TIRE_MU_BY_PREP`; added `TARGET_60FT_BY_PREP` + export on Phys API
- `scripts/recalib-mu-60ft.js`: binary-search calibrator (`--apply` re-bakes)
- `scripts/mu-60ft-calibrate-report.json`: full sweep/relationship dump
- No UI redesign; `window.VB_POWERCURVE_GARAGE` bind **preserved**
- Does **not** touch EV launch retune (sibling of dirty `review/oem-tire-ev-power-batch`)

## Secrets / tracking

None in touched files. No API keys, no telemetry pixels.

## node --check

`js/physics.js`, `scripts/recalib-mu-60ft.js` — OK.
