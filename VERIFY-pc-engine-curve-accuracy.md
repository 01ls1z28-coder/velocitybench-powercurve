# VERIFY — PowerCurve engine curve accuracy

**Branch:** `review/pc-engine-curve-accuracy`  
**Parent tip:** `9c639c9` (`review/pc-trap-first-tire-prep`)  
**Credit:** Jorge Guerra only  
**Pages:** HOLD (trap/ET clearly better than parent — eligible; left for parent)  
**VERIFY JSON:** `/workspace/powercurve-fleet-verify-pc-engine-curve-accuracy.json`  
**Also:** `scripts/fleet-verify-pc-engine-curve-accuracy.json`, `scripts/engine-curve-accuracy-report.json`

## HARD constraints (complied)

| Constraint | Result |
|------------|--------|
| No peakHp edits | **PASS** — 0 cars |
| No weightLbs edits | **PASS** — 0 |
| No Cd / FA edits | **PASS** — 0 |
| forceScale = 1 | **PASS** — 0 non-one |
| Realism via engine curves (+ modest loss) | **PASS** |

## Focus

1. `synthesizeTorqueCurve` dyno-honest (span-aware post-peak HP fall ~8–26%, not ~55% cliff)
2. `sanitizeTorqueCurvePostPeak` lifts cratered tips + short-span gentle tip-off
3. Weather identity at RHO0 (removed invented NA×0.985 / FI×1.015)
4. Fleet outliers: **curve shape** (peakTqRpm / peakHpRpm / TQ ratio / fall) + modest loss only

## Fleet vs Corrected Excel (before = 9c639c9)

| | **9c639c9** | **this tip** |
|--|-------------|--------------|
| Trap hits | 282/313 (miss **31**) | **304/313** (miss **9**) |
| ET hits | 286/313 (miss **27**) | **299/313** (miss **14**) |
| 0–60 hits | 243/315 (miss **72**) | **255/315** (miss **60**) |
| 60–130 | 40/61 | 39/61 |
| priorityAll | 200/315 | **228/315** |
| Trap MAE | 0.85 | **0.64** |
| ET MAE | 0.114 | 0.116 |
| forceScale≠1 | 0 | **0** |

## Physics (`js/physics.js`)

- **Synth:** post-peak HP shaped to span-aware fall; HP-only defaults for peakTqRpm/peakHpRpm; peak TQ ~12% above TQ@peakHP
- **Sanitize:** max fall ~14–30% by span (was 45%); **rewrites cratered tips upward**; short span (peak≈redline) only ~8–14%
- **Weather:** `wx → 1` at standard density (no 0.985/1.015 fudge)

## Garage bake

- `scripts/recalib-engine-curve-accuracy.js` — 211 searched / **178 applied** / 33 parked / 102 unchanged-tight
- Knobs: curve shape + modest loss only

## Custom Builder (HP+weight path)

Defaults 450 hp / 3800 lb / Cd 0.35 / loss 15% / DR / Unprepped @ 70°F app wx: synth curve peak = rated HP; fall span-honest. Believable street-default trap (not magazine Cd-cheated).

## Residual trap misses (9)

- 2022 Tesla Model X Plaid (+7.3) — EV ET–trap conflict
- 2024 Rivian R1S Quad (+4.0)
- Golf R / Skyline R34×2 / TLX Type S / A7 3.0T / RS 3 / Venom GT — still under after curve/loss floor (no Cd/HP cheat)

## node --check

`js/physics.js`, `js/garage-data.js` — OK.
