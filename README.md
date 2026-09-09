# Portfolio — 零と壱より生まれる

A personal portfolio site for **Aryan Verma** — cybersecurity and ethical
hacking, based in Delhi. Dark, Japanese-influenced, terminal-flavoured. Plain
HTML, CSS and JavaScript — no framework, no build step, no dependencies. Open
`index.html` and it runs.

**Live:** https://bu1ldr.github.io/Portfolio/

---

## What's in it

| Feature | Where |
|---|---|
| Wireframe torii gate in real 3D (hand-written perspective projection, canvas 2D) | `js/scene.js` |
| Interactive shell — 33 commands, history, tab completion, typo suggestions | `js/terminal.js` |
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
| 1 | `index.html:11` | Name, description, canonical URL, social preview, JSON-LD |
| 2 | `index.html:145` | Hero pitch — the line under your name |
| 3 | `index.html:163` | Social links (hero) |
| 4 | `index.html:229` | Bio — three short paragraphs |
| 5 | `index.html:289` | Skills — plain lists, one `article` per group |
| 6 | `index.html:362` | Projects. Duplicate one `article.card` per project |
| 7 | `index.html:421` | Timeline — education and experience |
| 7b | `index.html:452` | Certifications |
| 8 | `index.html:506` | Contact form: your email and Formspree ID |
| 9 | `js/data.js` | **The terminal's brain** — everything `whoami`, `skills`, `projects`, `certs`, `neofetch` etc. print |

`js/data.js` is separate on purpose: the page and the terminal each need the
same facts, and this way you write them once.

The only placeholder left in the repo is `YOUR_FORMSPREE_ID` — see step 3.
Everything else is real; grep for that string and you'll find the last gap.

### 2. Drop in three files

See `assets/README.txt` for the details:

- `assets/resume.pdf` — linked from the hero, the contact panel, and the
  terminal's `resume` command
- `assets/og.png` — 1200×630, the image shown when the link is shared
- `assets/me.jpg` — optional portrait for the About card (it falls back to the
  零 glyph if absent)

### 3. Wire up the contact form

The form works without a backend — it opens the visitor's mail client. For real
inbox delivery, create a free form at [formspree.io](https://formspree.io),
then in `index.html` replace `YOUR_FORMSPREE_ID` in the `<form action>` with
your ID. The code detects the change and switches from `mailto:` to `fetch`
automatically.

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
help  whoami  about  skills  projects  work  experience  education  certs
path  contact  socials  links  email  resume  ls  cat  neofetch  banner
matrix  goto  date  echo  history  pwd  uname  clear  exit  sudo  hack
vim  coffee  42
```

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
.github/workflows/      GitHub Pages deploy
.nojekyll               stops Pages from running Jekyll over the files
```

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
