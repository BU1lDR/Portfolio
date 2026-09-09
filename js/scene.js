/* ═══════════════════════════════════════════════════════════════
   scene.js — the 3D layer.

   Two independent canvas renderers, no libraries:

     Scene      a wireframe torii gate (鳥居) floating over a grid
                floor and a depth field of particles. Real 3D:
                vertices are rotated in model space and projected
                through a pinhole camera every frame.

     MatrixFX   the katakana rain, toggled by the terminal's
                `matrix` command.

   Both pause when off-screen or when the tab is hidden, and both
   collapse to a single static frame under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── tiny 3D helpers ──────────────────────────────────────── */

  /** Axis-aligned box as 8 vertices + 12 edges, in model space. */
  function box(cx, cy, cz, w, h, d) {
    var x = w / 2, y = h / 2, z = d / 2;
    var v = [
      [cx - x, cy - y, cz - z], [cx + x, cy - y, cz - z],
      [cx + x, cy + y, cz - z], [cx - x, cy + y, cz - z],
      [cx - x, cy - y, cz + z], [cx + x, cy - y, cz + z],
      [cx + x, cy + y, cz + z], [cx - x, cy + y, cz + z]
    ];
    var e = [
      [0, 1], [1, 2], [2, 3], [3, 0],   // back face
      [4, 5], [5, 6], [6, 7], [7, 4],   // front face
      [0, 4], [1, 5], [2, 6], [3, 7]    // connectors
    ];
    return { v: v, e: e };
  }

  /** Merge several boxes into one vertex list + edge list. */
  function merge(parts) {
    var verts = [], edges = [];
    parts.forEach(function (p) {
      var off = verts.length;
      p.v.forEach(function (vv) { verts.push(vv); });
      p.e.forEach(function (ee) { edges.push([ee[0] + off, ee[1] + off]); });
    });
    return { verts: verts, edges: edges };
  }

  /* ── the torii ────────────────────────────────────────────── */
  /* y grows downward, matching canvas space. Base at y=150.     */

  var TORII = merge([
    box(-92,  15, 0,  19, 270, 19),   // left pillar
    box( 92,  15, 0,  19, 270, 19),   // right pillar

    box(  0, -132, 0, 172, 15, 27),   // kasagi — centre span
    box(-104, -137, 0,  68, 13, 24),  // kasagi — left sweep
    box( 104, -137, 0,  68, 13, 24),  // kasagi — right sweep

    box(  0, -114, 0, 214, 10, 21),   // shimaki (second beam)
    box(  0,  -58, 0, 206, 14, 21),   // nuki (lower crossbeam)
    box(  0,  -88, 0,  17, 47, 15)    // gakuzuka (centre post)
  ]);

  var FOCAL = 780;
  var CAM_Z = 640;

  /* ── Scene ────────────────────────────────────────────────── */

  var Scene = {
    canvas: null, ctx: null,
    w: 0, h: 0, dpr: 1, scale: 1, offX: 0, offY: 0,
    raf: 0, running: false, visible: true,
    t: 0,
    mx: 0, my: 0,          // target tilt, -1..1
    cx: 0, cy: 0,          // eased tilt
    particles: [],
    glitchUntil: 0,
    nextGlitch: 900,
    colors: { red: '#ff3b53', grn: '#3dfaa8', dim: '#626b80', line: 'rgba(255,255,255,.16)' },

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      if (!this.ctx) return;

      this.readColors();
      this.resize();
      this.seedParticles();

      var self = this;

      // Resize — debounced through rAF so we never thrash layout.
      var pending = false;
      window.addEventListener('resize', function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; self.resize(); self.draw(); });
      }, { passive: true });

      // Pointer parallax, normalised against the viewport.
      if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
        window.addEventListener('pointermove', function (ev) {
          self.mx = (ev.clientX / window.innerWidth - .5) * 2;
          self.my = (ev.clientY / window.innerHeight - .5) * 2;
        }, { passive: true });
      }

      // Device tilt on phones, where there is no pointer.
      if (!reduceMotion && 'DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', function (ev) {
          if (ev.gamma == null) return;
          self.mx = Math.max(-1, Math.min(1, ev.gamma / 40));
          self.my = Math.max(-1, Math.min(1, ((ev.beta || 0) - 40) / 40));
        }, { passive: true });
      }

      // Only animate while the hero is actually on screen.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          self.visible = entries[0].isIntersecting;
          self.visible ? self.start() : self.stop();
        }, { threshold: 0 }).observe(canvas);
      }

      document.addEventListener('visibilitychange', function () {
        document.hidden ? self.stop() : (self.visible && self.start());
      });

      if (reduceMotion) { this.draw(); } else { this.start(); }
    },

    readColors: function () {
      var cs = getComputedStyle(document.documentElement);
      var pick = function (name, fallback) {
        var v = cs.getPropertyValue(name).trim();
        return v || fallback;
      };
      this.colors = {
        red:  pick('--red', '#ff3b53'),
        grn:  pick('--grn', '#3dfaa8'),
        dim:  pick('--txt-3', '#626b80'),
        line: pick('--line-2', 'rgba(255,255,255,.16)')
      };
    },

    resize: function () {
      var r = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, Math.round(r.width));
      this.h = Math.max(1, Math.round(r.height));
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      // Shrink the model on small screens so the gate always fits.
      this.scale = Math.min(1, Math.max(.42, Math.min(this.w / 1180, this.h / 760)));

      // Keep the gate clear of the headline. On wide screens the hero copy
      // is left-aligned, so push the model into the right third; on narrow
      // screens there is no room beside the text, so drop it below instead.
      if (this.w >= 900) {
        this.offX = this.w * 0.19;
        this.offY = 0;
      } else {
        this.offX = 0;
        this.offY = this.h * 0.30;
      }
    },

    seedParticles: function () {
      var n = this.w < 700 ? 90 : 190;
      this.particles = [];
      for (var i = 0; i < n; i++) {
        this.particles.push({
          x: (Math.random() - .5) * 1600,
          y: (Math.random() - .5) * 900,
          z: Math.random() * 1500 - 400,
          sp: .35 + Math.random() * 1.15,
          a: .18 + Math.random() * .5
        });
      }
    },

    start: function () {
      if (this.running || reduceMotion || !this.ctx) return;
      this.running = true;
      var self = this;
      var loop = function () {
        if (!self.running) return;
        self.t += 1;
        self.draw();
        self.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },

    stop: function () {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    },

    /** Rotate a model-space point, then project to screen. */
    project: function (p, ry, rx, ox, oy) {
      // rotate about Y
      var cosY = Math.cos(ry), sinY = Math.sin(ry);
      var x = p[0] * cosY - p[2] * sinY;
      var z = p[0] * sinY + p[2] * cosY;
      var y = p[1];
      // rotate about X
      var cosX = Math.cos(rx), sinX = Math.sin(rx);
      var y2 = y * cosX - z * sinX;
      var z2 = y * sinX + z * cosX;

      var zz = z2 * this.scale + CAM_Z;
      if (zz < 30) return null;                 // behind / too near the lens
      var s = FOCAL / zz;
      return {
        x: this.w / 2 + this.offX + x * this.scale * s + ox,
        y: this.h / 2 + this.offY + y2 * this.scale * s + oy,
        s: s,
        z: zz
      };
    },

    draw: function () {
      var ctx = this.ctx;
      if (!ctx) return;

      ctx.clearRect(0, 0, this.w, this.h);

      // ease the tilt toward the pointer
      this.cx += (this.mx - this.cx) * .045;
      this.cy += (this.my - this.cy) * .045;

      var t = this.t;
      var ry = t * 0.0022 + this.cx * 0.42;
      var rx = -0.09 + this.cy * 0.16;

      // occasional signal glitch
      if (!reduceMotion && t > this.nextGlitch) {
        this.glitchUntil = t + 9 + Math.floor(Math.random() * 10);
        this.nextGlitch = t + 420 + Math.floor(Math.random() * 900);
      }
      var glitching = t < this.glitchUntil;

      this.drawParticles(ry, rx);
      this.drawFloor(ry, rx);

      if (glitching) {
        var j = (Math.random() - .5) * 9;
        this.drawTorii(ry, rx, j - 3, 0, this.colors.grn, .5);
        this.drawTorii(ry, rx, j + 3, 0, this.colors.red, .5);
        this.drawTorii(ry, rx, j, 0, this.colors.red, .95);
      } else {
        this.drawTorii(ry, rx, 0, 0, this.colors.red, .8);
      }
    },

    drawTorii: function (ry, rx, ox, oy, color, alpha) {
      var ctx = this.ctx;
      var pts = new Array(TORII.verts.length);
      for (var i = 0; i < TORII.verts.length; i++) {
        pts[i] = this.project(TORII.verts[i], ry, rx, ox, oy);
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var k = 0; k < TORII.edges.length; k++) {
        var a = pts[TORII.edges[k][0]], b = pts[TORII.edges[k][1]];
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      // glowing vertices, brighter the closer they are
      ctx.fillStyle = color;
      for (var m = 0; m < pts.length; m++) {
        var p = pts[m];
        if (!p) continue;
        ctx.globalAlpha = alpha * Math.min(1, p.s * .55);
        var r = Math.max(.7, p.s * 1.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    drawFloor: function (ry, rx) {
      var ctx = this.ctx;
      var Y = 168, STEP = 120, EXT = 720, NEAR = -320, FAR = 1080;

      ctx.save();
      ctx.strokeStyle = this.colors.line;
      ctx.lineWidth = 1;

      // lines running away from the camera
      for (var x = -EXT; x <= EXT; x += STEP) {
        var a = this.project([x, Y, NEAR], ry, rx, 0, 0);
        var b = this.project([x, Y, FAR], ry, rx, 0, 0);
        if (!a || !b) continue;
        var g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, this.colors.line);
        g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g;
        ctx.globalAlpha = .5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // lines running across, fading with depth
      for (var z = NEAR; z <= FAR; z += STEP) {
        var l = this.project([-EXT, Y, z], ry, rx, 0, 0);
        var r = this.project([EXT, Y, z], ry, rx, 0, 0);
        if (!l || !r) continue;
        ctx.globalAlpha = Math.max(0, .55 - (z - NEAR) / (FAR - NEAR) * .55);
        ctx.strokeStyle = this.colors.line;
        ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke();
      }
      ctx.restore();
    },

    drawParticles: function (ry, rx) {
      var ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = this.colors.dim;

      for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        if (!reduceMotion) {
          p.z -= p.sp;
          if (p.z < -CAM_Z / this.scale + 60) p.z += 1900;   // recycle to the back
        }
        var s = this.project([p.x, p.y, p.z], ry * .4, rx * .4, 0, 0);
        if (!s) continue;
        if (s.x < -40 || s.x > this.w + 40 || s.y < -40 || s.y > this.h + 40) continue;
        ctx.globalAlpha = p.a * Math.min(1, s.s * .8);
        var r = Math.max(.5, s.s * 1.1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };

  /* ── MatrixFX ─────────────────────────────────────────────── */

  var MatrixFX = {
    canvas: null, ctx: null, raf: 0, on: false,
    cols: 0, drops: [], fontSize: 15, w: 0, h: 0, dpr: 1,
    glyphs: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789零壱弐参',

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      var self = this;
      window.addEventListener('resize', function () { if (self.on) self.resize(); }, { passive: true });
    },

    resize: function () {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.fontSize = this.w < 620 ? 12 : 15;
      this.cols = Math.ceil(this.w / this.fontSize);
      this.drops = [];
      for (var i = 0; i < this.cols; i++) {
        this.drops.push(Math.random() * -60);
      }
    },

    toggle: function () { return this.on ? (this.stop(), false) : (this.start(), true); },

    start: function () {
      if (this.on || !this.ctx) return;
      this.on = true;
      this.resize();
      this.canvas.classList.add('is-on');
      var self = this;
      var loop = function () {
        if (!self.on) return;
        self.frame();
        self.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },

    stop: function () {
      this.on = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.canvas.classList.remove('is-on');
      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    },

    frame: function () {
      var ctx = this.ctx;
      var cs = getComputedStyle(document.documentElement);
      // Painted over the previous frame instead of clearing it — the low
      // alpha is what leaves the fading trail behind each column.
      var bg = 'rgba(5,6,10,.09)';
      var grn = cs.getPropertyValue('--grn').trim() || '#3dfaa8';
      var red = cs.getPropertyValue('--red').trim() || '#ff3b53';

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.font = '500 ' + this.fontSize + 'px ' + '"JetBrains Mono", monospace';
      ctx.textBaseline = 'top';

      for (var i = 0; i < this.cols; i++) {
        var ch = this.glyphs[Math.floor(Math.random() * this.glyphs.length)];
        var x = i * this.fontSize;
        var y = this.drops[i] * this.fontSize;

        // the leading glyph burns brighter
        ctx.fillStyle = Math.random() > .975 ? red : grn;
        ctx.fillText(ch, x, y);

        if (y > this.h && Math.random() > .975) this.drops[i] = 0;
        this.drops[i] += 1;
      }
    }
  };

  /* ── boot ─────────────────────────────────────────────────── */

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var hero = document.getElementById('scene');
    if (hero) Scene.init(hero);

    var mx = document.getElementById('matrixCanvas');
    if (mx) MatrixFX.init(mx);
  });

  window.Scene = Scene;
  window.MatrixFX = MatrixFX;
})();
