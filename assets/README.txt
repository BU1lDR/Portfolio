assets/ — one optional file left to drop in (me.jpg, item 5).
Everything else here is in place.

────────────────────────────────────────────────────────────────

1. resume.pdf  +  resume.src.html                    ← IN PLACE ✓
   Your CV. The hero "Resume" button, the Contact sidebar, and
   the terminal's `resume` command all point at this exact path:

       assets/resume.pdf

   DON'T EDIT THE PDF, AND DON'T COPY ONE IN OVER IT.
   resume.src.html is the source now, and resume.pdf is built from
   it by printing it with headless Chromium:

       node tools/build-resume.js          (from the repo root)

   Edit the HTML, run that, done. Every number in the stylesheet
   there is commented, including why the document sits about 9pt
   off the bottom margin and what breaks if you add a line.

   Why it works this way, and not with a `cp` from wherever the PDF
   came from — the PDF that used to be here:

     · printed a mobile number and a zone-plus-postcode address
       across the top of a file served to anyone who asks for it,
       forever, and archived in git besides. Neither value is
       written out here, or in resume.src.html, or in the scripts
       that check for them - they match the shape of an Indian
       mobile number and of a Delhi postcode. Quoting a secret in
       the note that says you removed it does not remove it, and
       text in a public repo is easier to find than a PDF: GitHub
       indexes text, and the digits inside a PDF page are glyph
       indices that match no search;
     · carried a signed C2PA manifest — an embedded content
       credential naming ChatGPT as the claim generator and
       asserting digitalSourceType trainedAlgorithmicMedia. Not a
       stray string: a cryptographically signed attachment, and
       none of it visible in a PDF reader;
     · linked github.com/BU1DR, which is a 404. The username is
       BU1lDR with a lowercase L. Arial draws that L identically to
       a capital I, so this class of typo cannot be proofread by
       looking at it — click the link, or extract the text.

   Re-exporting from any AI writing tool puts all of that back. So
   before you replace this file, run:

       node tools/pdf-audit.js assets/resume.pdf

   It reads three separate layers — raw bytes, inflated object
   streams, and the visible text via pdftotext — because the
   visible text is NOT greppable: the page addresses glyphs by
   index into a subset font, so a phone number printed across the
   top of the page is invisible to any scanner that skips
   pdftotext. build-resume.js runs the same checks on its own
   output and refuses to finish if one fails.

   Keep a private copy with your phone number on it for actual
   applications. Do not put that copy in this repo.


2. pfp.jpg                                           ← IN PLACE ✓
   Used twice, both times briefly and both times processed so it
   never reads as a plain photo:

     · the boot overlay's identity frame, for about a second
       while the loading sequence runs
     · poured into the letterforms of "ARYAN" in the hero, via
       background-clip: text on .glitch__photo

   Copied from ..\..\hacker_pfp.png. If you swap it, keep it
   roughly square — the hero crop assumes it.


3. certs/ and badges/                                ← IN PLACE ✓
   Eleven certificate PDFs and the seven issuer badge images
   behind the Certifications block. See the note at the bottom.


4. og.png                                            ← IN PLACE ✓
   The image people see when your link is shared on WhatsApp,
   LinkedIn, X, Slack, Discord. 1200 x 630, which is the one size
   every platform agrees on.

   It is GENERATED, not drawn: it is rendered from this site's own
   css/style.css and assets/samurai/idle.png, so the colours, the
   typefaces and the samurai are the same ones the site uses and
   cannot fall out of step with them. If you change the design,
   regenerate it rather than retouching the PNG.

   Two things to know if you replace it by hand instead:
     - it must stay exactly 1200 x 630, because index.html declares
       those numbers in og:image:width / :height and unfurlers lay
       the card out from them before the image arrives;
     - keep the important part away from the edges. Slack and
       Discord crop, so anything within ~40px of an edge may be
       cut off.

   LinkedIn, Slack and WhatsApp cache preview images hard. If you
   update this after sharing the link anywhere, run the URL through
   LinkedIn's Post Inspector to force a re-fetch.


5. me.jpg                                            ← OPTIONAL
   A photo of you for the ID card in the About section.
   Square crop, 400x400 or larger.

   To use it, open index.html, find the idcard__avatar block,
   and swap the placeholder for:

       <img src="assets/me.jpg" alt="Aryan Verma">

   Delete the <span>零</span> line when you do.

────────────────────────────────────────────────────────────────

favicon.svg is already here — that's the little torii gate in
the browser tab. Edit the two fill colours if you change the
site's accent.

────────────────────────────────────────────────────────────────

certs/ — the certificate PDFs

Eleven files, ~4.5 MB in total, copied from
D:/DATA/Desktop/Aryan/certifications/ on 2026-09-10 and renamed
to kebab-case. Nothing loads them until a visitor clicks, so
they cost the page nothing.

All eleven were read before publishing. Each contains only your
name, the course, the issuer, a completion date and a course or
certificate ID — no address, no phone number, no date of birth,
and no identifying metadata (no author field, no local paths).
Check any file you add later the same way, because that is not
true of certificates generally.

Two of them were the reason a couple of entries got corrected:
the C programming course is E&ICT Academy, IIT *Kanpur* (the
page had said Roorkee), and the IBM one is "Using LLMs *to
Work* with Data".

Where a credential exists as both a terse award and a fuller
"Certificate of Course Completion" — the three Cisco ones — the
fuller version is here, because it lists the learning outcomes
and carries a QR verification code.

One source filename contained your email address; it was
renamed to cisco-packet-tracer-getting-started.pdf on the way
in, so the published URL doesn't carry it.

badges/ — issuer badge art

Seven transparent PNGs, 128x128, the official Credly badge images
downscaled. They arrived at 600x600 (networking-basics at 650) and
were resampled in 859cb77, which took the seven of them from 296KB
to 76KB for art that is never drawn above 64px.

The grid shows them at 64px, muted
with saturate(.62), and restores full colour on hover or
keyboard focus — Cisco cyan and IBM magenta at full strength
fight this site's palette.

Muted rather than greyed, which was the first attempt and worth
not repeating: these badges are small posters with their own
typography, so desaturating them entirely turns all eleven rows
into the same illegible grey square. 64px is roughly the size
where the wordmark becomes readable.

The four credentials with no badge art show the issuer's short
name in mono instead ("cisco", "aws", "IBM", "IIT Kanpur"). A ✓
was there first, but an empty 64px box reads as an image that
failed to load.

If you add a credential later, grab its badge from Credly, resize
it to 128x128, save it as PNG with transparency, and name it to
match the PDF. Don't drop a 600px one straight in — it will look
identical and cost four times the bytes.

Not published, and deliberately so: the seven "Digital Sticker"
PNGs in the source folder. They're participation stickers rather
than certifications, and mixing them into the list would dilute
the eleven that are real credentials.


samurai/ — the guard on the terminal window

Seven sprite sheets, 128x128 cells, 35KB for the lot. Art by
CraftPix ("Samurai Pixel Art Sprite Sheets", the free pack) and
used under their file licence: https://craftpix.net/file-licenses/
Credited in the footer as well as here, because a licence that
costs nothing still costs an attribution.

  idle.png       640x128   5 frames   at his post, breathing
  run.png       1024x128   8 frames   entrances, run-up, `spar`
  jump.png       896x128   7 frames   f2-f6 leap, f4-f6 land
  attack_2.png   640x128   5 frames   overhead kesa-giri -> close
  attack_3.png   512x128   4 frames   horizontal cut -> minimise
  protect.png    256x128   2 frames   guard, when you poke him
  hurt.png       256x128   2 frames   the fourth poke

The last two arrived with the easter eggs and are the only two
standing poses in here, which made them the only two that could
not be registered the way the other five were: the hip band that
lines up the action sheets gives them two different answers
despite identical legs. Both sit at left: 7px, off the legs and
feet bands instead. The derivation is written out in style.css
§10b next to the rules that use it.

hurt.png is 16KB of the 35 — an unoptimised encode from the
source pack, not a bigger sheet. Left as it came, because 14KB is
not worth a lossy step through another tool on art that is
someone else's.

Lowercased on the way in, because GitHub Pages is case-sensitive
and the source pack ships Title Case — a mismatch that works
locally on Windows and 404s only once it's published.

The source pack has ten poses for each of three characters. Only
these seven, from Samurai_Commander alone, are in this repo. The
rest stay out on purpose: Walk, Dead and Attack_1 are never
referenced, and shipping the other two characters, the PSDs, or
the pack's coupon would put ~40MB of unused binary into a repo
that is otherwise a few hundred KB of text. If you want a
different pose later, take it from the original download rather
than expecting to find it here.

Which frames of jump.png get used is not arbitrary — f0 and f1
are the crouch, and starting a leap from them makes him hesitate
before a window that has already begun moving. See style.css
§10b for the frame maths and js/samurai.js for the timing.
