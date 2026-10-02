# VERIFY — OEM tire class (Mustang GT all-season) + EV power batch tip

**Credit:** Jorge Guerra only  
**Branch:** `review/oem-tire-ev-power-batch`  
**Base:** LIVE tip `c89db28` (factory-tire-60ft)  
**Repo:** `01ls1z28-coder/velocitybench-powercurve`  
**Pages / main:** HOLD until Seraph CLEAR — tip only until ship call combines tire + EV  
**Report JSON:** `scripts/oem-tire-class-sweep-report.json`

## Disclaimer

Factory tire classes are **compiled estimates** from OEM order guides, Tire Rack OE fitments, and manufacturer press — **not lab-certified µ measurements**. Simulated 60fts still depend on vehicle mass, gearing, and launch RPM; µ sets class traction character. Use for comparison, not as a substitute for track data.

## 1) Mustang GT before → after

| Field | Before | After |
|-------|--------|-------|
| id | `2020-ford-mustang-gt` | same |
| tireType | **3 Summer** | **0 Street / all-season** |
| OEM note | Pirelli P Zero / Goodyear Eagle F1 summer | **P235/50R18 BSW all-season** (base 10AT / non-PP) |
| Powertrain | Ford_10R80 · FD 3.15 | unchanged |

Summer staggered **255/40R19 F / 275/40R19 R** is **GT Performance Package** only — different car; not this base garage card.

## 2) Other cars fixed

| id | Change | Source |
|----|--------|--------|
| *(tireType)* **none beyond Mustang GT** this half — Challenger/Charger UHP Jorge overrides left intact | — | factory-tire-60ft Jorge map |
| 11 Cup/Trofeo/Corsa cars | **source string sync only** UHP→R-Compound (tireType stayed **5**) | documented Cup/Trofeo/Corsa OE |

## 3) Bake confirmation

- `js/garage-data.js` — Mustang `tireType: 0` + OEM source; R-Comp source sync; **`window.VB_POWERCURVE_GARAGE` / `globalThis.VB_POWERCURVE_GARAGE` bind preserved**
- `index.html` — cache-bust `garage-data.js?v=oem-tire-ev-batch`
- `scripts/recalib-factory-tire-60ft.js` — Mustang map entry `tire: 0` so future rebakes do not revert
- `scripts/oem-tire-class-sweep-report.json`

## 4) Sources

- Ford 2020 Mustang Order Guide — base GT **235/50R18 BSW All-Season**; Performance Package **summer-only** staggered 19s
- Tire Rack OE / mustangspecs — 2020 Mustang GT P235/50R18 A/S
- Prior tip `c89db28` FINAL 60ft µ ladder (physics untouched this half)

## 5) Secrets / tracking

**none** — no API keys, tokens, analytics, or remote tire DB. Runtime data baked into `js/garage-data.js`.

## 6) Family seeds still flagged (VERIFY)

Heuristic `OEM tire: Street` source clauses vs later performance Summer/UHP tireType (BMW M2, Type S, Golf R, etc.) were **not** mass-demoted — prefer strong OEM over class seeds; those remain **family seeds** for a later documented pass. Challenger/Charger UHP Jorge overrides intentionally left. See `familySeedsFlagged` in report JSON.

## 7) Tire-type enum (verified `js/physics.js`)

| id | Label |
|----|-------|
| 0 | Street / all-season |
| 1 | Drag Radial (UI-only; never factory) |
| 2 | Slick (Z28 ATC only) |
| 3 | Summer |
| 4 | UHP |
| 5 | R-Compound |

## Tip SHA

`bf9c86b8fc9ea9095dc5194b042f8c5634c20758`
