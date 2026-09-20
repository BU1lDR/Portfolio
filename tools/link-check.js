/* link-check.js — every link on the site still points at something.
 *
 *     node tools/link-check.js              # local checks, then the network
 *     node tools/link-check.js --offline    # local checks only, no requests
 *     node tools/link-check.js --net-only   # skip the local pass
 *
 * WHY THIS EXISTS, WITH THE DEFECT THAT PROMPTED IT
 *
 * The Work section's third card and the terminal's `projects` command both
 * linked to github.com/BU1lDR/my_projects/tree/main/file_integrity_checker.
 * That monorepo was split into standalone repos and deleted. Both links became
 * 404s, and stayed that way through a merge, two deploys and a thirteen-suite
 * verification pass that reported zero failures — because not one of those
 * suites asked the other end of a link whether it was still there.
 *
 * That is the shape of the failure. Link rot is invisible from inside the repo:
 * the href is a well-formed string, the anchor renders, the colour is right, and
 * the page throws nothing. Nothing about the bytes on this disk changes when a
 * repo on a server somewhere is renamed or deleted. The only thing that detects
 * it is a request.
 *
 * A deep tree URL is the fragile kind twice over — it dies on a repo rename, a
 * branch rename, OR a directory move, and two of those three are things you do
 * on purpose without thinking about a portfolio.
 *
 * LINK ROT IS TIME-BASED, NOT COMMIT-BASED
 *
 * Which is why this is not in deploy.yml. A check that runs on push tells you
 * about the state of the world at the moment you happened to edit CSS; the repo
 * you deleted last Tuesday goes unnoticed until the next push, whenever that
 * is. Worse, it puts the network on the deploy path — a Credly rate-limit or a
 * GitHub blip would then block publishing a typo fix, and a gate that fails for
 * reasons unrelated to the change is a gate people learn to skip.
 *
 * So: run it by hand, or on a schedule. The local pass below is the part that
 * *is* deterministic enough for CI, and --offline exists for exactly that.
 *
 * WHY A DEAD LINK AND A BLOCKED ONE ARE NOT THE SAME RESULT
 *
 * LinkedIn answers unknown clients with 999, Credly rate-limits, and plenty of
 * hosts refuse HEAD outright. If those counted as failures this would cry wolf
 * on a clean site, and a checker that cries wolf gets ignored — at which point
 * it is worse than no checker, because its green run is now evidence of nothing.
 * So 404/410 and a domain that does not resolve are FAILURES; 403/429/5xx and a
 * timeout are NOTES. The distinction is the difference between "this link is
 * dead" and "I was not allowed to find out."
 *
 * COMMENTS ARE BLANKED FIRST, IN BOTH LANGUAGES
 *
 * Not a nicety — without it this tool fails on the two files it most needs to
 * read. index.html documents a dead Formspree endpoint inside a comment, and
 * js/data.js now explains the very defect above by writing the dead
 * my_projects URL out in prose. A scanner that reads comments would report both
 * and be right about neither.
 *
 * (csp-audit.js carries its own copy of this logic for the same reason. Two
 * copies in a no-build repo with no module story beats making that file
 * importable — require()-ing it would execute it, and it is a CI gate.)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const NET_ONLY = args.includes('--net-only');
const PAGES = ['index.html', '404.html'];
const SCRIPTS = ['js/data.js', 'js/terminal.js'];

let fails = 0;
let notes = 0;
const fail = (m, d) => { fails++; console.log('  FAIL  ' + m); if (d) console.log(ind(d)); };
const note = (m, d) => { notes++; console.log('  note  ' + m); if (d) console.log(ind(d)); };
const ok = (m) => console.log('  ok    ' + m);
const ind = (s) => s.split('\n').map((l) => '          ' + l).join('\n');

/* ---- comment blanking ------------------------------------------------ */
/* Length is preserved rather than the text removed, so byte offsets still map
   to the right line number after blanking. */
function blankHtmlComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

/* Strings and template literals are tracked so `//` inside a URL does not read
   as a comment — and that direction matters: mistaking a string for a comment
   blanks live code, and blanked code cannot be found to be wrong. The error
   would be a silent miss, which is the failure this file exists to end. */
function blankJsComments(s) {
  const out = s.split('');
  const n = s.length;
  let i = 0;
  let prev = ''; // last non-space char, for the regex-versus-divide decision
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && s[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) { if (s[i] !== '\n') out[i] = ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < n && s[i] !== c) { if (s[i] === '\\') i++; i++; }
      i++;
      prev = 'x';
      continue;
    }
    if (c === '/' && /[(,=:[!&|?{};+\-*%~^<>]/.test(prev)) {
      i++;
      let inClass = false;
      while (i < n) {
        const r = s[i];
        if (r === '\\') { i += 2; continue; }
        if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '\n') break;      // unterminated: it was a divide after all
        else if (r === '/' && !inClass) break;
        i++;
      }
      i++;
      prev = 'x';
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

const lineOf = (s, idx) => s.slice(0, idx).split('\n').length;

/* ---- collect ---------------------------------------------------------- */
/* One entry per occurrence, so a report names every place that needs editing
   rather than the first one and a count. */
const refs = [];
const add = (file, line, url, kind) => refs.push({ file, line, url, kind });

/* content= holds a URL on exactly three meta tags and prose on the rest, and the
   membership test has to be exact rather than a prefix: og:image:width is "1200"
   and og:image:alt is a sentence. Matching /og:image/ reported both as missing
   files — the first run of this file did precisely that. */
const URL_META = new Set(['og:image', 'og:url', 'twitter:image']);
const ORIGIN_RELS = /\b(preconnect|dns-prefetch)\b/;
const attrOf = (tag, name) => (tag.match(new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"')) || [])[1] || '';

PAGES.forEach((f) => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { fail(f + ' does not exist'); return; }
  const raw = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const src = blankHtmlComments(raw);
  const re = /\b(href|src|content)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const url = m[2].trim();
    if (!url || url.startsWith('data:') || url.startsWith('#/')) continue;

    // Decide from the tag this attribute sits in, not from the value.
    const start = src.lastIndexOf('<', m.index);
    const end = src.indexOf('>', m.index);
    const tag = src.slice(start, end < 0 ? m.index : end + 1);
    const tagName = (tag.match(/^<\s*([a-zA-Z][\w-]*)/) || [])[1] || '';

    if (m[1] === 'content' && !URL_META.has(attrOf(tag, 'property') || attrOf(tag, 'name'))) continue;

    // <base href> is the published root the deploy rewrites per-repo, not a path
    // in this checkout. There is no file at /Portfolio/ here and there should not
    // be one. deploy.yml already asserts the substitution took.
    if (tagName === 'base') continue;

    // A preconnect href is an ORIGIN — a host to warm DNS and TLS against, not a
    // document to fetch. fonts.googleapis.com serves no page at / and answers
    // 404 there forever, which is correct and says nothing about the link.
    const kind = tagName === 'link' && ORIGIN_RELS.test(attrOf(tag, 'rel')) ? 'origin' : m[1];
    add(f, lineOf(src, m.index), url, kind);
  }
});

SCRIPTS.forEach((f) => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { fail(f + ' does not exist'); return; }
  const code = blankJsComments(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
  const re = /['"`](https?:\/\/[^'"`\s]+)['"`]/g;
  let m;
  while ((m = re.exec(code)) !== null) add(f, lineOf(code, m.index), m[1], 'js');
});

console.log('\n  ' + refs.length + ' link(s) in ' + (PAGES.length + SCRIPTS.length) + ' files\n');

/* ---- local pass ------------------------------------------------------- */
const external = [];

if (!NET_ONLY) {
  console.log('  ── on disk ' + '─'.repeat(52));

  const ids = {};
  PAGES.forEach((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) return;
    const s = fs.readFileSync(p, 'utf8');
    ids[f] = new Set();
    const re = /\bid\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(s)) !== null) ids[f].add(m[1]);
  });

  const missing = [];
  const badAnchor = [];

  refs.forEach((r) => {
    if (/^https?:\/\//i.test(r.url)) { external.push(r); return; }
    if (/^(mailto|tel|javascript):/i.test(r.url)) return;

    if (r.url.startsWith('#')) {
      const id = decodeURIComponent(r.url.slice(1));
      if (id && ids[r.file] && !ids[r.file].has(id)) {
        badAnchor.push(r.file + ':' + r.line + '  #' + id);
      }
      return;
    }
    // 404.html carries a <base href="/Portfolio/"> that the deploy rewrites, so
    // its relative hrefs resolve against the published root, not this directory.
    const rel = r.url.split('#')[0].split('?')[0].replace(/^\//, '');
    if (!rel) return;
    if (!fs.existsSync(path.join(ROOT, decodeURIComponent(rel)))) {
      missing.push(r.file + ':' + r.line + '  ' + r.url);
    }
  });

  if (missing.length) fail(missing.length + ' local path(s) point at no file', missing.join('\n'));
  else ok('every local href and src resolves to a file on disk');

  if (badAnchor.length) fail(badAnchor.length + ' in-page anchor(s) match no id', badAnchor.join('\n'));
  else ok('every in-page anchor matches an id on that page');

  /* A target="_blank" without rel="noopener" hands the opened page a live
     window.opener back into this one. Modern browsers imply noopener, older
     ones do not, and the repo already claims all 32 carry it — so assert it. */
  const blanks = [];
  PAGES.forEach((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) return;
    const src = blankHtmlComments(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    const re = /<a\b[^>]*target\s*=\s*"_blank"[^>]*>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (!/rel\s*=\s*"[^"]*\bnoopener\b/.test(m[0])) {
        blanks.push(f + ':' + lineOf(src, m.index));
      }
    }
  });
  if (blanks.length) fail(blanks.length + ' target="_blank" link(s) lack rel="noopener"', blanks.join('\n'));
  else ok('every target="_blank" carries rel="noopener"');

  /* The specific corpse. Cheap, deterministic, and it names the replacement —
     which a bare 404 from the network pass does not. */
  const dead = refs.filter((r) => /\/my_projects(\/|$)/.test(r.url));
  if (dead.length) {
    fail(dead.length + ' reference(s) to the deleted my_projects monorepo',
         dead.map((r) => r.file + ':' + r.line + '  ' + r.url).join('\n') +
         '\nThat repo was split into standalone repos and deleted. Point each at\n' +
         'its own repo, e.g. github.com/BU1lDR/file-integrity-checker.');
  } else ok('no reference to the deleted my_projects monorepo');
} else {
  refs.forEach((r) => { if (/^https?:\/\//i.test(r.url)) external.push(r); });
}

/* ---- network pass ----------------------------------------------------- */
const REAL_DEATH = new Set([404, 410]);

function probe(url, depth) {
  return new Promise((resolve) => {
    if (depth > 5) return resolve({ kind: 'note', why: 'redirect loop' });
    let u;
    try { u = new URL(url); } catch (e) { return resolve({ kind: 'fail', why: 'unparseable URL' }); }
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      headers: {
        // A plain scripty UA gets walled far more often, which would turn real
        // answers into notes and hide dead links behind "I wasn't allowed."
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en',
      },
      timeout: 15000,
    }, (res) => {
      const code = res.statusCode;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, u).href;
        return probe(next, depth + 1).then((r) => resolve(
          r.kind === 'ok' ? { kind: 'ok', code: code, final: next, via: r.code } : r));
      }
      res.resume();
      if (code >= 200 && code < 300) return resolve({ kind: 'ok', code: code });
      if (REAL_DEATH.has(code)) return resolve({ kind: 'fail', why: 'HTTP ' + code });
      return resolve({ kind: 'note', why: 'HTTP ' + code + ' — blocked or unavailable, not proof of death' });
    });
    req.on('timeout', () => { req.destroy(); resolve({ kind: 'note', why: 'timed out' }); });
    req.on('error', (e) => {
      // A domain that does not resolve is as dead as a 404. A refused or reset
      // connection is a host having a bad day.
      if (e.code === 'ENOTFOUND') return resolve({ kind: 'fail', why: 'domain does not resolve' });
      resolve({ kind: 'note', why: e.code || e.message });
    });
  });
}

(async () => {
  if (!OFFLINE && external.length) {
    console.log('\n  ── over the network ' + '─'.repeat(44));

    // Deduplicate: github.com/BU1lDR appears many times and one answer covers
    // every occurrence. The report still names all of them.
    const byUrl = new Map();
    external.forEach((r) => {
      if (!byUrl.has(r.url)) byUrl.set(r.url, []);
      byUrl.get(r.url).push(r.file + ':' + r.line);
    });
    const urls = [...byUrl.keys()];
    console.log('  ' + urls.length + ' distinct external URL(s) from ' + external.length + ' reference(s)\n');

    const results = new Map();
    let cursor = 0;
    const WORKERS = 6;
    await Promise.all(Array.from({ length: Math.min(WORKERS, urls.length) }, async () => {
      while (cursor < urls.length) {
        const u = urls[cursor++];
        results.set(u, await probe(u, 0));
      }
    }));

    // An origin-only URL passes on any answer at all: reaching the host is the
    // whole point of a preconnect, and the status code of / is irrelevant. Only
    // a host that does not resolve is a real defect there.
    const originOnly = new Set(urls.filter(
      (u) => external.filter((r) => r.url === u).every((r) => r.kind === 'origin')));

    const dead = [];
    const walled = [];
    urls.forEach((u) => {
      const r = results.get(u);
      const where = byUrl.get(u).join(', ');
      if (originOnly.has(u)) {
        if (r.why === 'domain does not resolve') dead.push(u + '\n    ' + r.why + '  ←  ' + where);
        return;
      }
      if (r.kind === 'fail') dead.push(u + '\n    ' + r.why + '  ←  ' + where);
      else if (r.kind === 'note') walled.push(u + '  —  ' + r.why);
    });

    if (dead.length) fail(dead.length + ' external link(s) are dead', dead.join('\n'));
    else ok(urls.length + ' external link(s) answered, none dead');

    if (walled.length) {
      note(walled.length + ' link(s) could not be checked (not a failure)', walled.join('\n'));
    }
  } else if (OFFLINE) {
    console.log('\n  --offline: ' + external.length + ' external reference(s) not checked');
  }

  console.log('\n  ' + (fails ? fails + ' failure(s)' : 'every link resolves') +
              (notes ? ', ' + notes + ' note(s)' : '') + '\n');
  process.exit(fails ? 1 : 0);
})();
