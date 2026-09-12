/* ════════════════════════════════════════════════════════════════
   samurai.js — the guard on the terminal window's roof
   ────────────────────────────────────────────────────────────────
   He stands on the floating window's top border and breathes. When you dismiss
   the window he cuts it down, and the cut is what actually dismisses it.

   Almost all of the choreography is in style.css §10b — poses, the lunge, the
   two cut beams. This file only decides WHEN, and it is small on purpose,
   because everything about WHERE he is turns out to be a layout problem rather
   than a scripting one: he is an absolutely positioned child of .termwin at
   `bottom: 100%`, so his feet track the folding roof frame-for-frame with no
   measurement, no cache, no ResizeObserver and no transitionend correction. The
   whole apparatus that would otherwise live here does not exist. There is not
   even a resize handler: there is no geometry of his to go stale.

   Three things this file is careful about, in order of how badly they would
   read if it were not:

   1. THE WINDOW MUST STILL FEEL INSTANT. The dismissal is committed on the
      blade's contact frame — 120ms for the fold, 150ms for the close — not at
      the end of the animation. Both are under the threshold where a click
      starts to feel like lag, and the sprite is visibly moving inside the first
      frame, so the wait reads as the animation starting rather than as nothing
      happening. The follow-through plays out over a window that has already
      done what you asked.

   2. THE WINDOW MUST ALWAYS GO. Every path that starts a strike also arms a
      watchdog, commit() is idempotent, and nothing waits on `animationend` —
      which does not fire for an element that gets display:none'd mid-animation.
      If this file threw an exception on every line after the first, the worst
      case would still be a window that closes a fifth of a second later.

   3. A SECOND CLICK IS ANSWERED WITH SPEED, NOT WITH SILENCE. Clicking again
      because nothing seemed to happen commits the pending dismissal at once and
      then does the new thing plainly. Impatience gets you today's behaviour,
      never a dropped input.

   Kill switch: delete the <script> tag. He is rendered and animated by CSS
   alone, so without this file he is still there, still breathing, and the
   window's controls behave exactly as they did before he existed.
   ════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var doc = document;
  var win = doc.getElementById('termWin');
  var sam = doc.getElementById('sam');
  var T = window.TermWindow;

  /* No window, no sprite, or main.js never loaded — nothing to guard. This
     script is loaded after main.js precisely so that last test is meaningful. */
  if (!win || !sam || !T) return;

  var bar = doc.getElementById('termBar');
  var launch = doc.getElementById('termLaunch');

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = matchMedia('(max-width: 860px)');
  var squat = matchMedia('(max-height: 599px)');

  var POSES = ['p-idle', 'p-run', 'p-leap', 'p-land', 'p-cut-min', 'p-cut-close'];
  var MOVES = ['is-runin', 'is-lunge-min', 'is-lunge-close'];

  var dead = false;            // sheets failed to load — never fire a cut
  var pend = null;             // the strike in flight, or null
  var fired = false;           // has this strike's dismissal been committed
  var timers = [];
  var watchdog = 0;

  /* ── the two strikes ──────────────────────────────────────────
     `lead` is measured off the art, not chosen: it is when the blade reaches
     the border on each sheet. Attack_3 is a 4-frame horizontal cut whose steel
     lands on frame 2; Attack_2 is a 5-frame overhead kesa-giri that lands on
     frame 4. See assets/README.txt for the sheets and §10b for the geometry
     those frames imply. */
  var CUT = {
    min: {
      pose: 'p-cut-min', move: 'is-lunge-min', vfx: 'is-cut-min',
      lead: 120,         // contact — the fold commits here
      land: 200,         // ...then the Jump tail, riding the roof down
      done: 620,
      needs: ['attack_3', 'jump'],
      act: function () { T.collapse(); }
    },
    close: {
      pose: 'p-cut-close', move: 'is-lunge-close', vfx: 'is-cut-close',
      lead: 150,
      land: 0,           // no landing: he holds the finished cut and goes with it
      done: 700,
      needs: ['attack_2'],
      act: function () { T.close(); }
    }
  };

  /* Which sheet each pose paints from, so a pose is never entered before its
     bytes exist. `needs` above covers the whole choreography, not just its first
     frame: the fold plays attack_3 and *then* the Jump tail, and a half-warmed
     cache that can draw the swing but not the landing is still a hole. */
  var SHEET = {
    'p-idle': 'idle', 'p-run': 'run', 'p-leap': 'jump', 'p-land': 'jump',
    'p-cut-min': 'attack_3', 'p-cut-close': 'attack_2'
  };
  function drawable(list) {
    for (var i = 0; i < list.length; i++) if (have[list[i]] !== true) return false;
    return true;
  }

  /* Every reason not to perform. Reduced motion and the two size cut-offs
     mirror §10b's media queries exactly — if CSS has hidden him, JS must not
     fire a red slash across the window on behalf of an invisible sprite. */
  function off() {
    return dead || doc.hidden || reduce.matches || narrow.matches || squat.matches;
  }

  function isMin() { return win.classList.contains('is-min'); }

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function pose(name) {
    for (var i = 0; i < POSES.length; i++) sam.classList.remove(POSES[i]);
    if (name) sam.classList.add(name);
  }

  function move(name) {
    for (var i = 0; i < MOVES.length; i++) sam.classList.remove(MOVES[i]);
    if (!name) return;
    void sam.offsetWidth;      // so re-adding the same class restarts it
    sam.classList.add(name);
  }

  /* Idempotent, and reachable from three independent places: the contact
     timer, the watchdog, and abort(). Whichever gets here first dismisses the
     window; the others are no-ops. */
  function commit() {
    if (!pend || fired) return;
    fired = true;
    win.classList.add(pend.vfx);
    var wasClose = pend === CUT.close;
    pend.act();
    /* The pill arrives ~300ms later to replace the window. Flashing it red as
       it lands makes it read as the window's replacement rather than as an
       unrelated button that happened to appear. */
    if (wasClose && launch) {
      at(300, function () {
        launch.classList.add('is-cut');
        at(320, function () { launch.classList.remove('is-cut'); });
      });
    }
  }

  function finish() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
    clearTimeout(watchdog);
    watchdog = 0;
    win.classList.remove('is-cut-min', 'is-cut-close');
    sam.style.removeProperty('--sam-run-dur');
    sam.style.removeProperty('--sam-run-x');
    move(null);
    pose('p-idle');
    pend = null;
    fired = false;
  }

  /* Stop the ceremony but never the dismissal. */
  function abort() {
    if (!pend) return;
    commit();
    finish();
  }

  /* Returns true if the strike was taken on, false if the caller should
     dismiss the window itself. terminal.js relies on that return value, so it
     keeps working unchanged whenever he is switched off. */
  function strike(kind, runway) {
    var c = CUT[kind];
    if (!c) return false;
    if (off() || !T.isOpen()) return false;
    if (!drawable(c.needs)) return false;   // cold cache — let it close plainly

    if (pend) { abort(); c.act(); return true; }

    /* A runway is dead time the caller already had — terminal.js holds `exit`
       for 700ms and `minimise` for 620ms so you can read the line you just
       typed. Spending it on a run-up costs nothing and is the difference
       between "he swung" and "he ran and slashed". */
    var run = 0;
    if (runway > c.lead + 80 && drawable(['run'])) {
      run = runway - c.lead;
      sam.style.setProperty('--sam-run-dur', run + 'ms');
      /* Constant ground speed whatever the runway, or his feet skate: ~280px/s,
         the same as the CSS default for the shorter entrance run. */
      sam.style.setProperty('--sam-run-x', Math.round(run * 0.28) + 'px');
      pose('p-run');
      move('is-runin');
    }

    pend = c;
    at(run, function () { pose(c.pose); move(c.move); });
    at(run + c.lead, commit);
    if (c.land) at(run + c.lead + c.land, function () { pose('p-land'); });
    at(run + c.done, finish);
    watchdog = setTimeout(function () { commit(); finish(); }, run + c.done + 400);
    return true;
  }

  function once(name, ms) {
    if (off() || pend) return;
    if (!drawable([SHEET[name]])) return;
    pose(name);
    at(ms, function () { if (!pend) { move(null); pose('p-idle'); } });
  }

  /* ── the dots ─────────────────────────────────────────────────
     Capture phase, on .termwin rather than on the buttons. main.js registers
     its own click handlers on the buttons themselves; a capture listener on an
     ancestor is unambiguously earlier than any listener on the target, so
     stopPropagation() here reliably prevents main.js's instant dismissal from
     running. A capture listener on the *button* would not — for the target
     node, listeners fire in registration order regardless of phase, and
     main.js registered first.

     The public API is deliberately NOT decorated to catch these. Six of this
     repo's own preview drivers call TermWindow.close() and .collapse() and
     depend on them returning with the work done; putting a 120ms delay inside
     them would quietly break every one. */
  win.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var btn = t.closest('button');
    var id = btn ? btn.id : '';

    /* Folded. Nothing here is a cut: unfolding is not a dismissal, and closing
       a window that is already down to a 38px title bar has no body left to
       sever — a diagonal across a title bar would be a shrug. He leaps up with
       the window as it unfolds and otherwise stays out of the way. */
    if (isMin()) {
      if (id === 'termMin' || (!btn && bar && bar.contains(t))) once('p-leap', 360);
      return;
    }

    if (id !== 'termClose' && id !== 'termMin') return;
    /* Keyboard activation reports detail 0. Someone driving the window from the
       keyboard is navigating, not watching, and should not be made to wait for
       a sword. Esc is likewise left alone in main.js as the fire exit. */
    if (ev.detail === 0) return;

    if (!strike(id === 'termClose' ? 'close' : 'min', 0)) return;
    ev.stopPropagation();
    ev.preventDefault();
  }, true);

  /* ── arriving with the window ─────────────────────────────────
     Capture on the document, without stopping anything: main.js opens the
     window on the bubble phase, so this runs first and can still see that the
     window was closed. */
  doc.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (!t.closest('#termLaunch') && !t.closest('#termOpen')) return;
    if (T.isOpen()) return;
    once('p-run', 440);
    move('is-runin');
  }, true);

  /* ── a tab nobody is looking at ───────────────────────────────
     The idle loop is parked by CSS whenever the window is closed or stowed;
     this covers the other case. Backgrounding the tab also has to abort a
     strike in flight, because its timers are throttled to once a second there
     and the window would otherwise hang mid-cut until you came back. */
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) { abort(); sam.classList.add('is-still'); }
    else sam.classList.remove('is-still');
  });

  /* ── the sheets ───────────────────────────────────────────────
     Warmed with Image() after the boot curtain lifts rather than with
     <link rel=preload>, which would compete with the hero and log an unused
     preload warning for whichever sheets a visitor never triggers.

     idle.png is loaded by CSS anyway, so its failure is the honest signal that
     the folder is missing: without it there is no visible sprite, and an
     invisible sprite must never fire a red slash across a live window.

     decode() rather than a bare .src, because .src only promises the bytes are
     coming — the first paint that needs the sheet still has to decode it, and
     that decode lands on the frame you are trying to show.

     But warming cannot be *relied* on, and the measurement is what taught me
     that. Holding attack_3.png back by 2.5s and clicking the fold dot put the
     cut 95ms in — inside the contact frame — with the classes right, the
     background-image right, and the porthole empty. No amount of decode() fixes
     that one: the bytes had not arrived. He simply vanishes for the single frame
     the whole animation exists to show.

     So readiness is tracked rather than assumed, and strike() refuses a sheet it
     cannot draw. Losing the ceremony on a cold click is invisible — the window
     just closes the way it did before he existed. Slashing a live window with an
     empty porthole is not. */
  var have = {};
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    var sheets = ['idle', 'run', 'jump', 'attack_2', 'attack_3'];
    for (var i = 0; i < sheets.length; i++) load(sheets[i], i === 0);
  }
  function load(name, critical) {
    var img = new Image();
    img.onerror = function () { if (critical) kill(); };
    img.onload = function () {
      /* No decode() in Safari <15; onload there is as good as it gets. */
      if (!img.decode) { have[name] = true; return; }
      img.decode().then(function () { have[name] = true; },
                        function () { if (critical) kill(); });
    };
    img.src = 'assets/samurai/' + name + '.png';
  }
  function kill() {
    dead = true;
    if (sam.parentNode) sam.parentNode.removeChild(sam);
  }
  addEventListener('boot:done', warm, { once: true });
  setTimeout(warm, 4000);        // belt: boot:done may already have fired

  /* terminal.js asks for the typed dismissals. Nothing else is exposed — the
     poses are not a public toy. */
  window.Samurai = { strike: strike };
})();
