# Skill: inbox-classifier

> **Architecture:** One of 4 skills in the Sales Agent. See `README.md` for the overview.
> **Shared rules:** `CLAUDE.md` (reply templates follow the same greeting/tone rules).
> **Related:** Reads lessons from `knowledge/learnings.md`.

---

## Purpose
Reactive one-shot command: reads the inbox for new replies to sent outreach emails, classifies each reply into 1 of 8 categories, creates appropriate reply drafts (when sensible), updates HubSpot lead status, and writes reply fields to `table.tsv`.

**No loop.** One invocation = one run = all new replies processed = STOP.

## Trigger
Manual. Recommended: 1-2x daily, or after each outreach wave (24-48h later). Invocation examples in `prompts/invoke-skill.md`.

## Output
- Reply drafts in Gmail (only for POSITIVE_* classifications)
- HubSpot updates (lead status + note with classification + date)
- `table.tsv` updates: `reply_received_at`, `reply_classification`, `reply_draft_id`, `hubspot_status_after`
- Run report in the console

## Stopping
- All new replies processed → STOP
- API quota exhausted → STOP with notice
- On unclear classification → mark `awaiting_human`, continue

---

## Setup (once per run)

1. **Read tracker:** `node src/tracker.js read` → set of all `email` addresses we have drafted
2. **Search inbox:**
   - **MCP:** `mcp__claude_ai_Gmail__gmail_search_messages` with `query="newer_than:7d in:inbox"`
   - **CLI:** `node src/tools/gmail.js inbox search --query "newer_than:7d in:inbox"`
3. **Filter replies:** keep threads where:
   - Last message is incoming (not from us)
   - Sender email is in the tracker
   - `reply_classification` in tracker is still empty
4. **Build reply set:** `[{threadId, fromEmail, snippet}, ...]`

---

## Per-Reply 6-Step Loop

### Step 1 — Load thread
- **MCP:** `mcp__claude_ai_Gmail__gmail_read_thread(threadId)` → full thread (need original outreach + all replies)
- **CLI:** `node src/tools/gmail.js thread read --id <threadId>`

### Step 2 — Load HubSpot context
Find the contact via `fromEmail`:
- **MCP:** `mcp__claude_ai_HubSpot__search_crm_objects` with `objectType=contacts`, query=email
- **CLI:** `node src/tools/hubspot.js contacts search --email <email>`

Read lead status, recent notes, associated deals.
If no HubSpot contact: mark `awaiting_human` (manual mapping needed).

### Step 3 — Classify

| Classification | Detection | Example |
|---|---|---|
| **POSITIVE_INTENT** | "Yes, do you have an offering", "send me info", "when can we talk" | *"Yes, there's a need. Do you have an offering and timeline?"* |
| **POSITIVE_MEETING** | Meeting booking, rescheduling, confirming with specific time | *"I've booked a new slot at 13:30 — will you also be on the call?"* |
| **POSITIVE_QUESTION** | Content question about services/pricing without clear yes/no | "What does a project like this cost?" |
| **NEGATIVE_HARD** | "No", "not interested", "please remove me", "unsubscribe" | Direct "No, not interested" |
| **NEGATIVE_SOFT** | "Not right now", "maybe later", "no budget", polite decline | *"No, not at the moment. Kind regards"* |
| **NEUTRAL** | OOO reply, automatic acknowledgment, "forwarding to colleague" | Out-of-office auto-reply |
| **BOUNCE** | Mailer-Daemon "address not found" / "domain not found" | Various |
| **SPAM_FLAG** | "You don't often receive emails from..." warning, "potentially virus" reject | Mail server warnings |

**When uncertain:** mark `awaiting_human`. Better to let a human review than misclassify.

### Step 4 — Generate reply draft (only for POSITIVE_*)

#### POSITIVE_INTENT
**Greeting:** Match the greeting the lead used in their reply (casual or formal).
```
[Hello / Hey] [Name],

thanks for the quick reply — great to hear there's a current need.

[OPTIONAL: 1 sentence with REAL details from the lead's reply. NO invented
details from old notes — see learnings in knowledge/learnings.md.]

Let's set up a quick call so we can walk through the offering together:
[YOUR_SCHEDULING_LINK]

One quick question: [concrete qualifying question about the need,
based on the lead's reply]

[Kind regards / Best]
YOUR_NAME
YOUR_DOMAIN
```

**Rules:**
- NO invented note details
- Scheduling link ALWAYS: `[YOUR_SCHEDULING_LINK]` (configure in CLAUDE.md)
- ONE concrete qualifying question (not multiple)
- Match greeting from the lead's reply

#### POSITIVE_MEETING
```
[Hello / Hey] [First name],

sounds good — I'll be there.

[Brief confirmation of the time / platform if mentioned]

See you then,
YOUR_NAME
```

#### POSITIVE_QUESTION
Answer the question concretely in 2-4 sentences, then include the scheduling link for a deeper conversation.

#### NEGATIVE_HARD / NEGATIVE_SOFT
**NO reply draft.** Instead:
- Set HubSpot lead status to `UNQUALIFIED`
- Add HubSpot note: `[Date] Sales Agent: classification NEGATIVE_[HARD|SOFT] — "[first 100 chars of reply]"`
- Tracker: `status=declined`
- No re-engagement for 6 months

#### NEUTRAL (OOO, auto-reply)
**NO reply draft.** Tracker: `status=awaiting_human`. On next run, the thread is skipped (already classified) — human must decide manually.

#### BOUNCE
**NO reply draft.**
- HubSpot: mark email as invalid (add note)
- Tracker: `status=bounced`
- TODO: find alternative email (LinkedIn, website) → manual

#### SPAM_FLAG
**NO reply draft.** Warning in run report — human must check SPF/DKIM/DMARC.

### Step 5 — HubSpot update
- **MCP:** `mcp__claude_ai_HubSpot__manage_crm_objects`
- **CLI:** `node src/tools/hubspot.js contacts update --id <id> --property hs_lead_status --value UNQUALIFIED`

Update lead status (NEGATIVE_* → UNQUALIFIED, POSITIVE_INTENT → IN_PROGRESS).
Add note with classification + date + first 100 chars of reply.

### Step 6 — Tracker update
```bash
node src/tracker.js update <email> <reply_classification> [reply_draft_id] [hubspot_status_after]
```

Automatically sets `reply_received_at = ISO now`.

---

## Run Report (at end)

```
Inbox Classifier Run — [Date]

Processed: 12 new replies
├── POSITIVE_INTENT:   2 → 2 reply drafts in Gmail
├── POSITIVE_MEETING:  3 → 3 reply drafts in Gmail
├── POSITIVE_QUESTION: 1 → 1 reply draft in Gmail
├── NEGATIVE_HARD:     1 → HubSpot UNQUALIFIED
├── NEGATIVE_SOFT:     2 → HubSpot UNQUALIFIED
├── NEUTRAL/OOO:       1 → awaiting_human
├── BOUNCE:            2 → email_invalid
└── SPAM_FLAG:         0

HubSpot updates: 8
Tracker updates: 12
Reply drafts:    6

Action for human:
→ 6 reply drafts in Gmail to review and send
→ 1 neutral reply to evaluate manually: <thread-link>
→ If SPAM_FLAG > 0: check SPF/DKIM/DMARC
```

---

## Lesson Extraction (optional, not every run)

When the run shows **surprising patterns** → manually update `knowledge/learnings.md`:
- Positive signal with unusual email style
- Sudden cluster of rejections from one industry
- New rejection reasons not seen before

**Trigger:** 50+ new emails since last wave OR unusual patterns.

---

## Constraints

### Allowed
- Read inbox (read-only)
- Create reply drafts
- Update HubSpot lead status
- Add HubSpot notes
- Update `table.tsv`

### Forbidden
- Send emails
- Send drafts
- Delete threads
- Delete HubSpot contacts
- Force classification when uncertain — prefer `awaiting_human`
- Invent personalized "note details" in reply drafts
