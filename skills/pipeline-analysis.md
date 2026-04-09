# Skill: pipeline-analysis

> **Architecture:** One of 5 skills in the Sales Agent. See `README.md` for the overview.
> **Related skills:** This skill is the "zoom out" — it analyzes the whole HubSpot pipeline and recommends which action-skills to run next (`follow-up-loop`, `research-outreach`, `lead-recovery`).

---

## Purpose

**Analysis + recommendation, no action.** Reads all contacts and deals from HubSpot, cross-references with the tracker, surfaces patterns, and outputs a structured health report with concrete next actions. This is how you decide where to focus — instead of guessing which skill to run, you run this first.

**Difference from `lead-recovery`:** `lead-recovery` looks at a specific list of stale/burned deals you already identified. `pipeline-analysis` looks at the **entire** pipeline and tells you which deals you should even be looking at.

## Trigger
Manual. Recommended: weekly, or before each outreach wave. Invocation examples in `prompts/invoke-skill.md`.

## Output
- **Console summary** — key metrics in tables
- **Markdown report** to `output/analysis/pipeline-<date>.md` — full analysis + recommendations
- **Recommended next actions** — which skill to run, with which inputs

## Stopping
One-shot run. No loop, no background work. When the analysis is complete, print the report and stop.

---

## Setup

1. **Read tracker:** `node src/tracker.js read` → set of emails already processed by the agent
2. **Fetch all contacts** from HubSpot:
   - **MCP:** `mcp__claude_ai_HubSpot__search_crm_objects` with `objectType=contacts`, paginate through all
   - **CLI:** `node src/tools/hubspot.js contacts list --limit 100 --offset <N>` in a loop
   - Properties: `firstname`, `lastname`, `email`, `company`, `jobtitle`, `hs_lead_status`, `industry`, `lifecyclestage`, `createdate`, `lastmodifieddate`
3. **Fetch all deals**:
   - **MCP:** `mcp__claude_ai_HubSpot__search_crm_objects` with `objectType=deals`
   - **CLI:** `node src/tools/hubspot.js deals list --limit 100 --offset <N>` in a loop
   - Properties: `dealname`, `amount`, `dealstage`, `closedate`, `hs_lastmodifieddate`, `createdate`

---

## Analysis Sections

### Section 1 — Contact Distribution
- Total contacts
- By `hs_lead_status` (NEW, CONNECTED, ATTEMPTED_TO_CONTACT, UNQUALIFIED, IN_PROGRESS, OPEN_DEAL, BAD_TIMING, unset)
- By `industry` (if populated)
- By creation cohort (last 30 days / 30-90 / 90-365 / older)
- **Data quality flags:** contacts with no email, no company, no lead_status, duplicate emails

### Section 2 — Deal Health
- Total deals + total pipeline value
- By stage (open vs closed-won vs closed-lost)
- Win rate (closed-won / total closed)
- Average deal value
- Median deal cycle length (close_date - create_date for closed-won)
- **Stale deals:** open with no activity > 90 days
- **Zombie deals:** open > 2 years with no activity
- **Missing-data deals:** no `amount`, no `closedate`, no linked contact

### Section 3 — Agent Coverage
Cross-reference contacts with `table.tsv`:
- How many contacts has the agent touched? (drafted / skipped / declined / bounced)
- How many untouched contacts remain in each lead_status bucket?
- Reply rate on agent-drafted emails (if any `reply_classification` entries exist)
- Classification breakdown: POSITIVE_INTENT / POSITIVE_MEETING / NEGATIVE_* / etc.

### Section 4 — Segment Insights
- **Top converting industries** (highest win rate)
- **Highest value lead sources** (if `hs_analytics_source` populated)
- **Dead segments** — industries with 0% conversion across 10+ deals
- **Untapped segments** — lead_status clusters with no agent activity

### Section 5 — Recommended Actions
Structured recommendations with a suggested skill to run:

```
Action 1: Clean up pipeline
→ 14 zombie deals identified (> 2 years open, 0 activity)
→ Combined value: €X (fake pipeline)
→ Suggested skill: lead-recovery (pipeline-hygiene mode)

Action 2: Re-engage stale leads in your best segment
→ 23 CONNECTED contacts in "Manufacturing" never touched
→ Manufacturing has 38% win rate (your highest)
→ Suggested skill: follow-up-loop (filter: CONNECTED + industry=Manufacturing)

Action 3: Value-first recovery for MEDIUM-chance losses
→ 8 CLOSED_LOST deals in MEDIUM bucket (see lead-recovery criteria)
→ Combined value: €X
→ Suggested skill: lead-recovery → then research-outreach for top candidates

Action 4: Daily inbox check
→ Last inbox-classifier run: 12 days ago
→ Suggested skill: inbox-classifier (newer_than:14d)
```

---

## Report Output

Write the full analysis to `output/analysis/pipeline-<YYYY-MM-DD>.md`:

```markdown
# Pipeline Analysis — YYYY-MM-DD

## Executive Summary
- Total contacts: X
- Total deals: X (€X in pipeline)
- Win rate: X%
- Agent coverage: X% of contacts touched
- Top recommendation: <action>

## 1. Contact Distribution
[Tables]

## 2. Deal Health
[Tables]

## 3. Agent Coverage
[Tables]

## 4. Segment Insights
[Tables]

## 5. Recommended Actions
[Structured action list with skill references]

## Data Quality Flags
[List of issues found]
```

---

## Constraints

### Allowed
- Read all HubSpot contacts and deals (read-only)
- Read `table.tsv` for cross-referencing
- Write analysis report to `output/analysis/`
- Recommend next skills to run (with concrete inputs)

### Forbidden
- Change any HubSpot data
- Create Gmail drafts
- Update `table.tsv`
- Run another skill automatically — recommendations are for the human to act on

---

## Example Run Report (console)

```
Pipeline Analysis — 2026-04-09

Contacts:    627 total
  NEW:                 145
  CONNECTED:           203  (38 untouched by agent)
  ATTEMPTED_TO_CONTACT: 89  (61 untouched)
  UNQUALIFIED:         102
  IN_PROGRESS:          27
  OPEN_DEAL:            14
  BAD_TIMING:            8
  (unset):              39

Deals:        184 total
  Open:                 23  (€178K)
  Closed Won:           41  (€312K)  ← 18% win rate
  Closed Lost:         120  (€847K)

Stale (open > 90d):    14 deals (€132K)
Zombie (open > 2y):     5 deals (€61K)  ← pipeline hygiene candidates

Agent coverage:        31% of contacts touched (194/627)
  Drafted:   156
  Skipped:    23
  Declined:    8
  Bounced:     7

Top recommendations:
1. Run lead-recovery in pipeline-hygiene mode → 5 zombies to close (€61K)
2. Run follow-up-loop filtered to CONNECTED+untouched (38 contacts)
3. Run inbox-classifier (last run: 12 days ago)

Full report: output/analysis/pipeline-2026-04-09.md
```
