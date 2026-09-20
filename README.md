# Portfolio — 零と壱より生まれる

A personal portfolio site for **Aryan Verma** — cybersecurity and ethical
hacking, based in Delhi. Dark, Japanese-influenced, terminal-flavoured. Plain
HTML, CSS and JavaScript — no framework, no build step, nothing to install to
serve it. A Google-hosted webfont is the only thing the page loads from anyone
else, and the CSP is what holds that line. Open `index.html` and it runs, webfont
or not.

"Nothing to install to serve it" rather than "no dependencies", which is what this
line used to say and which was false in two directions. The page fetches a webfont
from Google, so it does have a runtime dependency on somebody else's server; and
`tools/build-resume.js` needs playwright and poppler's `pdftotext` to turn
`assets/resume.src.html` into the committed PDF, so the repository is not
npm-free either. Neither affects serving the site — there is no `package.json`,
no `node_modules`, and nothing is compiled — but a blanket "no dependencies"
claimed both, and only one of the two was ever true.

**Live:** https://bu1ldr.github.io/Portfolio/

---

## What's in it

| Feature | Where |
|---|---|
| Wireframe torii gate in real 3D (hand-written perspective projection, canvas 2D) | `js/scene.js` |
| Interactive shell — 21 commands, history, tab completion, typo suggestions | `js/terminal.js` |
| Matrix rain (`matrix` command, or the Konami code) | `js/scene.js` |
| Custom cursor, 3D card tilt, glitch text, scroll reveals, boot sequence | `js/main.js` |
| Contact form with validation and a `mailto:` fallback | `js/main.js` |
| SEO: canonical URL, Open Graph, Twitter card, JSON-LD `Person`, sitemap | `index.html` |
| Auto-deploy to GitHub Pages | `.github/workflows/deploy.yml` |

Accessibility and preferences are handled throughout: `prefers-reduced-motion`
collapses every animation to a static frame, the terminal output is an
`aria-live` log, there's a skip link, and the whole site works keyboard-only.

---

## Running it locally

No tooling required. Either open `index.html` directly, or serve it — a server
is closer to production and avoids `file://` quirks:

```bash
python -m http.server 4173
# then visit http://localhost:4173
```

---

## Setup checklist

### 1. Fill in your content

Everything you need to change is inside a numbered `EDIT #N` comment block.
Search for `EDIT #` and work through them in order.

| # | File | What it holds |
|---|---|---|
| 1 | `index.html:46` | Name, description, canonical URL, social preview, JSON-LD |
| 2 | `index.html:455` | Hero pitch — the line under your name |
| 3 | `index.html:478` | Social links (hero) |
| 4 | `index.html:552` | Bio — three short paragraphs |
| 5 | `index.html:612` | Skills — plain lists, one `article` per group |
| 6 | `index.html:685` | Projects. Duplicate one `article.card` per project |
| 7 | `index.html:765` | Timeline — education and experience |
| 7b | `index.html:806` | Certifications |
| 8 | `index.html:1005` | Contact form — the address it falls back to. No backend to configure |
| 9 | `js/data.js` | **The terminal's brain** — everything `whoami`, `skills`, `projects`, `certs`, `neofetch` etc. print |

Those line numbers drift every time the page grows — all eight were several
hundred lines out before this table was last corrected. `grep -n 'EDIT #'
index.html` is the version that cannot go stale.

`js/data.js` is separate on purpose: the page and the terminal each need the
same facts, and this way you write them once.

Nothing in the repo is a placeholder any more. There was one — a dead Formspree
endpoint in the contact form's `action` — and it was deleted rather than filled
in; see step 3 for why the form works regardless. The string survives in one
comment in `js/main.js`, where it explains what the stand-in guard is guarding
against; it is not used as a value anywhere.

### 2. Drop in three files

See `assets/README.txt` for the details:

- `assets/resume.pdf` — linked from the hero, the contact panel, and the
  terminal's `resume` command
- `assets/og.png` — 1200×630, the image shown when the link is shared
- `assets/me.jpg` — optional portrait for the About card (it falls back to the
  零 glyph if absent)

### 3. Wire up the contact form

Nothing to do — it already works. The form has no `action` attribute, and
`js/main.js` §08 treats that absence as "no backend" and composes the message
into the visitor's own mail client instead. That is a real send.

For inbox delivery instead, create a free form at
[formspree.io](https://formspree.io) and add its endpoint as the action:

```html
<form class="form reveal" id="contactForm" action="https://formspree.io/f/abcd1234" ...>
```

§08 switches from `mailto:` to `fetch` as soon as the action is an `http(s)` URL.
Nothing else changes.

Put the real ID in, not a stand-in. An action pointing at a form ID nobody owns
is worse than no action at all — the code believes it and POSTs to it, and
Formspree answers 404, so the visitor gets an error for a message that had a
working `mailto:` route until you edited this. §08 rejects any action containing
the word "your" and stays on `mailto:` for exactly that reason.

### 4. Turn on GitHub Pages

One-time, in the repository: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

After that every push to `main` deploys itself. If you host at a different path
than `/Portfolio/`, update the canonical URL and the `og:image` URL in
`EDIT #1`, plus the `<loc>` in `sitemap.xml`.

---

## Terminal commands

Type `help` in the terminal on the site, or:

```
about  banner  cat  certs  clear  contact  education  eggs  exit
experience  goto  help  ls  matrix  minimise  neofetch  path  projects
resume  skills  whoami
```

Those are the 21 `help` lists, which is the same number the card on the site
shows — both come from the one filter in `js/terminal.js` (`!hidden`), so
adding a command updates all three at once. `CMDS` holds 51 names in total;
the other 30 are aliases and easter eggs, and they stay off this list for the
same reason they stay off `help`.

It also understands a few things that aren't commands — `rm -rf /`, `cd ..`,
"hello", "thanks". Try them.

---

## Structure

```
index.html              the whole page — every section, all the edit blocks
404.html                styled not-found page
css/style.css           19 numbered sections, design tokens at the top
js/data.js              your facts, in one object (loaded first, not deferred)
js/scene.js             3D torii + matrix rain
js/terminal.js          the shell
js/main.js              boot, nav, cursor, tilt, reveals, form
assets/                 resume, favicon, social image, portrait
tools/                  the checks the deploy runs, and the resume build
.github/workflows/      GitHub Pages deploy
.nojekyll               stops Pages from running Jekyll over the files
```

`tools/` was missing from that list until the list was checked, which is its own
small version of the problem two of the files in it exist to solve. Five files,
and what matters about them is which ones a deploy runs — a check nobody triggers
is documentation.

The deploy runs two, and both assert something this README claims:

- `csp-audit.js` — the Content-Security-Policy against the pages it guards, in
  both directions, plus the sentence at the top of this file: every host the
  policy admits has to be one of the two Google font origins, so "the only thing
  the page loads from anyone else" cannot quietly stop being true.
- `check-commands.js` — the command counts. `js/terminal.js` is the only thing
  that knows how many commands there are; the two numbers further down, the one in
  the feature table above, the placeholder in `index.html` and the first sentence
  of the repository's GitHub description are all copies of its answer. The
  description is the copy no commit can reach, and it is the one that was wrong:
  it advertised "40+ commands" against a table of 51. Not false — which is
  precisely why it lasted. A floor claim is satisfied by any number above it, so
  it cannot go stale in a way a reader can see.

The other three are run by hand, and say so here rather than implying a
guarantee: `link-check.js` (every link still resolves, with an `--offline` mode),
`pdf-audit.js` (what a PDF discloses about itself beyond its text), and
`build-resume.js`, which builds `assets/resume.pdf` and is the one thing in the
repository that needs installing anything.

## Notes on a couple of decisions

**There is no light theme.** Not "dark by default" — dark, full stop. A site
built on vermilion, terminal green and shadow doesn't have a cream-paper mode
that means the same thing, so there's no toggle, no `prefers-color-scheme`
branch, and no stored preference. The palette lives in one `:root` block at the
top of `css/style.css`; change it there if you want a different look.

**Skills have no percentages.** There were animated meters here at first —
"Python 82%", that sort of thing. A self-assigned number is unverifiable by
definition, so it can only be discounted or disbelieved; the projects and the
certifications are the actual evidence. The section is plain grouped lists now.

**The 3D is hand-rolled.** No Three.js. Vertices are rotated in model space and
projected through a pinhole camera every frame, which keeps the promise of zero
dependencies intact for the sake of about 60 lines of maths.

**The theme is aesthetic.** "Black hat" here means the visual language —
terminal, glitch, katakana rain. There is nothing offensive in the code, and
the `hack` command says so itself.
