# Sales Agent — Skill Invocation

> Overview of all 4 skills + how to invoke them. Each block is self-contained — copy-paste into your agent harness.
>
> **Before every invocation:** You should have `README.md` and `CLAUDE.md` loaded (or the agent reads them at the start of each skill run).

---

## Skill 1: follow-up-loop

### Autonomous Mode (NEVER STOP)

```
Read skills/follow-up-loop.md and CLAUDE.md, then run the skill autonomously.

NEVER STOP. Work through all contacts from HubSpot until manually interrupted.
Follow the 7-step loop strictly. Log every contact immediately to table.tsv.
Do NOT ask for confirmation mid-loop.

At the end: print summary (drafted / skipped / errors / remaining).
```

### Preview Mode (console output, no Gmail)

```
Read skills/follow-up-loop.md and CLAUDE.md, then run the skill in PREVIEW MODE.

For each contact: read notes → generate email → print to console.
NO gmail draft creation, NO table.tsv update.
Show for each contact: email, lead status, subject, body.
Process max 10 contacts, then stop and show summary.
```

### Resume (continue interrupted run)

```
Read skills/follow-up-loop.md and CLAUDE.md. Run the skill in Resume mode.
table.tsv already contains processed contacts — skip them automatically.
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

Do NOT create a Gmail draft. Do NOT update table.tsv.
```

### Batch with Approval (controlled)

```
Read skills/follow-up-loop.md and CLAUDE.md. Run in APPROVAL MODE.

For each contact: generate email → show me → wait for my response.
- "ok" → create draft + log to table.tsv
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
6. Update tracker via node src/tracker.js update <email> <classification> [draft_id]

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
5. Log to table.tsv with notes_summary "RES: <domain> - <top1>"

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
