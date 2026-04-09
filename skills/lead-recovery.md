# Skill: lead-recovery

> **Architecture:** One of 7 skills in the Sales Agent. See `README.md` for the overview.
> **Related skill:** `research-outreach.md` handles the actual value-first outreach — this skill only provides the decision framework + lead selection.

---

## Purpose
**Decision framework**, not a loop. For a list of burned-out / bulk-closed / stale deals: decide which recovery lever to apply per deal. Output is a **prioritized recovery strategy** — the actual outreach runs in `research-outreach` (for value-first) or manually (for other levers).

## Trigger
Manual with a deal list from HubSpot. Invocation examples in `prompts/invoke-skill.md`.

## Output
Structured recommendation per deal:
- Recovery chance (HIGH / MEDIUM-HIGH / MEDIUM / LOW / UNCLEAR)
- Recommended lever (fresh face / value-first / trigger-based / close)
- Ownership (who does the outreach)
- Concrete next action

Format: console table + optional markdown file at `output/recovery-<date>.md`.

## Stopping
When all deals are analyzed. No loop, no background run.

---

## When to Apply

This framework is for deals where `follow-up-loop` no longer works:

- **Burned out:** the salesperson is done, lead no longer responds to the same person
- **Bulk-closed:** deal was closed during pipeline cleanup, but no real "no" was ever documented
- **Stale:** 6+ months of no activity, deal still open in pipeline
- **Canceled but not rejected:** meeting missed, postponed, never followed up

**Do NOT apply to:**
- Lead explicitly declined with reason ("not a fit for our needs")
- Skip flags in HubSpot (configured "do not contact", etc.)
- Deal is genuinely lost with documented reason

---

## Per-Deal Decision Loop

### Step 0 — Load learnings (once per run)

Read `knowledge/learnings.md`. Section A informs recovery-lever reasoning (don't re-engage with a tone that failed before), the most recent ~20 entries of Section B flag recovery patterns from prior runs (what levers worked for which deal profiles), Section C lists distilled rules. Universal requirement — see `program.md`.

### Step 1 — Load deal data
Via HubSpot (MCP or CLI):
- Deal properties: `dealname`, `amount`, `dealstage`, `closedate`, `hs_lastmodifieddate`
- Linked contact: `firstname`, `lastname`, `email`, `company`, `hs_lead_status`
- Last 5 notes (sorted by timestamp DESC)

### Step 2 — Assess recovery chance

| Chance | Criteria |
|--------|----------|
| **HIGH** | Lead themselves said "get back to me", need is documented, only timing was off |
| **MEDIUM-HIGH** | Need is clear, but trust issue (e.g., burned by another vendor) |
| **MEDIUM** | Proposal was out, conversations flowed, then silence or bulk-closed. No real no. |
| **LOW** | 2+ years stale, salesperson says "time-waster", repeatedly postponed |
| **UNCLEAR** | No notes, no emails, high deal value but no history |

### Step 3 — Choose lever

#### Lever 1: Fresh Face
- **When:** Lead isn't burned out on the product, just on the person / chase mode. Bulk-closed deals. Long follow-up marathons.
- **Who:** Someone other than the previous salesperson. Real context needed (e.g., "We're currently working on a project for a similar industry...")
- **How:** Manual outreach by a different team member. No skill needed — the value comes from the person.

#### Lever 2: Value-First (research-driven outreach)
- **When:** Lead has an existing website/business with identifiable weaknesses. Trust is damaged OR lead no longer responds to "is this still relevant?"
- **Who:** Sales Agent → hand off to `research-outreach` skill
- **How:** Add lead to the input list of `research-outreach`

#### Lever 3: Trigger-based
- **When:** Lead "postponed to the future". Wait for a real trigger instead of calendar-based follow-up.
- **Trigger sources:** website changes, new job postings, new blog post, industry news, funding round, hiring spree
- **How:** Track manually — no skill yet.

#### Lever 4: Close
- **When:** See pipeline hygiene rules below.
- **How:** Set HubSpot deal stage to `closedlost`, short note with reason.

### Step 4 — Output recommendation per deal

```
Deal: <dealname>
Value: €<amount>
Last activity: <date>
Recovery chance: <chance>
Recommended lever: <lever>
Ownership: <person/skill>
Next action: <concrete in 1 sentence>
Reasoning: <why this lever>
```

---

## Pipeline Hygiene: Close Instead of Recover

| Signal | Action |
|--------|--------|
| Lead explicitly declined with reason | → Set LOST |
| 2+ years in pipeline with no real activity | → One call attempt, then LOST |
| Salesperson says "time-waster" + 6+ months of follow-up with no result | → Set deadline or LOST |
| No notes, no emails, no context | → Internal discussion, then decide |
| Deal value < minimum threshold + no strategic value | → LOST, not worth the energy |

**Clean up fake pipeline:** Zombie deals distort pipeline numbers and eat mental energy. An honest pipeline worth $50K is better than an inflated $150K.

---

## Run Report (at end)

```
Lead Recovery Analysis — [Date]

Input:    20 deals
Recovery chance:
├── HIGH:         3 → recommended: fresh face (manual)
├── MEDIUM-HIGH:  4 → recommended: value-first (research-outreach)
├── MEDIUM:       6 → recommended: value-first (research-outreach)
├── LOW:          5 → recommended: close
└── UNCLEAR:      2 → recommended: internal discussion

Pipeline hygiene:
→ 5 deals identified for closing (zombie/time-waster)
→ Cleaned pipeline volume: -€XX,XXX (zombies removed)

Action for human:
→ 10 leads handed off to research-outreach (list in output/recovery-<date>.md)
→ 3 leads for manual discussion (fresh face)
→ 5 deals to set LOST in HubSpot
→ 2 deals for internal discussion
```

---

## Append to learnings (end of analysis)

After the run report, append one entry to `knowledge/learnings.md` Section B.

**Default — heartbeat:**
```bash
npx tsx src/learnings.ts append heartbeat --skill lead-recovery \
  --text "Analyzed N deals. HIGH a / MED-HIGH b / MED c / LOW d / UNCLEAR e. K deals flagged for close."
```

**Observation (if a recovery-lever pattern emerged, a segment dominated one chance bucket, or pipeline hygiene revealed a systemic issue):**
```bash
npx tsx src/learnings.ts append observation --skill lead-recovery \
  --headline "<short pattern name>" \
  --context "<batch description: deal count, source>" \
  --observed "<quantitative pattern in chance or lever>" \
  --apply "<concrete rule for next run>"
```

Write observation **instead of** the heartbeat. See `program.md` for the universal teardown rule.

---

## Constraints

### Allowed
- Read HubSpot deals and linked notes
- Create structured recovery recommendations
- Write output markdown to `output/recovery-<date>.md`
- Generate lead lists for `research-outreach`

### Forbidden
- Automatically set HubSpot status to LOST without human confirmation
- Create outreach emails directly — that's what `research-outreach` does
- Output recommendations without reasoning
