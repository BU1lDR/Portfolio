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
      "while reading for a B.Tech at GGSIPU in Delhi."
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
      name: 'File Integrity Checker',
      year: '2026',
      blurb: 'A lightweight file integrity monitor. Take a trusted baseline once, ' +
             'run a check whenever you need one, and it names exactly what was ' +
             'modified, added or deleted — no manual diffing, no guesswork.',
      stack: ['Python', 'JSON', 'CLI', 'Git'],
      live: '',
      code: 'https://github.com/BU1lDR/my_projects/tree/main/file_integrity_checker'
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
      where: 'Guru Gobind Singh Indraprastha University (GGSIPU) — Delhi, India',
      note: 'CGPA 9.04.'
    }
  ],

  experience: [
    {
      when: 'Apr — Sep 2026',
      what: 'Data Analytics Intern',
      where: 'IBM SkillsBuild × BharatCares — Remote',
      note: 'Worked with real-world datasets and learned to apply analytical ' +
            'thinking to them — which is where data analytics and AI stopped ' +
            'being two separate subjects for me.'
    },
    {
      when: '2026',
      what: 'Backend — API & Integration',
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
