# BUILD TIP — Dash pixel-match v2b (Sati)

Branch: `review/dash-pixel-match-v2`  
Parent tip: `13f7c5e69cb8ff4fb11800f5ae49c60122fca0c2` (atop `d5e3c6302fedc6d2f0825e594954213241f4df97`)  
**Rejected look:** `6c071aa7c61cb6cb32ee4214b3ec0a7b9a440e56`  
**Canonical ONLY:** `/workspace/powercurve-CANONICAL-approved-snip.png`  
Local tip only — **NO push**. Do not tip Seraph until Sati visual check.

Shot: `/workspace/powercurve-tip-dash-pixel-v2-shot.png`  
Side-by-side: `/workspace/powercurve-dash-side-by-side.png` (TIP left | CANONICAL right)  
This VERIFY: `/workspace/powercurve-tip-dash-pixel-v2-VERIFY.md`

## Proportion lock (measured from canonical 1280×720)

| Metric | Canonical | Tip (DOM) |
|--------|-----------|-----------|
| Panel aspect | 1280×720 | 1280×720 (`aspect-ratio` + `container-type:size`) |
| Gauge diam / panel H | ≈0.61 | ≈0.61–0.65 (`72cqh`) |
| Gauge top / H | ≈0.057 | ≈0.06 |
| Gauge bottom / H | ≈0.67 | ≈0.68 |
| Gap between gauges / W | ≈0.13 | ≈0.12–0.14 |
| Buttons band | lower third | `margin-top: 13cqh` under dials |

CSS uses `cqh`/`cqw` against the dash panel container so gauge diameter tracks panel height (not width).

## Visual checklist vs snip

- Brass double-ring bezels, radial-brushed faces, blue 7-seg recessed wells, blue needles + brass/blue hubs
- Tach 0–8 red ticks; speedo 0–200 majors/20
- Gear digit prominent; TRACTION% + triangular SLIP (car skid)
- 8 round LEDs 3g→2a→3r in distinct brass pill capsule
- Start/Pause/Stop one horizontal row, thin brass outlines
- Thin brass frame around charcoal glass panel

## Peak HP smoke — 2020 Mustang GT (NOT Z28)

| Case | ET | trap | ΔET | Δtrap |
|------|-----|------|-----|-------|
| stock | 11.501 | 118.70 | — | — |
| +100 Peak HP uniform scale | 10.883 | 127.31 | **−0.618** | +8.61 |
| −50 Peak HP uniform scale | 11.883 | 114.05 | **+0.382** | −4.65 |

`scripts/_peak-hp-mustang-gt-smoke.js` → **PASS** (uniform torqueCurve scale from d5e3c63/0754e2b kept)

## Tip Seraph

Local only. **Sati visual check of shot vs side-by-side before any Seraph tip.** No push.
