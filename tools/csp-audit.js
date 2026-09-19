/* csp-audit.js — keeps the Content-Security-Policy honest about the pages it guards.
 *
 *     node tools/csp-audit.js                  # index.html and 404.html
 *     node tools/csp-audit.js some-other.html
 *
 * The policy lives in a <meta http-equiv> because GitHub Pages cannot set
 * response headers. That is the whole reason this file exists. A header is
 * configuration you change in one place; a meta tag is markup sitting in the
 * same file as the things it restricts, which means the two drift, and CSP
 * drifts silently in the worst possible direction — the browser does not warn,
 * it just refuses to run the script. So the page keeps loading, looks fine on
 * the machine of whoever made the change, and quietly stops working.
 *
 * Three shapes of that failure are live in this repo right now:
 *
 *   1. A hash goes stale. 404.html pins two inline <script> blocks by sha256
 *      because neither can become a file — the first has to run before the
 *      stylesheet <link> resolves, against a <base> it is itself there to
 *      correct, so an external src would be fetched from the wrong root and
 *      404. Touch one character of that block and the digest no longer matches:
 *      the base is never corrected, and a stranger who lands on a bad URL gets
 *      an unstyled page. Nobody reports that. It is found months later, or not.
 *
 *   2. index.html gains its first inline script. Its policy is strict — no
 *      'unsafe-inline' anywhere, not even for styles — and that is only
 *      affordable because every script on the page is an external file and
 *      there are no on* handlers. That is a property of the markup, not of the
 *      policy, and nothing about adding an onclick= tells you it is about to be
 *      ignored. So this asserts the property instead of trusting the comment
 *      that claims it.
 *
 *   3. The contact form gets a backend. index.html's own instructions for that
 *      said to put an endpoint in the action and that there was "nothing else to
 *      change" — while connect-src 'self' and form-action 'self' sat at the top
 *      of the same file, blocking both submit paths. Following the instruction
 *      exactly produced a form that told every visitor "Network error. Email me
 *      directly," because a fetch CSP refuses rejects like an unreachable host.
 *      No tag changed, so nothing above this would have noticed: connect-src
 *      governs JavaScript rather than markup, and was the one directive in either
 *      policy with no check behind it at all.
 *
 * Both directions are checked, because both are drift: a hash in the policy
 * that matches no script on the page is as much a bug as a script with no hash
 * — it means an edit happened and only half of it landed.
 *
 * Line endings. Hashes are computed over LF, which is what Pages serves: git
 * stores LF and the Linux runner checks out LF. A Windows clone with
 * core.autocrlf=true can have CRLF in the working copy, which hashes to
 * something else entirely — the deployed page is still correct, but those
 * blocks are blocked when you open the local file. That is the one false alarm
 * worth knowing about, and it is reported rather than silently normalised away.
 *
 * HTML comments are blanked before scanning, and not as a tidiness measure:
 * index.html documents the removed Formspree endpoint inside a comment, complete
 * with a form action. A scanner that reads comments reports that dead example as
 * a live cross-origin POST and is wrong every single run, which is how a check
 * gets ignored. Blanking preserves byte offsets so line numbers still point at
 * the real thing, and script bodies are read back out of the uncommented text so
 * a comment inside a script cannot corrupt its digest.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* index.html is required to stay hash-free. Not a style preference: the moment
   it needs a hash, the "no inline script anywhere" claim in its own CSP comment
   has stopped being true and the comment needs rewriting along with the policy. */
const MUST_STAY_STRICT = new Set(['index.html']);

const EXEC_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);

const args = process.argv.slice(2);
const files = args.length ? args : ['index.html', '404.html'];

let failures = 0;
let notes = 0;

function fail(msg, detail) {
  failures++;
  console.log('  FAIL  ' + msg);
  if (detail) String(detail).split('\n').forEach((l) => console.log('        ' + l));
}
function note(msg) {
  notes++;
  console.log('  note  ' + msg);
}
function ok(msg) {
  console.log('  ok    ' + msg);
}

/* Replace every HTML comment with spaces of the same length, so offsets and
   line numbers survive. Newlines are kept for the same reason. */
function blankComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

/* The same treatment for JavaScript, and for the same reason. The style-attribute
   scan near the bottom reads the page's scripts, and js/samurai.js explains its
   own fix in a comment that spells out `style="` in prose. A scanner that reads
   comments fails on the very file that proves it works.

   Strings and template literals are tracked so that `//` inside a URL is not read
   as the start of a comment. That direction matters more than it looks: mistaking
   a string for a comment blanks live code, and blanked code cannot be found to be
   wrong — the error would be a silent miss, which is exactly the failure this
   check was written to end. Regex literals get the usual heuristic (a `/` in a
   value position opens one) because a regex is the other place a stray `/*` can
   hide. Known limit: a backtick nested inside a `${}` would end a template early
   here. Nothing in js/ does that, and there is a standing rule against it. */
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
        else if (r === '\n') break;       // unterminated: it was a divide after all
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

function lineOf(s, idx) {
  return s.slice(0, idx).split('\n').length;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i'));
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
}

function sha256b64(str) {
  return crypto.createHash('sha256').update(Buffer.from(str, 'utf8')).digest('base64');
}

/* CSP source lists are whitespace-separated; directive names are ASCII
   case-insensitive, source expressions are not (hashes are base64). */
function parsePolicy(content) {
  const out = new Map();
  content.split(';').forEach((chunk) => {
    const parts = chunk.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    out.set(parts[0].toLowerCase(), parts.slice(1));
  });
  return out;
}

/* CSP's fallback chain, only as deep as this site actually needs. */
function sources(policy, directive) {
  if (policy.has(directive)) return policy.get(directive);
  if (policy.has('default-src')) return policy.get('default-src');
  return null; // nothing governs it
}

function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol + '//' + u.host;
  } catch (e) {
    return null;
  }
}

function permits(srcs, url) {
  if (!srcs) return true; // no directive and no default-src: unrestricted
  if (/^data:/i.test(url)) return srcs.some((s) => s.toLowerCase() === 'data:');
  if (/^blob:/i.test(url)) return srcs.some((s) => s.toLowerCase() === 'blob:');
  const origin = originOf(url);
  if (!origin) return srcs.some((s) => s === "'self'"); // relative => same origin
  return srcs.some((s) => {
    const t = s.replace(/\/$/, '');
    return t === origin || t === origin.replace(/^https?:/, 'https:') || t === '*';
  });
}

function auditFile(file) {
  console.log('='.repeat(72));
  console.log(file);
  console.log('='.repeat(72));

  if (!fs.existsSync(file)) {
    fail('file not found');
    return;
  }

  const rawBuf = fs.readFileSync(file);
  const hadCRLF = rawBuf.includes('\r\n');
  const lf = rawBuf.toString('utf8').replace(/\r\n/g, '\n'); // what Pages serves
  const bare = blankComments(lf); // comments gone, offsets intact

  if (hadCRLF) {
    note('working copy has CRLF; hashing LF as deployed. Expect the two inline\n' +
         'blocks to be reported blocked if you open this file locally.');
  }

  /* ---- the policy itself ---------------------------------------------- */
  const metaRe = /<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i;
  const metaTag = (bare.match(metaRe) || [])[0];
  if (!metaTag) {
    fail('no <meta http-equiv="Content-Security-Policy"> found');
    return;
  }
  const content = attr(metaTag, 'content');
  if (!content) {
    fail('CSP meta tag has no content attribute');
    return;
  }
  const policy = parsePolicy(content);

  /* The policy must be parsed before anything it governs. A CSP meta tag only
     applies to markup after it, so one placed below a <script> is decoration. */
  const metaAt = bare.indexOf(metaTag);
  const firstScript = bare.search(/<script\b/i);
  if (firstScript !== -1 && firstScript < metaAt) {
    fail('CSP meta tag appears AFTER the first <script> (line ' +
         lineOf(bare, firstScript) + ' vs ' + lineOf(bare, metaAt) + ').',
         'Everything parsed before the tag is ungoverned. Move it up.');
  } else {
    ok('policy precedes every <script> and <link>');
  }

  /* Directives that are silently dropped when delivered by meta rather than a
     header. Listing them looks like defence and is not. */
  ['frame-ancestors', 'report-uri', 'report-to', 'sandbox'].forEach((d) => {
    if (policy.has(d)) {
      fail("'" + d + "' is ignored in a <meta> policy; remove it or it reads as protection that is not there");
    }
  });

  const scriptSrc = sources(policy, 'script-src') || [];
  ['unsafe-inline', 'unsafe-eval'].forEach((bad) => {
    if (scriptSrc.some((s) => s.toLowerCase() === "'" + bad + "'")) {
      fail("script-src contains '" + bad + "'");
    }
  });

  /* ---- inline scripts vs hashes --------------------------------------- */
  const policyHashes = scriptSrc.filter((s) => /^'sha(256|384|512)-/i.test(s));
  const found = [];

  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(bare)) !== null) {
    const attrs = m[1];
    const openLen = m[0].indexOf('>') + 1;
    const bodyStart = m.index + openLen;
    const bodyEnd = m.index + m[0].lastIndexOf('</');
    const body = lf.slice(bodyStart, bodyEnd); // real bytes, comments intact
    const src = attr('<x' + attrs + '>', 'src');
    const type = (attr('<x' + attrs + '>', 'type') || '').toLowerCase();

    if (src) continue; // external: checked with the other subresources
    if (!EXEC_TYPES.has(type)) continue; // application/ld+json and friends: data, not script

    found.push({ line: lineOf(bare, m.index), bytes: body.length, hash: sha256b64(body) });
  }

  const base = path.basename(file);
  if (MUST_STAY_STRICT.has(base) && found.length) {
    fail(base + ' is required to have no inline <script>, but has ' + found.length + '.',
         'Its policy claims strictness that this breaks. Either move the code to a\n' +
         'file under js/, or drop ' + base + ' from MUST_STAY_STRICT and add the hash\n' +
         'below to script-src — and rewrite the CSP comment, which says there are none.');
  }

  found.forEach((s) => {
    const token = "'sha256-" + s.hash + "'";
    if (policyHashes.some((h) => h === token)) {
      ok('inline script at line ' + s.line + ' (' + s.bytes + ' bytes) matches its hash');
    } else {
      fail('inline script at line ' + s.line + ' (' + s.bytes + ' bytes) is not in script-src.',
           'It will be blocked. Add exactly:  ' + token);
    }
  });

  policyHashes.forEach((h) => {
    if (!found.some((s) => "'sha256-" + s.hash + "'" === h)) {
      fail('script-src pins ' + h + ' but no inline script on the page hashes to it.',
           'Half of an edit landed. Re-run and paste the digests printed above.');
    }
  });

  if (!found.length && !policyHashes.length) ok('no inline script, no hashes to keep in step');

  /* ---- things that need 'unsafe-inline' whether you meant it or not --- */
  const handler = bare.match(/<[^>]+\son(?:click|load|error|submit|change|input|focus|blur|mouseover|keydown|keyup)\s*=/i);
  if (handler) {
    fail('inline event handler at line ' + lineOf(bare, bare.indexOf(handler[0])) +
         ' will never fire under this policy.',
         'on* attributes need script-src \'unsafe-inline\'. Bind it in js/ instead.');
  } else {
    ok('no inline event handlers');
  }

  const styleSrc = sources(policy, 'style-src') || [];
  const styleInline = styleSrc.some((s) => s.toLowerCase() === "'unsafe-inline'");
  const hasStyleBlock = /<style\b/i.test(bare);
  const hasStyleAttr = /<[^>]+\sstyle\s*=\s*["']/i.test(bare);
  if ((hasStyleBlock || hasStyleAttr) && !styleInline) {
    const what = [hasStyleBlock && '<style> block', hasStyleAttr && 'style attribute'].filter(Boolean).join(' and ');
    fail('page has a ' + what + " but style-src has no 'unsafe-inline'.",
         'It will be dropped and the page will render wrong.');
  } else if (!hasStyleBlock && !hasStyleAttr && styleInline) {
    note("style-src carries 'unsafe-inline' but there is no inline CSS left to need it.");
  } else {
    ok('inline CSS and style-src agree');
  }

  /* ---- subresources actually referenced ------------------------------- */
  const refs = [];
  const tagRe = /<(script|link|img|object|source)\b([^>]*)>/gi;
  let t;
  while ((t = tagRe.exec(bare)) !== null) {
    const tag = t[0];
    const name = t[1].toLowerCase();
    const at = lineOf(bare, t.index);
    if (name === 'script') {
      const src = attr(tag, 'src');
      if (src) refs.push({ url: src, directive: 'script-src', at });
    } else if (name === 'link') {
      const rel = (attr(tag, 'rel') || '').toLowerCase();
      const href = attr(tag, 'href');
      if (!href) continue;
      // preconnect/dns-prefetch open a socket; they fetch nothing and CSP does
      // not govern them. Counting them would demand origins for no requests.
      if (/preconnect|dns-prefetch/.test(rel)) continue;
      if (/stylesheet/.test(rel)) refs.push({ url: href, directive: 'style-src', at });
      else if (/icon|apple-touch-icon/.test(rel)) refs.push({ url: href, directive: 'img-src', at });
      else if (/manifest/.test(rel)) refs.push({ url: href, directive: 'manifest-src', at });
      else if (/preload/.test(rel)) {
        const as = (attr(tag, 'as') || '').toLowerCase();
        const d = as === 'image' ? 'img-src' : as === 'font' ? 'font-src'
                : as === 'script' ? 'script-src' : as === 'style' ? 'style-src' : null;
        if (d) refs.push({ url: href, directive: d, at });
      }
    } else if (name === 'img' || name === 'source') {
      const src = attr(tag, 'src') || attr(tag, 'srcset');
      if (src) refs.push({ url: src.split(/[\s,]+/)[0], directive: 'img-src', at });
    } else if (name === 'object') {
      const data = attr(tag, 'data');
      // The résumé viewer sets data= at runtime, so an <object> with none is
      // normal here; object-src still has to allow 'self' for it to work.
      if (data) refs.push({ url: data, directive: 'object-src', at });
      else {
        const objSrc = sources(policy, 'object-src');
        if (objSrc && !objSrc.some((s) => s === "'self'")) {
          fail('<object> at line ' + at + " is filled in by script, but object-src has no 'self'.",
               'The résumé viewer renders as its fallback text instead of the PDF.');
        }
      }
    }
  }

  let blocked = 0;
  refs.forEach((r) => {
    if (!permits(sources(policy, r.directive), r.url)) {
      blocked++;
      fail(r.directive + ' blocks ' + r.url + ' (line ' + r.at + ')');
    }
  });
  if (!blocked) ok(refs.length + ' subresource reference(s) all permitted');

  /* Local stylesheets get the same treatment: a url() added to CSS is exactly
     as capable of being blocked as one added to the markup, and less visible. */
  refs.filter((r) => r.directive === 'style-src' && !originOf(r.url)).forEach((r) => {
    const p = path.join(path.dirname(file), r.url.split('?')[0]);
    if (!fs.existsSync(p)) return;
    const css = fs.readFileSync(p, 'utf8');
    const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((u) => u[1]);
    let bad = 0;
    urls.forEach((u) => {
      if (/^#/.test(u)) return; // svg fragment reference, not a fetch
      const isFont = /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(u) || /^data:(application\/)?font/i.test(u);
      const d = isFont ? 'font-src' : 'img-src';
      if (!permits(sources(policy, d), u)) {
        bad++;
        fail(d + ' blocks ' + u.slice(0, 60) + (u.length > 60 ? '…' : '') + ' in ' + r.url);
      }
    });
    if (!bad) ok(urls.length + ' url() in ' + r.url.split('?')[0] + ' all permitted');
  });

  /* ---- the style attributes no file contains --------------------------------
     The inline-CSS check above reads THIS FILE for `<style>` and `style="`. Both
     of its regexes run over markup that exists on disk — which is precisely the
     set of inline styles that were never going to be the problem, because they
     are sitting there to be counted. The ones that break a page are the ones a
     script writes at runtime, and js/samurai.js wrote fifty-one of them: the `sl`
     road built its stones, torii and runner as a single innerHTML string with a
     style attribute on every element. style-src carries no 'unsafe-inline', so
     the browser refused to parse all fifty-one. Every stone landed at left:0, the
     bed at top:0, the gates in a pile, and the runner fell back to the slow
     walking cadence that --sam-run-dur exists to override.

     This audit printed `ok  inline CSS and style-src agree` on that run, and it
     was not lying. The file's own markup did agree. There were three CSP checks
     here and all three looked at the page as LOADED; none looked at the page as
     USED. That is the gap, and it is what the scan below closes.

     Two things need 'unsafe-inline' and are worth naming separately, because they
     fail against different directives:

       - a style attribute in an HTML string, or setAttribute('style', …)
             → style-src-attr, refused when the attribute value is parsed
       - a <style> element in an HTML string
             → style-src-elem, refused unless its hash is pinned

     Both fall back to style-src when the -attr/-elem forms are absent, which they
     are in both policies here and should stay that way: Firefox never implemented
     either form, so reaching for `style-src-attr 'unsafe-inline'` to make a road
     appear fixes Chrome and leaves the page broken in the browser you did not
     check.

     el.style.setProperty(…) and el.style.foo = … are deliberately NOT flagged.
     CSSOM writes are governed by no directive at all, which is why the fix was to
     move the values there rather than to loosen the policy. */
  const STYLE_WRITERS = [
    { re: /(^|[^.\w$])style\s*=\s*\\?["'`]/g, what: 'builds a style attribute' },
    { re: /\.setAttribute\s*\(\s*\\?["'`]style\\?["'`]/g, what: "calls setAttribute('style', …)" },
    { re: /<style[\s>]/gi, what: 'builds a <style> element' },
  ];

  const styleWrites = [];
  refs.filter((r) => r.directive === 'script-src' && !originOf(r.url)).forEach((r) => {
    const p = path.join(path.dirname(file), r.url.split('?')[0]);
    if (!fs.existsSync(p)) return;
    const code = blankJsComments(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    const name = r.url.split('?')[0];
    STYLE_WRITERS.forEach((w) => {
      w.re.lastIndex = 0;
      let h;
      while ((h = w.re.exec(code)) !== null) {
        styleWrites.push({ file: name, at: lineOf(code, h.index), what: w.what });
      }
    });
  });

  if (styleWrites.length && !styleInline) {
    fail(styleWrites.length + " inline-style site(s) in this page's scripts, and style-src has no 'unsafe-inline'.",
         styleWrites.map((s) => s.file + ':' + s.at + '  ' + s.what).join('\n') +
         '\nSites, not attributes: a site inside a loop counts once here and produces one\n' +
         'blocked attribute per iteration. The six above are the sl road before the fix,\n' +
         'and they were fifty-one refusals on every run.\n' +
         'Nothing in the page source shows any of it. Move the values to the CSSOM —\n' +
         'el.style.setProperty(name, value) — which no directive governs. Do not add\n' +
         "'unsafe-inline' to make this pass: index.html has no inline CSS of its own, so\n" +
         'that trades away a protection currently in full force, and style-src-attr does\n' +
         'not exist in Firefox.');
  } else if (styleWrites.length) {
    ok(styleWrites.length + " inline-style site(s) in scripts, and style-src allows 'unsafe-inline'");
  } else {
    ok('no script builds an inline style this policy would drop');
  }

  /* ---- the requests no markup can show you ----------------------------------
     Everything above walks tags. connect-src governs neither a tag nor a file
     path — it governs fetch(), XHR, WebSocket, EventSource and sendBeacon, which
     live in JavaScript, so it was the one directive in either policy with
     nothing checking it. That is also the directive with the live trap, and the
     trap is written down in index.html as an instruction:

         "put its endpoint back as the action: <form ... action="https://…">
          §08 switches to fetch()-ing it the moment the action is an http(s) URL
          — nothing else to change."

     Nothing else to change is false. connect-src 'self' blocks that POST and
     form-action 'self' blocks the no-JS one, and the same file's CSP comment says
     so thirty lines from the top while the instruction next to the form does not.
     Follow the instruction and the fetch rejects, main.js's .catch() prints
     "Network error. Email me directly at …", and the only account of why is a
     console line nobody is watching — on the one path a stranger uses to reach
     a person. The policy would still "match the pages": no tag changed.

     So: a form action and a literal URL in the page's own scripts both count as
     requests, and both get checked here. */
  const netCalls = [];

  const formRe = /<form\b([^>]*)>/gi;
  let f;
  while ((f = formRe.exec(bare)) !== null) {
    const action = attr(f[0], 'action');
    if (!action || !originOf(action)) continue; // absent or relative: same origin
    const at = lineOf(bare, f.index);
    // Two directives, two submit paths. fetch() is what §08 does with JS on;
    // form-action is what the browser does with JS off, and a policy that allows
    // one without the other half-works in a way nobody tests.
    netCalls.push({ url: action, directive: 'connect-src', at, what: 'form action (fetch path)' });
    netCalls.push({ url: action, directive: 'form-action', at, what: 'form action (no-JS submit)' });
  }

  /* Literal URLs handed to a network API in the local scripts this page loads.
     Deliberately only literals: main.js calls fetch(action) through a variable,
     which is the case the form check above resolves properly. Guessing at
     variables would mean either false alarms or a confident wrong answer, and
     this file exists because of a confident wrong answer. */
  const NET_API = /(?:\bfetch\s*\(|\.open\s*\(\s*["'][A-Z]+["']\s*,|new\s+WebSocket\s*\(|new\s+EventSource\s*\(|sendBeacon\s*\()\s*(["'])([^"']+)\1/g;
  refs.filter((r) => r.directive === 'script-src' && !originOf(r.url)).forEach((r) => {
    const p = path.join(path.dirname(file), r.url.split('?')[0]);
    if (!fs.existsSync(p)) return;
    const js = fs.readFileSync(p, 'utf8');
    let c;
    NET_API.lastIndex = 0;
    while ((c = NET_API.exec(js)) !== null) {
      const url = c[2];
      if (!originOf(url)) continue; // relative: same origin, and 'self' covers it
      netCalls.push({ url, directive: 'connect-src', at: null, what: r.url.split('?')[0] });
    }
  });

  let refused = 0;
  netCalls.forEach((c) => {
    if (permits(sources(policy, c.directive), c.url)) return;
    refused++;
    fail(c.directive + ' blocks ' + c.url + ' — ' + c.what +
         (c.at ? ' (line ' + c.at + ')' : ''),
         c.directive === 'connect-src'
           ? 'The request never leaves the page. It rejects like a network error,\n' +
             'so the handler shows one, and the real reason is console-only.'
           : 'With JavaScript off the browser refuses the submit outright.');
  });
  if (!refused) {
    ok(netCalls.length
      ? netCalls.length + ' outbound request target(s) permitted'
      : 'no cross-origin request target in the markup or scripts');
  }

  console.log('');
}

files.forEach(auditFile);

console.log('='.repeat(72));
if (failures) {
  console.log(failures + ' failure(s), ' + notes + ' note(s) — the policy and the pages disagree.');
  process.exitCode = 1;
} else {
  console.log('policy matches the pages. ' + notes + ' note(s).');
}
