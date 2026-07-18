# The Five Rings — VMSS Civilization (Lite Site)

A voluntary civilization framework built on moral causality, layered governance, continuity, and consequence.

**Version:** 21.5 Lite
**Live site:** https://jasonhuang24.github.io/VMSSLite/
**Full site:** https://jasonhuang24.github.io/VMSS/

---

## About

This is the **lite version** of The Five Rings doctrine portal. It delivers the complete VMSS framework in a faster, more focused reading experience — condensed pages, no interactive widgets, essential content only. Ideal for a first read before exploring the full site.

The Five Rings is a proposed civilization model organized around five concentric governance rings (+1 to -3). Citizens are placed in rings based on demonstrated behavior — not birth, wealth, or ideology. The system combines technoneural enforcement, a Social Trust Index, automation-funded UBI, backup vessel continuity, and consequence-bound freedom into a single coherent architecture.

---

## What's Different from the Full Site

| Feature | Lite | Full |
|---|---|---|
| Interactive ring diagram | ✗ | ✓ |
| STI simulation console | ✗ | ✓ |
| Individual layer dossiers | ✗ (overview on layers page) | ✓ (5 detailed pages) |
| SADs / MGDs page | ✗ | ✓ |
| Whitepaper | ✗ (full site only) | 34-section paginated with TOC + glossary |
| World page | ✗ (full site only) | International relations, military, culture |
| Roadmap | ✗ (full site only) | 7-phase development roadmap |
| Simulations | 6 archetypal profiles | 40 world scenarios + 42 resident stories + 33 academy questions + 33 academic resources (4 dossiers) |
| FAQ | Core + governance | Extended with edge cases |
| Charter | All 28 articles, condensed | Full constitutional form with rationale links |

---

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Homepage — key metrics, five rings at a glance, full site callout |
| `layers.html` | Single comparison page — one card per layer, no dossiers |
| `technologies.html` | Seven technology sections in prose |
| `systems.html` | Governance, economy, enforcement — condensed |
| `simulations.html` | Six archetypal profiles, one per layer outcome |
| `why-vmss.html` | The case for VMSS — 30 points |
| `faq.html` | Core questions + governance & identity |
| `charter.html` | All 28 articles in clean constitutional form |
| `audiobook.html` | The Five Rings audiobook series |
| `join.html` | Voluntary entry process and application form |

---

## Stack

- HTML · CSS · Vanilla JavaScript
- Tailwind CSS (CDN)
- Font Awesome (CDN)
- Supabase (join form backend, shared with full site)
- Hosted on GitHub Pages

---

## Structure

```
/
├── index.html
├── layers.html
├── technologies.html
├── systems.html
├── simulations.html
├── why-vmss.html
├── faq.html
├── charter.html
├── audiobook.html
├── join.html
├── 404.html
├── navbar.html          # Shared nav, loaded dynamically
├── footer.html          # Shared footer, loaded dynamically
├── script.js            # Global state engine, theme, mobile menu, modals
├── styles.css           # Full design system (shared with full site)
├── assets/
│   └── js/
│       ├── diagrams.js
│       └── sti-sim.js
├── images/
│   └── emblem.jpg
├── sitemap.xml
└── robots.txt
```

---

## Key Concepts

**VMSS** — Vertical Moral Stratification System. Behavioral stratification replaces incarceration. Layer placement is a permanent environmental consequence of demonstrated conduct, not a time sentence.

**STI** — Social Trust Index. A separate ledger for non-criminal trust violations. Makes social harms legible without criminalizing them. Operates on two tracks: social trust violations (STI) and hard behavioral flags (criminal record log).

**Backup Vessels** — Periodic encrypted mind-state backups. Sovereign VMSS technology. Revival is binary: full fidelity or failure. In -3 Terminal, the implant severs the backup vessel link at the hardware level — death is final.

**Neural Diving** — Direct mind-to-mind interface technology. Audience mode (passive) and Pilot mode (active, requires consent).

**SADs** — Selective Ascension Domains. Opt-in metric-gated domains within +1 Sanctuary, each gated by a single measurable metric.

**Governance** — Three-body structure. The **Meritboard** is the civilization's continuously updating competence ranking with separate sub-rankings for the distinct competencies each role requires. The **President** is drawn from the top of the executive-doctrinal-leadership ranking. **Supreme Court** justices (10) are drawn from the top of the legal-interpretation ranking. Structural independence between executive and judicial branches comes from metric separation within the Meritboard, not pool separation. No elections. Competence is measured, not campaigned for.

**Leakage** — The gap between stated consequence and actual consequence delivery. Starting reality: ~90%. Target by 3000: ~0.01%.

---

## Companion Repository

The **VMSS** repository contains the full site — complete doctrine portal with interactive tools, detailed layer dossiers, STI console, current-state annotations, 34-section whitepaper, world page, and extended FAQ.

---

*Founded January 26, 2026 — Boise Accord*
