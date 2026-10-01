# VERIFY — PowerCurve trap-first + tire track-prep

**Branch:** `review/pc-trap-first-tire-prep`  
**Parent tip:** `21fb630` (`review/pc-fleet-realism-pass`)  
**Live / main tip:** `79bef38`  
**Credit:** Jorge Guerra only  
**Pages:** HOLD deferred to parent — trap **clearly better** than live `79bef38` on priority metrics (eligible), but not FF'd here.  
**VERIFY JSON:** `/workspace/powercurve-fleet-verify-pc-trap-first-tire-prep.json`  
**Also:** `scripts/fleet-verify-pc-trap-first-tire-prep.json`, `scripts/trap-first-tire-prep-report.json`

## Priority (strict)

1. ¼-mile **trap** — primary  
2. ¼-mile **ET**  
3. **60–130**  
4. **0–60**

## Goals

| Goal | Result |
|------|--------|
| Track-prep µ (Unprepped default) | **PASS** — DR 1.38 / Slick 1.40 unprep; DR 1.43 / Slick 1.45 prep |
| Prep UI near tire select | **PASS** — `#trackPrep` Prepped / Unprepped (default Unprepped) |
| Street &lt; Summer &lt; UHP &lt; DR &lt; Slick each mode | **PASS** |
| No peakHp / weight edits | **PASS** — 0 cars changed vs 21fb630 |
| forceScale = 1 | **PASS** — 0 non-one |
| Trap better vs 21fb630 **and** 79bef38 | **PASS** — miss **31** (was 103 / 71) |
| Trap-first bake Cd/FA/loss/curve-fall/tire/launch | **PASS** — 276 applied + 7 park-rescue |

## µ table (Jorge)

| Tire | Unprepped (default) | Prepped |
|------|---------------------|---------|
| Street (0) | 0.95 | 0.98 |
| Summer (3) | 1.05 | 1.10 |
| UHP (4) | 1.15 | 1.22 |
| Drag Radial (1) | **1.38** | **1.43** |
| Slick (2) | **1.40** | **1.45** |

Prep mainly boosts DR/Slick; Street/Summer/UHP stay sensible. Garage/Excel SOI uses **Unprepped**.

## Fleet Corrected Excel (tol z60±0.25 / et±0.25 / trap±2.5 / 60-130±0.75)

| | tip 79bef38 (live) | tip 21fb630 (realism) | **this tip** |
|--|--------------------|------------------------|--------------|
| ET hits | 245/313 (miss **68**) | 282/313 (miss **31**) | **286/313** (miss **27**) |
| Trap hits | 242/313 (miss **71**) | 210/313 (miss **103**) | **282/313** (miss **31**) |
| 0–60 hits | 186/315 (miss **129**) | 231/315 (miss **84**) | **243/315** (miss **72**) |
| 60–130 | 43/61 | 39/61 | **40/61** |
| priorityAll | 132/315 | 147/315 | **200/315** |
| ET MAE | 0.153 | 0.092 | 0.114 |
| Trap MAE | 2.01 | 2.43 | **0.85** |
| forceScale≠1 | 0 | 0 | **0** |

## Key changes

### Physics (`js/physics.js`)

- `TIRE_MU_BY_PREP` + `normalizeTrackPrep` / `trackPrepLabel`
- `tireGripForType(tireType, trackPrep)` — default **unprepped**
- `env.trackPrep` honored in `runQuarterMile` (explicit `env.tireGrip` still wins)

### UI (`index.html` + `js/app.js`)

- Track prep select next to tire row; hint documents µ levels
- `readEnv()` passes `trackPrep` + tire label suffix `· Unprepped|Prepped`

### Garage bake (`scripts/recalib-trap-first-tire-prep.js`)

- Knobs: **Cd / frontalArea / modest loss / ICE post-peak fall× / tire / launch**
- Never peakHp / weightLbs; forceScale=1
- Skip: Cybertruck, ZR1X, Jorge Z28 ATC
- Trap-first cost weights; park-rescue applied 7 ET-guard rejects that already **hit trap**

## Prep UI note

Default **Unprepped** so garage Excel SOI does not silently jump to strip µ. Selecting **Prepped** raises DR/Slick toward 1.43/1.45 (street compounds only slightly). Ladder preserved in both modes.

## Blockers / residuals

- **Model X Plaid** trap still ~+16 (ET–trap Excel conflict; best trap-closer wrecks ET/0–60) — parked honest.
- Assorted trap-under residuals (Golf R, RS 3, GNX, Ford GT, …) already near Cd/FA/loss floors without inventing HP.
- 60–130 still soft vs Excel (bike/high-power windows) — not primary this tip.
- **Pages / FF main:** trap clear win vs both baselines → eligible; left on review for parent to decide Pages/FF.

## node --check

`js/physics.js`, `js/app.js`, `js/garage-data.js` — OK.
