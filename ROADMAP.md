# Roadmap

Known gaps between this agent and the expectations people carry from mature outbound tooling (Outreach, Apollo, Salesloft). These aren't bugs — the current scope is deliberately smaller. This file is a commitment to honesty about what's missing, not a commitment to ship any of it on a timeline.

If you want to pick one up, open a PR. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the pattern (add a new skill, extend an existing one, or add a new tool).

---

## 1. ~~Qualification and scoring~~ — SHIPPED (v2.8)

**Implemented.** Lead scoring utility at `src/scoring.ts` with configurable ICP definition at `knowledge/scoring-config.md`.

- **Fit score** (0-100) from HubSpot properties: industry, company size, job title, location. Weights configurable.
- **Engagement score** (0-100) from tracker data: reply history, classification, recency, touch count.
- **Priority tier** (A/B/C/D) from fit x engagement matrix.
- Tracker columns: `fit_score`, `engagement_score`, `priority_tier` (added in v2.8 schema migration).
- CLI: `npx tsx src/scoring.ts score|score-tracker|rank|tier|update`
- Skills updated: `follow-up-loop` and `cold-outreach` sort by tier; `prospect-research` populates fit scores from research; `pipeline-analysis` reports score distribution.

**What's still missing.** Intent signals (website visits, email opens) are not tracked — these would further refine the engagement score but require webhook infrastructure.

---

## 2. Meeting booking

**What's missing.** The funnel ends at *"positive reply classified."* There's no calendar integration, no dynamic scheduling-link insertion, no handoff to an actual meeting booked on a calendar.

**What happens today.** `inbox-classifier` catches `POSITIVE_INTENT` and `POSITIVE_MEETING` replies, drafts a response that includes a `[YOUR_SCHEDULING_LINK]` placeholder, and stops there. The human reviews the reply draft, manually replaces the placeholder with their actual Calendly/Cal.com link, sends, waits for the lead to book. If the lead doesn't book, nobody notices. If the lead books, the agent doesn't know.

The gap between *"they said yes"* and *"meeting on the calendar"* is where a meaningful share of deals leaks out.

**What it would take.**
- A scheduler integration — either (a) a generic URL template baked into `CLAUDE.md` (trivial — partially exists via the `[YOUR_SCHEDULING_LINK]` placeholder), or (b) a real calendar API integration (Cal.com, Calendly, or Google Calendar directly) that lets the agent read availability and propose specific slots.
- New state in the tracker — `meeting_proposed_at`, `meeting_booked_at`, `meeting_url` — or a new table for meeting state.
- A new skill `meeting-nudge.md` that checks positive replies from N days ago that still don't have `meeting_booked_at` set, and drafts a gentle follow-up.
- Ideally: webhook from the calendar service → local script → tracker update when a meeting is booked. Non-trivial because it needs a publicly-reachable endpoint, which conflicts with the "localhost only" posture.

**Complexity.** High for real calendar integration (OAuth + webhook infrastructure). Low for "smarter scheduling-link handling" + "meeting-nudge skill".

**Priority.** High, because this is where deals die. Start with the low-complexity version (smarter links + nudge skill).

---

## 3. Sequencing and cadence logic

**What's missing.** There's no *"send email 1, wait 3 days, send email 2, wait 5 days, send email 3"* structure. Multi-touch sequences with wait intervals are table stakes in outbound tooling.

**What happens today.** `follow-up-loop` drafts one email per contact and moves on. The contact is then in the tracker with `status=drafted`. If you want a second touch, you run the loop again later and it skips anyone already in the tracker. To actually send a second email, you'd manually remove the row or run `compose-reply` per contact.

**What it would take.**
- New tracker columns: `sequence_step` (int), `next_action_at` (ISO timestamp), `sequence_id` (string).
- A `sequences/` directory with markdown definitions: `sequences/cold-to-warm.md` defines "step 1: follow-up-loop default. step 2: research-outreach after 3 days. step 3: compose-reply with retry angle after 5 days".
- A new skill `sequence-runner.md` that wakes up, queries the tracker for rows where `next_action_at <= now`, figures out the current step, runs the appropriate downstream skill with the right parameters, updates `sequence_step` and `next_action_at`.
- A scheduling layer — either (a) cron / launchd / systemd timer that invokes the agent periodically, (b) a long-running daemon, or (c) manual re-runs with the skill handling the "what's due now" logic.

**Complexity.** Moderate, but it introduces persistent *time-based* state beyond the current "drafted / replied" model. Once you have `next_action_at`, you need something that runs periodically — which the current architecture doesn't assume.

**Priority.** High for anyone running cold outbound at volume. Medium for warm re-engagement.

---

## 4. ~~CRM pipeline management beyond lead status~~ — SHIPPED (v2.8)

**Implemented.** Full HubSpot CRM management from the terminal via `skills/crm-manager.md` + expanded `src/tools/hubspot.ts` (8 → 17 commands).

- **Contact management:** create, search, get, update any property, archive
- **Deal management:** create (with contact association), update stage/amount/close date, search by name or stage
- **Task management:** create (with contact association + due date), list, complete/update status
- **Notes:** create, list (already existed)
- **Pipeline:** list all stages with internal IDs
- Both MCP and CLI paths supported (same dual-path pattern as all skills)

**What's still missing.** Structured activity logging (typed engagements like calls, meetings, demos as first-class CRM events instead of freeform notes). Opportunity forecasting (pipeline value x probability x time projections).

---

## Meta: what's explicitly NOT on this list

The following are sometimes raised as "missing" features. They're intentionally out of scope and unlikely to change:

- **Actually sending emails.** By design. The agent creates drafts; humans send. Bypassing this eliminates the last line of defense against the agent generating something embarrassing.
- **A SaaS version / hosted dashboard / multi-user collaboration.** By design. The whole premise is "runs on your laptop, holds your credentials, never exposed publicly."
- **A visual sequence builder / drag-and-drop UI for skills.** The skills are markdown files you edit with any text editor. If you want drag-and-drop, use Outreach.
- **Automatic rule promotion from `learnings.md` Section B → Section C.** `performance-review` already proposes rules with evidence. Promoting them is the one place a human's judgment stays in the loop.
- **Native integrations with CRMs other than HubSpot.** The skills and tool wrappers are HubSpot-shaped. A Salesforce adapter is a whole separate project, not a feature.

---

## How to pitch a new item

If something belongs on this list that isn't here, open a PR that adds it in the same format: *What's missing → what happens today → what it would take → complexity → priority*. The honest "what happens today" paragraph is the important one — it forces the reader to agree the gap is real before proposing the fix.
