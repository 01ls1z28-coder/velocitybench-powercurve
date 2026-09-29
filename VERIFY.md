# BUILD TIP — Dash pixel-match v2 (Sati)

Branch: `review/dash-pixel-match-v2`  
Parent: `d5e3c6302fedc6d2f0825e594954213241f4df97` (Peak HP uniform torqueCurve scale kept from d5e3c63/0754e2b)  
**Rejected (do not reuse look):** `6c071aa7c61cb6cb32ee4214b3ec0a7b9a440e56`  
**Canonical snip ONLY:** `/workspace/powercurve-CANONICAL-approved-snip.png`  
Local tip only — **NO push**.

Shot: `/workspace/powercurve-tip-dash-pixel-v2-shot.png`  
This VERIFY: `/workspace/powercurve-tip-dash-pixel-v2-VERIFY.md`

## Gauge / panel match vs canonical snip

Redrawn `js/gauges.js` (visual fidelity over legacy draw path):

| Target | Notes |
|--------|-------|
| Brass bezel double-ring | Medium-thick brushed brass outer + dark groove + inner highlight |
| Radial brushed dark face | Offscreen radial brush strokes + charcoal radial base |
| Blue 7-seg hub digits | Canvas-drawn 7-segment in recessed well; labels RPM/MPH |
| Bright blue needle + hub | Glowing blue needle; brass hub ring + blue glowing core |
| Tach 0–8 ×1000 | Red ticks near redline (~6.5→8); title `RPM x1000` |
| Speedo 0–200 MPH | Majors every 20 only (no mid labels); no redline arc |
| Twin spacing + center | Compact center: gear digit → TRACTION%+SLIP → 8 round LEDs |
| 8 ROUND LEDs | 3 green → 2 amber → 3 red in brass capsule |
| Start/Pause/Stop | ONE horizontal row of three wide rounded buttons |
| Charcoal glass + thin brass frame | Near-black panel `#05070a` + thin brass border |

`?demoDash=1` freezes snip mid-run look (gear 3, hub 3280/104, needles 6500/155, all LEDs on, SLIP on).

## Peak HP smoke — generic car (NOT Z28)

Car: **2020 Ford Mustang GT** (`2020-ford-mustang-gt`) — baked `torqueCurve` (65 keys), uniform scale path from parent.

| Case | ET | trap | ΔET | Δtrap |
|------|-----|------|-----|-------|
| stock | 11.501 | 118.70 | — | — |
| +100 Peak HP uniform scale | 10.883 | 127.31 | **−0.618** | +8.61 |
| −50 Peak HP uniform scale | 11.883 | 114.05 | **+0.382** | −4.65 |

Gates: +100 ΔET materially negative + trap up; −50 slower + trap down.  
Script: `scripts/_peak-hp-mustang-gt-smoke.js` → **PASS**  
(Z28 ATC bake / regression intentionally not used as the HP smoke gauge.)

## Files

- `js/gauges.js` — full canonical gauge redraw
- `css/styles.css` — charcoal glass panel; round LEDs; horizontal run row; center stack
- `index.html` — gauges-dials + gear/TRACTION/SLIP/LEDs + horizontal Start/Pause/Stop (no SPIN)
- `js/app.js` — speedo max 200; TRACTION/SLIP Soft/Agg/Auto; `?demoDash=1` hardened paints; Peak HP scale path untouched
- `scripts/_peak-hp-mustang-gt-smoke.js` — generic-car Peak HP smoke
- `scripts/_dash-approved-mock-match-smoke.js` / `_shift-led-bar-smoke.js` — layout helpers

## Tip Seraph

Local tip only — SHA + shot + VERIFY. **Do not push.**
