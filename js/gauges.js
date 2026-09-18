/**
 * VelocityBench PowerCurve — Lexus LFA–inspired dual-dial gauges (brass accents).
 * Sharp needles, clear numerals, dark face, dual-dial presence — not neon toys.
 */
(function (global) {
  'use strict';

  function BrassGauge(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.min = (opts && opts.min) || 0;
    this.max = (opts && opts.max) || 8000;
    this.value = 0;
    this.display = 0;
    this.label = (opts && opts.label) || 'RPM';
    this.unit = (opts && opts.unit) || '';
    this.redline = (opts && opts.redline) || this.max * 0.9;
    this.majorDiv = (opts && opts.majorDiv) || null;
    this._raf = null;
    this._running = false;
    this._resize();
  }

  BrassGauge.prototype._resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var css = Math.min(this.canvas.clientWidth || 220, this.canvas.clientHeight || 220);
    if (!css) css = 220;
    this.canvas.width = Math.round(css * dpr);
    this.canvas.height = Math.round(css * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = css;
  };

  BrassGauge.prototype.setValue = function (v) {
    this.value = Math.max(this.min, Math.min(this.max, Number(v) || 0));
  };

  BrassGauge.prototype.setMax = function (m) {
    this.max = Math.max(this.min + 1, Number(m) || this.max);
    if (this.redline > this.max) this.redline = this.max * 0.9;
  };

  BrassGauge.prototype.start = function () {
    if (this._running) return;
    this._running = true;
    var self = this;
    (function loop() {
      if (!self._running) return;
      // LFA-like needle: quick but not twitchy
      self.display += (self.value - self.display) * 0.28;
      if (Math.abs(self.value - self.display) < 0.35) self.display = self.value;
      self.draw();
      self._raf = requestAnimationFrame(loop);
    })();
  };

  BrassGauge.prototype.draw = function () {
    var ctx = this.ctx, w = this.size, h = this.size;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 4;
    // LFA cluster: ~250° sweep, start lower-left
    var start = 140, sweep = 260;
    function rad(d) { return (d * Math.PI) / 180; }
    var self = this;
    function ang(v) {
      return start + ((v - self.min) / (self.max - self.min)) * sweep;
    }

    ctx.clearRect(0, 0, w, h);

    // Outer brass bezel (brushed ring)
    var bezel = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    bezel.addColorStop(0, '#f0e2c4');
    bezel.addColorStop(0.22, '#a89068');
    bezel.addColorStop(0.48, '#e8d7b0');
    bezel.addColorStop(0.72, '#6a5738');
    bezel.addColorStop(1, '#c4b08a');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = bezel; ctx.fill();

    // Inner dark ring
    ctx.beginPath(); ctx.arc(cx, cy, R - 5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1510'; ctx.fill();

    // Face — deep charcoal with subtle radial
    var face = ctx.createRadialGradient(cx, cy - R * 0.15, R * 0.05, cx, cy, R - 8);
    face.addColorStop(0, '#1c222c');
    face.addColorStop(0.55, '#0c0f14');
    face.addColorStop(1, '#050608');
    ctx.beginPath(); ctx.arc(cx, cy, R - 8, 0, Math.PI * 2);
    ctx.fillStyle = face; ctx.fill();

    // Fine brass inner rim
    ctx.beginPath(); ctx.arc(cx, cy, R - 9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232,215,176,0.35)';
    ctx.lineWidth = 1.25; ctx.stroke();

    // Redline arc (thin, sharp — LFA style)
    var redStart = ang(Math.min(this.redline, this.max));
    ctx.beginPath();
    ctx.arc(cx, cy, R - 16, rad(redStart), rad(start + sweep));
    ctx.strokeStyle = 'rgba(220, 48, 48, 0.92)';
    ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.stroke();

    // Tick marks + numerals
    var span = this.max - this.min;
    var majors = this.majorDiv || (this.max >= 1000 ? 8 : 10);
    var majorStep = span / majors;
    var minors = 5;
    ctx.lineCap = 'butt';
    for (var i = 0; i <= majors * minors; i++) {
      var val = this.min + (i / (majors * minors)) * span;
      var a = rad(ang(val));
      var isMajor = i % minors === 0;
      var isHalf = i % Math.max(1, minors / 2) === 0;
      var outer = R - 12;
      var inner = isMajor ? R - 28 : (isHalf ? R - 22 : R - 18);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.strokeStyle = isMajor ? '#e8d7b0' : 'rgba(232,215,176,0.40)';
      ctx.lineWidth = isMajor ? 2.2 : 1;
      ctx.stroke();
      if (isMajor) {
        var tx = cx + Math.cos(a) * (R - 40);
        var ty = cy + Math.sin(a) * (R - 40);
        ctx.fillStyle = '#dce3ee';
        ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var label = this.max >= 1000 ? String(Math.round(val / 1000)) : String(Math.round(val));
        ctx.fillText(label, tx, ty);
      }
    }

    // Unit / ×1000 hint
    ctx.fillStyle = 'rgba(232,215,176,0.75)';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    if (this.max >= 1000) ctx.fillText('×1000', cx, cy - R * 0.18);

    // Digital value well (LFA-like center bottom)
    ctx.fillStyle = '#e8d7b0';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillText(this.label, cx, cy + R * 0.22);

    ctx.fillStyle = '#f4f7fb';
    ctx.font = 'bold 22px ui-monospace, "Cascadia Code", monospace';
    var shown = this.max >= 1000 ? Math.round(this.display) : Math.round(this.display);
    ctx.fillText(String(shown) + (this.unit ? ' ' + this.unit : ''), cx, cy + R * 0.40);

    // Sharp needle (thin white/red tip, brass hub) — drawn last
    var na = rad(ang(this.display));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(na);
    // counterweight
    ctx.beginPath();
    ctx.moveTo(-R * 0.16, -2.2);
    ctx.lineTo(-R * 0.16, 2.2);
    ctx.lineTo(-4, 1.4);
    ctx.lineTo(-4, -1.4);
    ctx.closePath();
    ctx.fillStyle = '#8a7a58';
    ctx.fill();
    // needle body
    ctx.beginPath();
    ctx.moveTo(-4, -1.6);
    ctx.lineTo(R - 30, -0.7);
    ctx.lineTo(R - 26, 0);
    ctx.lineTo(R - 30, 0.7);
    ctx.lineTo(-4, 1.6);
    ctx.closePath();
    var needleGrad = ctx.createLinearGradient(0, 0, R - 28, 0);
    needleGrad.addColorStop(0, '#f4f7fb');
    needleGrad.addColorStop(0.75, '#f4f7fb');
    needleGrad.addColorStop(1, '#e02040');
    ctx.fillStyle = needleGrad;
    ctx.fill();
    // tip accent
    ctx.beginPath();
    ctx.moveTo(R - 34, -1.1);
    ctx.lineTo(R - 22, 0);
    ctx.lineTo(R - 34, 1.1);
    ctx.closePath();
    ctx.fillStyle = '#ff3355';
    ctx.fill();
    ctx.restore();

    // Hub
    var hub = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 11);
    hub.addColorStop(0, '#f0e2c4');
    hub.addColorStop(0.45, '#a89068');
    hub.addColorStop(1, '#3a3020');
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = hub; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0c10'; ctx.fill();
  };

  // fix stop() bug reference
  BrassGauge.prototype.stop = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  global.VBPowerCurveGauges = { BrassGauge: BrassGauge };
})(typeof window !== 'undefined' ? window : globalThis);
