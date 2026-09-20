/* ═══════════════════════════════════════════════════════════════
   eggs.js — the scoreboard

   There were already a dozen easter eggs on this site and no way to know it.
   That is the actual problem this file solves: a joke nobody can tell is there
   is a joke that gets found by accident, once, by one person. A counter turns
   the same jokes into something you can be *finishing*.

   So this is deliberately not a feature. It holds a list of names and a set of
   the ones you have hit, in localStorage, and it is the only thing on the page
   that knows how many there are in total. Everything else — terminal commands,
   key sequences, the samurai, the 404 — just calls found('id') and carries on.
   None of them import this or check for it; see `found` below for why that has
   to stay true.

   ORDER: loaded FIRST, before terminal.js and main.js, because both of them
   call into it during their own setup. It has no dependencies of its own — not
   even data.js — so first is a position it can actually hold.

   Kill switch: delete the <script> tag. Every call site is guarded, so the eggs
   all still work; you just stop being told about them.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Versioned, so that adding eggs later never has to migrate anything: if the
     shape of what is stored ever changes, bump this and every visitor silently
     starts a fresh hunt rather than reading last version's format and throwing
     inside a try that then swallows it. */
  var KEY = 'aryan.eggs.v1';

  /* ── the list ─────────────────────────────────────────────────
     `how` is the spoiler — printed by `eggs all` and by the line for an egg you
     have already found, never for one you have not. Written as an instruction
     rather than as a description for exactly that reason: once it is on screen
     it is a walkthrough, so it may as well be a usable one.

     Ten of these predate the counter. Wiring them in was the point — a hunt
     that starts at 0/15 when the site already had ten things to find would be
     under-selling it, and someone who typed `hack` on their first visit has
     genuinely found an egg and should be told so.

     `cmd` is optional and is NOT a duplicate of `how`: it is the bare string a
     long-press on the terminal button pre-types into the prompt, so it exists
     only where a single command is the whole answer. `patience` has none because
     it is `sudo` three times and there is no one line for that; `secret` points
     at `ls` because that is the step that reveals the next one. Three have none
     on purpose: `unmask`, whose entire point is that the word appears nowhere in
     the UI and so cannot be typed into the UI by a hint, and `trap` and
     `notfound`, which are not commands at all. */
  var LIST = [
    /* the shell */
    { id: 'matrix',    where: 'shell',   name: 'katakana rain',   how: 'matrix', cmd: 'matrix' },
    { id: 'hack',      where: 'shell',   name: 'the intrusion',   how: 'hack', cmd: 'hack' },
    { id: 'sudo',      where: 'shell',   name: 'not a sudoer',    how: 'sudo', cmd: 'sudo' },
    { id: 'patience',  where: 'shell',   name: 'answered in steel', how: 'sudo, three times' },
    { id: 'vim',       where: 'shell',   name: 'no way out',      how: 'vim', cmd: 'vim' },
    { id: 'coffee',    where: 'shell',   name: 'I am a teapot',   how: 'coffee', cmd: 'coffee' },
    { id: '42',        where: 'shell',   name: 'the Answer',      how: '42', cmd: '42' },
    { id: 'rmrf',      where: 'shell',   name: 'permission denied', how: 'rm -rf /', cmd: 'rm -rf /' },
    { id: 'secret',    where: 'shell',   name: 'the shadow line', how: 'ls, then cat .secret', cmd: 'ls' },
    { id: 'recon',     where: 'shell',   name: 'the toolkit',     how: 'nmap localhost — or any tool named in 03 参', cmd: 'nmap localhost' },
    { id: 'fortune',   where: 'shell',   name: 'a proverb',       how: 'fortune', cmd: 'fortune' },
    { id: 'sl',        where: 'shell',   name: 'not a locomotive', how: 'sl — the ls typo', cmd: 'sl' },
    { id: 'spar',      where: 'shell',   name: 'the whole page',  how: 'spar', cmd: 'spar' },
    { id: 'unmask',    where: 'shell',   name: 'read the source', how: 'the name is only in the page source' },
    /* the page */
    { id: 'konami',    where: 'page',    name: 'the old code',    how: '↑ ↑ ↓ ↓ ← → ← → b a' },
    { id: 'name',      where: 'page',    name: 'say the name',    how: 'type aryan anywhere outside a text field' },
    { id: 'crt',       where: 'page',    name: 'the tube warms up', how: 'triple-click the background' },
    { id: 'corners',   where: 'page',    name: 'four corners',    how: 'tap the four screen corners, clockwise from top-left' },
    { id: 'kanji',     where: 'page',    name: 'counting up',     how: 'click a section numeral — the 01 壱 above a heading' },
    { id: 'selection', where: 'page',    name: 'nothing to see',  how: 'select the whole page (Ctrl+A)' },
    { id: 'longpress', where: 'page',    name: 'held down',       how: 'press and hold the ❯_ TERMINAL button' },
    { id: 'trap',      where: 'page',    name: 'caught one',      how: 'fill the contact form’s hidden field and send' },
    /* him */
    { id: 'poke',      where: 'samurai', name: 'do not poke him', how: 'click the samurai. keep clicking' },
    { id: 'doze',      where: 'samurai', name: 'off duty',        how: 'leave the terminal open and do nothing for a minute and a half' },
    /* the rest of the site */
    { id: 'notfound',  where: 'elsewhere', name: 'cut off',       how: 'ask for a page that does not exist' }
  ];

  /* Ranks are cosmetic, and they are cheap the way the whole file is cheap: the
     point is that 7/25 has somewhere to go. Thresholds are fractions of the
     list so adding eggs cannot strand anybody at a rank they already passed. */
  var RANKS = [
    [0,   '見物人', 'onlooker'],
    [.15, '新入り', 'newcomer'],
    [.35, '弟子',   'apprentice'],
    [.6,  '手練れ', 'skilled hand'],
    [.85, '達人',   'adept'],
    [1,   '影',     'shadow']
  ];

  /* ── storage ──────────────────────────────────────────────────
     Every read and write goes through these two, and both swallow. localStorage
     throws on access — not on use, on *access* — in Safari's private mode and
     wherever third-party storage is walled off, and an exception here would
     take down whatever egg was reporting itself. A visitor with storage
     disabled gets a counter that resets on reload, which is a worse hunt and a
     working site; the other order round is not a trade worth making. */
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return {};
      var arr = JSON.parse(raw);
      if (!arr || typeof arr.length !== 'number') return {};
      var set = {};
      for (var i = 0; i < arr.length; i++) set[String(arr[i])] = true;
      return set;
    } catch (e) { return {}; }
  }

  function write(set) {
    try {
      var arr = [];
      for (var k in set) if (set[k]) arr.push(k);
      window.localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  /* Held in memory as well as in storage, so a session with storage blocked
     still counts within itself, and so that a hunt in two tabs does not have
     each tab reading a stale copy on every single call. */
  var got = read();

  function known(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return null;
  }

  /* ── the one function that matters ────────────────────────────
     Returns true only the FIRST time an egg is reported, so a call site can
     treat it as "is this news" and say something extra. Most do not bother.

     It must never throw and must never care whether the id is real. Every call
     site is a joke in the middle of doing something else — a keydown handler, a
     terminal command, a click on a sprite — and none of them should be able to
     break because this file was edited. An unknown id is recorded anyway: it
     costs one string in localStorage and it means renaming an egg here can
     never silently stop counting it out there. */
  function found(id) {
    if (!id) return false;
    id = String(id);
    var fresh = !got[id];
    got[id] = true;
    if (fresh) write(got);
    return fresh;
  }

  function count() {
    var n = 0;
    for (var i = 0; i < LIST.length; i++) if (got[LIST[i].id]) n++;
    return n;
  }

  function rank() {
    var f = LIST.length ? count() / LIST.length : 0;
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) if (f >= RANKS[i][0]) r = RANKS[i];
    return { jp: r[1], en: r[2] };
  }

  /* A copy, with `got` folded in. Callers get to render this however they like
     — the terminal prints it, and nothing else currently reads it — but nobody
     gets a handle on the live list or the live set. */
  function list() {
    var out = [];
    for (var i = 0; i < LIST.length; i++) {
      out.push({ id: LIST[i].id, where: LIST[i].where, name: LIST[i].name,
                 how: LIST[i].how, got: !!got[LIST[i].id] });
    }
    return out;
  }

  /* One command you have not tried yet, for the long-press on the terminal
     button to pre-type. Only from entries that have a `cmd` — see the note on
     LIST for the three that deliberately do not.

     Falls back to 'eggs' rather than to nothing when there is nothing left to
     hint at, which is the right answer twice over: it is a real command, and
     somebody holding the button down after finding everything is asking to be
     shown the scoreboard. */
  function hint() {
    var pool = [];
    for (var i = 0; i < LIST.length; i++) {
      if (LIST[i].cmd && !got[LIST[i].id]) pool.push(LIST[i].cmd);
    }
    if (!pool.length) return 'eggs';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  window.Eggs = {
    found: found,
    has: function (id) { return !!got[id]; },
    list: list,
    count: count,
    total: function () { return LIST.length; },
    rank: rank,
    hint: hint,
    /* For the console banner, which wants to say how many are left without
       naming any of them. */
    left: function () { return LIST.length - count(); },
    reset: function () { got = {}; write(got); }
  };
})();
