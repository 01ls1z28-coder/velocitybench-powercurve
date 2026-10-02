# VERIFY — PowerCurve fleet fidelity (trap-first / µ + tires)

**Branch:** `review/fleet-fidelity-trap-first`  
**Tip SHA:** `87174c24c09d80169cb55b02bfd0ee422fb00ed2` (`87174c2`)  
**Parent tip:** `3c37b84981672d67851841569a42978faf386d70` (`main` — garage bind + cachebust)  
**Credit:** Jorge Guerra only  
**Pages / main:** **NOT touched** (tip only; HOLD Merovingian)  
**AUDIT:** `/workspace/powercurve-fleet-fidelity-AUDIT.md`  
**VERIFY JSON:** `scripts/fleet-verify-pc-fleet-fidelity-trap-first.json`  
**Also:** `scripts/fleet-fidelity-trap-first-report.json`

## Goals

| Goal | Result |
|------|--------|
| Research µ ladder Street→Slick × Unprep/Prep | **PASS** — prep Δ DR +0.22 / Slick +0.30 |
| Slicks only Jorge Z28 | **PASS** — hist Slick=1 |
| No OEM Cd/FA/weight/peakHp/TX edits | **PASS** |
| forceScale=1 | **PASS** — 0 non-one |
| Prefer factory-like; step-up Street→DR for Excel | **PASS** — demote 67 slicks + reseat 135; applied 192 |
| Honest 60′ (tire+µ) | **PASS** — Mustang ladder + Z28 prep Δ documented |
| Excel trap/ET better than parent | **NO** — honesty regression expected; not FF-eligible on hit rate |
| Cite µ sources in AUDIT | **PASS** |

## µ ladder before → after

| Tire | Unprep before→after | Prep before→after |
|------|---------------------|-------------------|
| Street | 0.95→**0.90** | 0.98→**0.94** |
| Summer | 1.05→**1.02** | 1.10→**1.08** |
| UHP | 1.15→**1.12** | 1.22→**1.20** |
| DR | 1.38→**1.28** | 1.43→**1.50** |
| Slick | 1.40→**1.32** | 1.45→**1.62** |

Sources: HPWizard/Wong dry asphalt 0.80–0.90; LS1GTO DR effective ~1.5–1.8 prepared; LivePhysics prepped µ≈1.6; Hallum SAE TF tread-momentum out-of-scope. Full URLs in AUDIT.

## Fleet Excel (Unprepped)

| | parent `3c37b84` | **this tip** |
|--|----------------:|-------------:|
| Trap miss | 82 | **90** |
| ET miss | 24 | **45** |
| 60–130 miss | 21 | **23** |
| 0–60 miss | 89 | **96** |
| priorityAll | 155/315 | 144/315 |
| 60′ sim mean | 2.089 | 2.117 |
| forceScale≠1 | 0 | **0** |

## Spotcheck

- **Z28 ATC** slick locked; trap+ET hit Unprepped; 0–60 soft; prep 60′ 2.00→1.74  
- **Mustangs** GT / PP2 / Dark Horse — priority hits with factory Cd/FA  
- **Camaro SS** UHP — hits  
- Worst Excel residuals: bikes (no slick), Model X Plaid, OEM-aero trap-under

## Blockers parked

- Bike/hypercar Excel without slicks/fake HP  
- Model X Plaid trap–ET conflict  
- Dyno end-spike / HP–TQ crossover backlog  
- Dragy g tip not reopened  
- **Not FF → main/Pages** — fidelity tip, hit-rate regress

## node --check

`js/physics.js`, `js/app.js`, `js/garage-data.js` — OK.
