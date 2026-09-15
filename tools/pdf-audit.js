/* pdf-audit.js — what a PDF says about itself, beyond the words on the page.
 *
 *     node tools/pdf-audit.js assets/resume.pdf
 *     node tools/pdf-audit.js assets/certs/*.pdf
 *
 * Run this on any PDF before committing it. A resume is the one file on this
 * site that carries facts the site itself is careful not to: a phone number, a
 * street-level location, and whatever the program that wrote it decided to
 * stamp inside. The visible text is the part that gets proofread; the Info
 * dictionary, the XMP packet and any C2PA manifest are not, and they survive a
 * copy into git forever.
 *
 * Three layers, and each needs a different tool. Getting this wrong is not
 * hypothetical — the first version of this file got it wrong and reported a
 * resume with a phone number printed across the top as CLEAN, four times over:
 *
 *   1. raw bytes            — plain grep finds it
 *   2. compressed streams   — PDF metadata routinely lives in Flate object
 *                             streams, so a raw grep finds nothing while the
 *                             string sits there in plain sight after inflate
 *   3. the visible text     — NOT greppable at all, even inflated. The page
 *                             content stream addresses glyphs by index into a
 *                             subset font, so a ten-digit number is stored as a
 *                             sequence of glyph IDs that spell nothing. Only
 *                             the font's ToUnicode CMap turns them back into
 *                             digits, which is what pdftotext is for.
 *
 * So: pdftotext for what a reader sees, inflate-and-grep for what the file says
 * about itself. Layer 3 is the one that matters most and the one a hand-rolled
 * scanner silently misses.
 *
 * Needs pdftotext from poppler. Without it the third layer is skipped and the
 * exit code is 3 rather than 0 — a skipped check must not read as a pass.
 */
const fs = require('fs');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

/* Things worth knowing are in the file. Producer/Creator name the program,
   which is how you tell a Word export from a Chromium print; the C2PA and
   JUMBF markers are content-credential containers, and an OpenAI claim
   generator inside one is a signed, machine-readable assertion that a language
   model wrote the document. */
const INFO = ['Producer', 'Creator', 'Author', 'Title', 'Subject', 'Keywords',
              'CreationDate', 'ModDate'];
const MARKERS = ['c2pa', 'jumbf', 'urn:uuid', 'openai', 'OpenAI', 'Adobe',
                 'contentcredentials', 'claim_generator', 'trustmark',
                 'xmpmeta', 'xpacket', 'dc:creator', 'photoshop', 'Microsoft',
                 'Word', 'LibreOffice', 'Skia', 'Chrome', 'Chromium', 'Google'];

/* The PII this repo is checked for, written as shapes rather than as the actual
   values. Two reasons, and the second is the important one:
     · a shape catches the next phone number somebody pastes in, not only the
       one that was there last time;
     · this file is public. A check written as the ten literal digits would
       publish the number, in plain indexable text, inside the tool whose whole
       purpose is to keep it out. That mistake is easy to make and it is worse
       than the leak it guards against.
   Same list as tools/build-resume.js, kept here too so an arbitrary PDF can be
   audited without running a build. */
const PII = [
  ['phone', /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g],
  ['postcode', /\b110\d{3}\b/g],
  ['locality', /\b(?:East|West|North|South|Central)\s+Delhi\b/gi],
  /* Rejects every wrong spelling of the username and passes the right one
     (BU1lDR, lowercase L). The old PDFs had BU1DR and BU1IDR; both 404. */
  ['broken github username', /BU1(?!lDR)[A-Za-z0-9]{0,2}DR/g],
];

/* Trim a match down to something safe to print on a terminal. Matches from the
   binary layers are arbitrary bytes, and echoing those raw can carry escape
   sequences into the shell. */
const show = (s) => JSON.stringify(s.length > 40 ? s.slice(0, 40) + '…' : s)
                      .replace(/[^\x20-\x7E]/g, '.');

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node pdf-audit.js <file.pdf> ...'); process.exit(2); }

for (const f of files) {
  const buf = fs.readFileSync(f);
  const raw = buf.toString('latin1');
  console.log('\n' + '='.repeat(68));
  console.log(f + '   ' + buf.length + ' bytes');
  console.log('='.repeat(68));

  /* ── the Info dictionary ─────────────────────────────────── */
  const info = [];
  for (const k of INFO) {
    const re = new RegExp('/' + k + '\\s*(\\([^)]*\\)|<[0-9A-Fa-f\\s]+>)', 'g');
    let m;
    while ((m = re.exec(raw)) !== null) info.push('  /' + k + ' = ' + m[1].slice(0, 140));
  }
  console.log(info.length ? info.join('\n') : '  (no Info entries in the raw bytes)');

  /* ── inflate everything, then search both layers ──────────── */
  let streams = 0, inflated = 0;
  const layers = { raw: raw, deflated: '' };
  const re = /stream\r?\n?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    streams++;
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    const body = buf.subarray(start, end);
    let out;
    try { out = zlib.inflateSync(body); }
    catch (e) { try { out = zlib.inflateRawSync(body); } catch (e2) { continue; } }
    inflated++;
    layers.deflated += out.toString('latin1');
  }
  console.log('\n  ' + inflated + ' of ' + streams + ' streams inflated (' +
              layers.deflated.length + ' bytes of decompressed content)');

  /* ── layer 3: what a reader actually sees ─────────────────────
     Shelled out to poppler rather than attempted here. Reconstructing text from
     a subset font means parsing the font descriptor, the ToUnicode CMap and the
     glyph widths, and a scanner that gets that subtly wrong reports clean. */
  try {
    layers.text = execFileSync('pdftotext', ['-layout', f, '-'],
                               { encoding: 'utf8', maxBuffer: 1 << 24 });
    console.log('  ' + layers.text.split('\n').length + ' lines of extracted text');
  } catch (e) {
    layers.text = '';
    console.log('  !! pdftotext unavailable — the visible-text layer was NOT checked');
    console.log('     (' + e.message.split('\n')[0] + ')');
    process.exitCode = 3;
  }

  /* ── provenance ──────────────────────────────────────────── */
  const found = {};
  for (const k of MARKERS) {
    const where = [];
    if (layers.raw.includes(k)) where.push('raw');
    if (layers.deflated.includes(k)) where.push('inflated');
    if (where.length) found[k] = where.join('+');
  }
  console.log('\n  provenance markers: ' +
              (Object.keys(found).length
                 ? Object.entries(found).map(([k, v]) => k + ' (' + v + ')').join(', ')
                 : 'none'));

  /* ── the PII ─────────────────────────────────────────────────
     A hit in the TEXT layer is conclusive: that is what a reader and an ATS
     parser see. A hit in the raw or inflated bytes and nowhere else is not,
     because compressed streams carry font tables full of arbitrary digit runs —
     the Chromium-printed resume has a descending byte sequence in its glyph
     index that reads 9876543210, and any ten-digit pattern matches it.

     So the two are reported separately and only a text hit sets a failing exit
     code. The matched substring is printed either way, which is the part that
     matters: the first version of this section printed "PRESENT phone" and no
     evidence, so the only way to find out it was a font table was to go and
     re-extract the streams by hand. A finding without its evidence gets
     ignored or it gets believed, and both are wrong. */
  console.log('');
  let bad = 0, suspect = 0;
  for (const [name, pat] of PII) {
    const find = (layer) => { pat.lastIndex = 0; return layer.match(pat) || []; };
    const hits = { text: find(layers.text), raw: find(layers.raw),
                   inflated: find(layers.deflated) };
    const label = hits.text.length ? 'PRESENT'
                : (hits.raw.length || hits.inflated.length) ? 'binary?'
                : 'clean  ';
    if (hits.text.length) bad++;
    else if (hits.raw.length || hits.inflated.length) suspect++;

    const where = Object.entries(hits).filter(([, a]) => a.length)
                        .map(([k, a]) => k + ':' + a.length).join(' ');
    console.log('  ' + label + '  ' + name.padEnd(24) + where);

    /* Up to three samples per layer, deduplicated — enough to recognise a font
       table, few enough not to bury the report. */
    for (const [layer, arr] of Object.entries(hits)) {
      if (!arr.length) continue;
      const uniq = [...new Set(arr)].slice(0, 3);
      console.log('           ' + layer.padEnd(10) + uniq.map(show).join('  ') +
                  (arr.length > uniq.length ? '  …' : ''));
    }
  }
  console.log('\n  ' + (bad ? bad + ' category(ies) of PII present in the visible text'
                            : 'nothing in the visible text') +
              (suspect ? ', ' + suspect + ' matched only in binary streams — read the samples above'
                       : ''));
  if (bad) process.exitCode = 1;
}
