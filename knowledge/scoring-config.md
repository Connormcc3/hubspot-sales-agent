# Scoring Configuration

> Define HOW the agent scores and prioritizes leads.
> This file is read by `src/scoring.ts` before computing scores.
> Edit the ICP definition and weights to match your business.

---

## How Scoring Works

Every contact gets two scores (0-100) and a priority tier (A/B/C/D):

- **Fit score** (0-100) — How well does this contact match your Ideal Customer Profile? Based on HubSpot properties: industry, company size, job title, location.
- **Engagement score** (0-100) — How engaged is this contact? Based on tracker data: reply history, classification, recency, number of touches.
- **Priority tier** — Derived from the fit x engagement matrix below.

Scores are stored in the tracker (`fit_score`, `engagement_score`, `priority_tier`) and used by skills to sort work queues.

---

## Fit Score — ICP Definition

Define your Ideal Customer Profile. The agent matches HubSpot properties against these criteria and assigns points.

### Industry Match (0-40 points)

| Industry | Points | Why |
|----------|--------|-----|
| `[YOUR_TOP_INDUSTRY]` | 40 | Perfect fit for your services |
| `[YOUR_SECOND_INDUSTRY]` | 30 | Strong fit |
| `[YOUR_THIRD_INDUSTRY]` | 20 | Moderate fit |
| _(other known industries)_ | 10 | Some potential |
| _(unknown / blank)_ | 5 | Can't assess |

**HubSpot property:** `industry`

### Company Size (0-25 points)

| Size | Points | Why |
|------|--------|-----|
| `[YOUR_SWEET_SPOT_SIZE]` | 25 | Sweet spot — big enough to pay, small enough to decide fast |
| `[NEXT_BEST_SIZE]` | 15 | Good fit |
| _(other)_ | 5 | Outside sweet spot |
| _(unknown)_ | 10 | Benefit of the doubt |

**HubSpot property:** `numberofemployees` or `annualrevenue`

### Job Title / Role (0-25 points)

| Title pattern | Points | Why |
|---------------|--------|-----|
| CEO, Founder, Owner, Managing Director | 25 | Decision maker |
| VP, Director, Head of | 20 | Strong influence |
| Manager | 15 | Can champion internally |
| _(other)_ | 5 | Unclear decision power |
| _(blank)_ | 10 | Unknown |

**HubSpot property:** `jobtitle`

### Location (0-10 points)

| Location | Points | Why |
|----------|--------|-----|
| `[YOUR_PRIMARY_MARKET]` | 10 | Local / primary market |
| `[YOUR_SECONDARY_MARKET]` | 7 | Reachable |
| _(other)_ | 3 | Remote / different timezone |
| _(blank)_ | 5 | Unknown |

**HubSpot property:** `city`, `state`, `country`

---

## Engagement Score — Tracker Signals

Computed from tracker data. No configuration needed — the logic is in `src/scoring.ts`.

| Signal | Points | Source |
|--------|--------|--------|
| Has positive reply (POSITIVE_INTENT/MEETING/QUESTION) | +40 | `reply_classification` |
| Has any reply (including NEGATIVE_SOFT, NEUTRAL) | +20 | `reply_classification` |
| Reply within last 30 days | +15 | `reply_received_at` |
| Reply within last 90 days | +10 | `reply_received_at` |
| Was drafted (outreach sent) | +10 | `status = drafted` |
| Has research outreach (RES: prefix) | +10 | `notes_summary` |
| Has compose-reply (COMPOSE: prefix) | +5 | `notes_summary` |
| Hard negative (NEGATIVE_HARD) | -20 | `reply_classification` |
| Bounced | -30 | `reply_classification = BOUNCE` |

**Cap:** 0-100 (clamp after summing).

---

## Priority Tier Matrix

Combine fit and engagement into a tier:

```
                    Engagement Score
                    Low (0-30)    Med (31-60)   High (61-100)
Fit Score
High (71-100)       B             A             A
Med  (41-70)        C             B             A
Low  (0-40)         D             C             B
```

**What each tier means for the agent:**

| Tier | Meaning | Agent behavior |
|------|---------|---------------|
| **A** | High-value, engaged | Prioritize first. Use `compose-reply` or `research-outreach` for maximum personalization. |
| **B** | Good fit OR good engagement | Process in normal queue. Standard `follow-up-loop` or `cold-outreach`. |
| **C** | Moderate | Process after A and B. Keep in pipeline but lower effort. |
| **D** | Low fit, low engagement | Process last. Consider `lead-recovery` to decide if worth keeping. |

---

## How to Customize

1. **Edit the industry table** — replace `[YOUR_TOP_INDUSTRY]` etc. with your actual target industries and point values.
2. **Edit the company size table** — define your sweet spot (e.g., "10-50 employees" = 25 points).
3. **Edit the job title table** — adjust which roles matter for your sales cycle.
4. **Edit the location table** — set your primary/secondary markets.
5. **Adjust the tier matrix thresholds** if needed (default thresholds work for most cases).

The scoring engine reads this file's tables to build the scoring model. Keep the table format — the parser expects `| value | points |` rows.
