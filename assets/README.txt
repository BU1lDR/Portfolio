assets/ — two files left to drop in, and the site is complete.

────────────────────────────────────────────────────────────────

1. resume.pdf                                        ← IN PLACE ✓
   Your CV. The hero "Resume" button, the Contact sidebar, and
   the terminal's `resume` command all point at this exact path:

       assets/resume.pdf

   Copied from ..\..\Resume_AryanVerma.pdf on 2026-09-10.
   Re-copy it whenever you update the original:

       cp ../../Resume_AryanVerma.pdf assets/resume.pdf


2. og.png                                            ← RECOMMENDED
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


3. me.jpg                                            ← OPTIONAL
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

OPTIONAL — certificate PDFs

The Certifications block links to your Credly profile, which
publicly verifies the badge-backed ones. If you'd rather offer
the PDFs directly, copy them in:

    mkdir -p assets/certs
    cp "D:/DATA/Desktop/Aryan/certifications/Junior_Cybersecurity_Analyst.pdf" \
       assets/certs/cisco-junior-cybersecurity-analyst.pdf
    # …and the rest

then wrap each <b> in index.html's .certs__list in an <a href>.
Worth knowing: certificate PDFs sometimes carry your full
address or an ID number, so open them before publishing.
