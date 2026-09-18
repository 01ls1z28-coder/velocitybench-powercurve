/**
 * VelocityBench PowerCurve — brass analog gauges (RPM + speed).
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
    this._raf = null;
    this._running = false;
    this._resize();
  }

  BrassGauge.prototype._resize = function () {
    var dpr = window.devicePixelRatio || 1;
    var css = Math.min(this.canvas.clientWidth || 200, this.canvas.clientHeight || 200);
    if (!css) css = 200;
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
      self.display += (self.value - self.display) * 0.18;
      if (Math.abs(self.value - self.display) < 0.5) self.display = self.value;
      self.draw();
      self._raf = requestAnimationFrame(loop);
    })();
  };

  BrassGauge.prototype.stop = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  BrassGauge.prototype.draw = function () {
    var ctx = this.ctx, w = this.size, h = this.size;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 6;
    var start = 135, sweep = 270;
    function rad(d) { return (d * Math.PI) / 180; }
    function ang(v) {
      return start + ((v - this.min) / (this.max - this.min)) * sweep;
    }
    ang = ang.bind(this);

    ctx.clearRect(0, 0, w, h);

    var bezel = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    bezel.addColorStop(0, '#d7c4a0');
    bezel.addColorStop(0.35, '#8f7a55');
    bezel.addColorStop(0.55, '#f0e2c4');
    bezel.addColorStop(1, '#6a5738');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = bezel; ctx.fill();

    ctx.beginPath(); ctx.arc(cx, cy, R - 8, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0c10'; ctx.fill();

    // redline arc
    var redStart = ang(this.redline);
    ctx.beginPath();
    ctx.arc(cx, cy, R - 18, rad(redStart), rad(start + sweep));
    ctx.strokeStyle = 'rgba(255, 51, 85, 0.85)';
    ctx.lineWidth = 6; ctx.stroke();

    // ticks
    var major = 10;
    for (var i = 0; i <= major; i++) {
      var val = this.min + (i / major) * (this.max - this.min);
      var a = rad(ang(val));
      var outer = R - 14;
      var inner = i % 2 === 0 ? R - 28 : R - 22;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.strokeStyle = i % 2 === 0 ? '#e8d7b0' : 'rgba(232,215,176,0.45)';
      ctx.lineWidth = i % 2 === 0 ? 2 : 1;
      ctx.stroke();
      if (i % 2 === 0) {
        var tx = cx + Math.cos(a) * (R - 38);
        var ty = cy + Math.sin(a) * (R - 38);
        ctx.fillStyle = '#9aa6b8';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var label = this.max >= 1000 ? String(Math.round(val / 1000)) : String(Math.round(val));
        ctx.fillText(label, tx, ty);
      }
    }

    // needle
    var na = rad(ang(this.display));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(na);
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(0, -4); ctx.lineTo(R - 32, 0); ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fillStyle = '#ff3355';
    ctx.fill();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#d7c4a0'; ctx.fill();

    ctx.fillStyle = '#e8d7b0';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, cx, cy + R * 0.42);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = 'bold 16px ui-monospace, monospace';
    var shown = this.max >= 1000 ? Math.round(this.display) : this.display.toFixed(0);
    ctx.fillText(String(shown) + (this.unit ? ' ' + this.unit : ''), cx, cy + R * 0.58);
  };

  global.VBPowerCurveGauges = { BrassGauge: BrassGauge };
})(typeof window !== 'undefined' ? window : globalThis);
