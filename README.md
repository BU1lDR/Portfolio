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
| 1 | `index.html:94` | Name, description, canonical URL, social preview, JSON-LD |
| 2 | `index.html:615` | Hero pitch — the line under your name |
| 3 | `index.html:638` | Social links (hero) |
| 4 | `index.html:712` | Bio — three short paragraphs |
| 5 | `index.html:772` | Skills — plain lists, one `article` per group |
| 6 | `index.html:845` | Projects. Duplicate one `article.card` per project |
| 7 | `index.html:952` | Timeline — education and experience |
| 7b | `index.html:1008` | Certifications |
| 8 | `index.html:1207` | Contact form — the address it falls back to. No backend to configure |
| 9 | `js/data.js` | **The terminal's brain** — everything `whoami`, `skills`, `projects`, `certs`, `neofetch` etc. print |

All nine of those line numbers drift every time the page grows, and all nine have
now been wrong more than once — once by between 45 and 92 lines each, which put
every reference in the middle of whatever had moved up to take its place. Near
enough to look plausible, far enough to be useless. `grep -n 'EDIT #' index.html`
is the version that cannot go stale, and it is still the better habit.

They are checked now, on every deploy, which is the part that was missing rather
than the numbers themselves: `tools/check-edit-blocks.js` re-derives all nine from
`index.html` and fails if this table disagrees, in either direction — a block that
grew a line and a block added to the page but never added here are the same defect
from a reader's point of view. It also reads the count in this paragraph, because
the sentence above used to say "all eight" over a table of nine rows, and a
hand-written count of the rows directly beneath it is no more reliable than a
hand-written copy of anything else.

It earned itself immediately, which is the part worth recording. The same commit
that corrected these nine numbers also rewrote a comment near the top of
`index.html` — three lines longer than what it replaced, so every block below it
moved down by three and all nine numbers were wrong again before the commit was
finished. That is the whole failure mode in one commit: not carelessness, but a
number in one file that depends on the length of another. The check caught it and
printed the corrected table; the drift never left this machine.

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
js/eggs.js              the easter-egg scoreboard (not deferred — 404.html pins
                        an inline block's hash against running after it)
js/samurai.js           the guard on the terminal window's roof; decides when he
                        breathes and when he cuts, the rest is CSS
js/main.js              boot, nav, cursor, tilt, reveals, form
assets/                 resume, favicon, social image, portrait
tools/                  six checks and the resume build; four run on deploy
.github/workflows/      GitHub Pages deploy, two weekly checks, and a ping to the
                        profile README on every push (see BU1lDR/BU1lDR)
.nojekyll               stops Pages from running Jekyll over the files
```

Three entries have been missing from that list at some point: `tools/`, and then
`js/eggs.js` and `js/samurai.js` — two files the page loads on every visit, absent
from the structure block while the same README explained at length how copies of a
fact drift apart. A hand-written list of files is a copy of the directory, and it
goes stale the same way every other copy does; this one has no check behind it and
is not worth one, so it gets the honest version instead, which is an admission
rather than a guarantee.

What matters about `tools/` is which of the seven a deploy runs, because a check
nobody triggers is documentation. And these counts are themselves a copy of a fact
`ls tools/` owns, so: the line above read "five checks and the resume build" over a
directory holding five files in total, while the sentence you are reading said "the
five" and the paragraphs below accounted for exactly five — three claims about one
directory, two of which could not both be right. Seven files now, six of them
checks. The breakdown below is the part to trust, because it is the part that had
to be correct for anything else here to be true.

The deploy runs four, and each asserts something claimed somewhere a reader can
see:

- `csp-audit.js` — the Content-Security-Policy against the pages it guards, in
  both directions, plus the sentence at the top of this file: every host the
  policy admits has to be one of the two Google font origins, so "the only thing
  the page loads from anyone else" cannot quietly stop being true. It also holds
  `index.html` to carrying no `'unsafe-inline'` or `'unsafe-eval'` in *any*
  directive, which is what that file's own CSP comment claims and what the audit
  did not check until now: it verified that inline CSS and `style-src` agree with
  each other, and a page that gained a `style` attribute and gained
  `'unsafe-inline'` to match satisfies that perfectly. `404.html` is deliberately
  exempt and keeps it for styles — hashes do not cover `style` attributes at all,
  and the comment above its policy argues the case. The point of the exemption
  being a named list is that the difference between the two pages is a decision
  rather than something nobody noticed.
- `check-commands.js` — the command counts. `js/terminal.js` is the only thing
  that knows how many commands there are; the two numbers further down, the one in
  the feature table above, the placeholder in `index.html` and the first sentence
  of the repository's GitHub description are all copies of its answer. The
  description is the copy no commit can reach, and it is the one that was wrong:
  it advertised "40+ commands" against a table of 51. Not false — which is
  precisely why it lasted. A floor claim is satisfied by any number above it, so
  it cannot go stale in a way a reader can see.
- `link-check.js --offline` — the half of the link checker that is a function of
  the bytes being deployed: local `href`s and `src`s pointing at no file, in-page
  anchors matching no `id`, a `target="_blank"` without `rel="noopener"`, and any
  surviving reference to the deleted `my_projects` monorepo. Those went unchecked
  entirely until this was wired up; the tool had existed for a while and nothing
  ran it, which is the same as not having it, except that by then a README
  elsewhere had started describing it.
- `check-edit-blocks.js` — the setup checklist above, against the page it sends
  you into. Nine `index.html:N` references, re-derived rather than trusted, in
  both directions: a number that moved, and a block added to the page that never
  got a row, which a reader working the list in order simply never edits. It reads
  the spelled-out count in that paragraph too, since "all eight" over nine rows is
  the kind of claim that is falsifiable by looking down and was wrong anyway.

The network half of that checker runs weekly instead, in `link-rot.yml`, and not
on the deploy path — on purpose. Link rot is time-based, not commit-based: a repo
deleted last Tuesday is not a fact about today's diff, and a Credly rate-limit or
a LinkedIn `999` must not be able to block publishing a typo fix. Nothing is
"failed" by that workflow in the sense a deploy gate fails something — there is
no build here, and the site is already published. What a red scheduled run does is
notify, and that is worth stating plainly, because the sentence written about this
tool before anything ran it said it failed builds.

`check-resume-count.js` is on a clock too, in `resume-claims.yml`, for the same
reason and about a different fact. `assets/resume.src.html` names a test count for
secscan, and that is the only figure on the resume that goes wrong without anybody
editing the resume — the other repo gains a test and there is no diff here for
anyone to review. It went wrong that way five times before this check existed and
once since — 355, 357, 367, 396, 446 and 448 in turn, from a first 353 — and the
fifth time it read 396 against a real 446 in *both* the source and the committed PDF, which is why
`build-resume.js` reported clean: the only thing it can compare is those two
against each other, and they agreed. Its own comment names that exact case and
prescribes deleting the parenthetical rather than carrying a wrong number. This is
the option that comment did not have. The check reads the figure secscan
publishes, where that repo's CI holds it to what `pytest` actually collects, so
the chain now runs from a test run to the PDF a stranger downloads without an
unguarded link in the middle. It is a separate workflow from the link check rather
than a step inside it because a run that goes red should not need investigating to
find out what it was about.

The remaining two are run by hand and say so here rather than implying a
guarantee: `pdf-audit.js` (what a PDF discloses about itself beyond its text) and
`build-resume.js`, which builds `assets/resume.pdf` and is the one thing here that
needs an `npm install` — playwright, for headless Chromium. It also wants poppler's
`pdftotext`, and so do the other two tools that read the PDF, which is why the
weekly workflow installs it rather than assuming the runner has it.

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
projected through a pinhole camera every frame — about 60 lines of maths, and the
reason the webfont is still the only thing this page fetches from anybody else.
This said "keeps the promise of zero dependencies intact", which was a promise the
top of this same file spends a paragraph explaining was never true.

**The theme is aesthetic.** "Black hat" here means the visual language —
terminal, glitch, katakana rain. There is nothing offensive in the code, and
the `hack` command says so itself.
