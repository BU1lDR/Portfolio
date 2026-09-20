/* check-commands.js — the terminal's command counts, against the terminal.
 *
 *     node tools/check-commands.js
 *
 * js/terminal.js registers a table of commands. Five places quote how many:
 * three sentences in README.md, the number baked into the card in index.html,
 * and the first sentence of this repository's GitHub description. All five are
 * derived facts about one object literal, and adding a command falsifies as many
 * of them as mention that particular total.
 *
 * The site itself does not have this problem. The card's number is written by
 * terminal.js from the same filter `help` uses, so it cannot be wrong for longer
 * than it takes the page to boot — the `21` in the markup is a placeholder the
 * script overwrites. Everything outside the page is a copy, and copies are what
 * this file is for.
 *
 * Three numbers, because the shell has three honest sizes and the prose uses all
 * of them: how many commands `help` lists, how many the table holds, and the
 * difference — the aliases and the easter eggs, deliberately not listed. A
 * sentence that says "51 commands" is as wrong as one that says "21", in the
 * other direction: the answer depends on the question, which is why each claim
 * below is checked against a named one rather than against "the count".
 *
 * The description is the copy that matters most and the only one no commit can
 * reach. It said "40+ commands" while the table held 51 — not false, which is
 * exactly what made it survive: a floor claim is satisfied by any number above
 * it, so it stays technically true while drifting arbitrarily far from the
 * truth, and no reader can tell the difference between a floor and a stale
 * figure. It now names the two counts the README names, and this file is what
 * keeps them honest. The sibling projects took the same route for the same
 * reason (security-scanner's description sat at "353 tests" through two
 * increments, because nothing that runs on a commit can see it).
 *
 * No dependencies. Node's standard library only, like everything else here.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TERMINAL = path.join(ROOT, 'js/terminal.js');
const IN_CI = process.env.GITHUB_ACTIONS === 'true';
const TIMEOUT = 15000;

/* Two kinds of failure, counted apart. A figure that disagrees with the table is
   a wrong number somebody can go and fix. A surface that could not be read at
   all — the API unreachable, the repository unidentifiable, a sentence reworded
   out from under its pattern — is not a wrong number, it is an unknown one, and
   the summary at the bottom has to say which it found. Both exit 1; only one of
   them tells you what to edit. Printing the same line for "we looked and it
   disagrees" and "we could not look" is how a check quietly stops being one. */
let failures = 0;
let blind = 0;
function fail(msg, detail) {
  failures++;
  console.log('  FAIL  ' + msg);
  if (detail) console.log(detail.split('\n').map((l) => '        ' + l).join('\n'));
}
function unchecked(msg, detail) {
  blind++;
  fail(msg, detail);
}
function ok(msg) {
  console.log('  ok    ' + msg);
}

/* ── reading the table ──────────────────────────────────────────────────────
   Brace matching over the source rather than a regex over the keys. The regex
   version is what produced the wrong answer first: a pattern anchored on
   /^\s*([A-Za-z_][\w-]*)\s*:\s*\{/ counts 50 of the 51 entries, because one key
   is the quoted numeric '42' and an identifier pattern cannot match it. The
   miscount is one, in the direction of "close enough to believe".

   Strings, template literals, comments and regex literals are skipped while
   counting depth, because all four can contain an unbalanced brace and the
   table is 700 lines of function bodies. Regex detection uses the usual
   previous-significant-token heuristic — after a value, `/` is division; after
   an operator or an opening bracket, it starts a pattern. */
function extractTable(src) {
  const at = src.indexOf('var CMDS = {');
  if (at === -1) throw new Error('no `var CMDS = {` in js/terminal.js — was it renamed?');
  const open = src.indexOf('{', at);

  let depth = 0;
  let end = -1;
  let prev = ''; // last significant character, for the regex heuristic
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const two = src.substr(i, 2);

    if (two === '//') {
      i = src.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (two === '/*') {
      i = src.indexOf('*/', i + 2) + 1;
      if (i === 0) break;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(src, i);
      prev = c;
      continue;
    }
    if (c === '/' && startsRegex(prev)) {
      i = skipRegex(src, i);
      prev = '/';
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
    if (!/\s/.test(c)) prev = c;
  }
  if (end === -1) throw new Error('the CMDS literal never closes — brace scan ran off the end');

  /* The scan stopping early is the failure that would undercount silently, so
     it is checked rather than hoped for: `var CMDS = {...};` ends in a
     semicolon, and a `}` found inside something the scanner mishandled would
     almost certainly not be followed by one. */
  const after = src.slice(end + 1).match(/^\s*;/);
  if (!after) {
    throw new Error(
      'the brace scan ended at offset ' + end + ', which is not followed by `;`.\n' +
      'That means it stopped inside something it mis-parsed and the count would\n' +
      'be too low. Fix the scanner rather than trusting the number.'
    );
  }

  const table = vm.runInNewContext('(' + src.slice(open, end + 1) + ')', Object.create(null));
  const names = Object.keys(table);
  if (!names.length) throw new Error('the CMDS literal evaluated to an empty object');
  if (!table.help) throw new Error('no `help` command in the table — the slice is wrong');
  names.forEach((n) => {
    if (typeof table[n] !== 'object' || typeof table[n].run !== 'function') {
      throw new Error('entry `' + n + '` has no run() — the slice picked up something else');
    }
  });
  return table;
}

function skipString(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === quote) return j;
    if (quote !== '`' && src[j] === '\n') return j; // unterminated; let the eval complain
  }
  return src.length;
}

function skipRegex(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] === '[') inClass = true;
    else if (src[j] === ']') inClass = false;
    else if (src[j] === '/' && !inClass) return j;
    else if (src[j] === '\n') return j;
  }
  return src.length;
}

function startsRegex(prev) {
  return prev === '' || '(,=:[!&|?{};+-*%~^<>'.indexOf(prev) !== -1;
}

/* ── the claims ─────────────────────────────────────────────────────────────
   Each pattern names which of the three counts it is a claim about. `required`
   means the file must contain it: a sentence that was reworded out of existence
   leaves this check passing because it found nothing to disagree with, which is
   the failure mode worth more than all the others put together. */
const CLAIMS = {
  'index.html': [
    { re: /id="termCmdCount">(\d+)</g, of: 'listed', what: 'the card before terminal.js overwrites it' },
  ],
  'README.md': [
    { re: /(\d+) commands, history/g, of: 'listed', what: 'the feature table' },
    { re: /the (\d+) `help` lists/g, of: 'listed', what: 'the terminal-commands section' },
    { re: /holds (\d+) names in total/g, of: 'total', what: 'the terminal-commands section' },
    { re: /the other (\d+) are aliases/g, of: 'hidden', what: 'the terminal-commands section' },
  ],
  description: [
    { re: /(\d+) documented commands/g, of: 'listed', what: 'the first sentence a visitor reads' },
    { re: /(\d+) hidden/g, of: 'hidden', what: 'the first sentence a visitor reads' },
  ],
};

function checkText(surface, text, counts, claims, locate) {
  let checked = 0;
  claims.forEach((claim) => {
    claim.re.lastIndex = 0;
    let m;
    let found = 0;
    while ((m = claim.re.exec(text)) !== null) {
      found++;
      checked++;
      const claimed = Number(m[1]);
      const actual = counts[claim.of];
      if (claimed === actual) continue;
      fail(
        surface + locate(m.index) + ' claims ' + claimed + ' where the table has ' +
          actual + ' ' + claim.of,
        'Matched "' + m[0] + '" — ' + claim.what + '.'
      );
    }
    if (!found) {
      unchecked(
        surface + ' no longer contains ' + claim.re.source,
        'Either the wording changed, in which case fix the pattern in\n' +
        'tools/check-commands.js, or the sentence is gone — and this check is\n' +
        'now passing by not looking, which is worse than the drift it exists\n' +
        'to catch.'
      );
    }
  });
  return checked;
}

function checkFile(name, counts) {
  const file = path.join(ROOT, name);
  const text = fs.readFileSync(file, 'utf8');
  const before = failures;
  const checked = checkText(name, text, counts, CLAIMS[name], (idx) => ':' + (text.slice(0, idx).split('\n').length));
  if (failures === before) ok(name + ': ' + checked + ' figure(s) agree with the table');
}

/* ── the copy no commit can reach ───────────────────────────────────────── */
function repoSlug() {
  const env = (process.env.GITHUB_REPOSITORY || '').trim();
  if (env.split('/').length === 2) return env;
  try {
    let url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (url.endsWith('.git')) url = url.slice(0, -4);
    if (!url.includes('github.com')) return null;
    const parts = url.split(/[/:]/);
    return parts.slice(-2).join('/');
  } catch (e) {
    return null;
  }
}

function fetchDescription(slug) {
  return new Promise((resolve) => {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      // The API refuses requests without one.
      'User-Agent': 'portfolio-check-commands (+https://github.com/' + slug + ')',
      // Anonymous responses come off a CDN cache. Immediately after a
      // `gh repo edit` this check read the old description and reported a
      // mismatch that no longer existed, which is the one false alarm it can
      // produce. Authenticated requests are not cached that way, so in CI the
      // token below also fixes this; by hand, re-run it in a minute.
      'Cache-Control': 'no-cache',
    };
    // Not for access — the description is public — but for the rate limit:
    // unauthenticated calls are 60/hour shared across everything leaving one IP.
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) headers.Authorization = 'Bearer ' + token;

    const req = https.request(
      { hostname: 'api.github.com', path: '/repos/' + slug, headers, timeout: TIMEOUT },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ error: 'HTTP ' + res.statusCode + ' from the GitHub API for ' + slug });
            return;
          }
          try {
            resolve({ description: JSON.parse(body).description || '' });
          } catch (e) {
            resolve({ error: 'the GitHub API returned something that is not JSON: ' + e.message });
          }
        });
      }
    );
    // One attempt. Unlike the repos this is copied from, nothing here gates a
    // commit: this runs in the deploy, where a retry would delay a publish for a
    // condition the next push re-tests anyway.
    req.on('timeout', () => { req.destroy(new Error('timed out after ' + TIMEOUT + 'ms')); });
    req.on('error', (e) => { resolve({ error: 'could not reach the GitHub API for ' + slug + ': ' + e.message }); });
    req.end();
  });
}

async function checkDescription(counts) {
  const slug = repoSlug();
  if (!slug) {
    unchecked('could not work out which GitHub repository this is, so the description went unchecked',
              'No GITHUB_REPOSITORY and no github.com origin remote.');
    return;
  }
  const { description, error } = await fetchDescription(slug);
  if (error) {
    const msg = 'the repo description went unchecked: ' + error;
    const detail = 'Everything in the tree was still checked. Compare the sentence under\n' +
                   'the repo name at https://github.com/' + slug + ' by hand.';
    // "We found nothing" and "we could not look" must not print the same thing.
    // In CI that also has to be a failure, or a network blip publishes a green
    // tick over a check that did not run.
    if (IN_CI) unchecked(msg, detail);
    else { console.log('  ----  ' + msg); console.log('        ' + detail.split('\n').join('\n        ')); }
    return;
  }

  const before = failures;
  const checked = checkText('the GitHub description', description, counts, CLAIMS.description, () => '');
  if (failures === before) {
    ok('the GitHub description: ' + checked + ' figure(s) agree with the table');
    return;
  }

  let fixed = description;
  CLAIMS.description.forEach((claim) => {
    claim.re.lastIndex = 0;
    fixed = fixed.replace(claim.re, (whole, digits) => whole.replace(digits, String(counts[claim.of])));
  });
  console.log('');
  console.log('  The description is the one copy no commit can fix. Run:');
  console.log('');
  console.log("    gh repo edit " + slug + " --description '" + fixed.replace(/'/g, "'\\''") + "'");
  console.log('');
  if (fixed.length > 350) {
    console.log('  (that is ' + fixed.length + ' characters and GitHub\'s limit is 350, so it');
    console.log('   needs shortening as well as correcting)');
    console.log('');
  }
}

async function main() {
  const table = extractTable(fs.readFileSync(TERMINAL, 'utf8'));
  const names = Object.keys(table);
  const listed = names.filter((n) => !table[n].hidden);
  const counts = { total: names.length, listed: listed.length, hidden: names.length - listed.length };

  console.log('='.repeat(72));
  console.log('js/terminal.js: ' + counts.total + ' commands, ' + counts.listed +
              ' listed by help, ' + counts.hidden + ' hidden');
  console.log('='.repeat(72));

  checkFile('index.html', counts);
  checkFile('README.md', counts);
  await checkDescription(counts);

  console.log('');
  const wrong = failures - blind;
  if (wrong && blind) {
    console.log(wrong + ' figure(s) disagree with the table, and ' + blind +
                ' surface(s) could not be checked at all.');
  } else if (wrong) {
    console.log(wrong + ' figure(s) quote a count the table does not support.');
  } else if (blind) {
    console.log(blind + ' surface(s) could not be checked at all. Nothing that was\n' +
                'read disagreed with the table — which is not the same as agreeing.');
  } else {
    console.log('every quoted count matches the table.');
  }
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error('check-commands.js could not run: ' + e.message);
  process.exitCode = 2;
});
