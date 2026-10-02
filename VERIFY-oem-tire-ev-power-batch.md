# VERIFY — Combined tip: OEM tire + EV power Excel match

**Credit:** Jorge Guerra only
**Branch:** `review/oem-tire-ev-power-batch`
**Tip SHA:** `b755624` (`b755624de1149993271602c62dfaaa30876f45f4`)
**Parent tire SHA:** `6464c65` (Mustang GT 10AT → Street P235/50R18 all-season)
**Repo:** `01ls1z28-coder/velocitybench-powercurve`
**Pages / main:** HOLD until Seraph CLEAR → Merovingian (tip push only from this VERIFY)
**Report:** `scripts/ev-power-excel-match-report.json`
**SOI Excel:** `/workspace/garage-export/VelocityBench_Garage_Corrected.xlsx` + `scripts/excel-corrected-targets.json`
**Cache-bust:** `js/garage-data.js?v=oem-tire-ev-batch` (preserved)
**Garage bind:** `window.VB_POWERCURVE_GARAGE` preserved

## Disclaimer

Compiled estimates from OEM published specs and instrumented magazine tests (C&D / MotorTrend / R&T priority per Excel Methodology sheet). **Not lab-certified dyno or VBOX numbers.** Driver weight default **200 lb** (Excel SOI / physics default). Unprepped track default.

## Secrets / tracking

**false** — no secrets, tokens, or tracking added.

## Locks

- No EV `weightLbs` changes
- Power-only: `peakHp` + proportional `torqueCurve` scale; `forceScale=1`
- Did **not** rewrite `TIRE_MU_BY_PREP` (µ tip `review/mu-60ft-calibrate` layers later)
- Remote DB: **none** — baked into `js/garage-data.js`

## Physics: EV AWD / TC launch

Auto launch mode for EVs: AWD gets `launchDriveMult=1.10` + `launchMuMult=1.06`; FWD/RWD EV `1.05` / `1.03`. Reflects factory traction control / AWD leave — not fleet-wide invented AWD µ×1.25.

## Hit rates vs Corrected Excel (priority trap→ET→60-130→0-60; 60ft N/A in sheet)

| Metric | Hits | Tol |
|--------|------|-----|
| Trap mph | **38/38** | ±2.5 |
| ET s | 10/38 | ±0.25 |
| 60–130 s | 3/4 | ±0.75 |
| 0–60 s | 6/39 | ±0.25 |
| 60ft | N/A (Excel has no 60ft column) | — |

Trap-first power often conflicts with ET/0-60 on the same card (Excel ET–trap pairs are magazine-session composites). Remaining ET/0-60 misses are honest leftovers under trap lock + no weight edits.

## Tire half (already on 6464c65)

- 2020 Ford Mustang GT (10AT): Summer→**Street** P235/50R18 all-season OEM

## EV table (before → after vs Excel)

| EV | Drive | HP before→after | Trap B→A / Excel | ET B→A / Excel | 60-130 B→A / Excel | 0-60 B→A / Excel | 60ft | Hits |
|----|-------|-----------------|------------------|----------------|--------------------|------------------|------|------|
| 2021 Rimac Nevera | AWD | 1914→1914 | N/A | N/A | 2.999→2.603 / 2.99 | 2.149→1.644 / 1.74 | N/A | 613✓ 60✓ |
| 2022 BMW iX M60 | AWD | 610→561 | 118.42→115.42 / 114 | 11.922→12.322 / 12.1 | N/A | 3.555→3.884 / 3.6 | N/A | T✓ E✓ 60✗ |
| 2022 Ford F-150 Lightning | AWD | 580→734 | 109.74→110 / 108 | 13.711→12.459 / 12.5 | N/A | 5.515→4.287 / 4 | N/A | T✓ E✓ 60✗ |
| 2022 Mercedes EQB 350 | AWD | 288→305 | 95.75→97.85 / 96 | 16.021→15.603 / 14.6 | N/A | 7.982→7.494 / 6 | N/A | T✓ E✗ 60✗ |
| 2022 Porsche Taycan Turbo S | AWD | 750→701 | 133.99→131.21 / 130 | 10.153→10.405 / 10.5 | 7.327→7.907 / 6.5 | 2.114→2.271 / 2.4 | N/A | T✓ E✓ 613✗ 60✓ |
| 2022 Tesla Model S Plaid | AWD | 1020→1156 | 146.66→151.59 / 151 | 9.811→9.342 / 9.25 | 4.943→4.323 / 4.8 | 2.519→2.207 / 2.1 | N/A | T✓ E✓ 613✓ 60✓ |
| 2022 Tesla Model X Plaid | AWD | 1020→683 | 144.51→126.4 / 124 | 10.148→12.036 / 10.2 | N/A | 2.718→4.154 / 2.5 | N/A | T✓ E✗ 60✗ |
| 2023 Audi e-tron GT | AWD | 522→488 | 119.51→116.8 / 116 | 11.585→11.884 / 12.1 | N/A | 3.089→3.317 / 3.6 | N/A | T✓ E✓ 60✗ |
| 2023 Audi Q4 e-tron | AWD | 295→312 | 96.77→98.83 / 97 | 15.836→15.434 / 14.5 | N/A | 7.768→7.304 / 5.8 | N/A | T✓ E✗ 60✗ |
| 2023 BMW i7 xDrive60 | AWD | 536→536 | 112.97→112.97 / 111 | 13.233→13.233 / 12.8 | N/A | 5.054→5.054 / 4.3 | N/A | T✓ E✗ 60✗ |
| 2023 Ford Mustang Mach-E GT | AWD | 480→504 | 114.52→116.34 / 114 | 12.866→12.605 / 12.2 | N/A | 4.675→4.439 / 3.6 | N/A | T✓ E✗ 60✗ |
| 2023 Genesis GV60 Performance | AWD | 429→476 | 111.61→115.49 / 113 | 13.317→12.742 / 12.3 | N/A | 5.102→4.568 / 3.8 | N/A | T✓ E✗ 60✗ |
| 2023 Hyundai Ioniq 5 N | AWD | 641→573 | 127.29→122.83 / 121 | 11.715→12.295 / 11.5 | N/A | 3.894→4.386 / 3.2 | N/A | T✓ E✗ 60✗ |
| 2023 Hyundai Kona Electric | FWD | 201→211 | 90.67→92.36 / 90 | 16.977→16.602 / 15.3 | N/A | 9.101→8.631 / 6.8 | N/A | T✓ E✗ 60✗ |
| 2023 Kia EV6 GT | AWD | 576→605 | 122.65→124.45 / 122 | 11.789→11.556 / 11.4 | N/A | 3.743→3.553 / 3.2 | N/A | T✓ E✓ 60✗ |
| 2023 Mercedes EQE AMG 53 | AWD | 677→607 | 122.48→119.16 / 120 | 11.011→11.453 / 11.6 | N/A | 2.737→3.071 / 3.2 | N/A | T✓ E✓ 60✓ |
| 2023 Mercedes EQS 580 SUV | AWD | 536→536 | 109.91→109.91 / 108 | 13.739→13.739 / 13.1 | N/A | 5.558→5.558 / 4.5 | N/A | T✓ E✗ 60✗ |
| 2023 Nissan Ariya e-4ORCE | AWD | 389→353 | 106.89→103.28 / 101 | 13.985→14.602 / 13.8 | N/A | 5.739→6.382 / 5.1 | N/A | T✓ E✗ 60✗ |
| 2023 Polestar 2 Performance | AWD | 476→436 | 116.52→113.25 / 111 | 12.622→13.099 / 12.6 | N/A | 4.466→4.903 / 4.1 | N/A | T✓ E✗ 60✗ |
| 2023 Tesla Model Y Performance | AWD | 456→465 | 116.74→117.45 / 115 | 12.519→12.418 / 11.8 | N/A | 4.353→4.263 / 3.5 | N/A | T✓ E✗ 60✗ |
| 2023 Toyota bZ4X AWD | AWD | 214→257 | 87.74→94.15 / 92 | 17.618→16.182 / 15.1 | N/A | 9.971→8.141 / 6.5 | N/A | T✓ E✗ 60✗ |
| 2023 VW ID.4 AWD Pro | AWD | 295→312 | 96.77→98.83 / 97 | 15.836→15.434 / 14.4 | N/A | 7.768→7.304 / 5.7 | N/A | T✓ E✗ 60✗ |
| 2024 BMW i5 M60 | AWD | 590→523 | 121.42→116.91 / 115 | 12.036→12.656 / 12.1 | N/A | 3.975→4.519 / 3.6 | N/A | T✓ E✗ 60✗ |
| 2024 Cadillac Lyriq AWD | AWD | 500→443 | 110.9→106.39 / 104 | 13.37→14.089 / 13.3 | N/A | 5.139→5.851 / 4.6 | N/A | T✓ E✗ 60✗ |
| 2024 Chevrolet Blazer EV SS | AWD | 557→588 | 116.68→118.69 / 117 | 12.567→12.287 / 11.7 | N/A | 4.407→4.161 / 3.4 | N/A | T✓ E✗ 60✗ |
| 2024 Fisker Ocean Extreme | AWD | 564→492 | 116.95→111.87 / 110 | 12.509→13.251 / 12.5 | N/A | 4.351→5.032 / 3.9 | N/A | T✓ E✗ 60✗ |
| 2024 Hyundai Ioniq 6 AWD | AWD | 320→336 | 104.35→106.12 / 104 | 14.432→14.126 / 13.4 | N/A | 6.206→5.884 / 4.8 | N/A | T✓ E✗ 60✗ |
| 2024 Kia Niro EV | FWD | 201→211 | 90.16→91.85 / 90 | 17.08→16.702 / 15.4 | N/A | 9.23→8.753 / 6.9 | N/A | T✓ E✗ 60✗ |
| 2024 Lucid Air Sapphire | AWD | 1234→1344 | 154.45→158.52 / 157 | 9.749→9.405 / 9 | 4.455→4.071 / 4.6 | 2.644→2.417 / 2.1 | N/A | T✓ E✗ 613✓ 60✗ |
| 2024 Lucid Air Touring | AWD | 620→587 | 126.11→124.26 / 123 | 11.121→11.358 / 11.2 | N/A | 3.004→3.183 / 3 | N/A | T✓ E✓ 60✓ |
| 2024 Mercedes EQS 450+ | RWD | 355→386 | 99.42→102.54 / 101 | 15.607→15.027 / 14 | N/A | 7.546→6.899 / 5.4 | N/A | T✓ E✗ 60✗ |
| 2024 Rivian R1S Quad Motor | AWD | 835→835 | 123.14→123.14 / 121 | 12.337→12.337 / 11.3 | N/A | 4.383→4.383 / 3 | N/A | T✓ E✗ 60✗ |
| 2024 Subaru Solterra | AWD | 215→268 | 86.28→94.19 / 92 | 18.123→16.335 / 15.1 | N/A | 10.672→8.358 / 6.5 | N/A | T✓ E✗ 60✗ |
| 2024 Tesla Cybertruck Tri-Motor | AWD | 845→903 | 118.18→120.08 / 119 | 11.379→11.113 / 11 | N/A | 3.087→2.878 / 2.6 | N/A | T✓ E✓ 60✗ |
| 2024 Tesla Model 3 Performance | AWD | 510→525 | 123.85→124.88 / 123 | 11.575→11.444 / 11 | N/A | 3.55→3.446 / 2.9 | N/A | T✓ E✗ 60✗ |
| 2024 Tesla Model S Long Range | AWD | 670→550 | 130.05→121.86 / 120 | 11.611→12.659 / 11.4 | N/A | 3.87→4.769 / 3.1 | N/A | T✓ E✗ 60✗ |
| 2024 Tesla Model X Long Range | AWD | 670→705 | 126.87→129.11 / 127 | 11.892→11.63 / 11.4 | N/A | 4.009→3.794 / 3.6 | N/A | T✓ E✓ 60✓ |
| 2024 Volvo EX90 Twin Motor | AWD | 496→464 | 107.6→105.11 / 103 | 13.9→14.315 / 13.5 | N/A | 5.661→6.087 / 4.9 | N/A | T✓ E✗ 60✗ |
| 2024 Volvo XC40 Recharge | AWD | 402→385 | 107.43→105.97 / 104 | 13.754→14.013 / 13.2 | N/A | 5.492→5.755 / 4.5 | N/A | T✓ E✗ 60✗ |

## Sources

- VelocityBench_Garage_Corrected.xlsx Methodology (C&D preferred; MT/R&T; OEM claim last)
- Per-car `source` strings in garage-data (OEM HP/weight cards retained; power scaled to Excel trap-first)
- Tesla/Lucid/Porsche/Hyundai/Kia/etc. published system HP as starting card; scale noted when >15% over card

## Over-OEM (>15% card HP) after bake

- 2022 Ford F-150 Lightning: 580→734 (scale 1.2655)
- 2023 Toyota bZ4X AWD: 214→257 (scale 1.2009)
- 2024 Subaru Solterra: 215→268 (scale 1.2465)

## Baked paths

- `js/garage-data.js` — EV peakHp/curves + OEM tire class fixes; Mustang from tire half
- `js/physics.js` — EV AWD/TC auto-launch only (no µ table rewrite)
- `scripts/recalib-ev-power-excel-match.js` + `scripts/ev-power-excel-match-report.json`

## Remaining blockers

- ET/0-60 under trap lock: many EVs cannot hit magazine ET and trap simultaneously with power-only + locked curb weight (Excel sessions omit 1-ft rollout post-2019; sim includes full standing start).
- Model X Plaid Excel trap 124 vs peer Plaid physics historically ~140+ — trap hit via power cut may soften ET/0-60.
- 60ft not in Corrected Excel — treated N/A; sim 60ft still reported in JSON `after.sixty`.
