# VERIFY — PowerCurve restore real OEM/card specs

**Branch:** `review/pc-restore-real-specs`  
**Parent tip:** `c22cfdb` (`main` — engine-curve accuracy + trap-first Cd/FA bake)  
**Specs baseline:** `21fb630` (pre trap-first; Cd/FA identical to `79bef38`)  
**Credit:** Jorge Guerra only  
**Pages:** YES — FF-merge to `main` (honesty over trap hit rate)  
**VERIFY JSON:** `scripts/fleet-verify-pc-restore-real-specs.json`  
**Also:** `scripts/restore-real-specs-report.json`

## Hard rule (Jorge)

ALL vehicle specs must match real life — NEVER change Cd / FA / weight / peakHp / tireType OEM card defaults to hit traps. Strip trap-first Cd/FA/loss-as-fake-aero garage fudges. Performance must fall out of real models + honest physics, not baked lies.

## Goals

| Goal | Result |
|------|--------|
| Restore Cd / FA from 21fb630 | **PASS** — 277 Cd + 226 FA restored; 0 mismatches vs baseline |
| weightLbs / peakHp untouched | **PASS** — 0 cars differed vs 21fb630 (and vs c22cfdb) |
| Restore drivetrainLossPercent (trap-invented) | **PASS** — 125 cars restored to 21fb630 loss |
| Restore tireType OEM card defaults | **PASS** — 47 cars |
| Restore launchRpm co-optimized with fake aero | **PASS** — 206 cars → 21fb630 realism calib |
| Keep physics curve / tire-prep / synth | **PASS** — `js/physics.js`, track-prep UI, c22 curves kept |
| forceScale = 1 | **PASS** — 0 non-one |
| No invented specs | **PASS** — values copied from 21fb630 only |

## Fleet Corrected Excel (tol z60±0.25 / et±0.25 / trap±2.5 / 60-130±0.75)

Track prep: **Unprepped** (garage / Excel SOI).

| | tip c22cfdb (fake Cd/FA live) | tip 21fb630 (realism) | **this tip (real specs)** |
|--|-------------------------------|------------------------|---------------------------|
| ET hits | 299/313 (miss **14**) | 282/313 (miss **31**) | **289/313** (miss **24**) |
| Trap hits | 304/313 (miss **9**) | 210/313 (miss **103**) | **231/313** (miss **82**) |
| 0–60 hits | 255/315 (miss **60**) | 231/315 (miss **84**) | **226/315** (miss **89**) |
| 60–130 | 39/61 | 39/61 | **40/61** |
| priorityAll | 228/315 | 147/315 | **155/315** |
| ET MAE | 0.116 | 0.092 | **0.097** |
| Trap MAE | 0.64 | 2.43 | **2.11** |
| forceScale≠1 | 0 | 0 | **0** |

**Honesty note:** Trap/ET hit rate vs c22cfdb worsens as expected after stripping fake aero. Trap still **better than 21fb630** (82 vs 103 miss) because c22 curve honesty remains. Prefer real Cd/FA over trap hit rate.

## What was restored (from 21fb630 onto c22cfdb garage)

| Field | Cars restored |
|-------|---------------|
| `dragCoefficient` | 277 |
| `frontalAreaSqFt` | 226 |
| `drivetrainLossPercent` | 125 |
| `tireType` | 47 |
| `launchRpm` | 206 |
| `weightLbs` | 0 (already matched) |
| `peakHp` | 0 (already matched) |

Cars touched: **286** / 316. Unchanged: 30. Missing in baseline: 0.

## Kept (not reverted)

- `js/physics.js` — dyno-honest synth, span-aware post-peak sanitize, weather identity, tire-prep µ ladder (DR/Slick unprep 1.38/1.40)
- Track-prep UI (`index.html` / `js/app.js`)
- Per-car `torqueCurve` from c22cfdb engine-curve accuracy pass (curve-only; never touched Cd/FA/weight/peakHp)

## Example (2020 Mustang GT)

| | c22cfdb (trap bake) | restored (21fb630) |
|--|---------------------|--------------------|
| Cd | 0.265 | **0.36** |
| FA | 21.5 | **24** |
| loss% | 0 | 0 |
| tireType | 4 (UHP) | **1 (DR)** |
| launchRpm | 3000 | **3900** |
| peakHp / weight | 460 / 3705 | unchanged |

## node --check

`js/physics.js`, `js/app.js`, `js/garage-data.js` — OK.
