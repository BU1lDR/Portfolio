/* ═══════════════════════════════════════════════════════════════
   main.js — everything that isn't the 3D scene or the terminal.

     boot overlay · nav · scroll reveal · custom cursor
     3D tilt · typewriter · contact form
     the floating terminal window · easter eggs · résumé viewer
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $  = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  // If we got this far, JS works — let the reveal system take over.
  root.classList.remove('no-js');


  /* ══ 01 boot overlay ═══════════════════════════════════════ */

  (function boot() {
    var el = $('#boot');
    if (!el) return;

    var logEl = $('#bootLog');
    var barEl = $('#bootBar');
    var seen = false;
    var done = false;
    try { seen = sessionStorage.getItem('booted') === '1'; } catch (e) {}

    function finish() {
      if (done) return;                                  // keydown + pointerdown can race
      done = true;
      el.classList.add('is-done');
      doc.body.classList.remove('is-locked');
      try { sessionStorage.setItem('booted', '1'); } catch (e) {}
      window.removeEventListener('keydown', finish);
      window.removeEventListener('pointerdown', finish);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 700);

      /* The terminal window sits behind this overlay and waits for this
         before typing its intro, so the sequence isn't spent under the
         curtain. Dispatched on the next tick rather than inline: when boot is
         skipped this function runs synchronously from here, which is *before*
         module 09 below has defined window.TermWindow — and the terminal asks
         that controller whether it is actually visible first. */
      setTimeout(function () { window.dispatchEvent(new CustomEvent('boot:done')); }, 0);
    }

    // Already booted this session, or the user asked for less motion.
    if (seen || reduce) { finish(); return; }

    doc.body.classList.add('is-locked');
    window.addEventListener('keydown', finish);
    window.addEventListener('pointerdown', finish);

    var lines = [
      '[ 0.000 ] shadow-init v1.0 — cold start',
      '[ 0.186 ] mounting <i>/dev/portfolio</i> … <b>ok</b>',
      '[ 0.412 ] loading glyph table 零 壱 弐 参 … <b>ok</b>',
      '[ 0.703 ] verifying identity: <i>aryan verma</i> … <b>ok</b>',
      '[ 0.991 ] importing keyring … <b>1 key, trusted</b>',
      '[ 1.264 ] scanning localhost … <b>1 host up</b>, <i>0 ports exposed</i>',
      '[ 1.588 ] baseline hash matches — <b>integrity ok</b>',
      '[ 1.902 ] projecting wireframe 鳥居 … <b>ok</b>',
      '[ 2.230 ] compositing katakana rain … <i>deferred</i>',
      '[ 2.577 ] arming custom cursor … <b>ok</b>',
      '[ 2.884 ] opening shell on tty1 … <b>ok</b>',
      '[ 3.150 ] handshake complete',
      '[ 3.402 ] <i>no exploits here. just a portfolio.</i>',
      '[ 3.610 ] ようこそ — welcome'
    ];

    var i = 0;
    /* Per-line pause, deliberately uneven — a flat 170ms metronome read as
       a progress bar with extra steps rather than a machine coming up.
       ~4.5s total; sessionStorage means you only sit through it once per
       session, and any key or click skips it. */
    var pauses = [260, 200, 240, 300, 220, 340, 260, 210, 380, 240, 200, 300, 420, 260];

    /* The portrait rides along with the log rather than on its own timer, so
       the two can't drift apart: it lands on the line that claims to be
       verifying an identity and leaves on the one that says the handshake is
       done. That's ~700ms in, ~2.1s on screen, gone before the overlay is. */
    var idEl = $('#bootId');
    var idCap = $('#bootIdCap');
    var ID_IN = 3;    // '[ 0.703 ] verifying identity: aryan verma'
    var ID_OUT = 11;  // '[ 3.150 ] handshake complete'

    function portrait(printed) {
      if (!idEl) return;
      if (printed === ID_IN + 1) {
        idEl.classList.add('is-live');
        if (idCap) idCap.innerHTML = '本人確認<i>identity confirmed</i>';
      } else if (printed === ID_OUT + 1) {
        idEl.classList.remove('is-live');
        idEl.classList.add('is-out');
        if (idCap) idCap.innerHTML = 'セッション開始<i>session open</i>';
      }
    }

    (function tick() {
      if (el.classList.contains('is-done')) return;      // skipped
      if (i >= lines.length) { setTimeout(finish, 620); return; }
      logEl.innerHTML += lines[i] + '\n';
      i++;
      portrait(i);
      if (barEl) barEl.style.width = (i / lines.length * 100) + '%';
      setTimeout(tick, pauses[i - 1] || 240);
    })();
  })();


  /* ══ 02 nav ════════════════════════════════════════════════ */

  (function nav() {
    var bar = $('#nav');
    var burger = $('#burger');
    var links = $$('.nav__links a');
    var prog = $('#navProgress');
    if (!bar) return;

    /* mobile menu */
    function closeMenu() {
      bar.classList.remove('is-open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
    }
    if (burger) {
      burger.addEventListener('click', function () {
        var open = bar.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
      });
    }
    links.forEach(function (a) { a.addEventListener('click', closeMenu); });
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeMenu();
    });
    doc.addEventListener('click', function (ev) {
      if (!bar.classList.contains('is-open')) return;
      if (!ev.target.closest('.nav')) closeMenu();
    });

    /* stuck state, auto-hide, progress bar — one rAF-throttled handler */
    var lastY = window.scrollY;
    var queued = false;

    function onScroll() {
      var y = window.scrollY;

      bar.classList.toggle('is-stuck', y > 8);

      // hide while scrolling down, reveal on the way back up
      if (!bar.classList.contains('is-open')) {
        if (y > 420 && y > lastY + 4) bar.classList.add('is-hidden');
        else if (y < lastY - 4 || y < 420) bar.classList.remove('is-hidden');
      }
      lastY = y;

      if (prog) {
        var max = doc.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (max > 0 ? Math.min(100, y / max * 100) : 0) + '%';
      }
      queued = false;
    }

    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    onScroll();

    /* active section highlighting */
    var sections = $$('main section[id]');
    if ('IntersectionObserver' in window && sections.length) {
      var seen = {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen[e.target.id] = e.intersectionRatio; });

        var bestId = null, best = 0;
        Object.keys(seen).forEach(function (id) {
          if (seen[id] > best) { best = seen[id]; bestId = id; }
        });

        links.forEach(function (a) {
          a.classList.toggle('is-active', bestId && a.getAttribute('href') === '#' + bestId);
        });
      }, { threshold: [0, .15, .35, .6, .9], rootMargin: '-70px 0px -35% 0px' });

      sections.forEach(function (s) { io.observe(s); });
    }
  })();


  /* ══ 03 scroll reveal ══════════════════════════════════════ */

  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var d = el.dataset.revealDelay;
        if (d) el.style.setProperty('--rd', d + 'ms');
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  })();


  /* ══ 04 typewriter ═════════════════════════════════════════ */

  (function typer() {
    var el = $('#typewriter');
    if (!el) return;

    /* EDIT: the rotating phrases after "I'm into" */
    var words = ['cybersecurity.', 'ethical hacking.', 'data analysis.', 'system design.'];

    if (reduce) { el.textContent = words[0]; return; }

    var w = 0, c = 0, deleting = false;

    (function tick() {
      var word = words[w];
      c += deleting ? -1 : 1;
      el.textContent = word.slice(0, c);

      var wait = deleting ? 42 : 78;
      if (!deleting && c === word.length) { wait = 1900; deleting = true; }
      else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; wait = 320; }

      setTimeout(tick, wait);
    })();
  })();


  /* ══ 05 glitch pulses ═════════════════════════════════════ */

  (function glitch() {
    var els = $$('.glitch');
    if (!els.length || reduce) return;

    els.forEach(function (el) {
      el.addEventListener('mouseenter', function () { fire(el); });
    });

    function fire(el) {
      el.classList.add('is-glitching');
      setTimeout(function () { el.classList.remove('is-glitching'); }, 440);
    }

    // Random ambient twitch, but only while the hero is on screen.
    var onScreen = true;
    var hero = $('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; })
        .observe(hero);
    }
    (function loop() {
      setTimeout(function () {
        if (onScreen && !doc.hidden) fire(els[Math.floor(Math.random() * els.length)]);
        loop();
      }, 2600 + Math.random() * 4200);
    })();
  })();


  /* ══ 06 custom cursor ══════════════════════════════════════ */

  (function cursor() {
    var dot = $('#cursorDot');
    var ring = $('#cursorRing');
    if (!dot || !ring || !fine || reduce) return;

    var label = $('.cursor-ring__label', ring);
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var rx = tx, ry = ty;
    var ready = false;

    /* The last three joined this list when §04 stopped enumerating what to hide
       the OS cursor on and started hiding it on everything. Each of them had
       been carrying a `cursor: pointer` of its own, which — cursor being an
       inherited property, and a direct match always beating an inherited value —
       was quietly winning against the rig and drawing the OS hand on top of it.
       The counter egg in §11 is the one that matters: its comment says
       "cursor:pointer is the whole hint", because an underline or a hover colour
       would answer the question the egg asks. Blanking that pointer without
       putting the element here would have deleted the only hint the egg has. The
       red ring is a louder one. */
    var HOVER = 'a, button, [role="button"], .term__chips button, label, ' +
                '.sec__num i, .sam__hit, .termwin.is-min .term__bar';
    var TEXT = 'input[type="text"], input[type="email"], textarea, .term__input';

    /* Asked of the element, not of a tag list: does THIS node hold text you
       could drag across? A list of prose tags is the obvious way to do it and it
       is wrong in both directions — it misses the <b>, <em>, <code> and <span>
       that real copy is full of, and it claims a <p> that some other rule has
       made unselectable. Two questions instead, cheap one first:

         1. does it own a non-empty text node directly (not via a descendant, or
            every <section> on the page counts and the blade never turns off)
         2. is that text actually selectable

       user-select inherits, so (2) catches the nav, the section numerals and the
       terminal chrome — all of which set it on an ancestor — without naming any
       of them. Which is the point: a blade over text you cannot select is a
       promise the page does not keep. */
    function prose(el) {
      if (!el || el.nodeType !== 1) return false;
      var has = false;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.trim()) { has = true; break; }
      }
      if (!has) return false;
      return getComputedStyle(el).userSelect !== 'none';
    }

    window.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      tx = ev.clientX; ty = ev.clientY;
      dot.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0)';
      if (!ready) { ready = true; doc.body.classList.add('cursor-ready'); }
    }, { passive: true });

    /* Mirrored into plain flags as well as classes, because the press feedback
       for every state except the blade is a scale, and a scale has to be written
       by the follow loop below — see the note at the end of §04's cursor block
       for why it cannot live in the stylesheet. */
    var down = false, sel = false;
    var PRESS = .82;

    window.addEventListener('pointerdown', function () { down = true; doc.body.classList.add('cursor-down'); }, { passive: true });
    window.addEventListener('pointerup', function () { down = false; doc.body.classList.remove('cursor-down'); }, { passive: true });

    // Leaving / re-entering the window
    doc.addEventListener('mouseleave', function () { doc.body.classList.remove('cursor-ready'); });
    doc.addEventListener('mouseenter', function () { if (ready) doc.body.classList.add('cursor-ready'); });

    doc.addEventListener('pointerover', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;

      var labelled = t.closest('[data-cursor]');
      var isText = t.closest(TEXT);
      var isHover = t.closest(HOVER);

      doc.body.classList.toggle('cursor-label', !!labelled);
      doc.body.classList.toggle('cursor-text', !!isText && !labelled);
      doc.body.classList.toggle('cursor-hover', !!isHover && !labelled && !isText);

      /* Last, and only if nothing above claimed the pointer. The order is the
         priority: a link inside a paragraph is a link. */
      sel = !labelled && !isText && !isHover && prose(t);
      doc.body.classList.toggle('cursor-sel', sel);

      if (labelled && label) label.textContent = labelled.dataset.cursor || '';
    }, { passive: true });

    // The ring trails the dot with a light spring.
    (function follow() {
      rx += (tx - rx) * 0.17;
      ry += (ty - ry) * 0.17;
      /* The press scale is composed in HERE and not in the stylesheet. This line
         writes an inline transform every frame, and an inline declaration beats
         any stylesheet rule short of !important — so §04's old
         `body.cursor-down .cursor-ring { transform: scale(.82) }` had never once
         run, and !important would not have saved it either, since it would have
         beaten the translate as well and parked the ring in the corner.
         Skipped while the blade is up: that state answers a press by drawing the
         blade 8px longer, and shrinking it at the same time reads as neither. */
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)' +
                             (down && !sel ? ' scale(' + PRESS + ')' : '');
      requestAnimationFrame(follow);
    })();
  })();


  /* ══ 07 3D tilt ════════════════════════════════════════════ */

  (function tilt() {
    var els = $$('[data-tilt]');
    if (!els.length || !fine || reduce) return;

    var MAX = 7;   // degrees

    els.forEach(function (el) {
      var target = $('.card__inner, .about__card-inner', el) || el;
      var frame = 0;

      el.addEventListener('pointermove', function (ev) {
        if (frame) return;
        frame = requestAnimationFrame(function () {
          frame = 0;
          var r = el.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width - .5;
          var py = (ev.clientY - r.top) / r.height - .5;
          target.style.transform =
            'rotateX(' + (-py * MAX * 2).toFixed(2) + 'deg) ' +
            'rotateY(' + (px * MAX * 2).toFixed(2) + 'deg) ' +
            'translateZ(6px)';
        });
      }, { passive: true });

      el.addEventListener('pointerleave', function () {
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        target.style.transform = '';
      });
    });
  })();


  /* ══ 08 contact form ═══════════════════════════════════════ */

  (function contact() {
    var form = $('#contactForm');
    if (!form) return;

    var status = $('#formStatus');
    var submit = $('#formSubmit');
    var action = form.getAttribute('action') || '';
    var configured = action.indexOf('YOUR_FORMSPREE_ID') === -1 && /^https?:/.test(action);
    var fallback = form.dataset.fallbackEmail || '';

    function say(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form__status' + (kind ? ' is-' + kind : '');
    }

    function fieldError(id, msg) {
      var input = $('#' + id);
      var slot = $('[data-err-for="' + id + '"]');
      if (input) input.closest('.field').classList.toggle('has-err', !!msg);
      if (slot) slot.textContent = msg || '';
      if (input) {
        if (msg) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }

    function validate() {
      var ok = true;
      var name = $('#fName'), email = $('#fEmail'), msg = $('#fMsg');

      if (!name.value.trim()) { fieldError('fName', 'Your name, please.'); ok = false; }
      else fieldError('fName', '');

      var ev = email.value.trim();
      if (!ev) { fieldError('fEmail', 'I need an address to reply to.'); ok = false; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ev)) { fieldError('fEmail', "That doesn't look like an email."); ok = false; }
      else fieldError('fEmail', '');

      if (msg.value.trim().length < 10) { fieldError('fMsg', 'A little more detail — 10 characters minimum.'); ok = false; }
      else fieldError('fMsg', '');

      if (!ok) {
        var first = $('.field.has-err input, .field.has-err textarea');
        if (first) first.focus();
      }
      return ok;
    }

    // Clear a field's error as soon as the user starts fixing it.
    ['fName', 'fEmail', 'fMsg'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('input', function () {
        if (el.closest('.field').classList.contains('has-err')) fieldError(id, '');
      });
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!validate()) { say('Fix the highlighted fields and try again.', 'err'); return; }

      /* Bot trap tripped — pretend everything is fine and drop it. The lie to the
         form is the point and does not change; what is new is that the shell says
         so out loud. The trap has been sitting here since the form was written and
         nothing ever reported it, which meant the one interesting thing this page
         can observe about its own traffic was thrown away silently.

         Nothing is logged and nothing is sent: this is a note to whoever is
         looking, not telemetry. A human filling a `display: none` field has
         either got a very odd autofill or is poking at the form on purpose, and
         either way they have earned the line. */
      if (($('#fHp') || {}).value) {
        say('Thanks — message sent.', 'ok');
        form.reset();
        egg('trap');
        if (window.Terminal) {
          window.Terminal.say('<span class="tl-red">trap:</span> hidden field filled — caught one. ' +
                              '<span class="tl-dim">message dropped, nothing sent.</span>');
        }
        return;
      }

      // No Formspree ID yet: hand off to the user's mail client instead of
      // silently doing nothing.
      if (!configured) {
        var subject = encodeURIComponent($('#fSubject').value.trim() || 'Hello from your portfolio');
        var body = encodeURIComponent(
          $('#fMsg').value.trim() +
          '\n\n— ' + $('#fName').value.trim() + ' (' + $('#fEmail').value.trim() + ')'
        );
        window.location.href = 'mailto:' + fallback + '?subject=' + subject + '&body=' + body;
        say('Opening your mail app… (the form isn\'t wired to a backend yet)', 'busy');
        return;
      }

      submit.setAttribute('disabled', '');
      say('Sending…', 'busy');

      fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            say('Message sent — thanks. I\'ll get back to you.', 'ok');
          } else {
            return res.json().then(function (data) {
              var m = (data && data.errors && data.errors[0] && data.errors[0].message) ||
                      'Something went wrong on the way out.';
              say(m + ' You can also email me directly.', 'err');
            });
          }
        })
        .catch(function () {
          say('Network error. Email me directly at ' + fallback + '.', 'err');
        })
        .then(function () {
          submit.removeAttribute('disabled');
        });
    });
  })();


  /* ══ 09 terminal window ════════════════════════════════════ */

  /* The shell floats over the page instead of sitting in it, and it has three
     states rather than two: open, folded to its title bar, and closed.
     "Stop covering that paragraph" and "I'm done with you" are different
     requests — folding keeps the session, its history and its scrollback
     exactly where they were, closing puts the whole thing away.

     Open is the shipped state: index.html carries `is-open` on the element so
     the window is there whether or not this file ever runs. Everything below
     is about taking it away again and bringing it back.

     On top of those three states there's a fourth thing that can hide it, and
     it isn't a state the visitor chose: above the terminal section the window
     is *stowed*, because the corner it sits in is the corner the hero's torii
     turns in. See the stow block near the bottom of this module. */

  (function termWindow() {
    var win = $('#termWin');
    if (!win) return;

    var launch = $('#termLaunch');
    var bar = $('#termBar');
    var closeB = $('#termClose');
    var minB = $('#termMin');
    var openB = $('#termOpen');
    var openLabel = $('#termOpenLabel');
    var narrow = window.matchMedia('(max-width: 860px)');

    function isOpen()   { return win.classList.contains('is-open'); }
    function isMin()    { return win.classList.contains('is-min'); }
    function isStowed() { return doc.body.classList.contains('term-stowed'); }

    /* Three separate ways for this window not to be in front of you, and
       "visible" has to mean none of them: closed, folded to its title bar, or
       stowed because you haven't scrolled down to it yet. terminal.js asks
       this before it types its intro, so getting it wrong plays the whole
       sequence out to an empty corner — once, unrepeatably. */
    function isVisible() { return isOpen() && !isMin() && !isStowed(); }

    /* Never pull focus on a narrow screen: the window is docked to the bottom
       edge there, so raising the on-screen keyboard would cover the very
       output that was just asked for. Tap the prompt instead.

       Deferred a frame because the prompt lives inside .term__body, which is
       hidden with `visibility` while folded — focus() aimed at an element
       whose visibility is still resolving does nothing at all, silently. */
    function focusPrompt() {
      if (narrow.matches || !window.Terminal) return;
      requestAnimationFrame(function () { window.Terminal.focus(); });
    }

    // The launcher and the window are inverses — exactly one is ever on screen.
    function sync() {
      var open = isOpen();
      if (launch) {
        launch.classList.toggle('is-shown', !open);
        launch.setAttribute('aria-expanded', String(open));
      }
      if (minB) {
        minB.setAttribute('aria-expanded', String(!isMin()));
        minB.setAttribute('aria-label', isMin() ? 'Expand terminal' : 'Collapse terminal');
      }
      if (openLabel) openLabel.textContent = open ? 'Focus terminal' : 'Open terminal';
    }

    /* Deliberately not in sync(): sync() also runs at init, while the boot
       overlay is still in front of everything, and kicking the intro there
       would play it out behind the curtain. Only the paths that actually put
       the window in front of someone release it — opening, unfolding, and
       un-stowing. (terminal.js also kicks it itself on boot:done, but its own
       guard means that only lands when the window is already visible as the
       curtain lifts, which now takes a page that loaded below the hero.) */
    function releaseWelcome() {
      if (isVisible() && window.Terminal) window.Terminal.welcome();
    }

    function open() {
      /* First, before is-open goes back on: if the samurai is mid-cut, take the
         cut down. His close holds a cloned half-card and two clip-paths on this
         element for about a second while the pieces fall off the screen, and
         `body:not(.term-stowed) .termwin.is-open` outranks his .is-sliced — so
         opening on top of a strike in flight would restore a full-opacity window
         that is still sliced into two falling halves. abort() is idempotent and a
         no-op when nothing is pending; it dismisses first and tears down after,
         which is why this has to run before the class rather than after it. */
      if (window.Samurai && window.Samurai.abort) window.Samurai.abort();
      win.classList.add('is-open');
      win.classList.remove('is-min');
      /* Being asked outranks where you are on the page. Nothing in the UI can
         reach this from inside the hero — the pill is stowed too, and the chips
         and the Open button are both down in the terminal section — but open()
         is a public method, and a window that silently ignores it is a worse
         bug than one that turns up somewhere unexpected. The observer stows it
         again at the next crossing. */
      stow(false);
      /* Whatever the scroll position had decided, the visitor has now decided
         otherwise — so the page gives up its claim on the window's size and
         won't unfold it again on the next crossing as if it were its own work.
         See the fold block near the end of this module. */
      autoFolded = false;
      sync();
      releaseWelcome();
      focusPrompt();
    }

    function close() {
      if (!isOpen()) return;
      /* Note what had focus first, hide, then move it — in that order.

         The launcher is hidden with `visibility` while the window is open, and
         you cannot focus a visibility:hidden element: focusing it *before*
         sync() reveals it silently does nothing, and the focus ring is then
         stranded inside a window that is about to disappear. Which sends the
         next Tab back to the top of the document. */
      var hadFocus = win.contains(doc.activeElement);
      win.classList.remove('is-open');
      sync();
      if (hadFocus && launch) requestAnimationFrame(function () { launch.focus(); });
    }

    /* `quiet` means "the page did this, not the visitor" — see the fold block
       further down. A scroll-driven fold or unfold must not pull the caret
       across the screen or raise a keyboard, so quiet skips focusPrompt(). The
       focus *rescue* in collapse() is not optional either way: folding hides
       .term__body with `visibility`, and a focus ring left inside it is blurred
       by the engine, which sends the next Tab back to the top of the document.
       Public callers pass nothing and get the loud version, which is right —
       every one of them is a click or a typed command. Only expand() needs the
       flag: folding never wants focus, it only ever gives it back. */
    function collapse() {
      if (!isOpen() || isMin()) return;
      if (win.contains(doc.activeElement) && minB) minB.focus();
      win.classList.add('is-min');
      sync();
    }

    function expand(quiet) {
      win.classList.remove('is-min');
      if (!quiet) autoFolded = false;          // see the note in open()
      sync();
      releaseWelcome();
      if (!quiet) focusPrompt();
    }

    if (closeB) closeB.addEventListener('click', close);
    if (minB) {
      minB.addEventListener('click', function () {
        if (isMin()) expand(); else collapse();
      });
    }
    if (openB) openB.addEventListener('click', open);
    if (launch) launch.addEventListener('click', open);

    /* Clicking the title bar unfolds. Deliberately one-way: folding on a bar
       click as well would mean every slightly-missed click on the way to
       `clear` collapses the thing you were reading. */
    if (bar) {
      bar.addEventListener('click', function (ev) {
        if (ev.target.closest('button')) return;
        if (isMin()) expand();
      });
    }

    /* Esc is already spoken for twice — the matrix rain claims it in
       terminal.js, the mobile nav menu claims it in module 02 above — so this
       handler has to know its place.

       It listens on the capture phase for one specific reason: terminal.js
       stops the rain on the bubble phase, so by the time a bubble handler here
       ran, MatrixFX.on would already be false and the same keypress that
       cleared the rain would also close the window. On capture we still see
       the pre-stop state and correctly stand down. */
    doc.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !isOpen()) return;
      if (window.MatrixFX && window.MatrixFX.on) return;        // the rain gets this one
      // Only from inside the window. Esc elsewhere on the page shouldn't
      // dismiss something the visitor may not even be looking at.
      if (!win.contains(ev.target) && !win.contains(doc.activeElement)) return;
      /* Esc is the ✕ button by another route, so it gets the same sword — folded
         or not. It deliberately does NOT check isMin(): samurai.js used to refuse
         a folded window and this matched it, but the peek bar is cut too now, and
         two paths to the same dismissal that animate differently is just a bug
         with a comment on it. samurai.js::foldCut() owns that geometry.

         window.Samurai — the whole animation is one deletable <script> tag, and
         that promise is only true if every caller checks. Delete the tag and
         this line falls through to a plain, instant close().

         The return value is the contract, not a courtesy: strike() answers false
         whenever it will not be taking the dismissal on — he is switched off, the
         sheets have not decoded yet, prefers-reduced-motion — and then the close
         below still happens, on this same keypress. Esc never fails to shut the
         window. A second Esc during the wind-up cuts the ceremony short rather
         than queueing another one, which is strike()'s job and it already does
         it. Runway 0 to match the button: there is no dead time to run through
         here the way terminal.js has after a typed `exit`. */
      if (window.Samurai && window.Samurai.strike &&
          window.Samurai.strike('close', 0)) return;
      close();
    }, true);

    /* ── stowed until you reach the terminal section ──────────────
       The corner this window lives in is the corner the hero's torii turns in,
       and at 540×418 it took out the gate's lower-right quadrant — the right
       pillar and the near end of the kasagi. So above #terminal the shell is
       put away: CSS hides it off a class on <body>, the state classes are left
       untouched, and scrolling back up stows it again.

       That last part is why this is a separate layer rather than a close():
       is-open and is-min still mean what they meant, so whatever state you
       left the window in is the state you get back on the way down — and a
       window you closed stays closed instead of being reopened by a scroll. */
    var STOW_AT = .62;
    var home = $('#terminal');

    function stow(on) {
      if (on === isStowed()) return;
      doc.body.classList.toggle('term-stowed', on);
      /* Arriving is the only direction with anything to do. The intro was held
         back while there was nothing to watch it on, so let it play now — it
         types itself out as the window slides in, which is a better first
         impression than a shell that was already talking to an empty corner.
         Not focusPrompt(), though: the visitor scrolled, they didn't ask for
         the keyboard. */
      if (!on) releaseWelcome();
    }

    /* Where the line is: #terminal's top edge coming up past 62% of the
       viewport height. Late enough that the gate has scrolled clear of the
       corner before anything lands on it — at 1686×822 its lowest point is
       ~90px above the window's top edge at the moment this fires — and early
       enough that the window is already there by the time the heading is.

       Read off the rect rather than off isIntersecting, because isIntersecting
       also goes false at the far end, when the terminal section leaves through
       the top of the screen. "The terminal section or after" includes
       everything below it, and a negative top is still past the line.

       Sampling only on crossings is safe, which is all an observer offers: a
       crossing is the only moment the answer can change. Resize included — the
       test below is the observer's own intersection test with the bottom
       clause dropped, and dropping it can only ever hold the answer at true. */
    function past(rect) { return rect.top <= window.innerHeight * STOW_AT; }

    /* ── folded once you've left the terminal section ─────────────
       Stowing solved the hero. The rest of the page is the other half of the
       same problem: a 600×500 window parked in the corner of #contact is
       sitting on the contact form, and #path, and the ID card, whatever the
       stylesheet reserves for it — reserving 654px of every section for a
       window that is only that wide in one of them costs more page than the
       layout can pay (see §18).

       So the window is full size in the section that is about it, and folded
       to its 240px title bar everywhere below. That is what --term-rail is
       sized for. Still open, still unclosed, session and scrollback intact —
       one click on the bar brings it back, and the rail means it has room to
       come back into.

       "At the terminal section" is measured off the section's *content* box —
       its .wrap — and not off the section itself. The section carries --sp-sec
       of block padding, 152px at desktop, so by the time its own bottom edge
       leaves the screen the next section's heading is already a third of the
       way down and has been sitting under a full-size window the whole time.
       Watching the content instead puts the fold exactly on the seam: the hint
       line goes off the top, the window folds, #about's heading arrives to a
       clear page. Generous enough that the chips that drive the window are
       never folded away while you're still looking at them.

       autoFolded is the difference between "the page folded this" and "the
       visitor folded this". Only a fold we performed gets undone on the way
       back up — expand it by hand at #work and it stays expanded until you
       leave the section boundary again, which is a scroll you meant. */
    var autoFolded = false;
    var homeBody = home && home.querySelector('.wrap');

    /* The width at which the terminal section can afford to reserve the whole
       600px rather than the folded 240px — §18 in the stylesheet keys the same
       number. Below it the window stays folded even in its own section, because
       a 654px rail at 1024px leaves a 290px column and the eight command chips
       don't fit in it. Folded there means the chips are never underneath the
       window they operate, which is the right way round to fail. */
    var roomy = window.matchMedia('(min-width: 1281px)');

    function onScreen(rect) { return rect.bottom > 0 && rect.top < window.innerHeight; }

    function fold(here) {
      /* Below 861px the window is a full-width strip docked to the bottom edge
         and it already arrives folded — there is no rail to fold into and
         nothing here to do. */
      if (narrow.matches) return;
      /* Full size in exactly one place, and only where the page has room to
         reserve for it. Everything else — every other section, and every width
         below 1281px including the terminal section itself — is folded. */
      if (here && roomy.matches) {
        if (autoFolded) { autoFolded = false; expand(true); }
      } else if (isOpen() && !isMin()) {
        autoFolded = true;
        collapse();
      }
    }

    /* Resizing across either breakpoint lands you in the next regime holding
       the previous one's shape. Re-deciding on change is enough: the crossing
       is the only moment the answer can change, same argument as the observers
       below. */
    var reFold = function () {
      fold(homeBody ? onScreen(homeBody.getBoundingClientRect()) : true);
    };
    [narrow, roomy].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener('change', reFold);
      else if (mq.addListener) mq.addListener(reFold);         // Safari < 14
    });

    if (home && 'IntersectionObserver' in window) {
      /* Measured synchronously first. The observer's opening callback lands a
         frame or two later, and on a second visit in the same session the boot
         overlay has been skipped and isn't there to cover the gap — long
         enough to watch the window flash into the hero's corner and then be
         taken away again.

         Synchronous isn't sufficient on its own, though. `is-open` ships in the
         markup, so stowing at boot reads as a state change and the exit
         transition plays: the window fades down out of the corner over .34s,
         which is the same flash by a slower route. So the first one is a cold
         start — transitions off (see §10 in the stylesheet), reflow to commit
         the hidden values as the resting state, transitions back on at the next
         frame. Everything after this animates.

         The reflow is what makes one frame enough: style is resolved while
         term-cold still applies, so by the time the class comes off there is no
         longer a change left to interpolate.

         The fold below has exactly the same problem and the same answer, which
         is why the cold class now wraps both: land on #contact from a shared
         link and the shipped full-size window would fold itself over .34s
         while you watch. So the initial reading of *both* signals happens
         cold, whichever way each one lands. */
      doc.body.classList.add('term-cold');
      if (!past(home.getBoundingClientRect())) stow(true);
      if (homeBody) fold(onScreen(homeBody.getBoundingClientRect()));
      void win.offsetWidth;
      requestAnimationFrame(function () { doc.body.classList.remove('term-cold'); });

      new IntersectionObserver(function (entries) {
        stow(!past(entries[entries.length - 1].boundingClientRect));
      }, { rootMargin: '0px 0px -' + Math.round((1 - STOW_AT) * 100) + '% 0px' })
        .observe(home);

      /* A second observer rather than another answer off the first one: they
         watch different elements. Stowing is about where the section's top edge
         is relative to a line 62% down the screen, folding is about whether the
         section's content is on screen at all — and no rootMargin on one target
         produces both crossings. Full root here, threshold 0: the crossing is
         the content's last pixel leaving the top, which is exactly the seam. */
      if (homeBody) {
        new IntersectionObserver(function (entries) {
          fold(entries[entries.length - 1].isIntersecting);
        }).observe(homeBody);
      }
    }

    /* On a phone the window docks to the bottom edge, and a 46vh panel over a
       390px-wide hero isn't "present on screen", it's in the way. So it
       arrives folded: the title bar is there as soon as it arrives — still
       present, still unclosed — and one tap opens it. */
    if (narrow.matches) win.classList.add('is-min');
    sync();

    window.TermWindow = {
      open: open,
      close: close,
      collapse: collapse,
      expand: expand,
      isOpen: isOpen,
      isStowed: isStowed,
      isVisible: isVisible
    };
  })();


  /* ══ 10 odds and ends ══════════════════════════════════════ */

  // footer year
  var yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();

  // live session uptime on the ID card
  var up = $('#uptime');
  if (up) {
    var tick = function () {
      up.textContent = window.__termUptime ? window.__termUptime() : '—';
    };
    tick();
    setInterval(tick, 1000);
  }

  // Anchor clicks: close any open menu and respect reduced motion.
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = doc.getElementById(id.slice(1));
      if (!target) return;
      ev.preventDefault();
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      // move focus for keyboard users without yanking the scroll position
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ══ 11 easter eggs ════════════════════════════════════════ */

  /* The page half of the hunt. The shell's half lives in js/terminal.js and the
     samurai's in js/samurai.js; js/eggs.js is the scoreboard all three report
     into and the only file that knows how many there are.

     TWO RULES HOLD EVERYWHERE IN HERE.

     One: every call into the counter goes through egg() below, which is guarded,
     so deleting eggs.js from index.html turns the scoreboard off and leaves every
     egg working. Nothing in this section may depend on it existing.

     Two: nothing here may cost anything when it is not firing. That rules out the
     obvious implementations — no rAF loops, no listeners on mousemove, no
     observers. What is left is a handful of keydown and pointer handlers that do
     an integer comparison and return, which is the price of the whole section.

     And they all keep out of text fields. Someone typing "aryan" into the contact
     form is filling in their name, not casting a spell. */
  function egg(id) { return !!(window.Eggs && window.Eggs.found(id)); }

  function typing(ev) {
    var t = ev.target;
    if (!t) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable;
  }

  // Konami code → matrix rain. Because of course.
  (function konami() {
    var seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
               'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var at = 0;
    doc.addEventListener('keydown', function (ev) {
      // don't swallow arrow keys while someone is typing
      if (typing(ev)) return;

      at = (ev.key === seq[at] || ev.key.toLowerCase() === seq[at]) ? at + 1 : 0;
      if (at === seq.length) {
        at = 0;
        egg('konami');
        if (window.MatrixFX) window.MatrixFX.toggle();
      }
    });
  })();

  /* ── say the name ──────────────────────────────────────────────
     Type `aryan` anywhere that is not a text field and the hero glitches hard,
     then the portrait inside the letters resolves for two seconds. See "say the
     name" in §05 of the stylesheet for the two properties that do the work.

     A rolling buffer rather than an index, because an index has to decide what to
     do about a wrong key: reset to 0 loses `aaryan`, and reset to 1 loses more
     interesting cases. Keeping the last five characters and comparing has no such
     decision in it. Five characters is also the entire memory cost. */
  (function name() {
    var want = 'aryan';
    var buf = '';
    var hero = $('.hero__title .glitch') || $('.glitch');
    doc.addEventListener('keydown', function (ev) {
      if (typing(ev) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (!ev.key || ev.key.length !== 1) return;
      buf = (buf + ev.key.toLowerCase()).slice(-want.length);
      if (buf !== want) return;
      buf = '';
      egg('name');
      if (!hero || reduce) return;
      /* Not scrolled into view on purpose. Yanking the page to the top because
         somebody typed five letters is the site taking over, and anyone who has
         just typed his name at the hero is looking at the hero already. */
      hero.classList.add('is-glitching', 'is-named');
      setTimeout(function () { hero.classList.remove('is-glitching'); }, 440);
      setTimeout(function () { hero.classList.remove('is-named'); }, 2200);
    });
  })();

  /* ── nothing to see ───────────────────────────────────────────
     Ctrl+A. The footer's transparent line is revealed by ::selection with no help
     from here — this only notices and scores it.

     Both the shortcut and a real drag-selection count, which is why this listens
     for `selectionchange` as well and checks whether the ghost line is inside the
     range. Cheap: selectionchange only fires while somebody is actually
     selecting, and the body of it is one containsNode call. */
  (function selection() {
    var ghost = $('.ghost');
    doc.addEventListener('keydown', function (ev) {
      if (typing(ev)) return;
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'a' || ev.key === 'A')) egg('selection');
    });
    if (!ghost || !doc.addEventListener) return;
    doc.addEventListener('selectionchange', function () {
      var s = window.getSelection && window.getSelection();
      if (!s || s.isCollapsed || !s.containsNode) return;
      if (s.containsNode(ghost, true)) egg('selection');
    });
  })();

  /* ── counting up ──────────────────────────────────────────────
     Click the kanji numeral above a heading and it counts 零壱弐参肆伍陸 and
     settles back on its own. Seven swaps at 90ms, then the original glyph.

     Whatever the numeral was is read off the element at click time and put back
     at the end, so this cannot be wrong about which section it is on and does not
     need a table of six answers. The is-counting class only exists to warm the
     colour to red; the stylesheet transitions it, so there is no timing here.

     Guarded against being clicked again mid-count, which would otherwise leave
     the second run's restore writing whatever the first run happened to be
     showing at the time. */
  (function kanji() {
    var CYCLE = ['零', '壱', '弐', '参', '肆', '伍', '陸'];
    $$('.sec__num').forEach(function (num) {
      var glyph = num.querySelector('i');
      if (!glyph) return;
      var running = false;
      num.addEventListener('click', function (ev) {
        /* The <i> only. The eyebrow's rule and its Arabic digits are not a
           target, and §11's cursor:pointer is on the <i> for the same reason. */
        if (ev.target !== glyph || running) return;
        running = true;
        egg('kanji');
        var was = glyph.textContent;
        num.classList.add('is-counting');
        var i = 0;
        (function step() {
          if (i < CYCLE.length) {
            glyph.textContent = CYCLE[i++];
            setTimeout(step, reduce ? 0 : 90);
            return;
          }
          glyph.textContent = was;
          num.classList.remove('is-counting');
          running = false;
        })();
      });
    });
  })();

  /* ── the tube warms up ────────────────────────────────────────
     Triple-click the background. `detail` on a click event is the browser's own
     multi-click counter, so this needs no timing logic of its own and matches
     whatever the platform considers a triple click.

     "The background" means not on anything. Anchors, buttons, form fields and the
     terminal are all excluded — a triple click inside a paragraph is somebody
     selecting it, and a triple click on the shell is somebody selecting a line of
     output. That leaves the section padding and the page margins, which is where
     you click when you are prodding at a page to see what it does. */
  (function crt() {
    var busy = false;
    doc.addEventListener('click', function (ev) {
      if (ev.detail < 3 || busy) return;
      var t = ev.target;
      if (!t || !t.closest) return;
      if (t.closest('a, button, input, textarea, select, label, .termwin, .termlaunch, .nav')) return;
      busy = true;
      egg('crt');
      if (reduce) { busy = false; return; }
      doc.documentElement.classList.add('is-crt');
      setTimeout(function () {
        doc.documentElement.classList.remove('is-crt');
        /* Held past the class coming off, for the length of the stylesheet's own
           .4s ramp down. Re-triggering during the fade would add the class back
           mid-transition and the crank would appear to stutter rather than
           restart. */
        setTimeout(function () { busy = false; }, 450);
      }, 5000);
    });
  })();

  /* ── four corners ─────────────────────────────────────────────
     The Konami code for a phone: tap the four corners clockwise from the top
     left, and the same rain falls. This exists because every other key-driven egg
     on this page is unreachable on a touch device, and a hunt with a counter that
     cannot be finished on the machine most people will read this on is a hunt with
     a bug in it.

     A corner is a 15%-of-the-shorter-side square, floored at 64px and capped at
     140px: proportional so it is the same gesture on a phone and a monitor,
     floored so it is still hittable with a thumb, capped so it does not become a
     quarter of a small laptop screen.

     Six seconds between taps or the sequence resets — long enough to be
     deliberate, short enough that four unrelated taps over a minute of reading do
     not accumulate into it by accident. */
  (function corners() {
    var at = 0;
    var last = 0;
    doc.addEventListener('pointerdown', function (ev) {
      var w = window.innerWidth, h = window.innerHeight;
      var size = Math.max(64, Math.min(140, Math.min(w, h) * 0.15));
      var left = ev.clientX <= size, right = ev.clientX >= w - size;
      var top = ev.clientY <= size, bottom = ev.clientY >= h - size;
      /* Clockwise from the top left. Index into this, so the check is one
         comparison and the order is readable rather than a switch. */
      var hit = [top && left, top && right, bottom && right, bottom && left];
      var now = ev.timeStamp || 0;
      if (now - last > 6000) at = 0;
      if (!hit[at]) {
        /* A tap on the FIRST corner restarts rather than resets — otherwise
           tapping top-left twice puts you back to zero instead of one, and that
           is the mistake everybody makes when they lose count. */
        at = hit[0] ? 1 : 0;
        last = now;
        return;
      }
      at++;
      last = now;
      if (at < 4) return;
      at = 0;
      egg('corners');
      if (window.MatrixFX) window.MatrixFX.toggle();
    }, { passive: true });
  })();

  /* ── held down ────────────────────────────────────────────────
     Press and hold the terminal button for 700ms and it opens with a command you
     have not tried yet already at the prompt, waiting for Enter. eggs.js::hint()
     picks it, because eggs.js is where the list lives; see the note on `cmd`
     there for the three eggs that are deliberately never offered.

     700ms is past every platform's long-press threshold and well short of anyone
     who is simply slow on the mouse. The hold is cancelled by pointerup,
     pointercancel, pointerleave and scrolling — a press that turns into a drag or
     a scroll is not a press.

     THE ORDINARY CLICK MUST STILL WORK, which is the only fiddly part. The button
     already has a click handler that opens the window; on a long press this opens
     it early and then has to stop that handler from running as well, or the second
     open would steal focus back and wipe the prefill. suppress + a capture
     listener does it, and it is scoped to the one event immediately after the
     hold. */
  (function longpress() {
    var HOLD = 700;
    ['#termLaunch', '#termOpen'].forEach(function (sel) {
      var btn = $(sel);
      if (!btn) return;
      var timer = 0;
      var suppress = false;

      var cancel = function () { clearTimeout(timer); timer = 0; };

      btn.addEventListener('pointerdown', function () {
        cancel();
        timer = setTimeout(function () {
          timer = 0;
          suppress = true;
          egg('longpress');
          if (window.TermWindow) window.TermWindow.open();
          var cmd = window.Eggs ? window.Eggs.hint() : 'eggs';
          /* After the open, not before: open() focuses the input itself, and a
             prefill written first would be focused over. 60ms is one frame plus
             slack, which is all the class change needs. */
          setTimeout(function () {
            if (window.Terminal && window.Terminal.prefill) window.Terminal.prefill(cmd);
            if (window.Terminal && window.Terminal.say) {
              window.Terminal.say('<span class="tl-dim">held down — try this one. press Enter.</span>');
            }
          }, 60);
        }, HOLD);
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (e) {
        btn.addEventListener(e, cancel);
      });
      addEventListener('scroll', cancel, { passive: true });

      btn.addEventListener('click', function (ev) {
        if (!suppress) return;
        suppress = false;
        ev.preventDefault();
        ev.stopPropagation();
      }, true);
    });
  })();

  /* ══ 12 résumé viewer ══════════════════════════════════════ */

  /* Clicking Resume used to drop a PDF in your downloads folder and show you
     nothing. Now it shows you the PDF and puts the download underneath it, which
     is the actual request: read first, keep it if you want it.

     Everything this module owns is in index.html's `.rv` block and style.css §10c.
     It exposes window.ResumeView so js/terminal.js's `resume` command can open the
     same panel — one viewer, three ways in (hero button, contact block, shell).

     THREE THINGS THIS HAS TO GET RIGHT, none of them the panel itself.

     One: the PDF must not be fetched until asked for. The <object> ships with no
     `data` attribute and gets one on first open, so a visitor who never clicks
     Resume never pays for it. Note what is NOT here: any code deciding whether the
     embed worked. That was written — inspect the frame after load, see if anything
     rendered — and it got the answer wrong in both directions on two different
     builds of the same browser. The <object>'s fallback content does the job
     natively and correctly, so the script's whole job here is one attribute.

     Two: Esc. It is spoken for three times on this page already — the mobile
     menu, the terminal window (module 09, on the capture phase, gated on the
     event being inside .termwin), and MatrixFX in js/terminal.js. This one is
     also on capture and stops propagation, so the top layer wins and closing the
     résumé cannot also close the terminal behind it. The terminal's gate means it
     would not have fired anyway; belt and braces, because that gate is one
     refactor away from not being true.

     Three: focus. Opening moves focus into the panel, Tab is trapped inside it, and
     closing puts focus back on whatever opened it — including when the opener was
     a command typed in the shell, in which case there is no button to return to
     and the shell's input is the right answer. That last case is why `open()`
     takes the opener rather than reading document.activeElement. */
  (function () {
    var rv = $('#resumeView');
    if (!rv) return;

    var frame  = $('#rvFrame');
    var panel  = rv.querySelector('.rv__panel');
    var closer = $('#rvClose');
    var url    = (window.PORTFOLIO && window.PORTFOLIO.resumeUrl) || 'assets/resume.pdf';

    var open = false;
    var opener = null;
    var loaded = false;

    // Every link on the page pointing at the file, kept in step with data.js.
    $$('[data-resume], #rvGet, #rvTab').forEach(function (a) {
      if (a.tagName === 'A') a.href = url;
    });

    /* The tab order inside the panel, recomputed per Tab rather than cached,
       because it genuinely changes: the <object> is a tab stop only once a
       plugin has taken it over, and whether that happens is the browser's
       decision, made after this module has finished running. */
    function stops() {
      return [].filter.call(
        panel.querySelectorAll(
          'a[href], button, object, iframe, [tabindex]:not([tabindex="-1"])'),
        function (el) { return !el.hasAttribute('hidden') && el.offsetParent !== null; });
    }

    /* The whole of the loading logic, and it is one line on purpose. Setting
       `data` is the request; everything after it belongs to the browser. If it
       can render a PDF it renders one, and if it cannot it lays out the children
       instead — no `load` handler to wait for, no timeout to guess at, nothing
       here that can be wrong about which of those happened. */
    function load() {
      if (loaded) return;
      loaded = true;
      frame.setAttribute('data', url);
    }

    function openView(from) {
      if (open) return;
      open = true;
      opener = from || null;
      rv.hidden = false;
      doc.body.classList.add('is-locked');
      load();
      /* Two frames, not one. Removing [hidden] and adding .is-open in the same
         frame gives the browser a single style resolution and no transition — the
         element goes straight to its end state. rAF twice is the reliable way to
         land them in separate frames. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { rv.classList.add('is-open'); });
      });
      closer.focus({ preventScroll: true });
    }

    function closeView() {
      if (!open) return;
      open = false;
      rv.classList.remove('is-open');
      doc.body.classList.remove('is-locked');
      /* Hidden only after the fade, or it vanishes instead of leaving. Matches
         §10c's 300ms and does not need to be exact — early would cut the fade,
         late only delays a display:none nobody can see. */
      setTimeout(function () { if (!open) rv.hidden = true; }, reduce ? 130 : 340);
      if (opener && opener.focus) {
        opener.focus({ preventScroll: true });
        /* An opener can stop being focusable while the panel is up. The one that
           actually does it is the shell: `resume` hands over #termInput, and if
           the window folds in the meantime that input is inside a collapsed body
           and refuses focus. Silently, of course — focus() on an unfocusable
           element is a no-op, not an error. Left there, the panel goes
           display:none a third of a second later with focus still inside it,
           which drops it on <body> and restarts Tab at the top of the document.
           So: check it took, and land on the button that opens this same panel
           if it did not. */
        if (doc.activeElement !== opener) {
          var alt = $('[data-resume]');
          if (alt) alt.focus({ preventScroll: true });
        }
      }
      opener = null;
    }

    // The page's own buttons. Plain left-click only: cmd/ctrl/middle-click and
    // "save link as" keep working on the href, which is the point of the <a>.
    $$('[data-resume]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
        ev.preventDefault();
        openView(a);
      });
    });

    closer.addEventListener('click', function () { closeView(); });
    $('#rvScrim').addEventListener('click', function () { closeView(); });

    /* Capture, and it stops there — see note three above. */
    doc.addEventListener('keydown', function (ev) {
      if (!open) return;
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        ev.preventDefault();
        closeView();
        return;
      }
      if (ev.key !== 'Tab') return;
      var f = stops();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      /* activeElement is the <iframe> while focus is inside the PDF, so this also
         correctly treats "somewhere in the document" as "on the frame". */
      var at = doc.activeElement;
      if (ev.shiftKey && (at === first || !panel.contains(at))) {
        ev.preventDefault(); last.focus();
      } else if (!ev.shiftKey && at === last) {
        ev.preventDefault(); first.focus();
      }
    }, true);

    /* Downloading is not leaving. Without this, clicking Download closes nothing
       and looks like it did nothing on browsers that download silently — so say
       so, in the one place the eye already is. */
    var get = $('#rvGet');
    if (get) get.addEventListener('click', function () {
      var span = get.querySelector('span');
      if (!span || get.dataset.said) return;
      get.dataset.said = '1';
      var was = span.textContent;
      span.textContent = 'Saved ↓';
      setTimeout(function () {
        span.textContent = was;
        delete get.dataset.said;
      }, 1800);
    });

    window.ResumeView = {
      open: function (from) { openView(from); },
      close: closeView,
      isOpen: function () { return open; },
      url: url
    };
  })();

  /* ── read the source ──────────────────────────────────────────
     The console half of the view-source breadcrumb; index.html carries the other
     half in a comment at the top of the file. Between them they name `unmask`,
     which appears nowhere in the UI, is excluded from tab-completion and from
     did-you-mean, and is therefore findable exactly one way: by looking.

     Deferred to a macrotask so it lands after everything else this file logs, and
     wrapped because a console with %c support is not guaranteed — a browser that
     ignores the directives prints the format string with a couple of stray %c in
     it, which is ugly, and a browser without console.log at all would throw. */
  setTimeout(function () {
    if (!window.console || !console.log) return;
    try {
      var left = window.Eggs ? window.Eggs.left() : 0;
      var total = window.Eggs ? window.Eggs.total() : 0;
      console.log(
        '%c零と壱より生まれる%c\n' +
        'You opened the console. That is the kind of thing I hire for.\n\n' +
        '  Open the terminal on this page and run %cunmask%c — it is not in help,\n' +
        '  it is not in tab-completion, and this is the only place it is written down.\n' +
        (total ? '  Then run %ceggs%c. ' + (left ? left + ' of ' + total + ' still hidden.' : 'You have all ' + total + '.') + '\n' : '%c%c') +
        '\n  aryanverma102007@gmail.com · /.well-known/security.txt',
        'color:#ff3b53;font:600 15px/1.6 ui-monospace,monospace;letter-spacing:.18em',
        'color:#8b93a7;font:13px/1.7 ui-monospace,monospace',
        'color:#4ade80;font:600 13px/1.7 ui-monospace,monospace',
        'color:#8b93a7;font:13px/1.7 ui-monospace,monospace',
        'color:#4ade80;font:600 13px/1.7 ui-monospace,monospace',
        'color:#8b93a7;font:13px/1.7 ui-monospace,monospace'
      );
    } catch (e) {}
  }, 0);
})();
