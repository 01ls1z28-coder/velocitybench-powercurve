/**
 * VelocityBench PowerCurve — canonical twin-gauge renderer (pixel-match snip).
 * Thick brass double-ring bezel · radial-brushed dark face · glowing blue needle/hub ·
 * blue 7-seg hub digits. Prefer visual fidelity over legacy LFA draw path.
 */
(function (global) {
  'use strict';

  /** 7-segment bitmasks for 0–9 (a b c d e f g). */
  var SEG7 = [
    0x3f, 0x06, 0x5b, 0x4f, 0x66,
    0x6d, 0x7d, 0x07, 0x7f, 0x6f
  ];

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
    this.dial = (opts && opts.dial) || null; // 'speed' → MPH face
    this.hubDisplay = null;
    this.overlayOnly = !!(opts && opts.overlayOnly); // legacy; tip uses full live dial only
    this._raf = null;
    this._running = false;
    this._brush = null;
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
    this._brush = null;
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

  /** Offscreen radial-brushed metal face (cached per size). */
  BrassGauge.prototype._brushFace = function (faceR) {
    var key = Math.round(faceR * 2);
    if (this._brush && this._brush.key === key) return this._brush.canvas;
    var off = document.createElement('canvas');
    var dim = Math.max(4, Math.ceil(faceR * 2 + 2));
    off.width = dim;
    off.height = dim;
    var octx = off.getContext('2d');
    var cx = dim / 2, cy = dim / 2;
    // Base charcoal
    var base = octx.createRadialGradient(cx, cy - faceR * 0.12, faceR * 0.02, cx, cy, faceR);
    base.addColorStop(0, '#1a1e26');
    base.addColorStop(0.35, '#0e1218');
    base.addColorStop(0.75, '#07090c');
    base.addColorStop(1, '#030406');
    octx.fillStyle = base;
    octx.beginPath();
    octx.arc(cx, cy, faceR, 0, Math.PI * 2);
    octx.fill();
    // Radial brush strokes
    octx.save();
    octx.beginPath();
    octx.arc(cx, cy, faceR, 0, Math.PI * 2);
    octx.clip();
    var n = Math.max(180, Math.round(faceR * 3.2));
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var bright = (i % 5 === 0) ? 0.12 : ((i % 2 === 0) ? 0.055 : 0.025);
      octx.strokeStyle = 'rgba(210,218,230,' + bright + ')';
      octx.lineWidth = (i % 9 === 0) ? 1.05 : 0.5;
      octx.beginPath();
      octx.moveTo(cx + Math.cos(a) * (faceR * 0.04), cy + Math.sin(a) * (faceR * 0.04));
      octx.lineTo(cx + Math.cos(a) * faceR, cy + Math.sin(a) * faceR);
      octx.stroke();
    }
    // Soft center bloom
    var bloom = octx.createRadialGradient(cx, cy, 0, cx, cy, faceR * 0.55);
    bloom.addColorStop(0, 'rgba(70,90,115,0.20)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = bloom;
    octx.fillRect(0, 0, dim, dim);
    octx.restore();
    this._brush = { key: key, canvas: off };
    return off;
  };

  /** Draw one 7-segment digit; returns advance width. */
  BrassGauge.prototype._drawSeg7Digit = function (ctx, x, y, h, mask, color) {
    var w = h * 0.58;
    var t = Math.max(2.0, h * 0.16); // segment thickness — snip bolder
    var g = t * 0.35; // gap from corners
    var hx = w - 2 * g;
    var vy = (h - 3 * g) / 2;
    function horiz(px, py) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + hx * 0.12, py - t / 2);
      ctx.lineTo(px + hx * 0.88, py - t / 2);
      ctx.lineTo(px + hx, py);
      ctx.lineTo(px + hx * 0.88, py + t / 2);
      ctx.lineTo(px + hx * 0.12, py + t / 2);
      ctx.closePath();
      ctx.fill();
    }
    function vert(px, py) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + t / 2, py + vy * 0.12);
      ctx.lineTo(px + t / 2, py + vy * 0.88);
      ctx.lineTo(px, py + vy);
      ctx.lineTo(px - t / 2, py + vy * 0.88);
      ctx.lineTo(px - t / 2, py + vy * 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = color;
    // a top, b ur, c lr, d bot, e ll, f ul, g mid
    if (mask & 0x01) horiz(x + g, y);
    if (mask & 0x02) vert(x + w - g * 0.15, y + g);
    if (mask & 0x04) vert(x + w - g * 0.15, y + g + vy + g);
    if (mask & 0x08) horiz(x + g, y + h);
    if (mask & 0x10) vert(x + g * 0.15, y + g + vy + g);
    if (mask & 0x20) vert(x + g * 0.15, y + g);
    if (mask & 0x40) horiz(x + g, y + h / 2);
    return w + h * 0.14;
  };

  BrassGauge.prototype._drawSeg7Number = function (ctx, cx, cy, text, digH, glow) {
    var digits = String(text);
    var widths = [];
    var total = 0;
    var i;
    for (i = 0; i < digits.length; i++) {
      var ch = digits.charAt(i);
      var w = (ch >= '0' && ch <= '9') ? digH * 0.72 : digH * 0.4;
      widths.push(w);
      total += w;
    }
    var x = cx - total / 2;
    ctx.save();
    if (glow) {
      ctx.shadowColor = 'rgba(80,200,255,1)';
      ctx.shadowBlur = Math.max(10, digH * 0.55);
    }
    for (i = 0; i < digits.length; i++) {
      var c = digits.charAt(i);
      if (c >= '0' && c <= '9') {
        this._drawSeg7Digit(ctx, x, cy - digH / 2, digH, SEG7[c.charCodeAt(0) - 48], '#6adbff');
      }
      x += widths[i];
    }
    ctx.restore();
    // Second pass without blur for crisp segments
    x = cx - total / 2;
    for (i = 0; i < digits.length; i++) {
      c = digits.charAt(i);
      if (c >= '0' && c <= '9') {
        this._drawSeg7Digit(ctx, x, cy - digH / 2, digH, SEG7[c.charCodeAt(0) - 48], '#9aecff');
      }
      x += widths[i];
    }
  };


  /** Needle + hub only (for snip-chrome overlay). ang(v) maps value→degrees. */
  BrassGauge.prototype._drawNeedleAndHub = function (ctx, cx, cy, R, faceR, ang) {
    function rad(d) { return (d * Math.PI) / 180; }
    var na = rad(ang(this.display));
    var tipLen = faceR - Math.max(12, R * 0.075);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(na);
    ctx.beginPath();
    ctx.moveTo(-R * 0.14, -2.4);
    ctx.lineTo(-R * 0.14, 2.4);
    ctx.lineTo(-5, 1.6);
    ctx.lineTo(-5, -1.6);
    ctx.closePath();
    ctx.fillStyle = '#4a6078';
    ctx.fill();
    ctx.shadowColor = 'rgba(40,180,255,1)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-3, -3.1);
    ctx.lineTo(tipLen - 8, -1.45);
    ctx.lineTo(tipLen + 2, 0);
    ctx.lineTo(tipLen - 8, 1.45);
    ctx.lineTo(-3, 3.1);
    ctx.closePath();
    var needleGrad = ctx.createLinearGradient(0, 0, tipLen, 0);
    needleGrad.addColorStop(0, '#d0f4ff');
    needleGrad.addColorStop(0.35, '#5ad4ff');
    needleGrad.addColorStop(0.75, '#2ab0ff');
    needleGrad.addColorStop(1, '#0088e8');
    ctx.fillStyle = needleGrad;
    ctx.fill();
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(tipLen - 14, -1.2);
    ctx.lineTo(tipLen + 2, 0);
    ctx.lineTo(tipLen - 14, 1.2);
    ctx.closePath();
    ctx.fillStyle = '#9ae8ff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(50,190,255,0.95)';
    ctx.shadowBlur = 14;
    var metal = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 11);
    metal.addColorStop(0, '#f0e4c4');
    metal.addColorStop(0.45, '#c4a878');
    metal.addColorStop(1, '#8a7048');
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2ec8ff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f8ff';
    ctx.fill();
    ctx.restore();
  };

  BrassGauge.prototype.draw = function () {
    var ctx = this.ctx, w = this.size, h = this.size;
    var cx = w / 2, cy = h / 2;
    // Leave room for thick double bezel
    var R = Math.min(w, h) / 2 - 2;
    var bezelOuter = R;
    var bezelInner = R - Math.max(13, R * 0.10); // thicker brass double-ring (snip depth)
    var faceR = bezelInner - Math.max(3.5, R * 0.028);
    var start = 140, sweep = 260;
    function rad(d) { return (d * Math.PI) / 180; }
    var self = this;
    function ang(v) {
      return start + ((v - self.min) / (self.max - self.min)) * sweep;
    }

    ctx.clearRect(0, 0, w, h);
    // Opaque circular plate — fully covers snip baked face/needle under this dial
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#05070a';
    ctx.fill();

    if (this.overlayOnly) {
      this._drawNeedleAndHub(ctx, cx, cy, R, faceR, ang);
      return;
    }

    // ——— Outer brass bezel (thick, brushed metallic) ———
    var bezel = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    bezel.addColorStop(0, '#fff6dc');
    bezel.addColorStop(0.16, '#c4a878');
    bezel.addColorStop(0.34, '#f0e0c0');
    bezel.addColorStop(0.52, '#8a7048');
    bezel.addColorStop(0.68, '#e8d4a8');
    bezel.addColorStop(0.84, '#a88858');
    bezel.addColorStop(1, '#f5e8cc');
    ctx.beginPath();
    ctx.arc(cx, cy, bezelOuter, 0, Math.PI * 2);
    ctx.fillStyle = bezel;
    ctx.fill();

    // Dark groove between outer & inner ring (double-ring look)
    ctx.beginPath();
    ctx.arc(cx, cy, bezelInner + Math.max(2.2, R * 0.018), 0, Math.PI * 2);
    ctx.fillStyle = '#0c0a08';
    ctx.fill();

    // Inner brass highlight ring
    var innerBezel = ctx.createLinearGradient(cx + R * 0.3, cy - R, cx - R * 0.3, cy + R);
    innerBezel.addColorStop(0, '#c8b890');
    innerBezel.addColorStop(0.35, '#f0e4c4');
    innerBezel.addColorStop(0.65, '#7a6648');
    innerBezel.addColorStop(1, '#d8c8a8');
    ctx.beginPath();
    ctx.arc(cx, cy, bezelInner + Math.max(1.2, R * 0.01), 0, Math.PI * 2);
    ctx.fillStyle = innerBezel;
    ctx.fill();

    // Face well (slightly inset dark lip)
    ctx.beginPath();
    ctx.arc(cx, cy, faceR + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#08090c';
    ctx.fill();

    // Radial brushed face
    var brush = this._brushFace(faceR);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(brush, cx - brush.width / 2, cy - brush.height / 2);
    ctx.restore();

    // Fine brass inner rim on face edge
    ctx.beginPath();
    ctx.arc(cx, cy, faceR - 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232,215,176,0.42)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Soft glass specular (upper arc)
    ctx.beginPath();
    ctx.arc(cx, cy, faceR - 6, Math.PI * 1.12, Math.PI * 1.88);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = Math.max(5, faceR * 0.045);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Tick geometry
    var tickOuter = faceR - Math.max(6, R * 0.045);
    var span = this.max - this.min;
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.dial === 'speed') {
      // MPH: majors every 20 only (canonical — no mid labels); minors every 5
      var v0 = Math.round(this.min);
      var v1 = Math.round(this.max);
      for (var mph = v0; mph <= v1; mph += 5) {
        var a = rad(ang(mph));
        var isMajor = (mph % 20 === 0) || mph === v1 || mph === v0;
        var isMid = !isMajor && (mph % 10 === 0);
        var inner = isMajor ? tickOuter - Math.max(16, R * 0.12)
          : (isMid ? tickOuter - Math.max(11, R * 0.08) : tickOuter - Math.max(6, R * 0.045));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * tickOuter, cy + Math.sin(a) * tickOuter);
        ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.strokeStyle = isMajor ? '#f2ece0' : (isMid ? 'rgba(232,215,176,0.55)' : 'rgba(232,215,176,0.28)');
        ctx.lineWidth = isMajor ? 2.6 : 1.05;
        ctx.stroke();
        if (isMajor) {
          var tx = cx + Math.cos(a) * (tickOuter - Math.max(22, R * 0.155));
          var ty = cy + Math.sin(a) * (tickOuter - Math.max(22, R * 0.155));
          ctx.fillStyle = '#f2f5fa';
          ctx.font = 'bold ' + Math.max(12, Math.round(R * 0.085)) + 'px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(String(mph), tx, ty);
        }
      }
      // Speedo: NO redline arc (absent on canonical snip)
    } else {
      // Tach / power: majors + red ticks near redline
      var majors = this.majorDiv;
      if (majors == null) {
        if (this.max <= 100 && this.unit === '%') majors = 10;
        else if (this.max >= 12000) majors = Math.round(span / 2000);
        else if (this.max >= 1000) majors = Math.round(span / 1000) || 8;
        else majors = 10;
      }
      if (majors < 4) majors = 4;
      if (majors > 16) majors = 16;
      var minors = 5;
      var redStartVal = Math.min(this.redline, this.max);
      for (var i = 0; i <= majors * minors; i++) {
        var val2 = this.min + (i / (majors * minors)) * span;
        var a2 = rad(ang(val2));
        var isMajor = i % minors === 0;
        var isHalf = i % Math.max(1, minors / 2) === 0;
        var inRed = val2 >= redStartVal - 1e-6;
        var inner2 = isMajor ? tickOuter - Math.max(15, R * 0.11)
          : (isHalf ? tickOuter - Math.max(10, R * 0.075) : tickOuter - Math.max(6, R * 0.045));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a2) * tickOuter, cy + Math.sin(a2) * tickOuter);
        ctx.lineTo(cx + Math.cos(a2) * inner2, cy + Math.sin(a2) * inner2);
        if (inRed && !isMajor) {
          // Discrete red ticks near redline (canonical)
          ctx.strokeStyle = 'rgba(230,40,40,0.95)';
          ctx.lineWidth = 1.5;
        } else if (inRed && isMajor) {
          ctx.strokeStyle = '#f0e6d0';
          ctx.lineWidth = 2.4;
        } else {
          ctx.strokeStyle = isMajor ? '#e8d7b0' : 'rgba(232,215,176,0.40)';
          ctx.lineWidth = isMajor ? 2.3 : 1;
        }
        ctx.stroke();
        if (isMajor) {
          var tx2 = cx + Math.cos(a2) * (tickOuter - Math.max(20, R * 0.145));
          var ty2 = cy + Math.sin(a2) * (tickOuter - Math.max(20, R * 0.145));
          ctx.fillStyle = '#f0f3f8';
          ctx.font = 'bold ' + Math.max(11, Math.round(R * 0.078)) + 'px "Segoe UI", system-ui, sans-serif';
          var label;
          if (this.unit === '%' || this.unit === 'kW') label = String(Math.round(val2));
          else if (this.max >= 1000) label = String(Math.round(val2 / 1000));
          else label = String(Math.round(val2));
          ctx.fillText(label, tx2, ty2);
        }
      }
      // Extra solid red tick stubs along redline arc (between majors)
      var redA0 = ang(redStartVal);
      var redA1 = start + sweep;
      var steps = Math.max(6, Math.round((redA1 - redA0) / 4));
      for (var ri = 0; ri <= steps; ri++) {
        var ra = rad(redA0 + (ri / steps) * (redA1 - redA0));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ra) * (tickOuter + 0.5), cy + Math.sin(ra) * (tickOuter + 0.5));
        ctx.lineTo(cx + Math.cos(ra) * (tickOuter - Math.max(7, R * 0.05)), cy + Math.sin(ra) * (tickOuter - Math.max(7, R * 0.05)));
        ctx.strokeStyle = 'rgba(220,36,36,0.92)';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'butt';
        ctx.stroke();
      }
    }

    // Face title
    ctx.fillStyle = 'rgba(230,235,242,0.88)';
    ctx.font = 'bold ' + Math.max(10, Math.round(R * 0.062)) + 'px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    if (this.dial === 'speed') {
      ctx.fillText('MPH', cx, cy - R * 0.20);
    } else if (this.unit === '%') {
      ctx.fillText('POWER', cx, cy - R * 0.20);
    } else if (this.unit === 'kW') {
      ctx.fillText('kW', cx, cy - R * 0.20);
    } else if (this.max >= 1000) {
      ctx.fillText('RPM x1000', cx, cy - R * 0.20);
    } else {
      ctx.fillText(this.label || '', cx, cy - R * 0.20);
    }

    // Recessed digital well — more pronounced (snip)
    var wellY = cy + R * 0.32;
    var wellW = Math.max(78, R * 0.56);
    var wellH = Math.max(32, R * 0.22);
    var wr = Math.max(5, wellH * 0.22);
    // Outer bevel (lighter top edge)
    ctx.beginPath();
    (function (x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    })(cx - wellW / 2 - 1.5, wellY - wellH / 2 - 1.5, wellW + 3, wellH + 3, wr + 1);
    ctx.fillStyle = 'rgba(40,36,28,0.85)';
    ctx.fill();
    // Deep well fill
    ctx.beginPath();
    (function (x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    })(cx - wellW / 2, wellY - wellH / 2, wellW, wellH, wr);
    var wellGrad = ctx.createLinearGradient(cx, wellY - wellH / 2, cx, wellY + wellH / 2);
    wellGrad.addColorStop(0, '#050608');
    wellGrad.addColorStop(0.45, '#0a0c10');
    wellGrad.addColorStop(1, '#12161c');
    ctx.fillStyle = wellGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,215,176,0.38)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Inner shadow lip
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - wellW / 2 + wr, wellY - wellH / 2 + 1.2);
    ctx.lineTo(cx + wellW / 2 - wr, wellY - wellH / 2 + 1.2);
    ctx.stroke();

    // Blue 7-seg hub digits at bottom of face
    // Same source as needle angle (ang(this.display)) — never diverge via hubDisplay
    var shown = Math.round(this.display);
    var digH = (this.dial === 'speed') ? Math.max(22, R * 0.145) : Math.max(20, R * 0.138);
    this._drawSeg7Number(ctx, cx, cy + R * 0.32, String(shown), digH, true);
    ctx.fillStyle = 'rgba(200,208,220,0.9)';
    ctx.font = 'bold ' + Math.max(9, Math.round(R * 0.055)) + 'px "Segoe UI", sans-serif';
    var under = (this.dial === 'speed') ? 'MPH'
      : (this.unit === '%') ? '%'
      : (this.unit === 'kW') ? 'kW'
      : 'RPM';
    ctx.fillText(under, cx, cy + R * 0.48);

    // ——— Glowing blue needle ———
    var na = rad(ang(this.display));
    var tipLen = faceR - Math.max(12, R * 0.075);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(na);
    // counterweight
    ctx.beginPath();
    ctx.moveTo(-R * 0.14, -2.4);
    ctx.lineTo(-R * 0.14, 2.4);
    ctx.lineTo(-5, 1.6);
    ctx.lineTo(-5, -1.6);
    ctx.closePath();
    ctx.fillStyle = '#4a6078';
    ctx.fill();
    // Glow underlay (wide soft)
    ctx.shadowColor = 'rgba(40,180,255,1)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-3, -3.1);
    ctx.lineTo(tipLen - 8, -1.45);
    ctx.lineTo(tipLen + 2, 0);
    ctx.lineTo(tipLen - 8, 1.45);
    ctx.lineTo(-3, 3.1);
    ctx.closePath();
    var needleGrad = ctx.createLinearGradient(0, 0, tipLen, 0);
    needleGrad.addColorStop(0, '#d0f4ff');
    needleGrad.addColorStop(0.35, '#5ad4ff');
    needleGrad.addColorStop(0.75, '#2ab0ff');
    needleGrad.addColorStop(1, '#0088e8');
    ctx.fillStyle = needleGrad;
    ctx.fill();
    // Crisp tip pass
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(tipLen - 14, -1.2);
    ctx.lineTo(tipLen + 2, 0);
    ctx.lineTo(tipLen - 14, 1.2);
    ctx.closePath();
    ctx.fillStyle = '#9ae8ff';
    ctx.fill();
    ctx.restore();

    // ——— Blue glowing hub ———
    ctx.save();
    ctx.shadowColor = 'rgba(50,190,255,0.95)';
    // Brass outer hub ring (snip: metallic surround + blue core)
    var metal = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 11);
    metal.addColorStop(0, '#f0e4c4');
    metal.addColorStop(0.35, '#c4a878');
    metal.addColorStop(0.7, '#6a5638');
    metal.addColorStop(1, '#2a2010');
    ctx.beginPath();
    ctx.arc(cx, cy, 10.5, 0, Math.PI * 2);
    ctx.fillStyle = metal;
    ctx.fill();
    // Blue glowing core
    ctx.save();
    ctx.shadowColor = 'rgba(60,190,255,1)';
    ctx.shadowBlur = 16;
    var core = ctx.createRadialGradient(cx - 1, cy - 1, 0.3, cx, cy, 5.8);
    core.addColorStop(0, '#f0fbff');
    core.addColorStop(0.4, '#5ad4ff');
    core.addColorStop(1, '#0a6aaa');
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.restore();
    // Dark pivot pin
    ctx.beginPath();
    ctx.arc(cx, cy, 1.9, 0, Math.PI * 2);
    ctx.fillStyle = '#05080c';
    ctx.fill();
    ctx.restore();
  };

  global.VBPowerCurveGauges = { BrassGauge: BrassGauge };
})(typeof window !== 'undefined' ? window : globalThis);
