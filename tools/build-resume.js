/* build-resume.js — print assets/resume.src.html to assets/resume.pdf.
 *
 *     node tools/build-resume.js
 *
 * Needs playwright (npx playwright install chromium) and pdftotext from
 * poppler. Both are only needed to build the resume; the site itself has no
 * build step and no dependencies.
 *
 * Chromium rather than Word, for one reason that matters more than
 * convenience: the PDF this replaces carried an embedded metadata payload that
 * no PDF reader displays and that no author would have chosen to publish.
 * Chromium's print path writes a plain PDF with an Info dictionary and nothing
 * else, so there is no manifest to strip and no metadata to remember to clear.
 * The marker list further down is what enforces that; it names the container
 * formats generically, because a checker that only knows one producer stops
 * working the moment you use a different tool.
 *
 * printBackground is off and there is nothing to print anyway — the document is
 * black text on white with one hairline rule, which keeps it small, legible
 * photocopied, and readable by the text extractors that decide whether a human
 * ever sees it.
 *
 * Verification is part of the build, not a separate step someone remembers to
 * run: it re-reads the PDF it just wrote, extracts the text, and fails if any
 * of the things this rewrite exists to remove has come back. A build that
 * cannot fail is a build nobody checks.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/* Resolved by hand so the failure is a sentence instead of a stack trace. The
   site has no package.json and no node_modules on purpose — it is static files
   and nothing else — so playwright will not be sitting next to this script the
   way it would in a normal project. */
let chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.error('playwright is not installed.\n\n' +
                '    npm install playwright && npx playwright install chromium\n\n' +
                'Or point NODE_PATH at an existing install:\n\n' +
                '    NODE_PATH=/path/to/node_modules node tools/build-resume.js\n');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets/resume.src.html');
const OUT = path.join(ROOT, 'assets/resume.pdf');

/* Must not appear in the output.
 *
 * These match SHAPES, not the specific values that were removed. That is
 * deliberate and it is not a stylistic choice: this file is public, so a check
 * written as the ten literal digits would put the number back into the repo in
 * the most searchable form there is, inside the very file whose job is to keep
 * it out. Matching the shape is also a better check — it catches the next
 * number somebody pastes in, not just the last one.
 *
 * These run against the EXTRACTED TEXT only, never the raw or inflated bytes.
 * A PDF's compressed streams contain font tables full of arbitrary digit runs:
 * this document has a descending byte sequence in its glyph index that reads
 * 9876543210, which any ten-digit pattern matches and which is not a phone
 * number. tools/pdf-audit.js searches those layers too and reports what it
 * matched so you can tell the difference; a build gate cannot afford to guess.
 */
const FORBIDDEN = [
  /* Any Indian mobile number: ten digits opening 6-9, optional +91, optional
     one space or dash where people break it up. Nothing legitimate in a resume
     is ten consecutive digits. */
  ['phone number', /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/],
  /* Any Delhi postcode. A city is a filter recruiters use; six digits is a
     few streets. */
  ['postcode', /\b110\d{3}\b/],
  /* A zone of the city, which is the same disclosure in words. "New Delhi" is
     deliberately absent — that is a city name, not a neighbourhood. */
  ['zone-level locality', /\b(?:East|West|North|South|Central)\s+Delhi\b/i],
  /* The username is BU1lDR, with a lowercase L. Two wrong versions have been
     in this document — BU1DR (a character short) and BU1IDR (capital I) — and
     both are 404s. The lookahead is what lets one pattern reject every wrong
     spelling while passing the right one, which a literal list could not do.
     Worth knowing: Arial draws lowercase L and capital I identically, so this
     is not a defect anyone can see. It has to be extracted to be checked. */
  ['broken github username', /BU1(?!lDR)[A-Za-z0-9]{0,2}DR/],
  /* अर्थNiti, not अर्थाNiti. The extra matra was in the old PDF. */
  ['stray matra', /अर्थाNiti/],
];

/* Must appear. The other half of the check — a PDF that failed to render its
   text at all would pass every test above. */
const REQUIRED = [
  ['the corrected username', /github\.com\/BU1lDR/],
  ['the email', /aryanverma102007@gmail\.com/],
  ['the name', /ARYAN VERMA/],
  ['the city', /Delhi, India/],
  ['the transliteration that survives extraction', /ArthNiti/],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'load' });

  /* Fonts before geometry. Chromium will happily lay the page out with a
     fallback face and swap it mid-print, which moves every line break. */
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: false,
    /* No margin option: @page in the stylesheet owns the paper edge, and
       setting it in both places means two numbers to keep in step. */
    preferCSSPageSize: true
  });
  await browser.close();

  const size = fs.statSync(OUT).size;
  console.log('  wrote assets/resume.pdf  (' + size + ' bytes)');
  /* Rebuilding an unchanged source still produces a 6-byte diff: /CreationDate
     is stamped from the clock. If git shows resume.pdf modified and you changed
     nothing, that is why — check out the old one rather than committing it. */

  /* ── verify ─────────────────────────────────────────────── */
  const text = execFileSync('pdftotext', ['-layout', OUT, '-'],
                            { encoding: 'utf8', maxBuffer: 1 << 24 });
  const raw = fs.readFileSync(OUT, 'latin1');

  let fail = 0;
  const check = (cond, msg) => {
    if (!cond) fail++;
    console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + msg);
  };

  console.log('\n  ── nothing that had to go came back ──');
  for (const [name, pat] of FORBIDDEN) check(!pat.test(text), 'no ' + name);

  console.log('\n  ── and the page actually rendered ──');
  for (const [name, pat] of REQUIRED) check(pat.test(text), name + ' is present');

  console.log('\n  ── provenance ──');
  for (const m of ['c2pa', 'jumbf', 'C2PA', 'claim_generator', 'OpenAI', 'ChatGPT'])
    check(!raw.includes(m), 'no ' + m + ' anywhere in the bytes');

  /* Counting /Type /Page and excluding /Pages. Cross-checked once against
     pdftotext's form feeds on a genuine two-pager, because a page-count check
     that is wrong in the safe direction is worse than no check. */
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  check(pages === 1, 'one page (' + pages + ')');

  console.log('\n  ' + (fail ? fail + ' FAILED' : 'ALL PASS'));
  process.exit(fail ? 1 : 0);
})();
