/* check-resume-count.js — the one figure on the resume that goes stale on its own.
 *
 *     node tools/check-resume-count.js              # both halves
 *     node tools/check-resume-count.js --offline    # the two copies in this repo only
 *
 * WHY THIS EXISTS, WITH THE DEFECT THAT PROMPTED IT
 *
 * assets/resume.src.html says `pytest (N tests)` in the secscan entry. It is the
 * only number on the resume that changes without anybody editing the resume —
 * secscan gains a test and this figure is wrong, with no diff here to review.
 *
 * It was wrong five times that way before this file existed, and once more after
 * (the git log of assets/resume.src.html is the record: 353, then 355, 357, 367,
 * 396, 446, 448). The fifth time it read 396 against a real
 * 446, and it read 396 in BOTH assets/resume.src.html AND the committed
 * assets/resume.pdf — the two in perfect agreement with each other and both
 * wrong. build-resume.js already compares those two, so it passed. Its own
 * comment names this exact case: "Nothing can tell you the figure is stale in
 * BOTH at once — if keeping it in step stops happening, delete the parenthetical
 * rather than leave a wrong one."
 *
 * This is the other option that comment did not have available. A specific,
 * checkable count is worth more to a reader than "well tested"; it is worth that
 * only while it is right, and "keeping it in step" is not a thing to remember if
 * something asks.
 *
 * THE CHAIN, AND WHICH LINK WAS MISSING
 *
 *   pytest collects it
 *     → secscan's decisions.md quotes it     (its CI asserts this against pytest)
 *       → assets/resume.src.html copies it   (nothing checked this — the gap)
 *         → assets/resume.pdf renders it     (build-resume.js asserts this)
 *
 * So this file only has to close the middle link, and it does it by reading
 * secscan's published decisions.md rather than by counting that repo's tests
 * itself. That is deliberate. Counting them here would need a checkout of
 * another repository and would make this a second, competing authority on a
 * number that already has one. Reading what secscan publishes follows the same
 * chain a reader follows, and if secscan's own figure is wrong then that is a
 * failure in secscan's CI, where it can be fixed once instead of here.
 *
 * WHY NEITHER HALF IS ON THE DEPLOY PATH
 *
 * The same argument link-check.js makes. The network half obviously does not
 * belong there: raw.githubusercontent.com having a bad minute must not be able
 * to block publishing a typo fix. The local half is deterministic, but it needs
 * pdftotext — a binary the deploy path does not otherwise depend on, whose
 * absence would fail a publish for a reason that has nothing to do with the
 * commit. And a wrong number on the resume is not an emergency that justifies
 * blocking the site; going months without noticing is the actual failure, and a
 * weekly run that notifies fixes that.
 *
 * WHY "COULD NOT LOOK" IS NOT EXIT 0
 *
 * If pdftotext is missing, this exits 2 rather than reporting clean. A checker
 * that cannot run and says nothing is worse than no checker, because its green
 * run is then evidence of nothing while looking like evidence of something. Same
 * reason a blocked fetch is a note and a 404 is a failure: they are different
 * results and must not print the same way.
 *
 *   0  the figure agrees everywhere it was possible to check
 *   1  a real disagreement, or the parenthetical is gone
 *   2  could not run the check at all
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/resume.src.html');
const PDF = path.join(ROOT, 'assets/resume.pdf');
const OFFLINE = process.argv.slice(2).includes('--offline');

/* Where secscan publishes the figure its CI holds to pytest. main rather than a
   tag on purpose: a tag would pin this to a release and quietly stop tracking
   the number the moment that repo moved past it, which is the failure this file
   exists to end, one level up. */
const UPSTREAM =
  'https://raw.githubusercontent.com/BU1lDR/security-scanner/main/decisions.md';

/* The same pattern secscan's own tools/check_test_count.py uses, so the two
   tools cannot disagree about where the number lives or what counts as one. */
const QUOTED = /\b(\d+) tests\b/g;
const IN_RESUME = /pytest \((\d+) tests\)/g;

let fails = 0;
let notes = 0;
const fail = (m, d) => { fails++; console.log('  FAIL  ' + m); if (d) console.log(ind(d)); };
const note = (m, d) => { notes++; console.log('  note  ' + m); if (d) console.log(ind(d)); };
const ok = (m) => console.log('  ok    ' + m);
const ind = (s) => s.split('\n').map((l) => '          ' + l).join('\n');
const die = (m) => { console.log('\n  CANNOT CHECK  ' + m + '\n'); process.exit(2); };

/* Exactly one match, or say so. A tool that silently takes the first of several
   is guessing, and the guess is invisible in a green run. */
function onlyFigure(text, re, where) {
  const all = [...text.matchAll(re)].map((m) => m[1]);
  if (all.length === 1) return all[0];
  if (!all.length) return null;
  const unique = [...new Set(all)];
  if (unique.length === 1) return unique[0]; // repeated, but not contradictory
  fail(where + ' states more than one different count: ' + unique.join(', '),
       'This check cannot tell which one is the claim. Narrow the wording, or\n' +
       'narrow the pattern in this file — but do not let it pick one.');
  return undefined; // distinct from null: found, unusable
}

console.log('\n  ── the two copies in this repo ' + '─'.repeat(33));

const srcText = fs.readFileSync(SRC, 'utf8');
const claimed = onlyFigure(srcText, IN_RESUME, 'assets/resume.src.html');

if (claimed === null) {
  /* Deliberately a failure and not a quiet pass. If the parenthetical was
     removed on purpose then this file and build-resume.js's count check are both
     obsolete and should go in the same commit; failing once says so to the person
     who did it. Passing would leave two checks asserting nothing, which is the
     shape of every defect this repo's tools were written for. */
  fail('assets/resume.src.html no longer states a test count',
       'That may be correct — build-resume.js suggests deleting the parenthetical\n' +
       'rather than carrying a wrong number. If that is what happened, delete this\n' +
       'file, its step in .github/workflows/link-rot.yml, and the count check at\n' +
       'the end of build-resume.js. If it is not, put the figure back.');
}

if (typeof claimed === 'string') {
  ok('assets/resume.src.html states ' + claimed + ' tests');

  let pdfText;
  try {
    pdfText = execFileSync('pdftotext', ['-layout', PDF, '-'],
                           { encoding: 'utf8', maxBuffer: 1 << 24 });
  } catch (e) {
    if (e.code === 'ENOENT')
      die('pdftotext is not on PATH, so the PDF half could not run.\n' +
          '                Install poppler (poppler-utils), or pass --offline off this\n' +
          "                machine. Reporting 0 here would be a lie about what was checked.");
    die('pdftotext failed on assets/resume.pdf: ' + (e.message || e.code));
  }

  /* The PDF is the artifact a reader downloads, so the check is on its extracted
     text and not on its bytes. Chromium subsets the font and writes the digits as
     glyph ids, so "446" does not appear in the raw streams at all — grepping the
     file would find nothing and pass. */
  if (pdfText.includes('pytest (' + claimed + ' tests)')) {
    ok('assets/resume.pdf carries the same figure');
  } else {
    const inPdf = onlyFigure(pdfText, IN_RESUME, 'assets/resume.pdf');
    fail('assets/resume.pdf says ' + (inPdf || 'no count') + ', the source says ' + claimed,
         'The PDF was not rebuilt after the source changed, or was built from a\n' +
         'stale source. Rebuild it:\n\n' +
         '    npm install playwright && npx playwright install chromium\n' +
         '    node tools/build-resume.js\n\n' +
         'The PDF is the file a reader actually opens; the source is not.');
  }
}

/* ---- and whether the figure is true at all ---------------------------- */

function get(url, depth) {
  return new Promise((resolve) => {
    if (depth > 4) return resolve({ kind: 'note', why: 'too many redirects' });
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        // Same reasoning as link-check.js: a scripty UA gets walled more often,
        // which turns real answers into notes and hides a real defect behind
        // "I wasn't allowed to look."
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        Accept: 'text/plain,*/*;q=0.8',
      },
      timeout: 15000,
    }, (res) => {
      const code = res.statusCode;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        return get(new URL(res.headers.location, u).href, depth + 1).then(resolve);
      }
      if (code < 200 || code >= 300) {
        res.resume();
        // A 404 here is a real defect and not a blip: it means decisions.md moved,
        // was renamed, or the repo went private — and the resume is quoting a
        // figure from a document a reader can no longer open either.
        if (code === 404 || code === 410)
          return resolve({ kind: 'fail', why: 'HTTP ' + code + ' — the upstream document is gone' });
        return resolve({ kind: 'note', why: 'HTTP ' + code + ' — blocked or unavailable, not proof of anything' });
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ kind: 'ok', body: body }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ kind: 'note', why: 'timed out' }); });
    req.on('error', (e) => {
      if (e.code === 'ENOTFOUND')
        return resolve({ kind: 'fail', why: 'raw.githubusercontent.com does not resolve' });
      resolve({ kind: 'note', why: e.code || e.message });
    });
  });
}

(async () => {
  if (OFFLINE) {
    console.log('\n  --offline: secscan\'s published figure not checked');
  } else if (typeof claimed === 'string') {
    console.log('\n  ── against the repo it describes ' + '─'.repeat(31));
    const r = await get(UPSTREAM, 0);

    if (r.kind === 'fail') {
      fail(UPSTREAM.replace('https://', '') + ' could not be read', r.why);
    } else if (r.kind === 'note') {
      note('secscan\'s published figure could not be checked (not a failure)',
           r.why + '\n' + UPSTREAM);
    } else {
      const upstream = onlyFigure(r.body, QUOTED, 'secscan\'s decisions.md');
      if (upstream === null) {
        fail('secscan\'s decisions.md quotes no test count any more',
             'The resume is copying a figure that its source no longer states. Either\n' +
             'that repo changed its wording — in which case fix the pattern in this\n' +
             'file and in secscan\'s tools/check_test_count.py, which reads it the same\n' +
             'way — or the figure was removed there and should come off the resume.');
      } else if (typeof upstream === 'string') {
        if (upstream === claimed) {
          ok('secscan\'s decisions.md says ' + upstream + ' too, and its CI holds that to pytest');
        } else {
          fail('the resume claims ' + claimed + ' tests; secscan publishes ' + upstream,
               'secscan is the authority — its CI compares that number against what\n' +
               'pytest collects, so ' + upstream + ' is the checked one and ' + claimed + ' is a stale copy.\n\n' +
               'Fix it in one place and rebuild, or the PDF will disagree with itself:\n\n' +
               '    assets/resume.src.html   pytest (' + upstream + ' tests)\n' +
               '    node tools/build-resume.js\n\n' +
               'The figure is written once in that file on purpose. Do not add a second.');
        }
      }
    }
  }

  console.log('\n  ' + (fails ? '  ' + fails + ' failure(s)' : '  the figure agrees everywhere it could be checked') +
              (notes ? ', ' + notes + ' note(s)' : '') + '\n');
  process.exit(fails ? 1 : 0);
})();
