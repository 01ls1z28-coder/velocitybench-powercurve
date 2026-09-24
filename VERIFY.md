# BUILD LOCK — PowerCurve UI stack on Phase 3 (gear TX label + calib panel)

Base lineage: `42cae82` (Phase 3 Euro DCT) → `37c2e70` (gear UI TX label) → this tip (calib/source transparency panel).
**UI-only stack** — **no garage remaps**, no physics / launch-tach / FD edits.
Gear label (`#txFactoryLabelField`) and calib panel (`#calibPanel` under Time Slip) do not overlap.

## VERIFY note (required)
- Phase 1–3 remaps **intact** (these tips do not touch `js/garage-data.js` / `js/physics.js`).
- Launch-tach intact: `resolveLeaveRpm` + `launchLocked` — **not touched**.
- forceScale untouched; no recalib (UI-only).
- Peak HP wipe guard + `VB_POWERCURVE_GARAGE` bind intact.
- Soft flag (Phase 2): bake was right; **label was missing** — gear editor now shows human factory TX / preset name from `car.txKey` → `FactoryTransmissions[txKey].name`.
- Credits **Jorge Guerra** only.
- Panel surfaces **existing** fleet hit-rates from `scripts/garage-calib-meta.json` tip `real-tx-phase3-euro-dct` + honest-miss caveat from `scripts/recalib-trap-miss-batch22.js` — **no new metrics / sources invented**.

## Goal (gear UI — already on main as 37c2e70)
In the gear editor, garage cars show e.g. **“Muncie M21 4-spd”** / **“Porsche PDK 7-spd (GT)”** above the editable gear rows — not anonymous ratios only. Custom Builder keeps the existing Factory TX preset dropdown.

| Surface | Behavior |
|---|---|
| `#txFactoryLabel` (garage cars) | Read-only brass label = `Phys.FactoryTransmissions[car.txKey].name` |
| `#txFactoryKey` | Muted `preset · <txKey>` under the name |
| `#txPreset` (Custom Builder only) | Unchanged editable dropdown; factory label field hidden |
| `readCarFromForm` | Preserves `base.txKey` so the label survives RUN |

## Goal (calib panel — this tip)
Compact calib/source transparency panel so users see compiled fleet hit-rates vs Excel TOL, honest-miss language, and a clear **compiled estimates / not lab-certified / not track-certified** caveat.

| Surface | Content | Source |
|---|---|---|
| `#calibCaveat` | Compiled estimates — not lab / dyno / track certified | baked caveat (matches existing disclaimer language) |
| `#calibHits` | Fleet ET / trap / 0–60 / 60–130 / all4 hit counts + % | `garage-calib-meta.json` → `stats` (324/331 · 301/331 · 284/332 · 72/76 · all4 250) |
| `#calibMetaLine` | Tip name · knobs · Excel TOL | meta `tip` / `tol` / knobs note |
| `#calibHonest` | 14 honest-miss cars left untouched | `recalib-trap-miss-batch22.js` HONEST_MISS |
| `#calibSource` | `scripts/garage-calib-meta.json` | path label |

## Files
- `index.html` — `#txFactoryLabelField` / `#calibPanel`; script tag for calib-meta
- `css/styles.css` — `.tx-factory-label` + `.calib-panel` brass chrome
- `js/app.js` — `resolveTxDisplayName` / `updateTxFactoryLabel`; `renderCalibPanel`; `txKey` preserved on RUN
- `js/calib-meta.js` — compact `window.VB_POWERCURVE_CALIB_META` subset (new)
- **Not touched:** `js/garage-data.js`, `js/physics.js`, launch-tach, gear ratios / FD

## Integrity
- forceScale / physics / garage remaps / launch-tach: **unchanged**
- Phase 1 nG10 + Phase 2 classics + Phase 3 Euro DCT: **not regressed** (no garage edit)
- `window.VB_POWERCURVE_GARAGE` bind present · Peak HP wipe comment present
- **Skipped:** Phase 4 EV FD remaps

## VERIFY checklist
1. Tip rebased onto `37c2e70`; files = HTML/CSS/`js/app.js`/`js/calib-meta.js` (+ VERIFY)
2. GTO / Demon / GT3 RS show human TX names in gear editor; Custom Builder dropdown intact
3. `rg 'resolveTxDisplayName|txFactoryLabel' js/app.js index.html`
4. Panel stats match `node -e "console.log(require('./scripts/garage-calib-meta.json').stats)"`
5. `rg 'renderCalibPanel|VB_POWERCURVE_CALIB_META' js/app.js js/calib-meta.js index.html`
6. `rg 'resolveLeaveRpm|launchLocked' js/physics.js` still present; garage-data untouched vs Phase 3
7. Credits remain **Jorge Guerra** only.
