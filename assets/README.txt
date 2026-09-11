assets/ — two files left to drop in, and the site is complete.

────────────────────────────────────────────────────────────────

1. resume.pdf                                        ← IN PLACE ✓
   Your CV. The hero "Resume" button, the Contact sidebar, and
   the terminal's `resume` command all point at this exact path:

       assets/resume.pdf

   Copied from ..\..\Resume_AryanVerma.pdf on 2026-09-10.
   Re-copy it whenever you update the original:

       cp ../../Resume_AryanVerma.pdf assets/resume.pdf


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


4. og.png                                            ← RECOMMENDED
   The image people see when your link is shared on WhatsApp,
   LinkedIn, X, Slack, Discord.

   Size:  1200 x 630 px, PNG (not SVG — sites won't render it)
   Keep:  your name large, one line of role text, dark background
          with the red accent. Leave ~80px of breathing room on
          every edge; some platforms crop.

   Quick way to make one: open the site, screenshot the hero at
   1200x630, and export as PNG.

   Until this file exists, shared links will show no preview
   image. Nothing else breaks.


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

Seven transparent PNGs, 600x600 (networking-basics is 650), the
official Credly badge images. The grid shows them at 64px, muted
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

If you add a credential later, grab its badge from Credly at
600px or larger, save it as PNG with transparency, and name it
to match the PDF.

Not published, and deliberately so: the seven "Digital Sticker"
PNGs in the source folder. They're participation stickers rather
than certifications, and mixing them into the list would dilute
the eleven that are real credentials.
