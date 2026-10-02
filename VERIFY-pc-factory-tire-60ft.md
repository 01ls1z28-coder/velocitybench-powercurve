# VERIFY — Factory tire → FINAL 60ft traction map

**Credit:** Jorge Guerra only
**Branch:** `review/factory-tire-60ft-final`
**Tip SHA:** `d0973a0` (`d0973a06e16a8891a52b55b9a2b168f848b0230f`)
**Repo:** `01ls1z28-coder/velocitybench-powercurve`
**Pages / main:** HOLD for Seraph/Merovingian FF — tip only
**Report JSON:** `scripts/factory-tire-60ft-report.json`
**Bake script:** `scripts/recalib-factory-tire-60ft.js`

## Disclaimer

Factory tire classes and 60-foot traction targets are **compiled estimates** from OEM order guides, Tire Rack OE fitments, manufacturer press, and published instrumented tests — **not lab-certified µ measurements**. Simulated 60fts still depend on vehicle mass, gearing, and launch RPM; µ sets class traction character. Use for comparison, not as a substitute for track data.

## FINAL 60ft targets (Jorge)

| Class | Unprepped (s) | Prepped (s) |
|-------|---------------|-------------|
| Street / all-season | 2.2 | 1.7–1.75 |
| Summer street performance | 2.0 | 1.6 |
| UHP summers | 1.85–1.90 (mid pick **1.875**) | 1.45–1.5 (mid pick **1.475**) |
| R-compound | 1.75–1.80 (mid pick **1.775**) | **1.5** fixed |
| Drag radials | 1.65–1.72 (mid pick **1.685**) | ≈ slick + 0.05 |
| Slicks | 1.80–1.90 (mid pick **1.85**) | 1.45–1.50 |

## µ bake (`js/physics.js` TIRE_MU_BY_PREP)

| tireType | Unprep µ | Prep µ |
|----------|----------|--------|
| 0 Street | 1.20 | 1.80 |
| 3 Summer | 1.34 | 1.95 |
| 4 UHP | 1.44 | 2.15 |
| 2 Slick | 1.47 | 2.20 |
| 5 R-Compound | 1.64 | 2.00 |
| 1 Drag Radial | 1.85 | 1.90 |

## Class counts (316 vehicles)

| Class | Before | After |
|-------|-------:|------:|
| Street | 151 | **101** |
| Summer | 55 | **70** |
| UHP | 108 | **132** |
| R-Compound | 1 | **12** |
| Drag Radial | 0 | **0** |
| Slick | 1 | **1** |

- tireType changes: **101**
- factory DR: **0** (must be 0)
- Slick: **1** (Z28 ATC only)
- R-Compound: **12** (documented Cup/Trofeo/Corsa + ZR1X)
- forceScale≠1: **0**
- `window.VB_POWERCURVE_GARAGE` bind: **preserved**
- Runtime remote tire DB: **none** — data baked into `js/garage-data.js`

## Challenger spot-check

| Car | tireType | Unprep 60ft | Prep 60ft |
|-----|----------|-------------|-----------|
| 2020 Dodge Challenger R/T Scat Pack | UHP | 2.042 | 2.037 |
| 2020 Dodge Challenger Hellcat | UHP | 1.868 | 1.725 |
| 2015 Dodge Challenger Hellcat | UHP | 1.942 | 1.815 |
| 2010 Dodge Challenger SRT8 | UHP | 2.45 | 2.45 |
| 2008 Dodge Challenger SRT8 | UHP | 2.506 | 2.506 |
| 2009 Dodge Challenger R/T | UHP | 2.555 | 2.555 |
| 1970 Dodge Challenger 426 Hemi | Street | 2.492 | 2.492 |

Hellcat Unprep UHP target band **1.85–1.90**: Hellcat sim should land in-band at stock launch.
Prep absolute **1.45–1.5** is demonstrated on sticky well-launched cars (Z28 ladder); heavy muscle may floor ~1.66–1.73 from mass/geometry while class µ remains correct.

## Hellcat tire ladder (sim 60ft)

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Unprep | 2.251 | 2.011 | 1.868 | 1.771 | 1.725 | 1.823 |
| Prep | 1.728 | 1.725 | 1.725 | 1.725 | 1.725 | 1.725 |

## Sources credited

- Tire Rack OEM / OE fitment guides
- Manufacturer order guides & press (Ford GT350R, GM Z/28, Porsche N-spec bulletins, Pirelli/McLaren/Lambo Trofeo R)
- Goodyear Eagle F1 Supercar OE catalogs (Camaro ZL1)
- C&D / MT / instrumented tests quoting OEM tire when used for class
- Prior tip OEM stack: `0ce7872` / `f7acdd0` (`scripts/recalib-oem-factory-tire.js`) — extended, Challenger family reassigned UHP per Jorge
- µ character research notes already in `js/physics.js` (Wong/HPWizard, LS1GTO DR µ, LivePhysics prep)

## Flagged family/package defaults (no car-specific placard in DOCUMENTED)

Count: **206** — full list in `scripts/factory-tire-60ft-report.json` → `flaggedFamilyDefaults`.

## Secrets / tracking

None found in touched files (`js/garage-data.js`, `js/physics.js`, `index.html` cache-bust, this VERIFY). No API keys, no telemetry pixels added.

## node --check

`js/physics.js`, `js/garage-data.js` — run at bake time.
