# Skill: performance-review

> **Architecture:** One of 7 skills in the Sales Agent. See `README.md` for the overview.
> **Related skills:** `pipeline-analysis` is forward-looking (what to work on next); `performance-review` is backward-looking (what worked). Run both on Mondays, performance-review first.
> **Shared rules:** `CLAUDE.md` (email rules — the thing being measured).

---

## Purpose

**Closes the feedback loop.** Joins `table.tsv` draft rows with reply outcomes, fetches the actual draft bodies from Gmail to extract tone and subject-line features (data that isn't in the tracker), computes conversion rates by segment, surfaces statistical contrasts with conservative sample-size thresholds, produces a weekly report with concrete numbers, and proposes **exact markdown blocks** for `knowledge/learnings.md` Section C that the human reviews and promotes.

**Does NOT auto-write to Section C.** Ever. Human review stays in the loop — this skill gives the human a copy-paste-ready pattern block with evidence and rationale.

**The difference from `pipeline-analysis`:** `pipeline-analysis` looks at the entire HubSpot pipeline and recommends which action-skill to run next. `performance-review` looks at what the agent has already done and asks "which decisions earned replies, and which didn't". Together they form the Monday-morning loop: review what worked → pick what to work on next.

## Trigger

Manual, weekly. Recommended cadence: **every Monday morning, before `pipeline-analysis`.** Invocation examples in `prompts/invoke-skill.md`.

## Output

- **Markdown report** to `output/performance/<YYYY-MM-DD>.md` — full analysis, numbers, proposed Section C blocks
- **Console summary** — headline metrics + top 3 contrasts
- **Proposed Section C additions** — copy-paste-ready markdown blocks embedded in the report, **not** auto-written to `learnings.md`

## Stopping

One-shot. Loads data → runs math → fetches a few drafts for deepening → writes report → appends learnings entry → stops.

---

## Setup

0. **Load learnings** — Read `knowledge/learnings.md`. Section A's current cheat sheets are hypotheses this skill is validating, Section B's recent entries provide context for what other skills observed, Section C is what this skill is trying to grow with evidence. Universal requirement — see `program.md`.

1. **Run the math tool** to get deterministic numbers:
   ```bash
   npx tsx src/performance.ts --window 7
   ```
   - Emits JSON with: `window`, `totals`, `positive_breakdown`, `negative_breakdown`, `by_lead_status`, `by_skill`, `by_lead_status_x_skill`, `contrasts`, `data_warnings`.
   - Override the window with `--window 14` or explicit `--since <ISO> --until <ISO>`.
   - **Do not manually recompute the math.** If a number in the report disagrees with `performance.ts` output, the tool is the source of truth.

2. **Check `data_warnings` first.** If the window has <5 drafts total: **stop immediately.** Write a short report explaining there isn't enough data, append a heartbeat, and return. Do not invent contrasts from tiny samples.

3. **For each `proposable` contrast (the tool flags these automatically, `proposable: true`):**
   - Fetch a sample of 2-3 drafts from the winning bucket:
     - **MCP:** `mcp__claude_ai_Gmail__gmail_read_message` with the `draft_id` → message
     - **CLI:** `npx tsx src/tools/gmail.ts draft read --id <draft_id>`
   - Extract the subject line from `message.payload.headers` (the header named `Subject`).
   - Decode `message.payload.body.data` (or `message.payload.parts[0].body.data`) from base64url and apply a greeting heuristic to recover the tone:
     - **Casual markers:** opens with `Hey`, `Hallo`, first-name only, no salutation ("Hi Simon,")
     - **Formal markers:** opens with `Sehr geehrter`, `Kind regards`, `Hello Mr./Ms.`, `Dear`, full-name address
   - Note the subject pattern (project-specific / generic / question-form) and tone for the report — these are the dimensions that weren't in the tracker.

4. **Optional HubSpot deepen** — only if a contrast is clearly segment-driven and the tracker/Gmail data alone doesn't explain it:
   - `npx tsx src/tools/hubspot.ts contacts search --email <email>` for a few contacts in the winning bucket
   - Check `industry` / `jobtitle` properties
   - Skip if the contrast is already clear.

---

## Analysis Sections

### Section 1 — Headline metrics

Pull directly from `performance.ts` totals:
- Drafts in window
- Replies received
- Reply rate (replies / drafts)
- Positive count + positive rate
- POSITIVE breakdown (POSITIVE_INTENT / POSITIVE_MEETING / POSITIVE_QUESTION)
- NEGATIVE breakdown (NEGATIVE_HARD / NEGATIVE_SOFT)
- Any data warnings from the tool (**always include these at the top**)

### Section 2 — Segment breakdowns

Three tables (directly from `performance.ts` output):
- Per `lead_status`: drafts / replies / positives / reply rate / positive rate
- Per `skill` (follow-up-loop / research-outreach / compose-reply): same columns
- Per `(lead_status × skill)` cross: only cells with ≥3 drafts

### Section 3 — Contrasts (≥5 in each bucket, ≥15pp delta)

For each contrast in `performance.ts` output (sorted by evidence weight):

```
Contrast #N — <description, e.g., "research-outreach vs other skills within CONNECTED">

  <bucket>:  <bucket_n> drafts, <bucket_positive_rate*100>% positive
  <other>:   <other_n> drafts, <other_positive_rate*100>% positive
  Delta:     <delta*100> percentage points

  Example from winning bucket:
    Subject: "<actual subject from Gmail>"
    Tone:    <casual / formal>
    Draft id: <id>

  Strength:  [strong | standard | proposable | directional]
  Evidence:  <bucket_n + other_n> total drafts in scope
```

### Section 4 — Proposed Section C additions

**Only for contrasts with `proposable: true`** (≥10 total evidence).

Generate exactly this markdown block per proposable contrast, ready for the human to copy into `knowledge/learnings.md` Section C:

```markdown
### Pattern: <short descriptive name>
- Evidence: performance-review <YYYY-MM-DD> — <bucket_n> drafts in <bucket>
  vs <other_n> in <other>, positive rate <bucket_rate%> vs <other_rate%>,
  delta <delta_pp> pp
- Apply: <concrete rule the drafting skills should follow>
```

After the blocks, explicitly tell the human: **"Review these. Do not paste blocks that contradict existing Section A/C rules without understanding why. If you're unsure, wait another week for more evidence."**

### Section 5 — Data warnings + caveats

- Total drafts warning (<20 = directional only)
- Zero-reply warning (if applicable)
- Any segment with <3 drafts flagged as "too thin to compare"
- Explicit reminder: **these are correlations, not causes.** A contrast between casual-on-CONNECTED vs formal-on-NEW doesn't prove tone caused the difference — it could be lead_status effects, time-of-day, industry mix, etc.

---

## Minimum sample rules (NON-NEGOTIABLE)

| Rule | Threshold |
|---|---|
| Report a contrast | ≥5 drafts in each bucket AND ≥15 percentage-point positive-rate delta |
| Propose a Section C rule | ≥10 drafts total evidence (bucket + other) |
| Flag as "strong" signal | ≥20 drafts total evidence AND ≥25 pp delta |
| Skip bucket entirely | <5 drafts |
| Stop the whole run | <5 drafts total in window |

**These thresholds are set in `src/performance.ts` as `MIN_BUCKET_SIZE`, `MIN_DELTA`, `PROPOSABLE_EVIDENCE`. The agent MUST NOT lower them.** Overfitting to tiny samples is exactly what makes feedback-loop systems harmful — the whole point of minimum-sample rules is to protect the drafting skills from chasing noise.

If the user explicitly asks for lower thresholds, they must edit `src/performance.ts` themselves. Do not run with `--force` flags or override logic.

---

## Report template (markdown, written to `output/performance/<date>.md`)

```markdown
# Performance Review — <YYYY-MM-DD>

**Window:** <start date> → <end date> (<N> days)

## Data warnings

- <warnings from performance.ts, or "none" if clean>

## 1. Headline metrics

- Drafts: <N>
- Replies: <N> (<reply_rate>%)
- Positive: <N> (<positive_rate>%)
  - POSITIVE_INTENT: <N>
  - POSITIVE_MEETING: <N>
  - POSITIVE_QUESTION: <N>
- Negative: <N>
  - NEGATIVE_HARD: <N>
  - NEGATIVE_SOFT: <N>

## 2. Segment breakdowns

### By lead_status
| lead_status | drafts | replies | positive | reply rate | positive rate |
|---|---|---|---|---|---|
| ... |

### By skill
| skill | drafts | replies | positive | reply rate | positive rate |
|---|---|---|---|---|---|
| ... |

### By (lead_status × skill)
| cell | drafts | positive rate |
|---|---|---|
| ... |

## 3. Contrasts

<one block per contrast, per the Section 3 format above>

## 4. Proposed Section C additions

<copy-paste blocks, or "No contrasts met the ≥10-evidence threshold this week">

**Review these carefully before promoting to learnings.md Section C.**

## 5. Caveats

- <sample size warnings>
- <correlation-not-causation reminder>
- <anything the human should weight down>

---

*Generated by `performance-review` — math from `src/performance.ts`, tone/subject from Gmail drafts, narrative by the agent.*
```

---

## Constraints

### Allowed
- Read all of `table.tsv` via `src/performance.ts`
- Read individual Gmail drafts (subject + body) for deepening contrasts
- Read HubSpot contacts for segment confirmation (optional)
- Write report to `output/performance/<YYYY-MM-DD>.md`
- Append to `knowledge/learnings.md` Section B (heartbeat or observation)
- Propose Section C rules **inside the report** as copy-paste-ready blocks

### Forbidden
- **Auto-writing to `knowledge/learnings.md` Section C** — human confirms every rule promotion, always
- **Lowering the minimum-sample thresholds** — edit `src/performance.ts` if you disagree, don't hack around it
- Generating Gmail drafts (this skill is read-only on Gmail)
- Modifying HubSpot data
- Running when the window has <5 drafts total — stop with an explanatory note and a heartbeat
- Fabricating subject lines or tone observations when drafts can't be fetched — skip the deepening and say so in the report
- Claiming causation from correlation — always frame findings as "observed pattern" not "this caused that"

---

## Append to learnings (end of run)

Universal teardown. One entry per run.

**Default — heartbeat:**
```bash
npx tsx src/learnings.ts append heartbeat --skill performance-review \
  --text "Window <N>d: <drafts> drafts / <replies> replies / <positive> positive. Top contrast: <short description> (delta <pp> pp, evidence <n>)."
```

**Observation (when a proposable rule emerged):**
```bash
npx tsx src/learnings.ts append observation --skill performance-review \
  --headline "<short pattern name>" \
  --context "<window, total drafts>" \
  --observed "<contrast with numbers>" \
  --apply "<proposed Section C rule text>"
```

Write **one or the other**, not both. See `program.md` for the universal teardown rule.

---

## Example run (what the console output looks like)

```
Performance Review — 2026-04-13

Window: 2026-04-06 → 2026-04-13 (7 days)
Data warnings: Only 23 drafts — directional signals only.

Headline:
  Drafts:   23
  Replies:   8  (35%)
  Positive:  3  (13%)
    POSITIVE_INTENT:  2
    POSITIVE_MEETING: 1
  Negative:  3
    NEGATIVE_SOFT:    3

Top contrasts:
  1. research-outreach within CONNECTED: 50% pos (6) vs 10% pos (10)  → delta 40pp  [proposable]
  2. follow-up-loop within NEW: 0% pos (5) vs 25% pos (8)             → delta 25pp  [proposable]

Proposed Section C additions: 2 (see report)
Full report: output/performance/2026-04-13.md

Heartbeat appended to learnings.md Section B.
```
