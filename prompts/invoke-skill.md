# Sales Agent — Skill Invocation

> Overview of all 9 skills + how to invoke them. Each block is self-contained — copy-paste into your agent harness.
>
> **Before every invocation:** You should have `README.md` and `CLAUDE.md` loaded (or the agent reads them at the start of each skill run).

---

## Skill 1: follow-up-loop

### Autonomous Mode (NEVER STOP)

```
Read skills/follow-up-loop.md and CLAUDE.md, then run the skill autonomously.

NEVER STOP. Work through all contacts from HubSpot until manually interrupted.
Follow the 7-step loop strictly. Log every contact immediately to tracker.
Do NOT ask for confirmation mid-loop.

At the end: print summary (drafted / skipped / errors / remaining).
```

### Preview Mode (console output, no Gmail)

```
Read skills/follow-up-loop.md and CLAUDE.md, then run the skill in PREVIEW MODE.

For each contact: read notes → generate email → print to console.
NO gmail draft creation, NO tracker update.
Show for each contact: email, lead status, subject, body.
Process max 10 contacts, then stop and show summary.
```

### Resume (continue interrupted run)

```
Read skills/follow-up-loop.md and CLAUDE.md. Run the skill in Resume mode.
tracker already contains processed contacts — skip them automatically.
NEVER STOP. Continue until manually interrupted.
```

### Single Contact (test/review, no draft)

```
Read skills/follow-up-loop.md and CLAUDE.md. Process ONLY this contact:
Email: <email@example.com>

1. Load the contact from HubSpot
2. Read all notes
3. Generate the follow-up email
4. Show me: subject + body + brief reasoning

Do NOT create a Gmail draft. Do NOT update tracker.
```

### Batch with Approval (controlled)

```
Read skills/follow-up-loop.md and CLAUDE.md. Run in APPROVAL MODE.

For each contact: generate email → show me → wait for my response.
- "ok" → create draft + log to tracker
- "skip" → skip
- "stop" → end loop + show summary
```

---

## Skill 2: inbox-classifier

### Default (last 7 days)

```
Read skills/inbox-classifier.md, knowledge/learnings.md, and CLAUDE.md.
Run the skill with default filter: newer_than:7d in:inbox.

For each new reply:
1. Load the thread
2. Load the HubSpot contact
3. Classify (8 categories)
4. For POSITIVE_*: create reply draft
5. Update HubSpot status (NEGATIVE_* → UNQUALIFIED)
6. Update tracker via npx tsx src/tracker.ts update <email> <classification> [draft_id]

At the end: run report with counts per category + action list for human.
```

### Custom Time Range

```
Read skills/inbox-classifier.md, knowledge/learnings.md, and CLAUDE.md.
Run the skill with filter: newer_than:<X>d in:inbox.

[Rest same as Default]
```

### Dry-Run (no reply drafts, no HubSpot updates)

```
Read skills/inbox-classifier.md, knowledge/learnings.md, and CLAUDE.md.
DRY-RUN: Classify all new replies from the last 7 days,
BUT create NO reply drafts and change NO HubSpot status.

Show me the classifications as a table: email | classification | suggested_action.
I will decide what happens next manually.
```

---

## Skill 3: research-outreach

### With Lead List (Standard)

```
Read skills/research-outreach.md, knowledge/research-config.md, and CLAUDE.md.
Run the skill for these leads:

[Insert lead list here — each lead with: email, firstname, lastname, company, domain, lead_status]

For each lead:
1. Research the domain (WebFetch / CLI) using the audit type configured in research-config.md
2. Extract top-3 findings
3. Write full report to output/research-reports/<domain-slug>.md
4. Create HTML email draft with findings as table
5. Log to tracker with notes_summary "RES: <domain> - <top1>"

For unreachable domains: skip with log.
At the end: run report (audits ok / skipped / drafts created).
```

### Single Lead

```
Read skills/research-outreach.md, knowledge/research-config.md, and CLAUDE.md.
Audit this one domain and create a draft:

Email: <email>
Company: <company>
Domain: <domain>

Write the full report to output/research-reports/<domain-slug>.md
and the HTML draft as a Gmail draft.
```

### Audit Only (no draft)

```
Read skills/research-outreach.md and knowledge/research-config.md.
Audit this domain and create ONLY the markdown report (no Gmail draft):

Domain: <domain>
Output: output/research-reports/<domain-slug>.md
```

---

## Skill 4: lead-recovery

### Analyze Deal List

```
Read skills/lead-recovery.md and CLAUDE.md. Analyze these HubSpot deals:

[Deal IDs or deal names here]

For each deal:
1. Load deal data (amount, stage, close date, last activity)
2. Load linked contact
3. Read last 5 notes
4. Assess recovery chance (HIGH / MEDIUM-HIGH / MEDIUM / LOW / UNCLEAR)
5. Recommend lever (fresh face / value-first / trigger-based / close)

Output: console table + markdown file to output/recovery-<date>.md
with: deal value, chance, lever, ownership, next action, reasoning.
```

### Pipeline Hygiene Sweep

```
Read skills/lead-recovery.md.

Load all deals from HubSpot with dealstage IN (open, decisionmakerboughtin)
OR closedlost with closedate < today - 6 months.

Apply the pipeline hygiene rules:
- 2+ years stale → action: close
- Time-waster with 6+ months of follow-up → close
- Deal value below threshold + no strategic value → close
- No notes / no context → "internal discussion"

Output: list of closing candidates with reasoning.
Do NOT change anything in HubSpot without my confirmation.
```

---

## Skill 5: pipeline-analysis

### Full Pipeline Health Check

```
Read skills/pipeline-analysis.md and CLAUDE.md.
Analyze the entire HubSpot pipeline.

1. Fetch ALL contacts (paginate through all pages)
2. Fetch ALL deals (paginate through all pages)
3. Cross-reference with tracker for agent coverage
4. Generate the 5-section analysis:
   - Contact distribution (by lead_status, industry, cohort)
   - Deal health (open/won/lost, win rate, stale, zombie)
   - Agent coverage (touched vs untouched, reply stats)
   - Segment insights (top converting industries, dead segments)
   - Recommended actions (which skill to run next)

Output:
- Console summary with key metrics
- Full report to output/analysis/pipeline-<YYYY-MM-DD>.md
- Ranked list of recommended next actions

Do NOT change any HubSpot data. Do NOT create drafts. Analysis only.
```

### Quick Health Check (no full report)

```
Read skills/pipeline-analysis.md.

Quick pipeline check — console output only, no markdown report.
Show me:
- Total contacts / by lead_status
- Total deals / open / won / lost / win rate
- Stale deals (>90d no activity) count + value
- Zombie deals (>2y open) count + value
- Agent coverage percentage
- Top 3 recommended actions

Fast summary — no detailed section breakdowns.
```

### Segment Deep-Dive

```
Read skills/pipeline-analysis.md.

Analyze ONE specific segment of the pipeline:
Segment: <industry name OR lead_status OR lead_source>

Show me:
- How many contacts / deals in this segment
- Win rate vs average
- Average deal value vs average
- Agent coverage in this segment
- Sample of untouched contacts (max 10)
- Recommended action specific to this segment
```

---

## Skill 6: performance-review

### Default weekly run (last 7 days)

```
Read skills/performance-review.md, program.md, and knowledge/learnings.md.
Run the skill with the default 7-day window.

1. Run npx tsx src/performance.ts --window 7 and interpret the JSON
2. For each proposable contrast, fetch 2-3 draft bodies from Gmail to extract
   subject + tone
3. Write the full report to output/performance/<YYYY-MM-DD>.md with:
   - Headline metrics
   - Segment breakdowns (by lead_status, by skill, by lead_status × skill)
   - Contrasts (≥5 in each bucket, ≥15pp delta)
   - Proposed Section C additions (ready-to-copy markdown blocks for each
     contrast with ≥10 evidence)
   - Data warnings + correlation-not-causation caveat
4. Print console summary with headline numbers + top 3 contrasts
5. Append learnings heartbeat (or observation if a rule was proposed)

DO NOT auto-write proposed rules to learnings.md Section C — human confirms.
DO NOT lower the minimum-sample thresholds.
```

### Custom window

```
Read skills/performance-review.md and program.md.
Run with window: <N> days (e.g., 14 for bi-weekly, 30 for monthly review).

npx tsx src/performance.ts --window <N>

Otherwise same as default: report to output/performance/<date>.md, propose
Section C rules, append learnings entry.
```

### Skill-specific review (single drafting skill)

```
Read skills/performance-review.md and program.md.
Run the default window but focus the report on ONE skill:
- Skill: <follow-up-loop | research-outreach | compose-reply>

Fetch the full performance.ts JSON, filter contrasts to those involving the
specified skill, and concentrate the report on that skill's outcomes.
Still propose Section C rules only for contrasts with ≥10 evidence.
```

---

## Skill 7: compose-reply

### Full Deep-Context Reply

```
Read skills/compose-reply.md and CLAUDE.md.
Compose a reply to this lead:

Email: <email@example.com>

New context:
- <any fresh information you want to inject>
- <e.g., "They just raised Series A yesterday">
- <e.g., "Competitor just lost them">

Desired outcome:
- <what should the email achieve — meeting booked, reply, soft re-engagement, etc.>

Tone: <casual / formal / match the prior conversation>

Assemble full context from HubSpot + Gmail history + tracker.
Generate a structured brief, then draft the email.
SHOW me the brief and draft first. Ask before creating the Gmail draft.
```

### Brief Only (no draft, just context assembly)

```
Read skills/compose-reply.md.
Assemble a full context brief for this lead — no draft:

Email: <email@example.com>

Pull:
- All HubSpot notes chronologically
- All linked deals with stage and history
- Complete Gmail thread history (both directions)
- Prior agent interactions from tracker

Output: structured brief with who they are, relationship history,
last activity, current state, and recommended angle for my next move.
Do NOT draft an email. I'll write it myself.
```

### Save Lead Dossier

```
Read skills/compose-reply.md and CLAUDE.md.
Compose a reply to this lead and save the dossier for future reference:

Email: <email@example.com>
New context: <...>
Desired outcome: <...>

Assemble full context, generate brief, draft the email,
and save the dossier to output/lead-dossiers/<email>.md.
Ask me before creating the Gmail draft.
```

---

## Workflow Examples

### Workflow A: Send wave + follow up

```
1. (Day 0) Run follow-up-loop autonomously
2. (Day 0) Human reviews drafts and sends
3. (Day 1-2) Run inbox-classifier with "newer_than:2d"
4. (Day 2) Human reviews reply drafts and sends
5. Optional: update knowledge/learnings.md if surprising patterns
```

### Workflow B: Pipeline recovery

```
1. Run lead-recovery for stale deals → recommendation per deal
2. Build lead list from value-first recommendations
3. Run research-outreach with that list
4. Human reviews drafts and sends
5. (Day 1-2) Run inbox-classifier
```

### Workflow C: Daily inbox

```
1. Run inbox-classifier with "newer_than:1d"
2. Human reviews reply drafts (5 min) and sends
```

### Workflow D: Weekly planning

```
1. Monday morning: run pipeline-analysis → full report
2. Read the recommended actions section
3. Pick top 1-2 actions for the week
4. Run the recommended skills (follow-up-loop / research-outreach / lead-recovery)
5. Human reviews drafts and sends
6. Run inbox-classifier daily through the week
```

---

## Skill 8: prospect-research

### Standard (with lead list)

```
Read skills/prospect-research.md and CLAUDE.md.
Research these companies and create dossiers:

- john@acme.com, John Smith, Acme Inc, acme.com
- jane@beta.io, Jane Doe, Beta Corp, beta.io
- mike@gamma.de, Mike Müller, Gamma GmbH, gamma.de

For each lead:
1. Fetch company website (homepage, about, careers, blog, services)
2. Build company profile (what they do, size, industry, tech stack)
3. Surface recent signals (hiring, news, product changes)
4. Generate 3-5 pain-point hypotheses with confidence levels
5. Score the lead via src/scoring.ts
6. Save dossier to output/prospect-dossiers/<company-slug>.md

At the end: run report with dossier count, tier distribution, top pain points.
```

### Single Company

```
Read skills/prospect-research.md and CLAUDE.md.
Research this one company in depth:

Email: john@acme.com
Company: Acme Inc
Domain: acme.com

Create a full dossier at output/prospect-dossiers/acme-inc.md.
Show me the dossier when done. Do not draft any emails.
```

### From lead-recovery output

```
Read skills/prospect-research.md and CLAUDE.md.
The lead-recovery run recommended "value-first" for these deals:

[Paste the lead-recovery "value-first" list here]

Research each company, create dossiers, then hand off to cold-outreach.
```

---

## Skill 9: cold-outreach

### With Dossiers (best results)

```
Read skills/cold-outreach.md and CLAUDE.md.
Run cold outreach for these leads (dossiers already exist in output/prospect-dossiers/):

- john@acme.com, John Smith, Acme Inc
- jane@beta.io, Jane Doe, Beta Corp

For each lead:
1. Load dossier from output/prospect-dossiers/
2. Choose template (signal-based or value-first based on hypothesis confidence)
3. Draft a first-touch cold email
4. Create Gmail draft
5. Log to tracker with COLD: prefix

Skip D-tier leads. Sort by priority tier (A first).
At the end: run report with draft count, template distribution, tier breakdown.
```

### Without Dossiers (quick blast)

```
Read skills/cold-outreach.md and CLAUDE.md.
Cold-email these leads (no dossiers, use HubSpot data only):

- john@acme.com, John Smith, Acme Inc, CEO
- jane@beta.io, Jane Doe, Beta Corp, Marketing Director

Use Template 3 (lightweight). Keep emails to 3 sentences max.
Create Gmail drafts and log to tracker.
```

### Full Pipeline (research + cold)

```
Read skills/prospect-research.md, skills/cold-outreach.md, and CLAUDE.md.

Step 1: Research these leads and create dossiers:
- john@acme.com, John Smith, Acme Inc, acme.com
- jane@beta.io, Jane Doe, Beta Corp, beta.io

Step 2: Use the dossiers to draft first-touch cold emails.
Sort by priority tier. Skip D-tier.

At the end: combined run report.
```

### Preview Mode (no drafts)

```
Read skills/cold-outreach.md and CLAUDE.md.
PREVIEW MODE — show me the cold emails but do NOT create Gmail drafts
and do NOT update the tracker.

Leads:
- john@acme.com, John Smith, Acme Inc

Show: subject, body, template used, priority tier, reasoning.
```

---

## Workflow Examples (updated)

### Workflow E: Cold outreach pipeline

```
1. Build lead list (manual curation, LinkedIn export, purchased list)
2. Run prospect-research → dossiers with pain-point hypotheses
3. Run cold-outreach → signal-based cold emails using dossiers
4. Human reviews drafts and sends
5. (Day 2-3) Run inbox-classifier
6. Positive replies → compose-reply for deep follow-up
```

### Workflow F: Scored pipeline prioritization

```
1. Score all contacts: npx tsx src/scoring.ts score-tracker
2. Run pipeline-analysis (now includes score distribution)
3. A-tier leads without outreach → prospect-research + cold-outreach
4. B-tier leads → follow-up-loop or research-outreach
5. D-tier leads → lead-recovery to decide if worth keeping
```
