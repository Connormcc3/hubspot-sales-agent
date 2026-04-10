# Skill: prospect-research

> **Architecture:** One of 9 skills in the Sales Agent. See `README.md` for the overview.
> **Shared rules:** `CLAUDE.md` (greeting, tone, signatures).
> **Related skills:** `cold-outreach.md` consumes the dossiers this skill produces. `research-outreach.md` does website-level audits — this skill goes deeper and wider.

---

## Purpose

Deep intelligence gathering on a target company and decision-maker. Goes beyond the website audit in `research-outreach` — builds a **strategic dossier** that profiles the company, surfaces recent signals (hiring, news, product changes), maps the decision-maker, and generates pain-point hypotheses.

**Difference from `research-outreach`:**
- `research-outreach` = "here are 3 problems with your website" (tactical, site-focused)
- `prospect-research` = "here's everything we know about this company and why they might need us" (strategic, company-focused)

**Output:** Structured dossiers in `output/prospect-dossiers/<company-slug>.md` that `cold-outreach` consumes.

## Trigger
Manual with a lead list (same format as `research-outreach`). Can also be triggered by `pipeline-analysis` recommendations or `lead-recovery` "value-first" suggestions.

## Output
- `output/prospect-dossiers/<company-slug>.md` — structured dossier per company
- Console summary of findings
- Scores updated in tracker (fit scores populated from discovered data)

## Stopping
When all leads in the input list are processed. On errors: silent skip with log.

---

## Setup

0. **Load learnings** — Read `knowledge/learnings.md`. Section A informs tone, Section B flags recent patterns, Section C lists distilled rules. Universal requirement — see `program.md`.

1. **Receive lead list** (from the user, `pipeline-analysis` output, or `lead-recovery` output):
   - Format: `[{email, firstname, lastname, company, domain?, lead_status?, hubspot_id?}, ...]`
   - Minimum required: `email` + `company` OR `domain`

2. **Tracker check:** `npx tsx src/tracker.ts exists <email>` for each lead. Existence is informational only — prospect-research is a research skill, not an outreach skill, so it runs regardless. But note if the contact already has outreach history.

3. **Load HubSpot data** (if contact exists in HubSpot):
   - Contact properties: `firstname`, `lastname`, `email`, `company`, `jobtitle`, `industry`, `numberofemployees`, `city`, `country`, `website`
   - Most recent 5 notes (for context on prior interactions)

---

## Per-Lead Workflow

### Step 1 — Validate and resolve domain

- If `domain` is empty: derive from email (`info@example.com` → `example.com`) or from HubSpot `website` property
- If the domain is a free mailer (gmail.com, outlook.com, yahoo.com, etc.): use `company` name to search instead
- If neither domain nor company is available: SKIP, log as `no_target`

### Step 2 — Company profile

Fetch the company website homepage + key pages. Build the company profile:

**Pages to fetch:**
- Homepage (`https://<domain>/`)
- About page (`/about`, `/about-us`, `/ueber-uns`, `/team`)
- Services/Products page (`/services`, `/products`, `/leistungen`)
- Careers page (`/careers`, `/jobs`, `/karriere`)
- Blog/News (`/blog`, `/news`, `/aktuelles`)

**MCP:** Use `WebFetch` for each URL. Gracefully handle 404s — not every site has every page.
**CLI:** `npx tsx src/tools/webfetch.ts fetch --url <url>`

**Extract:**
- **What they do** — core business in 1-2 sentences
- **Industry** — specific vertical (not just "technology" but "B2B SaaS for logistics")
- **Company size signals** — team page headcount, careers page openings, "about" mentions
- **Founded / maturity** — startup vs. established
- **Tech stack signals** — from source HTML (framework, CMS, analytics tools)
- **Geographic focus** — HQ location, markets served

### Step 3 — Recent signals

Look for actionable intelligence that indicates timing or need:

**From careers page:**
- Actively hiring? What roles? → Signals growth, budget, specific needs
- Hiring for roles you could serve? → Direct pain point

**From blog/news:**
- Recent product launches or pivots
- Funding announcements
- Partnership changes
- Content topics they're investing in

**From the homepage (compared to general knowledge):**
- Recent redesign? (fresh vs. dated design)
- New messaging or positioning changes?

### Step 4 — Decision-maker profile

From HubSpot data + what's visible on the website:

- **Name and title** (from HubSpot or team page)
- **Role in buying process** — decision maker, influencer, or champion?
- **Tenure signals** — long-time owner vs. recently hired
- **Communication style hints** — formal website = formal person; casual blog = approachable

### Step 5 — Pain-point hypotheses

Based on everything gathered, generate 3-5 hypotheses about what this company might need:

Each hypothesis should be:
- **Specific** — not "they need marketing" but "their blog hasn't been updated since January, suggesting content production bottleneck"
- **Evidence-based** — tied to something observed, not assumed
- **Relevant to your offering** — connected to services in `CLAUDE.md`
- **Ranked by confidence** — high/medium/low based on evidence strength

### Step 6 — Score the lead

With the gathered data, compute a fit score:

```bash
npx tsx src/scoring.ts score "<email>" --data '{"industry":"<found>","jobTitle":"<found>","numberOfEmployees":"<estimated>","city":"<found>","country":"<found>"}'
```

This updates the tracker with the fit score, engagement score, and priority tier.

### Step 7 — Save dossier

Write markdown file to `output/prospect-dossiers/<company-slug>.md`:

```markdown
# Prospect Dossier: <Company Name>
**Domain:** <domain>
**Contact:** <firstname> <lastname> (<email>)
**Created:** <ISO date>
**Priority Tier:** <A/B/C/D> (Fit: <score>, Engagement: <score>)

## Company Profile
- **What they do:** <1-2 sentences>
- **Industry:** <specific vertical>
- **Size:** <estimate + source>
- **Location:** <HQ + markets>
- **Maturity:** <startup / growth / established>
- **Tech stack:** <observed signals>

## Recent Signals
| Signal | Source | Date | Relevance |
|--------|--------|------|-----------|
| <signal> | <page/source> | <when> | <why it matters> |

## Decision Maker
- **Name:** <name>
- **Title:** <title>
- **Role:** <decision maker / influencer / champion>
- **Communication style:** <formal / casual / unknown>

## Pain-Point Hypotheses
1. **<Hypothesis>** (confidence: high/med/low)
   Evidence: <what you observed>
   Relevance: <how your services connect>

2. **<Hypothesis>** (confidence: high/med/low)
   Evidence: <what you observed>
   Relevance: <how your services connect>

3. **<Hypothesis>** (confidence: high/med/low)
   Evidence: <what you observed>
   Relevance: <how your services connect>

## Recommended Approach
- **Angle:** <which pain point to lead with>
- **Tone:** <formal/casual — based on decision-maker profile>
- **Hook:** <1 sentence opener suggestion for cold-outreach>
- **CTA:** <suggested ask>

## Raw Notes
<Any additional observations, quotes from the website, or context>

---
*Dossier generated by YOUR_NAME (YOUR_DOMAIN)*
```

### Step 8 — Continue to next lead

Move immediately to the next lead in the list. No pausing.

---

## Run Report (at end)

```
Prospect Research Run — [Date]

Input:              15 leads
Dossiers created:   12
├── Tier A:          3
├── Tier B:          5
├── Tier C:          4
└── Tier D:          0

Skipped:            3
├── No domain:       1
├── Domain offline:  2
└── Free mailer:     0

Top pain points across batch:
1. <most common hypothesis> (seen in N dossiers)
2. <second most common> (seen in N dossiers)

Action for human:
→ 12 dossiers in output/prospect-dossiers/
→ Run cold-outreach with these dossiers for personalized first-touch emails
→ A-tier leads (3) recommended for compose-reply or research-outreach
```

---

## Append to learnings (end of batch)

After the run report, append one entry to `knowledge/learnings.md` Section B.

**Default — heartbeat:**
```bash
npx tsx src/learnings.ts append heartbeat --skill prospect-research \
  --text "Researched N companies, M dossiers created. Top signal: <most common>. Tier distribution: A=X B=Y C=Z"
```

**Observation (if ≥3 dossiers surfaced the same pain point, a segment showed unexpected signals, or a hypothesis pattern emerged):**
```bash
npx tsx src/learnings.ts append observation --skill prospect-research \
  --headline "<short pattern name>" \
  --context "<batch description: industries, count>" \
  --observed "<quantitative finding pattern>" \
  --apply "<concrete rule for next run>"
```

Write observation **instead of** the heartbeat. See `program.md` for the universal teardown rule.

---

## Constraints

### Allowed
- Read HubSpot contacts and notes (for context)
- Fetch external websites via WebFetch / CLI (homepage, about, careers, blog, services)
- Write markdown dossiers to `output/prospect-dossiers/`
- Update tracker scores via `src/scoring.ts`
- Read tracker data

### Forbidden
- Send emails — this is a research skill, not an outreach skill
- Create Gmail drafts — that's `cold-outreach`'s job
- Invent signals not observed on the website — if a page 404s, note "not found", don't fabricate
- Scrape behind logins or paywalls
- Access personal social media accounts
