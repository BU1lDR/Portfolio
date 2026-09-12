/* ════════════════════════════════════════════════════════════════
   samurai.js — the guard on the terminal window's roof
   ────────────────────────────────────────────────────────────────
   He stands on the floating window's top border and breathes. When you dismiss
   the window he cuts it down, and the cut is what actually dismisses it.

   Almost all of the choreography is in style.css §10b — poses, the run-in, the
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

  var POSES = ['p-idle', 'p-run', 'p-leap', 'p-fall', 'p-land', 'p-cut-min', 'p-cut-close'];
  /* The run-in is the only move there is. He used to have a lunge per cut as
     well; §10b's "why he no longer drops" is the whole story. */
  var MOVES = ['is-runin'];

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
      pose: 'p-cut-min', vfx: 'is-cut-min',
      lead: 120,         // contact — the fold commits here
      /* ...then the Jump tail, riding the roof down. Offsets are from contact,
         and they are timed against a trace of the real fold rather than spaced
         evenly, because the fold is not an even motion: it carries him 468px in
         .34s and peaks near 4700px/s. 140 is the follow-through the stroke needs.
         300 is where the card has nearly run out of travel, so the sheet's own
         return to the ground reads as the impact. §10b's "riding the fold down"
         works through why p-fall cannot be handed to him any earlier. */
      tail: [[140, 'p-fall'], [300, 'p-land']],
      /* 780 because the tail has to finish: 120 + 300 + 240 = 660, and then he
         gets 120ms standing before the breath comes back. terminal.js holds the
         typed `minimise` for 620ms, which looks like this number and is not —
         that one is a runway, and nothing reads this. */
      done: 780,
      needs: ['attack_3', 'jump'],
      act: function () { T.collapse(); }
    },
    close: {
      pose: 'p-cut-close', vfx: 'is-cut-close',
      lead: 150,
      /* No tail. The fold needs one because the window survives it and so does
         he; here the window is leaving in two pieces and he holds the finished
         cut all the way through. Nothing to land on. */
      /* 1140 rather than 700 because the halves now fall off the bottom of the
         screen instead of fading out over it, and 860ms of falling that starts at
         contact is not finished until 1010 — after which §10b holds the emptied
         window for another 60ms and snaps it at 1070. finish() is what takes the
         clone and the clip-paths away, so anything earlier than that tears the
         wreckage out of mid-air. 70ms of slack past the snap. */
      done: 1140,
      needs: ['attack_2'],
      split: true,       // ...and the window comes apart along the blade
      act: function () { T.close(); }
    }
  };

  /* Which sheet each pose paints from, so a pose is never entered before its
     bytes exist. `needs` above covers the whole choreography, not just its first
     frame: the fold plays attack_3 and *then* the Jump tail, and a half-warmed
     cache that can draw the swing but not the landing is still a hole. */
  var SHEET = {
    'p-idle': 'idle', 'p-run': 'run', 'p-leap': 'jump',
    'p-fall': 'jump', 'p-land': 'jump',
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

  /* ── cutting the window in two ────────────────────────────────
     A kesa-giri leaves two halves, and one box cannot be clipped to both sides
     of a line at once. So on contact the card is photographed — cloneNode, ids
     stripped, inert, live input values copied across — the copy is laid exactly
     over the original, and the two are clip-pathed to opposite sides of the
     blade. §10b then pushes them apart. From that moment the original IS the
     upper-left half and the copy IS the lower-right one.

     The polygons are computed here rather than in CSS because they need the
     card's live height: the line enters the top edge on his blade's own path —
     §10b's --sam-cut-x — and rakes down-LEFT at 32deg, so where it leaves
     depends on how tall the window is, and --term-h is a clamp on the
     viewport. Tall enough and it leaves through the side instead. */
  var TAN32 = 0.62487;
  var ghost = null;

  function poly(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      out.push(pts[i][0].toFixed(2) + 'px ' + pts[i][1].toFixed(2) + 'px');
    }
    return 'polygon(' + out.join(',') + ')';
  }

  function live() { return win.querySelector('.term:not(.term--ghost)'); }

  /* ── cutting the folded bar ───────────────────────────────────
     The folded window is not a short version of the open one, it is a 240px pill
     (--term-min-w) where the open card is 600 — and he does not move when it
     folds, because he is anchored `right: 8px` of .termwin. So his blade keeps
     landing 247.5px from the RIGHT edge, which on a 240px bar is 7.5px past the
     LEFT edge: his own --sam-cut-x of 266 puts the cut line at x = -27.5 and it
     misses the bar completely. Measured, not guessed — and it is why simply
     lowering the height floor draws nothing at all.

     He cannot be moved to fix it either. To bring the blade to the middle of a
     240px bar he would have to travel 127px towards the right edge, which puts
     him off the screen; mirroring him instead lands the cut 25px from the far
     end. The bar is narrower than he is and that is the whole problem.

     So the beam gets aimed independently here, and the one thing worth aiming at
     is the single gap in the bar's contents: the dots end at x=74, the 開く label
     starts at x=98. Cut anywhere else and a piece leaves carrying half a dot or a
     sliced glyph. The line leans h*tan32 ≈ 24px over the bar's 38px, which is
     fractionally WIDER than the 24px gap, so it cannot sit inside the gap — it is
     centred on it instead, entering at the label's left edge and leaving at the
     dots' right edge. Both pieces keep their contents whole: at the dots' own
     mid-height the line is at x≈86, clear of both.

     Measured off the live bar rather than written down as 141px, because the dots
     and the label are placed by padding and do not move with --term-min-w. The
     clamp is for the day someone reorders the bar and the "gap" comes out silly.

     The cost, stated plainly: the beam is then ~98px right of where his blade
     actually falls, so the stroke and the steel are no longer one line the way
     they are on the open card. On a 38px bar crossed in 440ms, with the wash
     firing on the same frame, that reads as a cut. A 7px sliver off the left edge
     would not read as anything. */
  function foldCut(card, w, h) {
    var dots = card.querySelector('.term__dots');
    var peek = card.querySelector('.term__peek');
    var mid = w * 0.36;                       // fallback: no dots, no label
    if (dots && peek) {
      var d = dots.getBoundingClientRect(), p = peek.getBoundingClientRect();
      if (p.left > d.right) mid = (d.right + p.left) / 2 - card.getBoundingClientRect().left;
    }
    /* mid is where the line's MIDPOINT should sit, so the top crossing is half a
       lean to the right of it. Then back out the pin, which is off the right edge
       and 1.5px shy of the centreline. */
    var x0 = Math.min(Math.max(mid + h * TAN32 / 2, 30), w - 30);
    var cutx = Math.round(w - x0 - 1.5);
    /* Written back so the beam follows the polygons. The invariant above — one
       description of the line, shared — is the only reason they cannot drift. */
    win.style.setProperty('--sam-cut-x', cutx + 'px');
    return cutx;
  }

  function split(c) {
    if (!c.split || ghost) return false;
    var card = live();
    if (!card) return false;

    var r = card.getBoundingClientRect();
    var w = r.width, h = r.height;
    /* Only a floor against a degenerate box. This used to be `h < 120`, which
       ruled out the folded peek bar on the grounds that a diagonal across a
       title bar is a shrug — see "cutting the folded bar" below for why that was
       wrong and what it takes to make the short cut work. */
    if (h < 24 || w < 200) return false;

    /* .term__cut--v is a 3px bar pinned `right: var(--sam-cut-x)` and rotated
       about its own top centre, so its centreline crosses the card's top edge —
       y=0 — at x0 and rakes down-left from there. xAt() is that line, and it is
       the only description of the cut: the beam draws it and the polygons below
       are cut along it, so the two cannot drift apart. */
    var cutx = parseFloat(getComputedStyle(win).getPropertyValue('--sam-cut-x')) || 266;
    if (h < 120) cutx = foldCut(card, w, h);
    var x0 = w - cutx - 1.5;
    function xAt(y) { return x0 - y * TAN32; }

    ghost = card.cloneNode(true);
    ghost.classList.add('term--ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    /* Nothing in the copy may be findable or focusable. main.js and six preview
       drivers reach the terminal by id; a second #termInput in the document
       would hand half of them the photograph instead of the window. `inert`
       covers the focus half where it is supported, tabIndex where it is not. */
    ghost.removeAttribute('id');
    var ided = ghost.querySelectorAll('[id]');
    for (var i = 0; i < ided.length; i++) ided[i].removeAttribute('id');
    var hot = ghost.querySelectorAll('a, button, input, textarea, select, [tabindex]');
    for (var j = 0; j < hot.length; j++) hot[j].tabIndex = -1;
    /* cloneNode copies the value ATTRIBUTE, not the live property — without
       this, a half-typed command is missing from the half it was typed into. */
    var from = card.querySelectorAll('input, textarea');
    var to = ghost.querySelectorAll('input, textarea');
    for (var k = 0; k < from.length && k < to.length; k++) to[k].value = from[k].value;

    /* Before .sam, so he keeps painting over the card. He no longer reaches into
       it — the lunge that used to put his blade inside the card's top rows is
       gone — but his drop-shadow spills ~10px past his feet onto the border he is
       standing on, and a photograph of the card inserted after him would paint
       over that. Him on top is also the order that survives the next pose. */
    win.insertBefore(ghost, sam);
    /* 2px of overshoot on the outer edges — the polygon must not shave a
       piece's own 1px border off the sides it is supposed to keep. Which means
       the seam's own two vertices have to be read off the line at those
       overshot heights, xAt(L) and xAt(B), and not at 0 and h: run the line
       over h and draw it across h+4 and it comes out at 31.8deg, 2.5px away
       from the beam by the bottom of the card. The beam is then no longer on the
       edge it opened, so the piece it has drifted off has an unlit cut edge
       coming away while the other has a double-bright one. */
    var L = -2, B = h + 2;
    var xTop = xAt(L), xBot = xAt(B);
    if (xBot > L) {
      /* It leaves through the bottom edge. Two quads, and the shared pair of
         vertices is what makes the halves part along one seam. */
      card.style.clipPath = poly([[L, L], [xTop, L], [xBot, B], [L, B]]);
      ghost.style.clipPath = poly([[xTop, L], [w + 2, L], [w + 2, B], [xBot, B]]);
    } else {
      /* In a tall window it runs out through the LEFT edge first and the upper
         piece is a triangle. Emitting the quad regardless would put a vertex
         outside the box, and the path would then cross itself on the way back
         to the corner — at 536px, the tallest --term-h allows, by under a pixel,
         which nobody will ever see on a piece that is falling and fading.
         Handled anyway, because the alternative is a clip-path that folds over
         itself waiting for someone to widen the angle. */
      var yl = L + (xTop - L) / (xTop - xBot) * (B - L);
      card.style.clipPath = poly([[L, L], [xTop, L], [L, yl]]);
      ghost.style.clipPath = poly([[xTop, L], [w + 2, L], [w + 2, B], [L, B], [L, yl]]);
    }

    /* How far "all the way down" is, measured rather than guessed. The halves
       have to leave the screen, not fade out over it, and three things decide
       what that costs:
         - the card's own distance to the bottom of the fold. .termwin is fixed
           with its bottom edge --term-edge clear of it, so this is very nearly
           the card's height — and --term-h is a clamp on the viewport, so it is
           different on every screen. One hard-coded number would over-throw a
           short window and under-throw a tall one.
         - the corner the tumble lifts above the piece's own box: the farthest
           corner is ~0.78 of the width from the transform-origin, turning up to
           14deg, so 0.78 * w * sin14 ~= 0.19w of the piece is still on screen
           when its untransformed box has cleared.
         - 80px of overshoot, so both halves are already past the edge when the
           window snaps out at 860ms instead of arriving exactly as it does.
       §10b's term-piece-a/b fall to this. It is set on the window rather than
       the pieces because custom properties inherit and there are two of them. */
    win.style.setProperty('--sam-fall',
      Math.round(window.innerHeight - r.top + w * 0.19 + 80) + 'px');
    return true;
  }

  function unsplit() {
    var sliced = win.classList.contains('is-sliced');
    /* Removing is-sliced hands opacity back to .termwin's own .3s fade. If the
       halves have not finished — a second click, the watchdog, a backgrounded
       tab — that fade would start from a card that is still fully drawn, and
       restore the window it just destroyed for 300ms. Suppress the transition
       for the single frame the swap takes. */
    if (sliced) win.style.transition = 'none';
    win.classList.remove('is-sliced');
    if (ghost) {
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }
    var card = live();
    if (card) card.style.removeProperty('clip-path');
    /* Off with the rest of the scaffolding — a distance measured against last
       time's viewport is worse than no distance at all, and a folded bar's cut x
       left on the window would aim the next cut on the open card at the peek
       label's old gap. Both are re-measured on every strike. */
    win.style.removeProperty('--sam-fall');
    win.style.removeProperty('--sam-cut-x');
    if (sliced) {
      void win.offsetWidth;                 // commit the hidden state, then
      win.style.removeProperty('transition');  // hand the transition back
    }
  }

  /* Idempotent, and reachable from three independent places: the contact
     timer, the watchdog, and abort(). Whichever gets here first dismisses the
     window; the others are no-ops. */
  function commit() {
    if (!pend || fired) return;
    fired = true;
    /* Clone and clip BEFORE either class goes on, then add both in one go: the
       copy carries a .term__cut--v of its own and `.termwin.is-cut-close
       .term__cut--v` matches it, so the two halves of the beam are clipped to
       the two halves of the card and tear apart with them. That only works if
       they start on the same frame. */
    var halves = split(pend);
    win.classList.add(pend.vfx);
    if (halves) win.classList.add('is-sliced');
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
    unsplit();
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
    /* move(null) rather than a lunge: the run-in has to come off here — its
       `both` fill would otherwise keep holding him at 0, which is where it
       ends anyway, but a strike that inherits a finished animation is a strike
       that breaks the day someone retimes the run. He cuts from where he
       stopped, planted. */
    at(run, function () { pose(c.pose); move(null); });
    at(run + c.lead, commit);
    /* The tail, if the cut has one. Each step is [ms after contact, pose]. The
       IIFE is not decoration: this file is `var`-scoped, so without one every
       timer would close over the same loop variable and they would all fire the
       last pose in the list. */
    for (var i = 0; c.tail && i < c.tail.length; i++) {
      (function (step) {
        at(run + c.lead + step[0], function () { pose(step[1]); });
      }(c.tail[i]));
    }
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

    /* Folded, and the gesture is an unfold — the amber dot, or the bar itself.
       Unfolding is not a dismissal, so there is nothing to cut; he leaps up with
       the window as it grows and otherwise stays out of the way. Closing a folded
       window IS a dismissal, so it falls through to the strike below and gets the
       same kesa-giri the open card gets. See foldCut() for what that takes: the
       bar is narrower than he is, so the beam has to be aimed rather than
       inherited. This used to bail out here for every folded click. */
    if (isMin() && (id === 'termMin' || (!btn && bar && bar.contains(t)))) {
      once('p-leap', 360);
      return;
    }

    if (id !== 'termClose' && id !== 'termMin') return;
    /* Keyboard activation reports detail 0 — Space or Enter on a focused ✕. Left
       alone, because someone tabbing through the window is navigating rather than
       watching and should not be made to wait for a sword to finish.

       Esc is the exception and it is deliberate: main.js's Esc handler does call
       strike('close', 0), because Esc is the gesture people use to be rid of the
       thing, not to move through it, and it is worth the 150ms. It guards only on
       window.Samurai existing, and takes the folded bar as well, which is what
       this handler does too. If that ever changes, change it there — not here. */
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
    /* Reopening mid-cut has to tidy the cut away first. `is-open` outranks
       .is-sliced, so a window reopened while its two halves are still falling
       would come back clipped to one of them and wearing the other. Capture
       phase means this runs before main.js adds the class. */
    abort();
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

  /* terminal.js asks for the typed dismissals, and main.js's open() calls abort
     so that reopening the window mid-strike does not reopen it around a clone
     and two clip-paths — the fall lasts most of a second now, and the pill that
     can trigger that reopen turns up 450ms into it. Nothing else is exposed —
     the poses are not a public toy. */
  window.Samurai = { strike: strike, abort: abort };
})();
