# EV fix / recal interrupt diagnosis — 2026-10-02

**Credit:** Jorge Guerra only  
**Worktree:** `/workspace/pc-ev-pages-excel-match` (`review/ev-pages-excel-match`)  
**Scope:** Diagnosis only — no giant recal restarted as part of this write-up.  
**Box local times:** America/Chicago (CDT, UTC−5)

## Executive summary

The overnight EV fix/recal did **not** die from a classic Linux OOM killer (`oom-kill` / `Killed process` absent from `dmesg`). Both mid-pass stops share the **same failure mode**:

1. **Long recal work was bound to agent/subagent shell turns**, then  
2. **Host CPU starvation** (load 14–51, RCU stalls, sand-host pressure profile) made the box unresponsive, and  
3. **Agent harness interrupt / turn settle** killed or orphaned the node children mid-pass.

Result: progress lost mid-fleet (or stuck after 2/20 cars) even when some jobs wrote progress JSON.

## Evidence timeline (CDT)

| Time (CDT) | What |
|---|---|
| ~05:57–05:58 | `scripts/ev-miss-aggressive.err` ends with **NUL-byte corruption** mid-line after `Aggressive EV miss closer: 20 cars` then later a stale `EV 9/21…` fragment — classic **abrupt process kill mid-write** (SIGKILL / session teardown), not a clean Node exception. |
| 05:59:22 | `excel-match-pipeline` starts (`excel-match-pipeline.nohup.out`). |
| 05:59:40 | Pipeline phase `running recalib-ev-lean-closer.js`. |
| 06:06→06:35+ | Repeated `dmesg` **RCU preempt stalls**; message: *"Unless rcu_preempt kthread gets sufficient CPU time, **OOM is now expected behavior**."* This is **CPU starvation**, not proof an OOM kill occurred. |
| ~06:35 | `/tmp/sand-host-profiles/sand-host-pressure-*.cpuprofile` written — sand-host under pressure. |
| ~06:37 | `ev-lean-closer-progress.json` last update: **2/20 cars**, `fullOkSoFar: 0`, `sims: 1013`, last = Model 3 Performance (trap/et/z60 hit; z60130 miss). **No** `recalib-ev-lean-closer` / pipeline node process left running when diagnosed (~06:38). |
| Ongoing | `sand-supervisor`: agent cgroup **100–490% of 1 core**, stalls up to ~13%; desktop RFB restarts; network `DeadlineExceeded` / `EAI_AGAIN`. |
| Memory | ~12 Gi / 15 Gi used, **0 swap**, `/tmp/sand-memory-watch.log` empty (no useful memory-watch trail). |

Parent chat also recorded two “EV fix run got interrupted” / restart cycles while Jorge slept — matches the two windows above (aggressive closer, then lean-closer/pipeline).

## What did **not** kill the jobs

- **No** `dmesg` lines for `oom-kill`, `Out of memory`, or `Killed process`.
- **No** clean unhandled Node stack in lean-closer `.err` (only progress lines through car 2/20).
- Agent `audit.jsonl` files on disk appear **stale** (last keyword hits Sept; fuse mtimes Oct 1 21:36) — they do **not** record the Oct 2 interrupts reliably.

## Root cause (same mode both times)

| Factor | Role |
|---|---|
| **Agent/subagent interrupt** | Recal launched from executor turns; new user messages / voice inbound / turn settle interrupt the subagent → shell tree dies → child `node` dies mid-pass. |
| **CPU thrash** | Pipeline design runs heavy EV closer then **6–8 parallel ICE shards**; earlier morning also had 6 ICE shards DONE (~55 min each). Load averages 40–50 + RCU stalls → shells timeout (840 s spawn failures observed), host pressure, agent looks hung → more interrupts. |
| **Insufficient durability vs interrupt** | Progress JSON existed (`ev-lean-closer-progress.json`) but **garage-data was not checkpointed per car** to tip; interrupt left uncommitted working tree + incomplete closer. Pipeline `nohup` helped only until the agent-owned children were killed. |
| **Tight RAM / no swap** | Amplifies risk under thrash; not the smoking gun (no OOM killer). |

## Recommended changes for unattended overnight

1. **Detach sims from the agent turn** — `nohup`/`systemd`-style long jobs writing only to files; agent only polls progress JSON every few minutes (short shells).
2. **Chunk size = 1 car (or ≤5)** — each chunk must hit Garage 100% (trap→ET→60-130→0-60) then **commit tip** before next. Never one multi-hour “full fleet” inside one agent.
3. **Checkpoint often** — after each car: write `garage-data.js` + `*-progress.json` + per-car report; resume skips `fullOk` cars.
4. **Serialize heavy work** — max **1** tune worker at a time (no 6-shard + EV closer together). Prefer sequential shards overnight.
5. **Don’t restart giant pipeline** after an interrupt — resume from progress JSON / miss list only.
6. **Tip-only until CLEAR** — no Pages / Merovingian until every chunk green (per Jorge).

## Artifact pointers

- Progress: `scripts/excel-match-pipeline-progress.json`, `scripts/ev-lean-closer-progress.json`
- Corrupt kill evidence: `scripts/ev-miss-aggressive.err` (NUL bytes)
- Host pressure: `/tmp/sand-host.log`, `/tmp/sand-supervisor.log`, `/tmp/sand-host-profiles/`
- RCU: `dmesg -T | grep -i rcu`
- Last known hit rates (apply-shards ~05:07 CDT): EV fullOk **18/39**; ICE fullOk **29/276**
