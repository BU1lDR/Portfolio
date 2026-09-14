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
  /* Mirrors §10b's third gate, the one that also needs the fold state — see off().
     599 hides him at any width; this one only bites while the window is expanded. */
  var lowroof = matchMedia('(max-height: 699px)');

  var POSES = ['p-idle', 'p-run', 'p-leap', 'p-fall', 'p-land',
               'p-cut-min', 'p-cut-close', 'p-exit', 'p-guard', 'p-hurt'];
  /* Two moves the real sprite ever takes: he comes in, and after the close he
     goes back out. §10b's "why he no longer drops" is the story of the lunge he
     used to have, and its "and then he leaves" is the exit's.

     is-cross stays in the list without being applied to him any more. `sl` and
     `spar` both put it on a throwaway clone now, and this array is what move(null)
     strips — so leaving it here costs one string and means the day something does
     hand it to the real sprite, it can still be taken off him. */
  var MOVES = ['is-runin', 'is-exit', 'is-cross'];

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
      /* One step, and it is an exit rather than a landing. The fold's tail rides
         him down to the peek bar because he has somewhere to stand afterwards;
         here the window is leaving in two pieces and there is nothing under him
         to land on, so he leaves too — off the right-hand edge of the screen, the
         way the run-in brings him in. 200ms after contact: he holds the finished
         kesa-giri through the frames it is worth seeing (the halves part on the
         impulse at 114 and 198), then turns and goes. §10b's "and then he leaves"
         has the geometry and, more importantly, the deadline — .termwin holds
         opacity for 920ms after contact and he is a child of it, so 200 + the
         exit's own 620 has to fit inside that, and does, with 100ms spare. */
      tail: [[200, 'p-exit', 'is-exit']],
      /* 1140 rather than 700 because the halves now fall off the bottom of the
         screen instead of fading out over it, and 860ms of falling that starts at
         contact is not finished until 1010 — after which §10b holds the emptied
         window for another 60ms and snaps it at 1070. finish() is what takes the
         clone and the clip-paths away, so anything earlier than that tears the
         wreckage out of mid-air. 70ms of slack past the snap. */
      done: 1140,
      /* jump as well as attack_2 now, because the tail paints from it. Without it
         a cold cache would step him through an empty porthole on the way out —
         the exact hole this list exists to close. */
      needs: ['attack_2', 'jump'],
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
    'p-cut-min': 'attack_3', 'p-cut-close': 'attack_2',
    'p-exit': 'jump', 'p-guard': 'protect', 'p-hurt': 'hurt'
  };
  function drawable(list) {
    for (var i = 0; i < list.length; i++) if (have[list[i]] !== true) return false;
    return true;
  }

  /* Every reason not to perform. Reduced motion and the size cut-offs mirror
     §10b's media queries exactly — if CSS has hidden him, JS must not fire a red
     slash across the window on behalf of an invisible sprite.

     The last term is the fold-aware one, and it is a condition CSS states as
     `.termwin:not(.is-min) .sam` — below 700px of viewport an EXPANDED window puts
     his head, and the road he crosses on, behind the nav; a folded one leaves him
     300-450px of clear air. Same viewport, opposite answers, so the height alone
     cannot decide it.

     It belongs in off() rather than somewhere narrower because the crossing has
     the same problem, which is not obvious and is worth stating: the 参道 band is
     laid at the WINDOW'S ROOF, not at the bottom of the viewport
     (.preview-tools/road-headroom.js — band top tracks win.top exactly, 370 at
     900px of viewport and 214 at 640). So `sl` and `spar` run him along the same
     line that is behind the nav, and refusing them here is the same fix, not an
     unrelated one. cross() already declines a folded window, so the pair of them
     leaves the crossing available exactly where there is room for it. */
  function off() {
    return dead || doc.hidden || reduce.matches || narrow.matches || squat.matches ||
           (lowroof.matches && !isMin());
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
    /* The pill replaces the window, and it waits for the corner to be empty
       before it says so: §10b's "the pill waits its turn" holds its paint for
       920ms, which is .termwin.is-sliced's own hold, so it starts rising on the
       frame the window stops being drawn. Flashing it red as it lands is what
       makes it read as the window's replacement rather than an unrelated button
       that happened to appear — so the flash goes where the landing is. It used
       to fire at 300, which was the middle of the fall: a red border spent
       behind two tumbling halves with nobody looking at it.

       Cleared on the way IN rather than removed on a timer on the way out. At
       contact+920 the flash now outlives this strike's own teardown at `done`
       (contact+990), so a removal scheduled through at() would be cleared before
       it ever ran — and a leftover class costs the NEXT close its flash, because
       adding a class that is already there does not restart an animation.
       Removing it here is order-independent instead: whatever the last cut left
       behind, this one starts clean. Leaving it on afterwards is free — sam-pill
       has no fill-mode, so the moment it has played the pill is back to being
       styled by its own rule, hover included. */
    if (wasClose && launch) {
      launch.classList.remove('is-cut');
      at(920, function () { launch.classList.add('is-cut'); });
    }
  }

  function finish() {
    for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
    timers.length = 0;
    clearTimeout(watchdog);
    watchdog = 0;
    unsplit();
    /* A crossing in flight, if there is one. finish() is the one function that
       puts everything back, and after it runs there must be nothing left on the
       page that this file put there — an `sl` interrupted by a real dismissal
       would otherwise leave a stone path across the viewport and the sprite it
       was laid for switched off. Hoisted, so this reads before cross() defines
       it; null whenever nothing is in flight. */
    if (roadTidy) roadTidy();
    win.classList.remove('is-cut-min', 'is-cut-close');
    sam.style.removeProperty('--sam-run-dur');
    sam.style.removeProperty('--sam-run-x');
    sam.style.removeProperty('--sam-cross-x');
    sam.style.removeProperty('--sam-cross-dur');
    move(null);
    pose('p-idle');
    pend = null;
    fired = false;
    /* Last, because wake() refuses to re-arm while a strike is pending, and
       `pend` only clears on the line above. This is what guarantees he is never
       left asleep on a window that has just been cut out from under him. */
    wake();
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
      /* Whatever the runway, the same ground speed — the ONE ground speed, the one
         the sheet's contact foot was drawn at. See SPEED further down; it is
         declared after this point but only ever read here at click time, long
         after this file has finished executing. cells() because --sam-run-x is
         read inside .sam__zoom and SPEED is in device px. */
      sam.style.setProperty('--sam-run-x', cells(run * SPEED) + 'px');
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
    /* The tail, if the cut has one. Each step is [ms after contact, pose] and
       optionally a third element, a move — the close's exit needs one because
       leaving is both a new sheet and a new trajectory, where the fold's two
       steps only change frames. A step with no move leaves the current one
       alone, which is what the fold wants: move(null) already ran above.

       The IIFE is not decoration: this file is `var`-scoped, so without one every
       timer would close over the same loop variable and they would all fire the
       last pose in the list. */
    for (var i = 0; c.tail && i < c.tail.length; i++) {
      (function (step) {
        at(run + c.lead + step[0], function () {
          pose(step[1]);
          if (step[2]) move(step[2]);
        });
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
    /* protect and hurt are last and are NOT critical: they only serve the poke,
       and a poke that does nothing because the sheet never arrived is a joke
       nobody was owed. idle stays the only critical one — without it there is no
       sprite worth leaving on the page. */
    var sheets = ['idle', 'run', 'jump', 'attack_2', 'attack_3', 'protect', 'hurt'];
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

  function egg(id) { return !!(window.Eggs && window.Eggs.found(id)); }

  /* ── poking the guard ─────────────────────────────────────────
     He has stood on that roof doing nothing for the whole session, so the first
     thing a certain kind of visitor tries is whether he is clickable. He is now.

     Escalation, not a single reaction, because a single reaction is a thing you
     see once. Guard, guard, guard, then hurt, then he has had enough and cuts
     the window down with you still holding the mouse. The count resets after
     four seconds of being left alone — the joke is a flurry of pokes, not a
     tally you accumulate over ten minutes and then trip by accident.

     WHY A HIT AREA AND NOT `pointer-events: auto` ON .sam. His box is 256x256
     and the figure is a 110x190 sliver of it; the rest is transparent. Turning
     the box on would park an invisible 256px click-eater over the corner —
     exactly the bug §10b's "the pill waits its turn" exists to prevent one
     element along. The reserved rail means no page text is behind him, so a hit
     area over the FIGURE is safe, but the empty 60% of the box is not free to
     take. Measured from the sheets: the figure spans cell x10..120 across every
     frame of every pose and his feet are on row 127, so at scale(2) and
     `bottom: 100%` the pixels live in the lower ~190px of the box. */
  var pokes = 0;
  var pokeReset = 0;

  function poke() {
    /* isOpen() rather than isVisible(), because the folded peek bar counts: he
       stands on that too, and closing a folded window is a dismissal that
       strike() already knows how to cut. Stowed does not count — CSS has taken
       him off the screen and a click cannot honestly have landed on him. */
    if (off() || pend || !T.isOpen() || T.isStowed()) return;
    /* Mid-`sl` the real sprite is switched off and the one on screen is a clone in
       an overlay, so there is nothing here to poke and nothing that would answer.
       is-away already makes the hit area untestable — visibility:hidden takes
       descendants with it — so this is belt as well as braces, and it is the flag
       rather than a class because the flag is what cross() actually owns. */
    if (crossing) return;
    /* Nothing to react WITH on a cold cache — and a click that visibly does
       nothing is better than a click that blanks the porthole. */
    if (!drawable(['protect'])) return;
    egg('poke');
    wake();
    clearTimeout(pokeReset);
    pokeReset = setTimeout(function () { pokes = 0; }, 4000);
    pokes++;

    if (pokes < 4) { once('p-guard', 620); return; }
    if (pokes === 4 && drawable(['hurt'])) { once('p-hurt', 700); return; }

    /* Fifth. He is done being clicked at. Routed through strike() so it is the
       same kesa-giri, the same commit-on-contact and the same watchdog as ✕ —
       there is no second code path for closing this window and there is not
       about to be. */
    pokes = 0;
    if (!strike('close', 260)) return;
    egg('patience');
  }

  /* The listener goes on .termwin rather than on the hit area, so it survives
     the sprite being re-posed, and it is NOT capture — the dots handler above is
     capture and must keep winning if these ever overlap, which they do not. */
  win.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;
    if (!ev.target.closest('.sam__hit')) return;
    poke();
  });

  /* ── off duty ─────────────────────────────────────────────────
     Ninety seconds of an open window and no input at all, and he stops standing
     to attention: the breath drops to a third speed and a すー floats off him.

     There is no sleeping sheet in the pack — Walk, Protect, Hurt, Dead and
     Attack_1 are what was left, and Dead reads as dead, which is a different
     joke and a worse one. So this is idle.png at a third speed plus a すー on a
     pseudo-element, which is honestly what dozing looks like from across a room.
     No DOM node and no teardown: one class on and off is the whole mechanism.

     Every real input cancels it, including scrolling, because someone reading
     the page is not idle. visibilitychange is deliberately NOT one of them: a
     backgrounded tab is the most idle a tab gets. */
  var DOZE_AFTER = 90000;
  var dozeTimer = 0;
  var dozing = false;

  function wake() {
    if (dozing) {
      dozing = false;
      sam.classList.remove('is-doze');
    }
    clearTimeout(dozeTimer);
    if (off() || pend) return;
    dozeTimer = setTimeout(doze, DOZE_AFTER);
  }

  function doze() {
    /* isVisible() is open && not folded && not stowed — the only state in which
       he is actually on screen standing about. Re-arm rather than give up: the
       ninety seconds ran out while the window happened to be shut, and one such
       moment must not end the behaviour for the session. */
    if (off() || pend || dozing || !T.isVisible()) {
      dozeTimer = setTimeout(doze, DOZE_AFTER);
      return;
    }
    dozing = true;
    sam.classList.add('is-doze');
    egg('doze');
  }

  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (e) {
    /* Passive: none of these are cancelled here, and a non-passive scroll or
       wheel listener on the document is the single easiest way to make a page
       feel heavy. */
    doc.addEventListener(e, wake, { passive: true, capture: true });
  });
  wake();

  /* ── straight across, on a path (`sl`) ────────────────────────
     The ls typo. On a real box you get a steam locomotive; here you get the man
     who is already standing there — and a 参道 laid across the page ahead of him
     to run down, with 鳥居 to run through.

     THIS USED TO MOVE THE REAL SPRITE and that is what was wrong with it. He is a
     child of .termwin, so a translateX in his own coordinate space was the whole
     implementation and it cost nothing — but it also meant the run ended with him
     parked off the left of the window and `move(null)` snapping him back onto his
     post in a single frame. A teleport, at the end of every performance.

     A path across the entire page cannot be a child of the window either, so both
     problems have the same answer, and it is the one spar() already uses: build a
     throwaway sprite in a fixed overlay, stand the real one down for the length of
     it, and afterwards let him run back onto the roof with the same is-runin the
     window's own entrance uses. Nothing teleports because nothing is moved and
     put back — the thing that moved is deleted, and the thing that came back was
     never anywhere else. §10b's "the path he crosses on" has the CSS.

     Returns false rather than doing nothing quietly, because terminal.js prints a
     different line then.

     SPEED is derived, not chosen, and that is the whole reason this used to look
     like gliding rather than running. See STRIDE below. */

  /* ── the one ground speed on this page ────────────────────────
     A run cycle only reads as a run if the foot that is on the ground stays
     STILL on the ground. The sheet decides how fast that is: run.png is eight
     frames and its contact foot drifts backwards 9.5 cell px per frame, measured
     patch by patch off the shipped PNG (.preview-tools/run-stride.js). Eight of
     those is 76 cell px, and cell px double through .sam__zoom, so one cycle
     carries him 152 device px. Nothing here is a preference — move him slower
     than this and the planted foot slides forward under him, which is a moonwalk;
     faster and it slides backwards. Both look like gliding.

     THE BUG THIS REPLACES was a unit mix-up, and it is worth writing down because
     it is invisible in a diff. --sam-run-x is in cell px, so the run-in's 0.28
     meant 0.28 CELL px per ms — 0.56 device px per ms on the screen. SPEED was
     copied from that 0.28 and applied to a measured rect, i.e. as DEVICE px per
     ms. So the entrance ran 62% too fast and the crossing 19% too slow, one
     number, two speeds, both wrong, and the comment on each cheerfully claimed
     they matched at "~280px/s". They are one expression now: change the cycle and
     the ground speed follows it, in both files, or it does not change at all. */
  var RUN_CYCLE = 440;                    // ms — must equal --sam-run-dur's default
  var STRIDE = 152;                       // device px carried per cycle
  var SPEED = STRIDE / RUN_CYCLE;         // 0.345 device px/ms

  /* ── and the dash, which is `sl` only ─────────────────────────
     0.345 px/ms is a man travelling. It is the right speed for the run-in, where
     he is arriving somewhere and you are meant to watch him do it, and it is the
     wrong speed for `sl`, where he took better than three seconds to cross a
     1440px page. Three seconds of watching someone jog is not a passer-by, it is
     a parade.

     THE ONLY HONEST WAY TO GO FASTER IS TO RAISE THE CADENCE BY THE SAME FACTOR,
     and that is the whole reason this is a divisor and not a second hand-picked
     speed. STRIDE is fixed by the art — 152 device px per cycle, measured off
     run.png — so ground speed and cycle length are locked to each other by
     SPEED = STRIDE / CYCLE. Multiply the speed and leave the cycle alone and the
     planted foot slides backwards under him, which is the exact glide the commit
     above this one existed to remove. Both move or neither does.

     5 is chosen; 88ms and 1.727 are consequences. It divides 440 exactly, which
     keeps CROSS_CYCLE a whole number of ms and CROSS_SPEED therefore exactly
     STRIDE/88 rather than STRIDE over something rounded.

     What 88ms means in practice: eight frames land 11ms apart against a 16.7ms
     display frame, so the browser shows roughly five of the eight each cycle and
     a different five each time. THAT IS NOT A BUG AND IT IS WHY THIS WAS SAFE TO
     DO. Both animations are linear in time — sam-run advances the strip, sam-cross
     advances the position — so whichever frame a given display refresh happens to
     sample, the foot in it is in the right place for that instant. Foot-planting
     is a relationship per unit time, not per frame, and dropping frames cannot
     break it. What you see instead of eight clean poses is a scribble of legs,
     which is what legs look like at 1.7px/ms and is the point.

     The eye still fills in a streak whether or not one is drawn, so §10b draws it
     — see "the smear he leaves". */
  var DASH = 5;
  var CROSS_CYCLE = RUN_CYCLE / DASH;             // 88ms
  var CROSS_SPEED = STRIDE / CROSS_CYCLE;         // 1.727 device px/ms

  /* How many previous frames of him are drawn behind him during the dash. The
     geometry is entirely in §10b — see "the smear he leaves" — and the count is
     here because it is the number of extra nodes cross() has to write.

     One, and going higher is worse rather than merely more expensive: his banner is
     ribbed, so evenly spaced copies of it interfere into a lattice and you get a
     picket fence instead of a blur. .preview-tools/ghost-ab.js has the sheet. */
  var GHOSTS = 1;

  /* Device px to the CELL px the rig wants. The rig is inside .sam__zoom, which
     is scale(2), so anything set from here lands twice as far as it reads —
     exactly the trap --sam-run-x's comment warns about, and the only reason this
     conversion has to happen in JS at all is that the distance depends on a live
     measurement and CSS cannot ask for one. */
  function cells(devicePx) { return Math.round(devicePx / 2); }

  /* Where his painted pixels start, measured in from the left of his 256px box.
     NOT a guess and not the sheet's own column numbers: idle paints cell x27..82,
     .sam__flip mirrors the strip so that becomes cell 46..101, and .sam__zoom
     doubles it — 92 device px. Anything that needs to know where he actually is,
     rather than where his box is, needs this. */
  var TIP = 92;

  /* The gates, as fractions of the crossing rather than pixel positions, so three
     of them are spaced the same way on a 900px window and a 2560px one. Not at 0
     or 1: a gate on top of where he starts is a gate you never see him enter, and
     one at the far end goes up as he is already leaving the screen. */
  var GATES = [0.18, 0.48, 0.79];

  var crossing = false;
  /* The teardown for whatever overlay is in flight, so finish() can put the page
     back without knowing what built it. See the call there. */
  var roadTidy = null;

  function cross() {
    /* isVisible(): open, unfolded, unstowed. You cannot type `sl` into a folded
       window anyway, but terminal.js is not the only possible caller and the
       fallback line it prints is a better outcome than a run across a peek bar
       two hundred pixels wide. */
    if (off() || pend || crossing || !T.isVisible()) return false;
    if (!drawable(['run'])) return false;
    var r = sam.getBoundingClientRect();
    if (!r.width) return false;
    egg('sl');
    wake();
    crossing = true;

    /* From where he is standing to properly off the left edge: his leading
       painted edge has to clear x=0, plus 80 of slack, because half a samurai
       parked at the edge is worse than no samurai. */
    var travel = Math.round(r.left + TIP) + 80;
    var dur = Math.round(travel / CROSS_SPEED);

    var road = doc.createElement('div');
    road.className = 'sam-road';
    road.setAttribute('aria-hidden', 'true');

    /* ONE MEASUREMENT, TWO USERS. The path sits at r.bottom — his feet — and the
       runner is placed at r.left/r.top, so the ground cannot end up under his
       soles or over his head however the window has been resized or scrolled. */
    /* Order is the stacking: haze behind everything, then the stones, then the
       gates standing up through both, then him, last and in front. */
    var html = '<div class="sam-road__at" style="top:' + Math.round(r.bottom) + 'px">' +
               '<div class="sam-road__haze"></div>' +
               '<div class="sam-road__band"></div>';

    /* Each gate is fully up before he reaches it. Same arithmetic the spar uses
       for the headings — distance still to travel, over ground speed — taken from
       his leading edge rather than his box, and with a lead on top because the
       rise takes time: at the 260ms lead this started on, the gate was still
       fading in as he ran through it, so it read as growing around him rather
       than as something already standing there.

       RISE AND LEAD BOTH DIVIDE BY DASH, and they have to, together. The whole
       crossing is a fifth of what it was, so a 420ms rise would now take two
       thirds of it and a 700ms lead is longer than the run: every gate would be
       told to start before time zero, all three would go up in the same frame,
       and the one thing this arithmetic buys — gates that are already standing
       there rather than assembling around him — would be gone. Held as fractions
       of the crossing, the three gates are spaced the same way at any speed. The
       420 is sam-road-rise's own duration in §10b, so it is passed in rather than
       hard-coded twice. */
    var rise = Math.round(420 / DASH);          // 84ms
    var lead = rise + Math.round(280 / DASH);   // + the beat it stands there first
    for (var i = 0; i < GATES.length; i++) {
      var away = travel * GATES[i];
      html += '<div class="sam-road__torii" style="left:' +
                Math.round(r.left + TIP - away) + 'px;--d:' +
                Math.max(0, Math.round(away / CROSS_SPEED) - lead) + 'ms">' +
              '<i></i><b></b></div>';
    }
    html += '</div>';

    /* The same five nested nodes .sam uses, so every pose rule in §10b applies to
       this unchanged, and built by hand rather than cloned from .sam because .sam
       carries state — a pose, possibly is-doze — that must not come along. */
    /* --sam-run-dur is overridden HERE, on the runner itself, and that override is
       the load-bearing half of the dash. .sam declares 440ms and `.sam.p-run
       .sam__cel` reads it with no fallback, so without this line the strip would
       still be stepping at the walking cadence while the rig flew across at five
       times the speed — a man sliding along at 1.7px/ms taking one step per 152px
       of ground, i.e. the glide again, only worse. CROSS_SPEED and CROSS_CYCLE
       come out of the same STRIDE, so setting both from the same pair is what
       keeps the foot planted. */
    /* The afterimage. GHOSTS more porthole-and-strip stacks inside the same rig,
       each showing the pose he held one sheet frame ago at the place he was standing
       one sheet frame ago — §10b's "the smear he leaves" has why an actual previous
       frame beats a drawn-on trail, why both halves of it fall out of one number,
       and why the count and the spacing are what they are.

       FURTHEST BACK FIRST, because DOM order is the stacking and there is no
       z-index anywhere in this stack: he has to be painted last or his own pixels
       come out from under a translucent copy of himself. Same reason the path
       lays haze, stones, gates, man in that order.

       --g is the only thing that differs, so the geometry lives in the stylesheet
       and this stays a loop over a depth. */
    var GHOST = '<div class="sam__flip"><div class="sam__cel"></div></div>';
    var stack = '';
    for (var g = GHOSTS; g >= 1; g--)
      stack += '<div class="sam__stage sam__stage--ghost" style="--g:' + g + '">' +
                 GHOST + '</div>';
    stack += '<div class="sam__stage">' + GHOST + '</div>';

    html += '<div class="sam sam--road p-run" style="left:' + Math.round(r.left) +
              'px;top:' + Math.round(r.top) + 'px;--sam-cross-x:' + cells(travel) +
              'px;--sam-cross-dur:' + dur + 'ms;--sam-run-dur:' + CROSS_CYCLE + 'ms">' +
              '<div class="sam__zoom"><div class="sam__rig">' + stack + '</div></div>' +
            '</div>';

    road.innerHTML = html;
    /* The wipe runs at 1.4x his ground speed so the stones are always arriving in
       front of his feet. Ahead of him, not under him — a path that keeps exact
       pace with a runner is a path he appears to be dragging. Derived from dur, so
       it followed the dash without being touched. */
    road.style.setProperty('--sam-road-dur', Math.round(dur / 1.4) + 'ms');
    road.style.setProperty('--sam-road-rise', rise + 'ms');
    doc.body.appendChild(road);
    /* Only now, so there is never a frame with neither of them on screen: the
       runner is already in the document and already at the real one's coordinates
       when the real one goes. */
    sam.classList.add('is-away');
    road.querySelector('.sam--road').classList.add('is-cross');

    /* ── the man and the ground no longer leave together ───────────
       They used to: one tidy() at dur+200 took the overlay and gave the real
       sprite back in the same breath, and at a three-second crossing that was
       fine. At 640ms it is not. The 参道 was asked for as its own thing — stones,
       haze, three 鳥居 — and the whole of it would now be laid, run down and gone
       inside two thirds of a second, which is not long enough to look at a torii
       let alone three.

       So the path holds after he is off, and the teardown splits in two.
       restore() gives the real sprite back on his post; tidy() takes the overlay
       away. That is only safe because of where he is when restore() fires: past
       x=0, with sam-cross's `both` holding him there, inside a .sam-road that is
       `overflow: hidden`. He is clipped out of the viewport entirely, so there is
       no frame in which two samurai are visible at once — which is the invariant
       the single tidy() was protecting, and it is preserved by geometry rather
       than by the two happening simultaneously.

       Both are idempotent and roadTidy still points at the one that does
       everything, so finish() landing anywhere in here puts the page back exactly
       as before. */
    var HOLD = 620;               // the path stays lit this long after he is gone
    var restored = false;
    var restore = function () {
      if (restored) return;
      restored = true;
      sam.classList.remove('is-away');
    };
    var tidy = function () {
      restore();
      if (road.parentNode) road.parentNode.removeChild(road);
      crossing = false;
      roadTidy = null;
    };
    roadTidy = tidy;

    at(dur + 200, function () {
      restore();
      /* And back onto the roof the way he first came onto it — same sheet, same
         440ms, same is-runin, deliberately NOT the dash: he tears past, then walks
         back on. The contrast is most of what makes the tearing past read as
         unusual. once() refuses while a strike is pending, which is correct: a
         dismissal that started mid-crossing owns him now. */
      once('p-run', 440);
      move('is-runin');
    });

    /* Then the ground goes. OUT is set INTO the stylesheet rather than read out of
       it, because the removal has to outlast the fade and the two numbers were
       previously written down in different files: §10b said .42s and here the
       overlay came off 460ms after the fade began, which left 40ms of slack that
       nobody had checked and that no comment mentioned. One constant, passed in,
       and the removal is stated as fade-plus-slack so it cannot be wrong. */
    var OUT = 420;
    road.style.setProperty('--sam-road-out', OUT + 'ms');
    at(dur + HOLD, function () { road.classList.add('is-going'); });
    at(dur + HOLD + OUT + 160, tidy);
    /* Outside `timers`, and this is the line that matters. at() pushes into that
       array and finish() clears all of it, so a real dismissal landing mid-run
       would otherwise leave the overlay on the page and the real sprite
       invisible. finish() calls roadTidy for the normal case; this catches the
       rest. Both are idempotent.

       Written as the scheduled teardown plus a margin rather than as a round
       number. It used to be dur+1600 against a teardown at dur+200 — 1400ms of
       margin by accident — and the hold below pushes the real teardown out to
       dur+1200, which would have left the backstop firing 400ms later on a
       coincidence nobody had noticed. */
    setTimeout(tidy, dur + HOLD + OUT + 160 + 400);
    return true;
  }

  /* ── the spar ─────────────────────────────────────────────────
     The one thing he does that leaves the window. He crosses the whole viewport
     right to left and every section heading he passes comes apart along a
     diagonal and knits back together behind him.

     A SECOND SPRITE, not this one. Moving .sam out of .termwin would break the
     roof contract that the entire file rests on — his feet track the folding
     window because he is a child of it at `bottom: 100%`, with no measurement
     and no resize handler — and putting him back afterwards would mean
     reproducing that by hand for the length of one joke. So the spar builds a
     throwaway clone in a fixed overlay, animates that, and removes it. .sam
     never moves, never changes class, and cannot be left in a strange state if
     this throws halfway through.

     THE HEADINGS. A box cannot be clipped to both sides of a line at once, so
     each one is split the way split() splits the terminal card: the original is
     clipped to the upper-left of the rake, a clone is clipped to the lower-right,
     and the two are nudged apart. The clone goes in THIS overlay rather than
     beside the heading, which is what makes the arithmetic trivial — the overlay
     is position:fixed, so a getBoundingClientRect() is already the coordinates
     the clone needs, with no parent-offset walk and nothing to get wrong inside
     an arbitrary layout.

     Every clip-path involved is static, applied by a class and removed by
     removing it. An animated clip-path on a live line of body text is a value
     that can be interrupted mid-flight and left there; a class either applies
     whole or not at all. §10b owns both halves and both offsets. */
  var sparring = false;

  /* .sec__title is styled entirely on its own class — no ancestor selectors — so
     a clone renders identically anywhere, PROVIDED it is given back the two
     things it loses by being reparented: its used width, because the heading is
     a wrapping flex container and its line breaks depend on it, and its computed
     colour, which it inherits from the section rather than declaring. */
  function cleave(el, r) {
    var clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    clone.className = el.className + ' sam-spar__half';
    clone.style.left = r.left + 'px';
    clone.style.top = r.top + 'px';
    clone.style.width = r.width + 'px';
    clone.style.color = getComputedStyle(el).color;
    el.classList.add('is-cleaved');
    return clone;
  }

  function spar() {
    if (off() || pend || sparring || !T.isVisible()) return false;
    if (!drawable(['run'])) return false;
    egg('spar');
    wake();
    sparring = true;

    var stage = doc.createElement('div');
    stage.className = 'sam-spar';
    stage.setAttribute('aria-hidden', 'true');
    /* The same four nested nodes .sam uses — zoom, rig, stage, flip, cel — so
       §10b's pose rules apply to it unchanged. Built by hand rather than cloning
       .sam because .sam carries state (is-doze, whatever pose it is in) that
       must not come along. */
    stage.innerHTML =
      '<div class="sam sam--free p-run">' +
        '<div class="sam__zoom"><div class="sam__rig"><div class="sam__stage">' +
          '<div class="sam__flip"><div class="sam__cel"></div></div>' +
        '</div></div></div>' +
      '</div>';
    doc.body.appendChild(stage);
    var free = stage.firstChild;

    /* .sam--free starts at right: -288px, so his blade is one box-width off the
       screen and has the full viewport plus that box to cross. Same ground speed
       as every other run, so the cycle needs no retiming; cells() because the rig
       is inside the 2x zoom. */
    var travel = window.innerWidth + 320;
    var dur = Math.round(travel / SPEED);
    free.style.setProperty('--sam-cross-x', cells(travel) + 'px');
    free.style.setProperty('--sam-cross-dur', dur + 'ms');
    free.classList.add('is-cross');

    /* Which headings, and when. Read ONCE, up front — a rect per frame of a
       full-width run is a forced layout per frame, and a heading does not move
       during one.

       On screen only: cleaving a heading four sections down is a class added to
       something nobody can see and then taken off again. Note the X test is the
       only one — he passes at a fixed height and a heading well above or below
       him still splits. That is deliberate rather than sloppy: a blade sweeping
       the page reads as cutting what is in the sweep, and gating on his exact
       vertical band would mean the command does visibly nothing whenever you
       happen to be scrolled between two headings. */
    var marks = [];
    var heads = doc.querySelectorAll('.sec__title');
    for (var i = 0; i < heads.length; i++) {
      var r = heads[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || !r.width) continue;
      marks.push({ el: heads[i], r: r, x: r.right });
    }
    /* He starts off the right edge, so the wait before a heading is how far his
       blade still has to travel to reach its near side. */
    var startX = window.innerWidth + 160;
    marks.forEach(function (m) {
      at(Math.max(0, Math.round((startX - m.x) / SPEED)), function () {
        if (m.done) return;
        m.clone = cleave(m.el, m.r);
        stage.appendChild(m.clone);
        at(520, function () { heal(m); });
      });
    });

    function heal(m) {
      m.done = true;
      m.el.classList.remove('is-cleaved');
      if (m.clone && m.clone.parentNode) m.clone.parentNode.removeChild(m.clone);
      m.clone = null;
    }

    /* Teardown twice over, and not from paranoia: at() pushes into the shared
       `timers` array, so a real dismissal calling finish() mid-spar clears every
       timer above — including the ones that would have put the headings back.
       The plain setTimeout is outside that array and cannot be cleared, so the
       page always comes back together even when the animation does not finish.
       Removing the overlay is idempotent and healing an already-healed heading is
       a no-op, so it costs nothing when both run. */
    var tidy = function () {
      if (stage.parentNode) stage.parentNode.removeChild(stage);
      for (var j = 0; j < marks.length; j++) heal(marks[j]);
      sparring = false;
    };
    at(dur + 120, tidy);
    setTimeout(tidy, dur + 1400);
    return true;
  }

  /* terminal.js asks for the typed dismissals, and main.js's open() calls abort
     so that reopening the window mid-strike does not reopen it around a clone
     and two clip-paths — the fall lasts most of a second now, and the pill that
     can trigger that reopen turns up 450ms into it. Nothing else is exposed —
     the poses are not a public toy. */
  /* strike and abort are the dismissal contract terminal.js and main.js have
     always used. cross and spar are the two eggs, and they follow the same rule:
     they return a boolean, and false means "I did not perform — say something
     yourself". That is why `sl` and `spar` still print a line on a phone, under
     reduced motion, or on a cold cache, instead of appearing to be broken. */
  window.Samurai = { strike: strike, abort: abort, cross: cross, spar: spar };
})();
