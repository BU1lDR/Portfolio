/* ═══════════════════════════════════════════════════════════════
   terminal.js — "Born of 1s & 0s" 「零と壱より生まれる」

   An interactive shell. Everything it prints comes from
   js/data.js, so you update your details in one place.

   Keys:  ↑ / ↓ history · Tab complete · Ctrl+L clear · Ctrl+C abort
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var P = window.PORTFOLIO || {};
  var prof = P.profile || {};

  var screen = document.getElementById('termScreen');
  var form   = document.getElementById('termForm');
  var input  = document.getElementById('termInput');
  var chips  = document.getElementById('termChips');
  var clearB = document.getElementById('termClear');

  if (!screen || !form || !input) return;

  var history = [];
  var hIdx = -1;          // -1 == editing a fresh line
  var draft = '';
  var busy = false;
  var timers = [];

  /* ── output primitives ────────────────────────────────────── */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function out(html, cls) {
    var d = document.createElement('div');
    d.className = 'tl-line ' + (cls || 'tl-out');
    d.innerHTML = html;
    screen.appendChild(d);
    return d;
  }

  function gap() {
    var d = document.createElement('div');
    d.className = 'tl-gap';
    screen.appendChild(d);
  }

  function rule() {
    out('─'.repeat(46), 'tl-rule');
  }

  function scrollDown() {
    screen.scrollTop = screen.scrollHeight;
  }

  /** Print an array of lines with a stagger, locking input meanwhile. */
  function seq(lines, step, done) {
    busy = true;
    // Only hand focus back if we took it — otherwise the intro sequence
    // would yank focus (and the scroll position) the moment it plays.
    var hadFocus = document.activeElement === input;
    input.setAttribute('disabled', '');
    var i = 0;
    (function tick() {
      if (i >= lines.length) {
        busy = false;
        input.removeAttribute('disabled');
        if (hadFocus) input.focus();
        if (done) done();
        return;
      }
      var l = lines[i++];
      if (l === null) gap(); else out(l[0], l[1]);
      scrollDown();
      timers.push(setTimeout(tick, step));
    })();
  }

  function abort() {
    timers.forEach(clearTimeout);
    timers = [];
    busy = false;
    input.removeAttribute('disabled');
  }

  /* ── formatting helpers ───────────────────────────────────── */

  /* Wraps a list of short strings into terminal-width lines, so a group
     of nine tools doesn't run off the right edge on a phone. */
  function columns(items, indent, width) {
    var lines = [];
    var line = '';
    items.forEach(function (it) {
      var piece = (line ? '  ' : '') + it;
      if (line && (line + piece).length > width) { lines.push(line); line = it; }
      else { line += piece; }
    });
    if (line) lines.push(line);
    return lines.map(function (l) { return indent + l; });
  }

  function pad(s, n) {
    s = String(s);
    return s + ' '.repeat(Math.max(0, n - s.length));
  }

  function link(url, label) {
    if (!url) return '<span class="tl-dim">—</span>';
    var safe = esc(url);
    return '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">' +
           esc(label || url) + '</a>';
  }

  function kv(k, v) {
    return '<span class="tl-key">' + pad(k, 12) + '</span>' + v;
  }

  /* ── commands ─────────────────────────────────────────────── */

  var CMDS = {

    help: {
      desc: 'list every command',
      run: function () {
        out('Available commands <span class="tl-jp">— 使えるコマンド</span>', 'tl-hi');
        gap();
        var names = Object.keys(CMDS).filter(function (n) { return !CMDS[n].hidden; }).sort();
        names.forEach(function (n) {
          out(kv(n, '<span class="tl-out">' + CMDS[n].desc + '</span>'));
        });
        gap();
        /* Tell people about controls they actually have. All four of the
           keyboard hints below are keyboard-only: a phone has no arrow keys,
           no Tab, no Ctrl and no Esc, so on touch that line advertised four
           things that do not exist while the two that do — the `clear` button
           and the red dot — went unmentioned.

           The markup already draws this distinction: the ↹/↑ hint beside the
           input (.term__hintkey) is display:none under 860px, and .term__peek
           picks its English half from (hover: hover) rather than from a width.
           Only this JS-printed line was unguarded.

           Asked per call, not cached at load, because the answer can change
           under the page's feet — a 2-in-1 folding into tablet mode, or a
           desktop window being driven by touch. `help` is typed rarely enough
           that one matchMedia call costs nothing. */
        if (window.matchMedia('(pointer: coarse)').matches) {
          out('Tap <b>clear</b> to wipe the screen · the red dot closes this window · the amber one folds it', 'tl-dim');
        } else {
          out('↑/↓ history · Tab complete · Ctrl+L clear · Esc closes the window', 'tl-dim');
        }
        out('A few commands are not on this list. Poke around.', 'tl-dim');
      }
    },

    whoami: {
      desc: 'who is this',
      run: function () {
        out(esc(prof.name || 'Unknown') + ' <span class="tl-dim">— ' + esc(prof.title || '') + '</span>', 'tl-hi');
        out('<span class="tl-jp">' + esc(prof.tagline || '') + '</span>');
        gap();
        (prof.bio || []).forEach(function (l) { out(esc(l) || '&nbsp;'); });
        gap();
        out(kv('location', esc(prof.location || '—')));
        out(kv('status', '<span class="tl-key">' + esc(prof.status || '—') + '</span>'));
      }
    },

    about: { desc: 'the longer story', run: function () { CMDS.whoami.run(); } },

    skills: {
      desc: 'what I work with',
      run: function (args) {
        var groups = P.skills || [];
        var want = (args[0] || '').toLowerCase();
        var shown = 0;

        groups.forEach(function (g) {
          if (want && g.group.toLowerCase().indexOf(want) === -1) return;
          shown++;
          out('<span class="tl-red">▸</span> <span class="tl-hi">' + esc(g.group) + '</span>');
          // items are plain strings — no ratings, same as the page
          columns(g.items, '  ', 52).forEach(function (l) {
            out('<span class="tl-out">' + esc(l) + '</span>');
          });
          gap();
        });

        if (!shown) {
          out('No skill group matching "' + esc(want) + '".', 'tl-err');
          out('Try: ' + groups.map(function (g) { return g.group.toLowerCase(); }).join(', '), 'tl-dim');
          return;
        }
        if (!want && (P.also || []).length) {
          out(kv('also', '<span class="tl-out">' + esc((P.also || []).join(', ')) + '</span>'));
        }
      }
    },

    projects: {
      desc: 'things I built',
      run: function () {
        var list = P.projects || [];
        if (!list.length) { out('No projects listed yet.', 'tl-dim'); return; }
        list.forEach(function (p, i) {
          out('<span class="tl-red">' + pad('[' + (i + 1) + ']', 5) + '</span>' +
              '<span class="tl-hi">' + esc(p.name) + '</span>' +
              '<span class="tl-dim">  ' + esc(p.year || '') + '</span>');
          out('     ' + esc(p.blurb || ''));
          out('     <span class="tl-key">' + esc((p.stack || []).join(' · ')) + '</span>');
          var ls = [];
          if (p.live) ls.push(link(p.live, 'live'));
          if (p.code) ls.push(link(p.code, 'code'));
          if (ls.length) out('     ' + ls.join('<span class="tl-dim">  |  </span>'));
          // nothing to link to yet — say why instead of showing a bare gap
          else if (p.note) out('     <span class="tl-dim">' + esc(p.note) + '</span>');
          gap();
        });
        out('Scroll to the Work section for the visual version.', 'tl-dim');
      }
    },

    work: { desc: 'alias for projects', hidden: true, run: function () { CMDS.projects.run(); } },

    experience: {
      desc: 'where I have worked',
      run: function () {
        var list = P.experience || [];
        if (!list.length) { out('Nothing listed yet.', 'tl-dim'); return; }
        list.forEach(function (e) {
          out('<span class="tl-red">' + esc(e.when) + '</span>  <span class="tl-hi">' + esc(e.what) + '</span>');
          out('  ' + esc(e.where));
          if (e.note) out('  <span class="tl-dim">' + esc(e.note) + '</span>');
          gap();
        });
      }
    },

    education: {
      desc: 'where I studied',
      run: function () {
        var list = P.education || [];
        if (!list.length) { out('Nothing listed yet.', 'tl-dim'); return; }
        list.forEach(function (e) {
          out('<span class="tl-red">' + esc(e.when) + '</span>  <span class="tl-hi">' + esc(e.what) + '</span>');
          out('  ' + esc(e.where));
          if (e.note) out('  <span class="tl-dim">' + esc(e.note) + '</span>');
          gap();
        });
      }
    },

    certs: {
      desc: 'certifications',
      run: function () {
        var list = P.certifications || [];
        if (!list.length) { out('Nothing listed yet.', 'tl-dim'); return; }
        list.forEach(function (c) {
          out('<span class="tl-key">✓</span> <span class="tl-hi">' + esc(c.what) + '</span>');
          // Date on the issuer line rather than its own — eleven entries at
          // three lines each scrolls the window twice over.
          out('  <span class="tl-dim">' + esc(c.issuer) +
              (c.when ? ' · ' + esc(c.when) : '') + '</span>');
        });
        if (P.certsVerify) {
          gap();
          out(kv('verify', link(P.certsVerify, P.certsVerify)));
        }
      }
    },

    certifications: { desc: 'alias for certs', hidden: true, run: function () { CMDS.certs.run(); } },

    path: {
      desc: 'education + experience',
      run: function () {
        out('EDUCATION', 'tl-hi'); rule(); CMDS.education.run(); gap();
        out('EXPERIENCE', 'tl-hi'); rule(); CMDS.experience.run(); gap();
        out('CERTIFICATIONS', 'tl-hi'); rule(); CMDS.certs.run();
      }
    },

    contact: {
      desc: 'how to reach me',
      run: function () {
        out(kv('email', link('mailto:' + (prof.email || ''), prof.email || '—')));
        (P.socials || []).forEach(function (s) {
          if (s.key === 'email') return;
          out(kv(s.key, link(s.url, s.url)));
        });
        gap();
        out('Or use the form in the Contact section — it reaches the same inbox.', 'tl-dim');
      }
    },

    socials: { desc: 'alias for contact', hidden: true, run: function () { CMDS.contact.run(); } },
    links:   { desc: 'alias for contact', hidden: true, run: function () { CMDS.contact.run(); } },
    email:   { desc: 'just the email', hidden: true,
      run: function () { out(link('mailto:' + (prof.email || ''), prof.email || '—')); } },

    /* This used to trigger a download and print a line about it, which meant the
       one command people actually run gave them a file and no way to look at it.
       It opens the viewer now — main.js module 12, the same panel the Resume
       buttons on the page open — and the download lives inside that.

       The fallback is the old behaviour, not an error. ResumeView is gone if
       main.js failed to load or if this ever runs on a page without the panel in
       it (404.html has a shell on it too), and in that case handing over the file
       is still better than refusing. */
    resume: {
      desc: 'open the résumé',
      run: function () {
        var url = P.resumeUrl || 'assets/resume.pdf';
        var RV = window.ResumeView;
        if (RV && RV.open) {
          out('opening ' + esc(url) + ' …');
          /* The input is handed in as the thing to return focus to when the panel
             closes — there is no button to go back to when the way in was typed. */
          RV.open(input || null);
          return out('Esc closes it. The download is at the bottom of the box.', 'tl-dim');
        }
        out('fetching ' + esc(url) + ' …');
        var a = document.createElement('a');
        a.href = url;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        a.remove();
        out('If nothing downloaded, the PDF is not in place yet — see ' +
            link('assets/', 'assets/') + '.', 'tl-dim');
      }
    },

    ls: {
      desc: 'list files',
      run: function () {
        out('<span class="tl-key">about.txt</span>      ' +
            '<span class="tl-key">skills.json</span>    ' +
            '<span class="tl-red">projects/</span>');
        out('<span class="tl-key">contact.md</span>     ' +
            '<span class="tl-key">certs.md</span>       ' +
            '<span class="tl-key">resume.pdf</span>');
        out('<span class="tl-dim">.secret</span>');
      }
    },

    cat: {
      desc: 'read a file — try: cat about.txt',
      run: function (args) {
        var f = (args[0] || '').toLowerCase();
        switch (f) {
          case 'about.txt':   return CMDS.whoami.run();
          case 'skills.json': return CMDS.skills.run([]);
          case 'contact.md':  return CMDS.contact.run();
          case 'certs.md':    return CMDS.certs.run();
          case 'resume.pdf':
            out('cat: resume.pdf: binary file', 'tl-err');
            return out('Try <span class="tl-key">resume</span> — it opens the thing.', 'tl-dim');
          case '.secret':
            egg('secret');
            out('<span class="tl-jp">影の中で構築する。</span>', 'tl-red');
            out('"Build in the shadows." Nothing here but a nice sentence.', 'tl-dim');
            return;
          case '':
            return out('cat: missing operand. Try <span class="tl-key">ls</span> first.', 'tl-err');
          default:
            return out('cat: ' + esc(f) + ': No such file or directory', 'tl-err');
        }
      }
    },

    neofetch: {
      desc: 'system info, the fun way',
      run: function () {
        var art = P.art || [];
        var info = [
          '<span class="tl-red tl-hi">' + esc(prof.handle || 'aryan') + '@' + esc(prof.host || 'shadow') + '</span>',
          '<span class="tl-rule">' + '─'.repeat(20) + '</span>',
          kv('Name', esc(prof.name || '—')),
          kv('Role', esc(prof.title || '—')),
          kv('OS', 'Human 22.x (Arch, btw)'),
          kv('Shell', 'bash 5.2'),
          kv('Editor', 'VS Code · vim for the quick stuff'),
          kv('Region', esc(prof.location || '—')),
          kv('Certs', (P.certifications || []).length +
                      ' <span class="tl-dim">(run <span class="tl-key">certs</span>)</span>'),
          kv('Uptime', uptimeText()),
          kv('Status', '<span class="tl-key">' + esc(prof.status || '—') + '</span>'),
          kv('Theme', 'night 夜 <span class="tl-dim">(the only one)</span>')
        ];

        var wrapEl = document.createElement('div');
        wrapEl.className = 'tl-neo';
        wrapEl.innerHTML =
          '<pre class="tl-neo__art">' + art.map(esc).join('\n') + '</pre>' +
          '<div class="tl-neo__info">' +
            info.map(function (l) { return '<div class="tl-line">' + l + '</div>'; }).join('') +
          '</div>';
        screen.appendChild(wrapEl);
      }
    },

    banner: {
      desc: 'the big letters',
      run: function () {
        var art =
          ' █████╗ ██████╗ ██╗   ██╗ █████╗ ███╗   ██╗\n' +
          '██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗████╗  ██║\n' +
          '███████║██████╔╝ ╚████╔╝ ███████║██╔██╗ ██║\n' +
          '██╔══██║██╔══██╗  ╚██╔╝  ██╔══██║██║╚██╗██║\n' +
          '██║  ██║██║  ██║   ██║   ██║  ██║██║ ╚████║\n' +
          '╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝';
        var pre = document.createElement('pre');
        pre.className = 'tl-art';
        pre.textContent = art;
        screen.appendChild(pre);
        out('<span class="tl-jp">零と壱より生まれる</span> — born of 1s &amp; 0s', 'tl-dim');
      }
    },

    matrix: {
      desc: 'it had to be here',
      run: function () {
        if (!window.MatrixFX) return out('matrix: renderer unavailable', 'tl-err');
        egg('matrix');
        var on = window.MatrixFX.toggle();
        out(on ? 'Wake up… <span class="tl-dim">(run <span class="tl-key">matrix</span> again, or press Esc)</span>'
               : 'Back to reality.');
      }
    },

    goto: {
      desc: 'jump to a section — goto work',
      run: function (args) {
        var ids = ['home', 'terminal', 'about', 'skills', 'work', 'path', 'contact'];
        var t = (args[0] || '').toLowerCase();
        if (ids.indexOf(t) === -1) {
          out('goto: unknown section "' + esc(t) + '"', 'tl-err');
          return out('Sections: ' + ids.join(', '), 'tl-dim');
        }
        var el = document.getElementById(t);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        out('→ ' + t);
      }
    },

    date: {
      desc: 'my local time',
      hidden: true,
      run: function () {
        var d = new Date();
        out(d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' }) +
            ' <span class="tl-dim">IST</span>');
      }
    },

    echo: {
      desc: 'say it back',
      hidden: true,
      run: function (args) { out(esc(args.join(' ')) || '&nbsp;'); }
    },

    history: {
      desc: 'what you typed',
      hidden: true,
      run: function () {
        if (!history.length) return out('No history yet.', 'tl-dim');
        history.forEach(function (h, i) {
          out('<span class="tl-dim">' + pad(i + 1, 4) + '</span>' + esc(h));
        });
      }
    },

    pwd:   { desc: 'print working directory', hidden: true,
      run: function () { out('/home/' + esc(prof.handle || 'aryan')); } },

    uname: { desc: 'system name', hidden: true,
      run: function () { out('Portfolio 1.0 (static; html/css/js; no framework)'); } },

    clear: { desc: 'wipe the screen', run: function () { screen.innerHTML = ''; } },

    exit: {
      desc: 'close this window',
      run: function () {
        // Only a real command if there is a window to close. main.js owns the
        // window; if it never loaded, fall back to the old joke.
        if (!window.TermWindow) {
          return out('There is no exit. <span class="tl-dim">Just scroll.</span>');
        }
        out('Closing session… <span class="tl-dim">reopen with the ❯_ button, bottom right.</span>');
        // Long enough to read the line you just triggered — and long enough for
        // the guard on the roof to run the length of the window first. He
        // commits the close himself, on the frame the blade lands, so the delay
        // is the same 700ms either way. If he is switched off, absent, or
        // standing down (reduced motion, small screens, hidden tab) he says so
        // and we close it ourselves as before.
        if (window.Samurai && window.Samurai.strike('close', 700)) return;
        setTimeout(function () { window.TermWindow.close(); }, 700);
      }
    },

    quit:  { desc: 'alias for exit', hidden: true, run: function () { CMDS.exit.run(); } },
    close: { desc: 'alias for exit', hidden: true, run: function () { CMDS.exit.run(); } },

    minimise: {
      desc: 'fold the window to its title bar',
      run: function () {
        if (!window.TermWindow) return out('Nothing to fold — this shell is inline.', 'tl-dim');
        out('Folded. <span class="tl-dim">Click the title bar to unfold.</span>');
        // Same arrangement as `exit` above: the guard fills the 620ms if he can.
        if (window.Samurai && window.Samurai.strike('min', 620)) return;
        setTimeout(function () { window.TermWindow.collapse(); }, 620);
      }
    },
    minimize: { desc: 'alias for minimise', hidden: true, run: function () { CMDS.minimise.run(); } },

    /* ── the scoreboard ─────────────────────────────────────────
       Deliberately NOT hidden. Every other egg on this site is invisible until
       you trip over it, which for ten of them meant they were found once, by
       accident, by one person. One visible line in `help` is what turns them
       into something a visitor knows to look for — so this command is the egg
       that makes the rest of them worth having. */

    eggs: {
      desc: 'how many you have found',
      run: function (args) {
        if (!window.Eggs) return out('eggs: no scoreboard loaded.', 'tl-err');
        var all = window.Eggs.list();
        var n = window.Eggs.count(), t = window.Eggs.total();
        var r = window.Eggs.rank();
        var spoil = /^(all|-a|--all|spoil|list)$/i.test(args[0] || '');

        out('<span class="tl-jp">卵</span> <b>' + n + ' / ' + t + '</b> found' +
            '  <span class="tl-dim">·  ' + r.jp + ' <i>' + r.en + '</i></span>', 'tl-hi');
        /* A 24-cell bar, so progress is legible without counting the list. */
        var fill = t ? Math.round(n / t * 24) : 0;
        out('<span class="tl-red">' + '█'.repeat(fill) + '</span>' +
            '<span class="tl-dim">' + '░'.repeat(24 - fill) + '</span>', 'tl-out');
        gap();

        var groups = [['shell', 'in this shell'], ['page', 'on the page'],
                      ['samurai', 'the guard'], ['elsewhere', 'elsewhere']];
        groups.forEach(function (g) {
          var mine = all.filter(function (e) { return e.where === g[0]; });
          var mineGot = mine.filter(function (e) { return e.got; }).length;
          if (!mine.length) return;
          out('<span class="tl-key">' + pad(g[1], 15) + '</span>' +
              '<span class="tl-dim">' + mineGot + '/' + mine.length + '</span>');
          mine.forEach(function (e) {
            /* The `how` is printed for an egg you have already found — it is not
               a spoiler once you have seen it, and it is the only record of what
               you did. For one you have not, the row is a blank you can count
               but not read. */
            if (e.got) {
              out('  <span class="tl-red">✓</span> ' + pad(esc(e.name), 22) +
                  '<span class="tl-dim">' + esc(e.how) + '</span>');
            } else if (spoil) {
              out('  <span class="tl-dim">·</span> ' + pad(esc(e.name), 22) +
                  '<span class="tl-dim">' + esc(e.how) + '</span>', 'tl-dim');
            } else {
              out('  <span class="tl-dim">·  ????</span>', 'tl-dim');
            }
          });
          gap();
        });

        if (n === t) {
          out('That is all of them. <span class="tl-jp">見事</span> — nicely done.', 'tl-hi');
        } else if (!spoil) {
          out('<span class="tl-dim">' + (t - n) + ' left. <span class="tl-key">eggs all</span> ' +
              'if you would rather just be told.</span>', 'tl-dim');
        }
      }
    },

    /* ── easter eggs ───────────────────────────────────────── */

    sudo: {
      desc: 'nice try',
      hidden: true,
      run: function () {
        /* Three strikes, and the third is not a joke about permissions. The
           counter is per-session on purpose: it resets on reload, so the
           escalation is something you do in one sitting rather than something
           that silently arms itself weeks later. */
        sudos++;
        egg('sudo');
        if (sudos < 3) {
          out(esc(prof.handle || 'aryan') + ' is not in the sudoers file.', 'tl-err');
          out('This incident has been reported. <span class="tl-dim">(it has not)</span>', 'tl-dim');
          if (sudos === 2) out('<span class="tl-dim">Asking again will not change the file.</span>', 'tl-dim');
          return;
        }
        sudos = 0;
        out('This incident <b>has</b> been reported.', 'tl-err');
        /* Handed to the guard rather than closed here, so it is the same 150ms
           contact frame and the same kesa-giri as ✕ — see `exit` above. If he
           cannot perform, the joke still lands and the window still goes. */
        if (window.Samurai && window.Samurai.strike('close', 620)) { egg('patience'); return; }
        out('<span class="tl-dim">…he is off duty. Consider yourself lucky.</span>', 'tl-dim');
        egg('patience');
        if (window.TermWindow) setTimeout(function () { window.TermWindow.close(); }, 620);
      }
    },

    hack: {
      desc: 'purely cosmetic',
      hidden: true,
      run: function () {
        egg('hack');
        seq([
          ['<span class="tl-key">[*]</span> initialising…'],
          ['<span class="tl-key">[*]</span> reticulating splines…'],
          ['<span class="tl-key">[*]</span> bypassing the mainframe…'],
          ['<span class="tl-key">[*]</span> enhancing the enhance…'],
          null,
          ['<span class="tl-red">[!]</span> ACCESS GRANTED', 'tl-hi'],
          null,
          ['Just kidding. This is a portfolio, not a payload.', 'tl-dim'],
          ['Try <span class="tl-key">projects</span> for things I actually built.', 'tl-dim']
        ], 320);
      }
    },

    vim: {
      desc: 'you know how this goes',
      hidden: true,
      run: function () {
        egg('vim');
        out('vim: opened. You are now trapped. <span class="tl-dim">:q! … :q!! … please</span>');
      }
    },

    coffee: {
      desc: '',
      hidden: true,
      run: function () {
        egg('coffee');
        out('☕ brewing… <span class="tl-jp">コーヒー</span> — HTTP 418, I am a teapot.');
      }
    },

    '42': {
      desc: '',
      hidden: true,
      run: function () { egg('42'); out('The Answer. Still looking for the Question.'); }
    },

    /* ── the toolkit answers to its own names ───────────────────
       Section 03 参 lists nine security tools. Typing one of them here is the
       one egg on this site that cannot be found by guessing: you have to have
       actually read the skills list. That makes it the best-aimed thing in the
       file — it rewards attention rather than trivia, and the visitor it rewards
       is the one who was reading carefully enough to matter.

       All of the output is fabricated and says so. A portfolio that prints a
       plausible-looking real scan of anything is a portfolio making a claim it
       cannot support. */

    nmap: {
      desc: '',
      hidden: true,
      run: function (args) {
        egg('recon');
        var target = (args.join(' ') || 'localhost').replace(/^-\S+\s*/, '') || 'localhost';
        seq([
          ['Starting Nmap 7.95 ( <span class="tl-dim">https://nmap.org</span> ) against ' +
           '<span class="tl-key">' + esc(target) + '</span>'],
          ['Nmap scan report for ' + esc(target) + ' (127.0.0.1)'],
          ['Host is up (0.000091s latency).'],
          null,
          ['<span class="tl-key">PORT     STATE     SERVICE</span>'],
          ['80/tcp   open      http      <span class="tl-dim">this, but plaintext</span>'],
          ['443/tcp  open      https     <span class="tl-dim">this</span>'],
          ['22/tcp   filtered  ssh       <span class="tl-red">no shell for you</span>'],
          ['3306/tcp closed    mysql     <span class="tl-dim">there is no database</span>'],
          ['1337/tcp open      ' + esc(prof.handle || 'aryan') +
           '     <span class="tl-dim">you are already talking to it</span>'],
          null,
          ['Nmap done: 1 host up, 1 honest port, scanned in 0.04s'],
          ['<span class="tl-dim">All of the above is made up. It is a static page on a CDN.</span>', 'tl-dim']
        ], 190);
      }
    },

    sqlmap: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        seq([
          ['[<span class="tl-key">INFO</span>] testing connection to the target URL'],
          ['[<span class="tl-key">INFO</span>] testing if the target is protected by a WAF'],
          ['[<span class="tl-red">WARN</span>] no parameter found to test'],
          ['[<span class="tl-red">WARN</span>] no form found to test'],
          ['[<span class="tl-red">WARN</span>] no database found to be injected into'],
          null,
          ['There is nothing to inject. Every byte here is static.', 'tl-hi'],
          ['<span class="tl-dim">Which is the boring answer, and also the correct defence.</span>', 'tl-dim']
        ], 260);
      }
    },

    burp: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        out('Proxy listening on 127.0.0.1:8080. <span class="tl-dim">Intercept is on.</span>');
        out('You will find: one GET for the page, one for the CSS, five sprite sheets,');
        out('and nothing at all from the contact form — it hands off to your mail');
        out('client, so there is no request to catch. That is the whole conversation.');
        out('<span class="tl-dim">Repeater will be very quiet.</span>');
      }
    },

    hydra: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        out('Hydra v9.5 starting…');
        out('[<span class="tl-red">ERROR</span>] no login form on target', 'tl-err');
        out('There is no account to brute-force. <span class="tl-dim">There is no account.</span>', 'tl-dim');
      }
    },

    wireshark: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        out('Capturing on <span class="tl-key">any</span> …');
        out('<span class="tl-dim">All of it is TLS 1.3 to github.io. You are welcome to look;</span>');
        out('<span class="tl-dim">you will see the size of my stylesheet and nothing else.</span>');
      }
    },

    shodan: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        out('<span class="tl-key">bu1ldr.github.io</span>');
        out(kv('org', 'GitHub, Inc.'));
        out(kv('ports', '80, 443'));
        out(kv('vulns', '<span class="tl-dim">none of mine to claim — it is their infrastructure</span>'));
        out(kv('tags', 'cdn, static, <span class="tl-red">no attack surface</span>'));
      }
    },

    metasploit: {
      desc: '',
      hidden: true,
      run: function () {
        egg('recon');
        seq([
          ['<span class="tl-red">msf6</span> > use exploit/multi/http/portfolio'],
          ['[<span class="tl-red">-</span>] No exploit named that. There is no exploit named that.'],
          null,
          ['A static site has no interpreter to reach. The payload has nowhere', 'tl-hi'],
          ['to land. <span class="tl-dim">This is not me being clever — it is just what HTML is.</span>']
        ], 300);
      }
    },
    msfconsole: { desc: '', hidden: true, run: function () { CMDS.metasploit.run([]); } },

    /* ── proverbs ───────────────────────────────────────────────
       Filler, and it knows it. It is here because `fortune` is the first thing a
       certain kind of visitor types into any prompt that looks like a shell, and
       "command not found" is a worse answer than a proverb. */

    fortune: {
      desc: '',
      hidden: true,
      run: function () {
        egg('fortune');
        var f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
        out('<span class="tl-jp tl-red">' + f[0] + '</span>');
        out('<span class="tl-dim">' + esc(f[1]) + '</span>');
        out(esc(f[2]));
      }
    },

    /* ── the ls typo ────────────────────────────────────────────
       On a real box `sl` gives you a steam locomotive, as punishment for
       mistyping `ls`. There is no locomotive here, but there is somebody who
       runs, so he does — right across the whole page and off the far side, on a
       参道 that lays itself down ahead of his feet. */

    sl: {
      desc: '',
      hidden: true,
      run: function () {
        egg('sl');
        if (window.Samurai && window.Samurai.cross()) {
          out('<span class="tl-dim">You meant <span class="tl-key">ls</span>. ' +
              'Something went past instead.</span>');
          return;
        }
        /* He is off duty — reduced motion, a small screen, a closed window, a
           cold cache. The joke degrades to the joke. */
        out('<span class="tl-dim">You meant <span class="tl-key">ls</span>.</span>');
        out('&nbsp;&nbsp;&nbsp;<span class="tl-red">≡≡≡</span>&gt; <span class="tl-dim">(no locomotive available)</span>');
      }
    },

    /* ── the whole page ─────────────────────────────────────────
       The one egg that leaves the terminal. He steps off the window, crosses the
       viewport, and every section heading he passes comes apart along his blade
       and knits back together. See §10c and Samurai.spar(). */

    spar: {
      desc: '',
      hidden: true,
      run: function () {
        egg('spar');
        if (window.Samurai && window.Samurai.spar()) {
          out('<span class="tl-jp">お相手いたす</span> — <span class="tl-dim">watch the headings.</span>');
          return;
        }
        out('He is not going to do that right now.', 'tl-dim');
        out('<span class="tl-dim">Needs an open window, a screen wider than 860px, and motion allowed.</span>', 'tl-dim');
      }
    },

    /* ── the name that is only in the source ────────────────────
       Not in `help`, not in tab completion's useful range, and not guessable:
       the only place the string "unmask" appears to a visitor is the comment at
       the top of index.html and the console banner. Anyone running it opened the
       source of a security portfolio, which is the exact behaviour worth
       rewarding, so this is the one egg that answers with something real. */

    unmask: {
      desc: '',
      hidden: true,
      run: function () {
        var fresh = egg('unmask');
        seq([
          ['<span class="tl-jp tl-red">面を取る</span>'],
          ['You read the source. <span class="tl-dim">Almost nobody does.</span>', 'tl-hi'],
          null,
          ['So, plainly, with the aesthetic switched off for a moment:'],
          null,
          ['I am a second-year B.Tech IT student at ADGIPS, GGSIPU — CGPA 9.04 —'],
          ['and I want a cybersecurity internship. Not a rotation into one: the'],
          ['actual thing. Blue team, red team, detection, tooling, I am not fussy'],
          ['about which, and I would rather be the least experienced person in a'],
          ['competent room than the most in a slow one.'],
          null,
          ['What is actually mine on this page: every line of the HTML, CSS and'],
          ['JS, no framework and no build step. The samurai is CraftPix art and is'],
          ['credited. Everything else I typed.'],
          null,
          [kv('email', link('mailto:' + (prof.email || ''), prof.email || ''))],
          [kv('github', link('https://github.com/BU1lDR', 'github.com/BU1lDR'))],
          [kv('resume', '<span class="tl-key">resume</span> puts it on screen')],
          null,
          ['There is a <span class="tl-key">/.well-known/security.txt</span> too, if you have not been there yet.', 'tl-dim'],
          [fresh ? 'And that was an easter egg. Try <span class="tl-key">eggs</span>.'
                 : 'Try <span class="tl-key">eggs</span> for the rest of them.', 'tl-dim']
        ], 150);
      }
    }
  };

  /* ── proverbs, with the literal reading and then the point ────
     Three lines each: the Japanese, a gloss, and what it is doing here. The
     third line is the only one I wrote. */
  var FORTUNES = [
    ['七転び八起き', 'nana korobi ya oki — fall seven times, get up eight',
     'The standard one. It is standard because it is true.'],
    ['井の中の蛙大海を知らず', 'a frog in a well does not know the ocean',
     'Why I would rather be the least experienced person in a good room.'],
    ['急がば回れ', 'if you are in a hurry, go around',
     'The shortest path through a problem is usually not the first one you see.'],
    ['塵も積もれば山となる', 'even dust, piled up, becomes a mountain',
     'This site is one commit at a time. So is everything else.'],
    ['聞くは一時の恥、聞かぬは一生の恥',
     'asking is a moment of shame; not asking is a lifetime of it',
     'The single most useful thing anybody told me about working with engineers.'],
    ['能ある鷹は爪を隠す', 'the able hawk hides its talons',
     'Stated without comment, on a page with a samurai on it.'],
    ['石の上にも三年', 'three years, even on a rock',
     'Persistence beats intensity. Learned this from CTFs.'],
    ['負けるが勝ち', 'to lose is to win',
     'Every box that beat me taught me more than the ones that did not.']
  ];

  /* Per-session, and reset by a successful escalation. See `sudo`. */
  var sudos = 0;

  /* Report an egg without every call site having to check that the scoreboard
     loaded. Returns true the first time, which two commands use to say
     something extra. */
  function egg(id) {
    return !!(window.Eggs && window.Eggs.found(id));
  }

  /* Commands typed as multi-word phrases, matched before tokenising. */
  var PHRASES = [
    {
      test: /^rm\s+-rf\s+\/?\s*$/i,
      run: function () {
        egg('rmrf');
        out('rm: refusing to remove \'/\': Permission denied', 'tl-err');
        out('Also: this is my portfolio. <span class="tl-dim">Be nice.</span>', 'tl-dim');
      }
    },
    { test: /^cd\b/i, run: function () { out('cd: there is only one directory here, and you are in it.', 'tl-dim'); } },
    { test: /^(hi|hello|hey|yo|namaste)\b/i, run: function () {
        out('こんにちは — hello. Try <span class="tl-key">help</span>.');
      } },
    { test: /^(thanks|thank you|ty)\b/i, run: function () { out('Any time. <span class="tl-jp">どうも</span>'); } },
    // There used to be a `theme` command. Now there is only one theme, but
    // people will still type it — better a straight answer than "not found".
    { test: /^(theme|light\s*mode|dark\s*mode)\b/i, run: function () {
        out('theme: there is only <span class="tl-key">night 夜</span>.');
        out('The dark is the design, not a setting. <span class="tl-dim">Try <span class="tl-key">matrix</span> instead.</span>', 'tl-dim');
      } },
    { test: /^(who are you|what is this)\b/i, run: function () { CMDS.whoami.run(); } }
  ];

  /* ── uptime (session-based; honest and never wrong) ───────── */

  var t0 = Date.now();
  function uptimeText() {
    var s = Math.floor((Date.now() - t0) / 1000);
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    if (h) return h + 'h ' + (m % 60) + 'm';
    if (m) return m + 'm ' + (s % 60) + 's';
    return s + 's';
  }
  window.__termUptime = uptimeText;

  /* ── dispatch ─────────────────────────────────────────────── */

  function echoLine(raw) {
    out('<b>' + esc(prof.handle || 'aryan') + '@' + esc(prof.host || 'shadow') + '</b>' +
        '<i>:~$</i> ' + esc(raw), 'tl-echo');
  }

  function run(raw) {
    var cmd = raw.trim();
    echoLine(cmd);

    if (!cmd) { scrollDown(); return; }

    history.push(cmd);
    hIdx = -1;
    draft = '';

    // multi-word phrases first
    for (var i = 0; i < PHRASES.length; i++) {
      if (PHRASES[i].test.test(cmd)) { PHRASES[i].run(); scrollDown(); return; }
    }

    var parts = cmd.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    if (CMDS[name]) {
      try {
        CMDS[name].run(args);
      } catch (err) {
        out('internal error running "' + esc(name) + '"', 'tl-err');
      }
    } else {
      out('command not found: ' + esc(name), 'tl-err');
      var guess = nearest(name);
      if (guess) out('Did you mean <span class="tl-key">' + guess + '</span>?', 'tl-dim');
      else out('Type <span class="tl-key">help</span> for the list.', 'tl-dim');
    }
    scrollDown();
  }

  /* Same as run(), but waits its turn. Anything triggered from outside the
     prompt — a command chip, the window controller — can land while a
     sequence is still typing, and run() would interleave its output with the
     sequence's. Queued through `timers` so Ctrl+C cancels it too. */
  function runWhenIdle(raw) {
    if (!busy) return run(raw);
    timers.push(setTimeout(function () { runWhenIdle(raw); }, 120));
  }

  /* Commands the shell will run but will never NAME. `unmask` is only worth
     anything if the string is genuinely findable in one place — the comment at
     the top of index.html — and two perfectly innocent features were leaking
     it: Tab on "un" completed it, and the typo suggester offers anything within
     two edits, which includes `mask` and `unmark`. Both now skip this list.

     Kept to commands whose secrecy is the point. The other eggs are hidden from
     `help` but findable by poking around, which is what they are for. */
  var SECRET = { unmask: true };

  function suggestable(c) { return !SECRET[c]; }

  /** Cheap edit-distance so typos get a suggestion. */
  function nearest(word) {
    var best = null, bestD = 3;
    Object.keys(CMDS).forEach(function (c) {
      if (!suggestable(c)) return;
      var d = dist(word, c);
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  function dist(a, b) {
    var m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    var prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  /* ── events ───────────────────────────────────────────────── */

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    var v = input.value;
    input.value = '';
    run(v);
  });

  input.addEventListener('keydown', function (ev) {
    // history
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!history.length) return;
      if (hIdx === -1) { draft = input.value; hIdx = history.length; }
      hIdx = Math.max(0, hIdx - 1);
      input.value = history[hIdx];
      moveCaretEnd();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (hIdx === -1) return;
      hIdx++;
      if (hIdx >= history.length) { hIdx = -1; input.value = draft; }
      else input.value = history[hIdx];
      moveCaretEnd();
      return;
    }

    // tab completion
    if (ev.key === 'Tab') {
      ev.preventDefault();
      var frag = input.value.trim().toLowerCase();
      if (!frag || /\s/.test(frag)) return;
      var hits = Object.keys(CMDS).filter(function (c) {
        return c.indexOf(frag) === 0 && suggestable(c);
      });
      if (hits.length === 1) {
        input.value = hits[0] + ' ';
        moveCaretEnd();
      } else if (hits.length > 1) {
        echoLine(input.value);
        out(hits.join('   '), 'tl-dim');
        // fill in the shared prefix
        var pre = hits.reduce(function (acc, h) {
          var k = 0;
          while (k < acc.length && k < h.length && acc[k] === h[k]) k++;
          return acc.slice(0, k);
        });
        input.value = pre;
        moveCaretEnd();
        scrollDown();
      }
      return;
    }

    // Ctrl+L clear, Ctrl+C abort
    if (ev.ctrlKey && (ev.key === 'l' || ev.key === 'L')) {
      ev.preventDefault();
      screen.innerHTML = '';
      return;
    }
    if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C') && !window.getSelection().toString()) {
      ev.preventDefault();
      abort();
      echoLine(input.value + '^C');
      input.value = '';
      scrollDown();
    }
  });

  function moveCaretEnd() {
    var v = input.value;
    requestAnimationFrame(function () { input.setSelectionRange(v.length, v.length); });
  }

  // Clicking the screen focuses the prompt — unless you're selecting text
  // or clicking a link inside the output.
  screen.addEventListener('mouseup', function (ev) {
    if (window.getSelection().toString()) return;
    if (ev.target.closest && ev.target.closest('a')) return;
    input.focus();
  });

  if (chips) {
    chips.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-cmd]');
      if (!b) return;
      // The chips live down in the page; the shell they drive floats. Open it
      // first, or the command lands in a window nobody can see. Focus is the
      // controller's call, not ours — it knows not to raise a phone keyboard
      // over the output you just asked for.
      if (window.TermWindow) window.TermWindow.open();
      else input.focus();
      runWhenIdle(b.dataset.cmd);
    });
  }

  if (clearB) {
    clearB.addEventListener('click', function () { screen.innerHTML = ''; input.focus(); });
  }

  // Esc kills the matrix rain from anywhere on the page.
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && window.MatrixFX && window.MatrixFX.on) window.MatrixFX.stop();
  });

  /* ── first paint ──────────────────────────────────────────── */

  /* Keep the "N commands" line on the terminal card honest. It is markup in
     index.html and the commands live here, so the two drifted: the page claimed
     35 while help listed 21. Deriving it from the same filter help uses means
     adding a command updates the page and nobody has to remember.

     Same filter, deliberately — !hidden. The aliases and the easter eggs are
     not counted, because help does not list them either and the card is a
     promise about what help will show you. */
  var countEl = document.getElementById('termCmdCount');
  if (countEl) {
    countEl.textContent = Object.keys(CMDS).filter(function (n) {
      return !CMDS[n].hidden;
    }).length;
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var welcome = [
    ['<span class="tl-jp">零と壱より生まれる</span>', 'tl-red'],
    ['Born of 1s &amp; 0s — ' + esc(prof.name || '') + '\'s shell.', 'tl-hi'],
    null,
    ['Type <span class="tl-key">help</span> to see what this thing does.'],
    ['Or start with <span class="tl-key">whoami</span>, <span class="tl-key">projects</span>, <span class="tl-key">skills</span>.'],
    null
  ];

  var fired = false;
  function kick() {
    if (fired) return;
    fired = true;
    if (reduce) welcome.forEach(function (l) { if (l === null) gap(); else out(l[0], l[1]); });
    else seq(welcome, 170);
  }

  /* The intro plays once and can't be replayed, so it has to wait until there
     is something to watch it on. Three separate things can be in the way, and
     main.js's window controller owns all three: the boot overlay is in front
     of everything for the first few seconds, the window arrives folded on
     phones, and it arrives stowed anywhere above the terminal section. Its
     isVisible() accounts for all of them and it calls Terminal.welcome() at
     whichever moment the window actually turns up — opened, unfolded, or
     scrolled to.

     boot:done covers the one case nothing else will: the page loaded already
     below the hero, on a wide screen, so the window is up and unfolded the
     moment the curtain lifts. The timeout is belt and braces for main.js never
     having run — whatever else happens, the screen doesn't stay blank. */
  function kickIfVisible() {
    if (window.TermWindow && !window.TermWindow.isVisible()) return;
    kick();
  }
  window.addEventListener('boot:done', kickIfVisible, { once: true });
  setTimeout(kickIfVisible, 7000);

  /* ── public surface ───────────────────────────────────────────
     Just enough for main.js's window controller to drive the shell without
     reaching into any of the above. */
  window.Terminal = {
    focus: function () { input.focus(); },
    welcome: kick,
    isBusy: function () { return busy; },
    run: runWhenIdle,
    /* Print into the shell without pretending someone typed a command — no
       prompt echo, no history entry. main.js uses it for the bot trap, which
       reports here because the shell is the only place on the page with a voice.
       Queued behind a running sequence for the same reason runWhenIdle is. */
    say: function (html, cls) {
      if (busy) { timers.push(setTimeout(function () { window.Terminal.say(html, cls); }, 120)); return; }
      out(html, cls);
      scrollDown();
    },
    /* Put a command at the prompt without running it. The long-press egg uses
       this, and the distinction from run() is the whole point of having both: a
       command that executes itself is the site showing off, and a command sitting
       at the prompt waiting for Enter is a suggestion. You still press the key.

       The caret has to be moved explicitly. Setting .value programmatically
       leaves it at position 0 in some engines, and a hint you have to press End
       before using is worse than no hint. */
    prefill: function (text) {
      input.value = String(text == null ? '' : text);
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }
  };
})();
