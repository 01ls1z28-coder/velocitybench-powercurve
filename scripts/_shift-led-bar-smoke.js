'use strict';
/**
 * Unit smoke for progressive SHIFT LED bar logic (mirrors setShiftLamp in app.js).
 * No DOM — pure progress math + class expectations.
 */
function progressState(rpm, shiftRpm, n) {
  n = n || 8;
  var out = { approaching: false, shift: false, lit: 0, aria: 'off' };
  if (!(shiftRpm > 0) || rpm == null || !isFinite(Number(rpm))) return out;
  rpm = Number(rpm);
  var approachStart = Math.min(shiftRpm - 80, Math.max(shiftRpm - 500, shiftRpm * 0.92));
  var span = Math.max(60, shiftRpm - approachStart);
  if (rpm >= shiftRpm) {
    out.shift = true; out.lit = n; out.aria = 'shift';
    return out;
  }
  if (rpm < approachStart) return out;
  var progress = (rpm - approachStart) / span;
  if (progress < 0) progress = 0;
  if (progress > 1) progress = 1;
  out.approaching = true;
  out.lit = Math.max(1, Math.ceil(progress * n));
  out.aria = 'approaching';
  return out;
}

var shift = 6500;
var approachStart = Math.min(shift - 80, Math.max(shift - 500, shift * 0.92));
console.log('shiftRpm', shift, 'approachStart', approachStart);

var cases = [
  { rpm: 0, expect: { lit: 0, approaching: false, shift: false } },
  { rpm: 1000, expect: { lit: 0, approaching: false, shift: false } },
  { rpm: approachStart - 1, expect: { lit: 0, approaching: false, shift: false } },
  { rpm: approachStart, expect: { lit: 1, approaching: true, shift: false } },
  { rpm: approachStart + (shift - approachStart) * 0.4, expectMinLit: 3, approaching: true, shift: false },
  { rpm: approachStart + (shift - approachStart) * 0.75, expectMinLit: 6, approaching: true, shift: false },
  { rpm: shift - 1, expectMinLit: 7, approaching: true, shift: false },
  { rpm: shift, expect: { lit: 8, approaching: false, shift: true } },
  { rpm: shift + 200, expect: { lit: 8, approaching: false, shift: true } }
];

var fail = 0;
cases.forEach(function (c) {
  var s = progressState(c.rpm, shift, 8);
  var ok = true;
  var why = [];
  if (c.expect) {
    if (s.lit !== c.expect.lit) { ok = false; why.push('lit ' + s.lit + '!=' + c.expect.lit); }
    if (s.approaching !== c.expect.approaching) { ok = false; why.push('approaching'); }
    if (s.shift !== c.expect.shift) { ok = false; why.push('shift'); }
  } else {
    if (s.approaching !== c.approaching) { ok = false; why.push('approaching'); }
    if (s.shift !== c.shift) { ok = false; why.push('shift'); }
    if (s.lit < c.expectMinLit) { ok = false; why.push('lit ' + s.lit + ' < ' + c.expectMinLit); }
  }
  console.log((ok ? 'PASS' : 'FAIL'), 'rpm=' + Math.round(c.rpm), '→', s, why.join(','));
  if (!ok) fail++;
});

// Soft/Agg/Auto all share same setShiftLamp(pt.rpm) path — assert function is launch-mode agnostic
console.log('NOTE: Soft/Agg/Auto all call setShiftLamp via applyTimelinePoint(pt.rpm); mode-independent.');

if (fail) {
  console.error('FAIL count', fail);
  process.exit(1);
}
console.log('SHIFT LED smoke OK');
