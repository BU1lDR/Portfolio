/* ═══════════════════════════════════════════════════════════════
   data.js — everything the terminal knows about you.

   ┌─────────────────────────────────────────────────────────────┐
   │  EDIT #9 — this file is the terminal's brain.                │
   │  Keep it roughly in sync with index.html. If you only have   │
   │  time for one, do index.html first (that's what Google and   │
   │  recruiters read); the terminal is the fun layer on top.      │
   └─────────────────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

window.PORTFOLIO = {

  /* ── identity ───────────────────────────────────────────── */
  profile: {
    name: 'Aryan Verma',
    handle: 'aryan',
    host: 'shadow',
    title: 'Cybersecurity Analyst · Ethical Hacker',
    tagline: 'Born of 1s & 0s — 零と壱より生まれる',
    location: 'Delhi, India · IST (UTC+5:30)',
    email: 'aryanverma102007@gmail.com',
    status: 'Open to internships',
    // Short first-person blurb for `whoami` / `about`.
    bio: [
      "Hi, I'm Aryan — a curious learner, always looking for a reason to",
      "pull something apart and find out how it actually works.",
      "",
      "I'm particularly interested in cybersecurity and ethical hacking:",
      "understanding how systems behave, where they give, and how they can",
      "be made harder to break.",
      "",
      "Alongside that I'm working through data analysis and system design,",
      "while reading for a B.Tech at ADGIPS (GGSIPU) in Delhi."
    ]
  },

  /* ── links ──────────────────────────────────────────────── */
  socials: [
    { key: 'github',   label: 'GitHub',   url: 'https://github.com/BU1lDR' },
    { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/aryanver' },
    { key: 'credly',   label: 'Credly',   url: 'https://www.credly.com/users/aryan_v' },
    { key: 'email',    label: 'Email',    url: 'mailto:aryanverma102007@gmail.com' }
  ],

  resumeUrl: 'assets/resume.pdf',

  /* ── skills ─────────────────────────────────────────────── */
  /* Plain lists, no percentages. A number like "Python: 82%"   */
  /* can't be verified by anyone reading it, so it buys nothing */
  /* — the projects and certifications below do that job.       */
  skills: [
    {
      group: 'Languages',
      items: ['Python', 'C', 'C++', 'SQL', 'JavaScript']
    },
    {
      group: 'Security & Recon',
      items: ['Nmap', 'Wireshark', 'Burp Suite', 'sqlmap', 'Metasploit', 'Hydra', 'Shodan']
    },
    {
      group: 'Systems',
      items: ['Linux', 'Bash', 'Docker', 'Git & GitHub', 'Networking fundamentals']
    },
    {
      group: 'Backend',
      items: ['FastAPI', 'Uvicorn', 'Pydantic', 'REST APIs', 'pytest']
    },
    {
      group: 'Frontend',
      items: ['HTML & CSS', 'React', 'Tailwind CSS', 'Vite', 'react-router']
    },
    {
      group: 'Data & AI',
      items: ['Pandas', 'NumPy', 'Prompt engineering', 'LLM workflows', 'IBM Project Bob']
    }
  ],

  also: [
    'JSON', 'CLI tooling', 'httpx', 'ESLint', 'GitHub Actions', 'OSINT'
  ],

  /* ── projects ───────────────────────────────────────────── */
  projects: [
    {
      /* Order matters here and on the page: the terminal prints this array in
         order and index.html's cards are numbered 01/02/03 to match. This one
         leads both because it is the largest finished thing — tagged, MIT, a
         public repo with a real test suite.

         No release number and no test count, here or in the blurb. The `code`
         link is one click from the repo that proves both, and a figure typed
         here is a figure that goes stale silently. This comment used to carry
         them and it was wrong about the test count twice in one afternoon —
         each time because tests were added, which is the most routine thing
         that can happen to that repo. The argument made itself, so the numbers
         are gone. The repo's own CI now asserts the count it publishes; that is
         where a number belongs, next to something that can check it. */
      name: 'Security Scanner',
      year: '2026',
      blurb: 'A CLI — secscan — that points three kinds of check at one target ' +
             'and reconciles the results: dependency CVEs from OSV.dev, source ' +
             'patterns like eval and hardcoded keys, and live-site TLS, headers, ' +
             'cookies and exposed files. Passive by default; the intrusive probes ' +
             'stay off until you both ask for them and confirm you’re ' +
             'authorized to test the host.',
      stack: ['Python', 'asyncio', 'httpx', 'cryptography', 'pytest'],
      live: '',
      code: 'https://github.com/BU1lDR/security-scanner'
    },
    {
      /* The capstone from the internship at the top of experience[] — same
         programme, same two months, so the two entries corroborate each other
         instead of each being one unsupported line.

         It sits second, not last, because the evidence behind it is strong:
         public repo, MIT, a notebook that re-runs end to end, and a dataset
         anyone can download and check the numbers against. The figures are the
         exception to the rule in the comment above, and only because they cannot
         go stale the way a test count can — Online Retail II is a frozen public
         dataset and these are the notebook's own outputs over it, recorded in
         outputs/facts.json. Keep "identifies": the 683 are what the segmentation
         flags, not a confirmed count of customers who are gone. */
      name: 'Retail Customer Segmentation',
      year: '2026',
      blurb: 'The IBM SkillsBuild × BharatCares capstone — an end-to-end analysis ' +
             'of 1,067,371 UCI Online Retail II transaction lines in a single ' +
             'notebook: a cleaning audit that accounts for every row it drops, ' +
             'RFM segmentation cross-checked against K-Means, CLV estimation and ' +
             'cohort retention. It identifies 683 high-value accounts, £1.69M of ' +
             'revenue, that had stopped ordering.',
      stack: ['Python', 'pandas', 'NumPy', 'scikit-learn', 'Matplotlib', 'Jupyter'],
      live: '',
      code: 'https://github.com/BU1lDR/retail-customer-segmentation'
    },
    {
      name: 'File Integrity Checker',
      year: '2026',
      blurb: 'A lightweight file integrity monitor. Take a trusted baseline once, ' +
             'run a check whenever you need one, and it names exactly what was ' +
             'modified, added or deleted — no manual diffing, no guesswork.',
      stack: ['Python', 'SHA-256', 'JSON', 'CLI'],
      live: '',
      /* The monorepo this used to point into (my_projects/tree/main/
         file_integrity_checker) was deleted, so both surfaces that render
         projects[] — the Work cards and the terminal's `projects` — were
         serving a 404. Each project is its own repo now. A deep tree URL is
         also the fragile kind of link: it 404s on a branch rename or a
         directory move, silently, and nothing in this repo can detect that.
         tools/link-check.js now walks these and asserts 200. */
      code: 'https://github.com/BU1lDR/file-integrity-checker'
    },
    {
      name: 'अर्थNiti',
      year: '2026',
      blurb: 'Smart India Hackathon 2026 — an AI-driven hyper-local business ' +
             'advisory and financial structuring assistant for rural ' +
             'micro-entrepreneurs. I built the backend: the API surface and ' +
             'the integrations behind it.',
      stack: ['Python', 'FastAPI', 'React', 'Tailwind CSS', 'Vite'],
      live: '',
      code: '',
      note: 'Prototype phase · repository private'
    }
  ],

  /* ── path ───────────────────────────────────────────────── */
  education: [
    {
      when: '2025 — 2029',
      what: 'B.Tech — Information Technology',
      /* The college, then the affiliating university — in that order and not
         GGSIPU alone, which is what this said for a long time. GGSIPU is who
         awards the degree; ADGIPS is where the four years actually happen, and
         naming only the second one disagreed with both the resume and the
         profile README. Keep this string, index.html's timeline row and the
         JSON-LD alumniOf in step; they are three copies of one fact. */
      where: 'Dr Akhilesh Das Gupta Institute of Professional Studies (ADGIPS), GGSIPU — Delhi, India',
      note: 'CGPA 9.04.'
    }
  ],

  experience: [
    {
      /* Aug, not Apr. This said "Apr — Sep 2026" from the first commit and it
         was never right: every version of the resume says Aug, and the four IBM
         SkillsBuild certificates in assets/certs/ are all issued 18-19 Aug 2026.
         Mirror any change here in index.html's timeline — the page carries its
         own static copy of these two entries and only the terminal reads
         this array. */
      when: 'Aug — Sep 2026',
      what: 'Data Analytics Intern',
      where: 'IBM SkillsBuild × BharatCares — Remote',
      note: 'Worked with real-world datasets and learned to apply analytical ' +
            'thinking to them — which is where data analytics and AI stopped ' +
            'being two separate subjects for me.'
    },
    /* A third entry sat here, between the two around it. Removed on request.
       Deliberately not described: the point of taking it off the site is not to
       publish it, and a comment in a public repo is published.

       It is not in the resume either. The gap that existed for one commit — site
       short one role against the PDF the site links to — is closed: the Sep 2026
       entry in assets/resume.src.html is now the same SIH project the second
       entry below describes, so the two documents agree again. If you ever put
       this role back, put it in both, or the drift the comment above warns about
       is exactly what you get. */
    {
      when: '2026',
      what: 'Backend — Lead',
      where: 'Smart India Hackathon — अर्थNiti',
      note: 'Problem statement: AI-driven hyper-local business advisory and ' +
            'financial structuring assistant for rural micro-entrepreneurs.'
    }
  ],

  /* ── certifications ─────────────────────────────────────── */
  /* Most relevant first — security, then AI and data, then the
     fundamentals. `certsVerify` is the public badge profile; `when`
     and `issuer` are transcribed off the certificates themselves.

     Keep this list and the one in index.html in step. The terminal
     prints from here, the page renders from there, and a visitor can
     compare the two in the same screenful.                          */
  certsVerify: 'https://www.credly.com/users/aryan_v',
  certifications: [
    { what: 'Junior Cybersecurity Analyst Career Path',              issuer: 'Cisco Networking Academy',      when: 'Jul 2026' },
    { what: 'Introduction to Cybersecurity',                         issuer: 'Cisco Networking Academy',      when: 'Aug 2026' },
    { what: 'Networking Basics',                                    issuer: 'Cisco Networking Academy',      when: 'Aug 2026' },
    { what: 'Getting Started with Cisco Packet Tracer',              issuer: 'Cisco Networking Academy',      when: 'Jul 2026' },
    { what: 'Foundations of Prompt Engineering',                     issuer: 'Amazon Web Services (AWS)',     when: 'Aug 2026' },
    { what: 'Generative AI Essentials: Using LLMs to Work with Data', issuer: 'IBM SkillsBuild',              when: 'Aug 2026' },
    { what: 'Make Agentic AI Work for You',                          issuer: 'IBM SkillsBuild',              when: 'Aug 2026' },
    { what: 'Data Fundamentals',                                     issuer: 'IBM SkillsBuild',              when: 'Aug 2026' },
    { what: 'Getting Started with Data',                             issuer: 'IBM SkillsBuild',              when: 'Aug 2026' },
    { what: 'Lab: Troubleshoot Your Code Using IBM Bob',             issuer: 'IBM SkillsBuild',              when: 'Aug 2026' },
    { what: 'Fundamentals of C Programming',                         issuer: 'E&ICT Academy, IIT Kanpur',    when: 'Nov 2025' }
  ],

  /* ── neofetch art ───────────────────────────────────────────────
     A myōjin torii, drawn to its actual anatomy rather than by feel, top down:

       kasagi    the top lintel. Widest member, and the only one that sweeps up
                 at the tips — that is the whole silhouette of a myōjin gate and
                 what distinguishes it from the flat-topped shinmei style.
       shimaki   the second beam, directly under the kasagi and inset from it.
       gakuzuka  the short strut at dead centre, from the shimaki down to the
                 nuki. Only that span. It used to hang BELOW the nuki here,
                 which is not a member of anything.
       nuki      the tie beam. It passes THROUGH the pillars and protrudes a
                 column past each — flush ends would make this a shinmei gate,
                 and floating clear of the pillars, which is what it used to do,
                 makes it a rectangle hovering inside a doorframe.
       hashira   the two pillars. Straight, on purpose: real ones lean inward by
                 a degree or two, which at this size is under half a column, so
                 any attempt at it can only land as a 1-column jog — exactly the
                 kink the old right pillar had.
       nemaki    the wrapped base, one column wider than the pillar per side.

     Three invariants, all of which the old art broke somewhere:
       - every line is exactly 21 characters, or the grid skews;
       - the pillars stay in columns 3-4 and 16-17 for their whole height;
       - the widths nest, kasagi > shimaki > nuki > pillar span, since that
         hierarchy is what reads as a gate rather than as scaffolding.

     Half blocks give half-row vertical resolution, which is where the beam
     thicknesses come from: ▀ is the top half of its row, ▄ the bottom, █ both.
     They only tile if the line-height is exactly 1 — see .tl-neo__art. */
  art: [
    '▄▄                 ▄▄',
    '█████████████████████',
    ' ▀▀██▀▀▀▀▀█▀▀▀▀▀██▀▀ ',
    '   ██     █     ██   ',
    '  ▀██▀▀▀▀▀▀▀▀▀▀▀██▀  ',
    '   ██           ██   ',
    '   ██           ██   ',
    '   ██           ██   ',
    '   ██           ██   ',
    '   ██           ██   ',
    '   ██           ██   ',
    '  ▄██▄         ▄██▄  '
  ]
};
