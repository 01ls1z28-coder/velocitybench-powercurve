# Chunked Excel Garage recal plan (tip-only, no Pages)

**Credit:** Jorge Guerra only  
**Gold:** `/workspace/VelocityBench_Garage_Corrected.xlsx` → Garage sheet (targets in `scripts/excel-corrected-targets.json`)  
**Priority:** trap → ET → 60-130 → 0-60  
**Rules:** no weight changes; tire sweep first; drivetrain loss last; preserve `VB_POWERCURVE_GARAGE`; keep EV UI-path fixes (skip sanitize for EV; preserve `evLaunch*`).

## Why chunks

See `scripts/recal-interrupt-diagnosis.md`. Giant overnight passes die when the agent is interrupted or the box CPU-stalls. Each chunk must be **resumable** and **tip-committed** when green.

## Chunk gates (must be 100% for that chunk before next)

| Chunk | Scope | Done when | Durable job |
|---|---|---|---|
| **1** | Stabilize M3P + EV UI-path | `app.js` skips EV sanitize + preserves `evLaunch*`; physics EV launch clamps; M3P UI-path sim matches Excel within tol (trap/et/z60/z60130) | commit tip; `scripts/m3p-broken-vs-fixed.json` + verify smoke |
| **2** | EV misses one-by-one | Each miss car → Garage fullOk; progress JSON after every car; tip commit every 1–3 greens | `node scripts/chunk-ev-one.js --id=<carId>` (nohup) |
| **3** | Tire research bake | OEM class map + Mustang µ ladder retained; notes committed | `scripts/tire-research-notes.json` (already COMPLETE — verify only) |
| **4** | ICE fleet small batches | Batches of ≤10 ICE; tire sweep then loss last; tip after each batch green | sequential shard worker `SHARDS=1` / batch ids — **never** 6 parallel overnight |

## Resume state (2026-10-02 ~06:40 CDT)

- Tip HEAD before this work: `4c17760` (Pages LIVE — do **not** push Pages).
- Working tree has uncommitted EV UI-path + garage bake.
- EV fullOk last VERIFY: **18/39** (closer-ui-path / apply-shards).
- ICE fullOk: **29/276**.
- Lean closer died at 2/20; do **not** restart full pipeline.

## Overnight operator rules

1. Start at most **one** `nohup node scripts/chunk-ev-one.js …` at a time.
2. Agent polls `scripts/chunk-progress.json` only (short shells).
3. On interrupt: read progress, resume next pending id — never relaunch full fleet.
4. No Merovingian / Pages until all chunks green + Jorge CLEAR.
