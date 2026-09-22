/* check-edit-blocks.js — the setup table's line numbers point where it says.
 *
 *     node tools/check-edit-blocks.js
 *
 * WHY THIS EXISTS
 *
 * README.md's setup checklist is a table of nine `index.html:N` references, one
 * per `EDIT #N` comment block. Every one of them is a copy of a fact index.html
 * owns, and the copy goes stale on any commit that adds a line above it — which
 * is most commits, since the numbers only ever move in one direction.
 *
 * All nine have been wrong more than once. The worst time they were out by between
 * 45 and 92 lines each, so every reference in the table pointed into the middle of
 * whatever had moved up to take its place: near enough to look plausible, far
 * enough to be useless. Nothing detected it, because nothing here had ever read
 * index.html and the README in the same breath.
 *
 * The README already named the fix — "grep -n 'EDIT #' index.html is the version
 * that cannot go stale" — and then kept the table anyway, which is the right call:
 * a checklist you can jump into is worth more than an instruction to go and find
 * it yourself. The numbers being useful and the numbers being unmaintained are
 * both true, and this file is what makes the first one survivable.
 *
 * BOTH DIRECTIONS, DELIBERATELY
 *
 * A wrong line number is the obvious failure. The other one is a block added to
 * index.html and never added to the table, which a reader working through the
 * checklist in order simply never edits — the page keeps whatever the template
 * said. A check that only verified the rows it was given would pass that
 * perfectly, the same way csp-audit passed a page that gained a style attribute
 * and gained 'unsafe-inline' to match. So: every row resolves, and every block
 * has a row.
 *
 * AND THE COUNT IN THE PROSE
 *
 * The paragraph under the table said "all eight" over a table of nine rows. That
 * is a hand-written count of the lines directly beneath it, which is no more
 * reliable than any other hand-written copy and had the distinction of being
 * falsifiable by looking down. It is read here too. Nine is not a number this
 * file knows; it counts the rows and requires the word to match.
 *
 * WHY THIS IS ON THE DEPLOY PATH
 *
 * It is a pure function of two files in the checkout — no network, no binary, no
 * clock. Every failure it can report is caused by the commit being deployed, so
 * it belongs where the commit is, which is the same argument that put
 * link-check.js --offline there and kept its network half out.
 *
 *   0  the table and the page agree
 *   1  they do not
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = 'index.html';
const DOC = 'README.md';

let fails = 0;
const fail = (m, d) => { fails++; console.log('  FAIL  ' + m); if (d) console.log(ind(d)); };
const ok = (m) => console.log('  ok    ' + m);
const ind = (s) => s.split('\n').map((l) => '          ' + l).join('\n');

const pageLines = fs.readFileSync(path.join(ROOT, PAGE), 'utf8').split(/\r?\n/);
const docText = fs.readFileSync(path.join(ROOT, DOC), 'utf8');

/* ---- what the page actually says -------------------------------------- */
/* The id is `1`, `7b`, `12a` — a number with an optional letter, because the
   table has a 7b and assuming plain integers would silently drop it.

   A block HEADER is `EDIT #N —`; a dash is what separates one from a
   cross-reference. EDIT #5's block contains "Mirror any change in js/data.js
   (EDIT #9)", and counting that as a header would put #9 at the line inside #5
   where it is mentioned. Classifying rather than taking-the-first matters because
   a header written some other way — `EDIT #10:` — must not be quietly dropped;
   it lands in `refs` instead, where the last check below fails on it for having
   no row. Wrong-but-loud beats a silent miss. */
const real = new Map();
const refs = [];
pageLines.forEach((line, i) => {
  const re = /EDIT #(\d+[a-z]?)(\s*[—–-])?/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m[2]) { if (!real.has(m[1])) real.set(m[1], i + 1); }
    else refs.push({ id: m[1], line: i + 1 });
  }
});

console.log('\n  ── ' + PAGE + ' ' + '─'.repeat(56));
if (!real.size) {
  fail('no EDIT # blocks found in ' + PAGE + ' at all',
       'Either the blocks are gone — in which case the table and this file should\n' +
       'go with them — or the comment wording changed and this pattern no longer\n' +
       'matches it. Both are real; neither is a passing run.');
} else {
  ok(real.size + ' EDIT # block(s): ' + [...real.entries()].map(([k, v]) => '#' + k + '@' + v).join(' '));
  if (refs.length)
    ok(refs.length + ' cross-reference(s) to a block from elsewhere in the page');
}

/* ---- what the table claims -------------------------------------------- */
/* Rows look like:  | 7b | `index.html:898` | Certifications |
   Row 9 is `js/data.js` with no line number and is matched but not compared. */
const ROW = /^\|\s*(\d+[a-z]?)\s*\|\s*`([^`]+)`\s*\|/gm;
const rows = [...docText.matchAll(ROW)].map((m) => ({ id: m[1], ref: m[2] }));
const cited = new Map();
rows.forEach((r) => {
  const m = /^index\.html:(\d+)$/.exec(r.ref);
  if (m) cited.set(r.id, Number(m[1]));
});

console.log('\n  ── ' + DOC + "'s setup table " + '─'.repeat(42));
if (!rows.length) {
  fail('no setup-table rows found in ' + DOC,
       'The table was reformatted or removed. If it is gone, delete this file and\n' +
       'its step in .github/workflows/deploy.yml rather than leaving a check that\n' +
       'reports clean because it found nothing to look at.');
} else {
  ok(rows.length + ' row(s), ' + cited.size + ' of them citing a line in ' + PAGE);
}

/* ---- every row resolves ----------------------------------------------- */
const wrong = [];
cited.forEach((claimed, id) => {
  const actual = real.get(id);
  if (actual === undefined) {
    wrong.push('#' + id + '  table says ' + PAGE + ':' + claimed +
               ', but no EDIT #' + id + ' exists in the page');
  } else if (actual !== claimed) {
    const off = actual - claimed;
    wrong.push('#' + id + '  table says ' + claimed + ', really ' + actual +
               '  (' + (off > 0 ? '+' : '') + off + ')' +
               '\n      ' + PAGE + ':' + claimed + ' is: ' +
               (pageLines[claimed - 1] || '').trim().slice(0, 64));
  }
});

if (wrong.length) {
  fail(wrong.length + ' of ' + cited.size + ' line number(s) in the table are wrong',
       wrong.join('\n') + '\n\nThe re-derived table, ready to paste over it:\n' +
       [...cited.keys()].map((id) => '  | ' + id + ' | `' + PAGE + ':' +
                                    (real.get(id) || '?') + '` |').join('\n'));
} else if (cited.size) {
  ok('all ' + cited.size + ' cited line numbers are where the table says');
}

/* ---- and every block has a row ---------------------------------------- */
const hasRow = (id) => rows.some((r) => r.id === id);
const missing = [...real.keys()].filter((id) => !hasRow(id));
if (missing.length) {
  fail(missing.length + ' EDIT # block(s) in ' + PAGE + ' have no row in the table',
       missing.map((id) => '#' + id + ' at ' + PAGE + ':' + real.get(id) + '  ' +
                           (pageLines[real.get(id) - 1] || '').trim().slice(0, 64)).join('\n') +
       '\n\nSomebody working the checklist in order never edits these, so the page\n' +
       'keeps whatever the template said there.');
} else {
  ok('every EDIT # block in the page has a row');
}

/* Every cross-reference names something real. #9 is the one that resolves to a
   table row rather than to a block — it is js/data.js, a whole file with no line
   to point at — so a row counts as much as a header here. A pointer to a block
   that does not exist either way is a dead reference inside the page's own
   instructions, which is the same defect as a dead link and goes unnoticed the
   same way. */
const dangling = refs.filter((r) => !real.has(r.id) && !hasRow(r.id));
if (dangling.length) {
  fail(dangling.length + ' cross-reference(s) point at a block that does not exist',
       dangling.map((r) => PAGE + ':' + r.line + ' mentions EDIT #' + r.id + '  ' +
                           (pageLines[r.line - 1] || '').trim().slice(0, 64)).join('\n'));
} else if (refs.length) {
  ok('every cross-reference names a block or a table row that exists');
}

/* ---- the count in the prose ------------------------------------------- */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
               'eight', 'nine', 'ten', 'eleven', 'twelve'];

console.log('\n  ── the count in the paragraph under it ' + '─'.repeat(25));
/* Matches "All nine of those line numbers" and "all nine have now been wrong",
   both of which are counts of the table's rows written out in words. Anchored on
   "line numbers" / "have now been wrong" so it cannot drift onto some other
   number elsewhere in the file.

   \s+ and not a space: this file is hard-wrapped at 80 columns, so any anchor of
   more than two words will eventually have a newline dropped into the middle of
   it. The first version of this check used literal spaces and failed on its own
   README the moment the sentence wrapped between "have" and "now" — which is the
   good version of that mistake, since the alternative is a pattern that silently
   stops matching and a check that passes by finding nothing. */
const claims = [
  [/\ball\s+(\w+)\s+of\s+those\s+line\s+numbers\b/i, 'all N of those line numbers'],
  [/\ball\s+(\w+)\s+have\s+now\s+been\s+wrong\b/i, 'all N have now been wrong'],
];
let checkedAny = false;
claims.forEach(([re, label]) => {
  const m = re.exec(docText);
  if (!m) {
    fail('the paragraph under the table no longer says "' + label + '"',
         'The sentence was rewritten. Either re-anchor this check on the new\n' +
         'wording, or drop the spelled-out count from the prose so there is\n' +
         'nothing left to go stale — but do not leave it unread, which is how it\n' +
         'came to say "all eight" over nine rows.');
    return;
  }
  checkedAny = true;
  const word = m[1].toLowerCase();
  const expected = WORDS[cited.size];
  if (word === expected || word === String(cited.size)) {
    ok('"' + label.replace('N', word) + '" matches the ' + cited.size + ' numbered rows');
  } else {
    fail('the prose says "' + word + '" where the table has ' + cited.size + ' numbered rows',
         'Should read "' + label.replace('N', expected || String(cited.size)) + '".');
  }
});
if (!checkedAny && !fails) fail('no count in the prose was checked');

console.log('\n  ' + (fails ? fails + ' failure(s)' : 'the table and the page agree') + '\n');
process.exit(fails ? 1 : 0);
