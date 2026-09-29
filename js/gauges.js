/**
 * VelocityBench PowerCurve — live BrassGauge twin-cluster (beauty tip / d5e3c63 era).
 * Refined brushed brass bezel · richer charcoal glass · sharp white/red needle · polished brass hub (beauty-v4).
 * Needle angle and hub digital share this.display every frame (needle≡digital).
 * NO snip wallpaper / NO dash-canonical-snip underlay — faces + bezels are canvas-drawn.
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
    // 'speed' → MPH face: bold majors every 20, smaller intermediates every 10
    this.dial = (opts && opts.dial) || null;
    // Kept for app.js API compat (always ignored — digital always from this.display)
    this.hubDisplay = null;
    this.overlayOnly = !!(opts && opts.overlayOnly); // unused — full live dial always
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

  BrassGauge.prototype.setRedline = function (r) {
    this.redline = Math.max(this.min, Math.min(this.max, Number(r) || this.max * 0.9));
  };

  BrassGauge.prototype.setLabel = function (label, unit) {
    this.label = label || this.label;
    if (unit != null) this.unit = unit;
  };

  /**
   * Reconfigure dial for ICE tach vs EV power %.
   * mode: 'rpm' | 'powerPct'
   */
  BrassGauge.prototype.configure = function (opts) {
    opts = opts || {};
    var mode = opts.mode || 'rpm';
    this.mode = mode;
    if (mode === 'powerPct') {
      this.min = 0;
      this.max = 100;
      this.redline = 95;
      this.label = opts.label || 'PWR';
      this.unit = '%';
      this.majorDiv = 10;
      this.dial = null;
    } else {
      var red = Number(opts.redline) || 7000;
      var max = Number(opts.max);
      if (!isFinite(max) || max <= 0) {
        // Nice ceiling just above redline (1k steps; 2k when ≥12k)
        var pad = Math.max(red * 1.02, red + 200);
        var step = pad >= 12000 ? 2000 : 1000;
        max = Math.ceil(pad / step) * step;
      }
      this.min = 0;
      this.max = max;
      this.redline = Math.min(red, max);
      this.label = opts.label || 'RPM';
      this.unit = opts.unit || '';
      this.majorDiv = opts.majorDiv != null ? opts.majorDiv : null;
    }
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

  BrassGauge.prototype.stop = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  BrassGauge.prototype.draw = function () {
    var ctx = this.ctx, w = this.size, h = this.size;
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 4;
    // Font/tick scale. Original fixed px were tuned for typical desktop canvas (~280–440).
    // Keep fs=1 on desktop so brass dial chrome is unchanged; scale down only on small mobile faces.
    var fs;
    if (this.size >= 280) fs = 1;
    else {
      fs = this.size / 280;
      if (!isFinite(fs) || fs <= 0) fs = 1;
      if (fs < 0.78) fs = 0.78; // floor so majors stay readable
    }
    // LFA cluster: ~260° sweep, start lower-left
    var start = 140, sweep = 260;
    function rad(d) { return (d * Math.PI) / 180; }
    var self = this;
    function ang(v) {
      return start + ((v - self.min) / (self.max - self.min)) * sweep;
    }

    ctx.clearRect(0, 0, w, h);

    // Outer brass bezel — refined brushed gold (beauty-v4; geometry unchanged)
    var bezel = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    bezel.addColorStop(0, 'rgba(255,236,196,0.95)');
    bezel.addColorStop(0.18, 'rgba(168,140,96,0.98)');
    bezel.addColorStop(0.42, 'rgba(236,214,170,0.95)');
    bezel.addColorStop(0.62, 'rgba(110,88,58,0.99)');
    bezel.addColorStop(0.82, 'rgba(210,186,145,0.92)');
    bezel.addColorStop(1, 'rgba(150,122,82,0.95)');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = bezel; ctx.fill();

    // Soft outer ambient ring (subtle depth, still within dial clip)
    ctx.beginPath(); ctx.arc(cx, cy, R - 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,246,224,0.22)';
    ctx.lineWidth = 1.2; ctx.stroke();

    // Inner dark ring (slightly wider dark band → thinner visible brass)
    ctx.beginPath(); ctx.arc(cx, cy, R - 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#12100e'; ctx.fill();

    // Face — richer charcoal glass with warm brass undertone
    var face = ctx.createRadialGradient(cx, cy - R * 0.18, R * 0.04, cx, cy, R - 7);
    face.addColorStop(0, '#2a3140');
    face.addColorStop(0.28, '#1a202c');
    face.addColorStop(0.62, '#0e131a');
    face.addColorStop(1, '#050608');
    ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, Math.PI * 2);
    ctx.fillStyle = face; ctx.fill();

    // Warm brass vignette at face rim (restrained)
    var rimWash = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R - 7);
    rimWash.addColorStop(0, 'rgba(0,0,0,0)');
    rimWash.addColorStop(0.7, 'rgba(0,0,0,0)');
    rimWash.addColorStop(1, 'rgba(40,28,12,0.35)');
    ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, Math.PI * 2);
    ctx.fillStyle = rimWash; ctx.fill();

    // Glass specular arc (upper face) — slightly richer
    ctx.beginPath();
    ctx.arc(cx, cy, R - 10, (Math.PI * 1.15), (Math.PI * 1.85));
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.lineCap = 'butt';

    // Fine brass inner rim
    ctx.beginPath(); ctx.arc(cx, cy, R - 8.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(240,220,180,0.38)';
    ctx.lineWidth = 1.15; ctx.stroke();

    // Redline arc (thin, sharp — LFA style) — tach + speedo both live-drawn
    var redStart = ang(Math.min(this.redline, this.max));
    ctx.beginPath();
    ctx.arc(cx, cy, R - 16, rad(redStart), rad(start + sweep));
    ctx.strokeStyle = 'rgba(220, 48, 48, 0.92)';
    ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.stroke();

    // Tick marks + numerals — MPH: 20 major / 10 mid; tach ×1000; power 10%
    var span = this.max - this.min;
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.dial === 'speed') {
      // Twin-equal speedo: bold 20 mph majors, quieter 10s, thin 5s — large readable numerals
      var minorMph = 5;
      var midMph = 10;
      // Small faces: major numerals every 40 mph so 3-digit labels (100/120/…) don’t collide
      var majorMph = this.size < 200 ? 40 : 20;
      var v0 = Math.round(this.min);
      var v1 = Math.round(this.max);
      // Mid numerals only when dial is large enough — small mobile faces mash 10-mph labels
      var labelMid = v1 <= 220 && this.size >= 280;
      var spOuter = R - 11 * fs;
      var spMajorIn = R - 30 * fs;
      var spMidIn = R - 23 * fs;
      var spMinorIn = R - 17 * fs;
      // Closer-to-rim labels → longer chord between numerals on small R
      var spLabelR = R - (this.size < 220 ? 34 : 42) * fs;
      var spMajorFont = Math.max(8, Math.round(15 * fs * (this.size < 200 ? 0.92 : 1)));
      var spMidFont = Math.max(7, Math.round(10 * fs));
      var spMajorLw = Math.max(1.2, 2.4 * fs);
      for (var mph = v0; mph <= v1; mph += minorMph) {
        var val = mph;
        var a = rad(ang(val));
        var onMajor = (val % majorMph === 0);
        var isMajorTick = onMajor || (val === v1);
        var isMidTick = !isMajorTick && (val % midMph === 0);
        var outer = spOuter;
        var inner = isMajorTick ? spMajorIn : (isMidTick ? spMidIn : spMinorIn);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.strokeStyle = isMajorTick ? '#f0e6d0' : (isMidTick ? 'rgba(232,215,176,0.58)' : 'rgba(232,215,176,0.32)');
        ctx.lineWidth = isMajorTick ? spMajorLw : 1;
        ctx.stroke();
        if (isMajorTick || (isMidTick && labelMid)) {
          var tx = cx + Math.cos(a) * spLabelR;
          var ty = cy + Math.sin(a) * spLabelR;
          if (isMajorTick) {
            ctx.fillStyle = '#eef3fa';
            ctx.font = 'bold ' + spMajorFont + 'px "Segoe UI", system-ui, sans-serif';
          } else {
            ctx.fillStyle = 'rgba(220,227,238,0.55)';
            ctx.font = spMidFont + 'px "Segoe UI", system-ui, sans-serif';
          }
          ctx.fillText(String(val), tx, ty);
        }
      }
      if ((v1 - v0) % minorMph !== 0) {
        var aMax = rad(ang(v1));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(aMax) * spOuter, cy + Math.sin(aMax) * spOuter);
        ctx.lineTo(cx + Math.cos(aMax) * spMajorIn, cy + Math.sin(aMax) * spMajorIn);
        ctx.strokeStyle = '#f0e6d0';
        ctx.lineWidth = spMajorLw;
        ctx.stroke();
        ctx.fillStyle = '#eef3fa';
        ctx.font = 'bold ' + spMajorFont + 'px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(String(v1), cx + Math.cos(aMax) * spLabelR, cy + Math.sin(aMax) * spLabelR);
      }
    } else {
      var majors = this.majorDiv;
      if (majors == null) {
        if (this.max <= 100 && this.unit === '%') majors = 10;
        else if (this.max >= 12000) majors = Math.round(span / 2000); // 2k steps for superbikes / EV motor
        else if (this.max >= 1000) majors = Math.round(span / 1000) || 8;
        else majors = 10;
      }
      if (majors < 4) majors = 4;
      if (majors > 16) majors = 16;
      var minors = 5;
      var tachOuter = R - 12 * fs;
      var tachMajorIn = R - 28 * fs;
      var tachHalfIn = R - 22 * fs;
      var tachMinorIn = R - 18 * fs;
      var tachLabelR = R - 40 * fs;
      var tachFont = Math.max(9, Math.round(13 * fs));
      var tachLw = Math.max(1.2, 2.2 * fs);
      for (var i = 0; i <= majors * minors; i++) {
        var val2 = this.min + (i / (majors * minors)) * span;
        var a2 = rad(ang(val2));
        var isMajor = i % minors === 0;
        var isHalf = i % Math.max(1, minors / 2) === 0;
        var outer2 = tachOuter;
        var inner2 = isMajor ? tachMajorIn : (isHalf ? tachHalfIn : tachMinorIn);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a2) * outer2, cy + Math.sin(a2) * outer2);
        ctx.lineTo(cx + Math.cos(a2) * inner2, cy + Math.sin(a2) * inner2);
        ctx.strokeStyle = isMajor ? '#e8d7b0' : 'rgba(232,215,176,0.40)';
        ctx.lineWidth = isMajor ? tachLw : 1;
        ctx.stroke();
        if (isMajor) {
          var tx2 = cx + Math.cos(a2) * tachLabelR;
          var ty2 = cy + Math.sin(a2) * tachLabelR;
          ctx.fillStyle = '#dce3ee';
          ctx.font = 'bold ' + tachFont + 'px "Segoe UI", system-ui, sans-serif';
          var label;
          if (this.unit === '%' || this.unit === 'kW') label = String(Math.round(val2));
          else if (this.max >= 1000) label = String(Math.round(val2 / 1000));
          else label = String(Math.round(val2));
          ctx.fillText(label, tx2, ty2);
        }
      }
    }

    // Unit / ×1000 hint (skip for % / kW dials)
    ctx.fillStyle = 'rgba(232,215,176,0.75)';
    ctx.font = Math.max(7, Math.round(10 * fs)) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    if (this.dial === 'speed') {
      ctx.fillText('MPH', cx, cy - R * 0.18);
    } else if (this.max >= 1000 && this.unit !== '%' && this.unit !== 'kW') {
      ctx.fillText('×1000', cx, cy - R * 0.18);
    } else if (this.unit === '%') {
      ctx.fillText('POWER', cx, cy - R * 0.18);
    } else if (this.unit === 'kW') {
      ctx.fillText('kW', cx, cy - R * 0.18);
    }

    // Digital value well — SAME source as needle (this.display); hubDisplay ignored
    ctx.fillStyle = '#e8d7b0';
    ctx.font = 'bold ' + Math.max(8, Math.round(11 * fs)) + 'px "Segoe UI", sans-serif';
    ctx.fillText(this.label, cx, cy + R * 0.20);

    ctx.fillStyle = '#f4f7fb';
    var digSize = Math.max(14, Math.round(((this.dial === 'speed') ? 26 : 23) * fs));
    ctx.font = 'bold ' + digSize + 'px ui-monospace, "Cascadia Code", monospace';
    var shown = Math.round(this.display);
    var suffix = this.unit ? ((this.unit === '%') ? '%' : (' ' + this.unit)) : '';
    ctx.fillText(String(shown) + suffix, cx, cy + R * 0.40);

    // Sharp needle (thin white/red tip, brass hub) — drawn last; angle from this.display
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

    // Hub — polished brass cap
    var hub = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 11);
    hub.addColorStop(0, '#fff2d4');
    hub.addColorStop(0.35, '#d4b889');
    hub.addColorStop(0.7, '#8a7048');
    hub.addColorStop(1, '#2e2618');
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = hub; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#07090c'; ctx.fill();
  };

  global.VBPowerCurveGauges = { BrassGauge: BrassGauge };
})(typeof window !== 'undefined' ? window : globalThis);
