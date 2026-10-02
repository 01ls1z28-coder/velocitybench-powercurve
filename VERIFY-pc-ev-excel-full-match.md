# VERIFY — EV Excel full-match + Jorge Mustang GT 60ft µ chart

**Credit:** Jorge Guerra only
**Branch:** `review/ev-excel-full-match`
**Base:** LIVE `d34df6c`
**Repo:** `01ls1z28-coder/velocitybench-powercurve`
**Pages / main / Seraph:** HOLD — tip only until Seraph CLEAR
**Excel gold:** `/workspace/VelocityBench_Garage_Corrected.xlsx`
**forceScale:** 1
**Garage bind:** `VB_POWERCURVE_GARAGE` preserved
**Secrets / remote DB:** none — baked files only

## 1) Tire µ — AUTHORITATIVE Mustang GT 10AT 60ft chart

Ref `2020-ford-mustang-gt`, driver 200, fs=1, launch=auto.

| Prep | Street | Summer | UHP | R-Comp | DR | Slick |
|------|--------|--------|-----|--------|----|-------|
| Chart Unprep | 2.2 | 2.103 | 1.96 | 1.9 | 1.82 | 1.908 |
| After Unprep | 2.2 | 2.103 | 1.96 | 1.9 | 1.82 | 1.908 |
| Chart Prep | 2.04 | 1.989 | 1.9 | 1.85 | 1.73 | 1.708 |
| After Prep | 2.04 | 1.989 | 1.9 | 1.85 | 1.73 | 1.708 |

- All 12 cells: **PASS** (err ≤ 0.01s)
- Prep Slick vs DR gap: **0.022s** (chart 0.022)
- Prep DR/Slick: `prepRaceHook` drive mult DR×1.011 / Slick×1.039 (µ-only power floor ~1.738)
- **FLAG:** Jorge started third voice issue (“And if I go to…”) — cut off; needs finish

## 2) EV Corrected Excel (tol trap±0.5 / times±0.05)

| Metric | Hits |
|--------|------|
| Trap | **38/38** |
| ET | **37/39** |
| 60–130 | 1/4 |
| 0–60 | 19/39 |
| 60ft | N/A in sheet |

Full-OK EVs: **18/39**. Remaining: **21** (honest leftovers under fs=1).

### Remaining EV misses

- **2022 Tesla Model S Plaid** hp=1134 — z60130:4.448/4.8, z60:2.001/2.1
- **2022 Porsche Taycan Turbo S** hp=689 — z60130:8.063/6.5
- **2024 Lucid Air Sapphire** hp=1286 — et:9.05/9, z60130:4.299/4.6, z60:1.866/2.1
- **2024 Cadillac Lyriq AWD** hp=447 — z60:4.813/4.6
- **2023 Genesis GV60 Performance** hp=456 — z60:3.884/3.8
- **2024 Volvo EX90 Twin Motor** hp=469 — et:13.45/13.5, z60:5.022/4.9
- **2023 Audi Q4 e-tron** hp=324 — z60:6.122/5.8
- **2022 Mercedes EQB 350** hp=311 — z60:6.209/6
- **2023 Nissan Ariya e-4ORCE** hp=353 — z60:5.341/5.1
- **2024 Subaru Solterra** hp=280 — z60:6.77/6.5
- **2023 Toyota bZ4X AWD** hp=263 — z60:6.75/6.5
- **2024 Fisker Ocean Extreme** hp=497 — z60:4.043/3.9
- **2024 Hyundai Ioniq 6 AWD** hp=334 — z60:4.933/4.8
- **2023 VW ID.4 AWD Pro** hp=320 — z60:5.991/5.7
- **2023 Ford Mustang Mach-E GT** hp=481 — z60:3.791/3.6
- **2024 BMW i5 M60** hp=513 — z60:3.74/3.6
- **2024 Mercedes EQS 450+** hp=391 — z60:5.602/5.4
- **2023 Hyundai Kona Electric** hp=219 — z60:6.961/6.8
- **2024 Kia Niro EV** hp=218 — z60:7.096/6.9
- **2023 Mercedes EQS 580 SUV** hp=525 — z60:4.693/4.5
- **2024 Volvo XC40 Recharge** hp=388 — z60:4.712/4.5

### Excel tensions
- Taycan 60–130 **6.5** vs 10.5@130 composite
- Plaid/Sapphire 60–130 vs 0–60 under trap lock

## Tip SHA

_(post-commit)_

