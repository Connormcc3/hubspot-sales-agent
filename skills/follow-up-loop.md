# Skill: follow-up-loop

> **Architecture:** One of 7 skills in the Sales Agent. See `README.md` for the overview.
> **Shared rules:** `CLAUDE.md` (greeting, tone, templates, signatures).

---

## Purpose
Bulk standard follow-ups for HubSpot contacts: for each contact, create a personalized email as a Gmail draft based on lead status and HubSpot notes. The human reviews and sends manually.

## Trigger
Manual. Invocation examples in `prompts/invoke-skill.md`.

## Output
- Gmail drafts (one per contact)
- `table.tsv` rows with `status=drafted` (or `skipped`/`error`)
- `output/errors.log` on API errors

## Stopping
NEVER STOP on your own. Only manual interruption. When the work queue is exhausted: fetch next page from HubSpot or print completion report.

---

## Setup

Before starting the loop:

0. **Load learnings** — Read `knowledge/learnings.md`. Section A informs greeting/tone, the most recent ~20 entries of Section B flag recent patterns, Section C lists distilled rules. Universal requirement — see `program.md`.

1. **Read the tracker:** `npx tsx src/tracker.ts read` → list of already-processed emails from `table.tsv`. This is your skip set.

2. **Fetch HubSpot contacts:**
   - **Path A (MCP):** `mcp__claude_ai_HubSpot__search_crm_objects`
     - objectType: `contacts`
     - properties: `firstname`, `lastname`, `email`, `company`, `jobtitle`, `hs_lead_status`
     - Paginate: increase `offset` until `offset >= total`
   - **Path B (CLI):** `npx tsx src/tools/hubspot.ts contacts list --limit 100 --offset 0 --properties firstname,lastname,email,company,jobtitle,hs_lead_status`
     - Repeat with increasing `--offset` until no more results

3. **Build the work queue** — contacts where:
   - `email` is not empty
   - `hs_lead_status` is NOT in your exclude list (configure in your own process)
   - `email` is NOT in the tracker

4. Print setup confirmation, then enter the loop immediately.

---

## Per-Contact Loop — NEVER STOP

### Step 1 — Read notes
- **MCP:** `mcp__claude_ai_HubSpot__search_crm_objects` with `objectType=notes`, filter by contact ID, sort `hs_timestamp DESCENDING`
- **CLI:** `npx tsx src/tools/hubspot.ts notes list --contact-id <id> --limit 10`

If no notes exist: generate email based on lead status only (skip Step 3).

### Step 2 — Check for skip flags
Scan all note bodies (case-insensitive) for your configured skip phrases. Examples:
- `do not contact`
- `already a customer`
- `not interested`
- `already in contact with [team member]`

If ANY flag found → log to `table.tsv` with `status=skipped` and `notes_summary=<found flag>`. Move to next contact immediately.

### Step 3 — Extract context
From the most recent notes:
- **Project type** — what did they originally want?
- **Status** — where did things end? (meeting scheduled, no feedback, proposal sent, etc.)
- **Budget** — any numbers mentioned?
- **Special details** — anything specific that makes this contact memorable?

This context IS the email hook.

### Step 4 — Generate email
Full rules in `CLAUDE.md`. Key points:
- **Greeting (casual/formal) and tone** come from the `hs_lead_status` table in `CLAUDE.md`
- **IMPORTANT:** Follow the greeting override for conservative industries (see `CLAUDE.md`)
- **Subject:** project-related (e.g., "Your platform project" or "[Company] — quick follow-up"), NOT just "Follow-up"
- **Body:** max 5-7 sentences, ends with a concrete CTA
- **Hook:** connect to the conversation status, or reference the project
- Without notes: use lead status + company/job title for personalization
- **Never invent details** — if notes are unclear, stay generic

### Step 5 — Create Gmail draft
- **MCP:** `mcp__claude_ai_Gmail__gmail_create_draft` with `to`, `subject`, `body`, `contentType=text/plain`
- **CLI:** `npx tsx src/tools/gmail.ts draft create --to <email> --subject "..." --body "..."`

Save the returned `draftId`.

### Step 6 — Log to table.tsv
Immediately after draft creation:
```bash
npx tsx src/tracker.ts append "<email>\t<firstname>\t<lastname>\t<company>\t<lead_status>\t<notes_summary>\t<draft_id>\tdrafted\t<ISO timestamp>"
```
Do NOT skip this step. `notes_summary`: max 1 sentence.

### Step 7 — Continue
Move immediately to the next contact. No pausing. No asking for confirmation.

---

## Constraints

### Allowed
- Read HubSpot notes for any contact
- Generate email content freely
- Create Gmail drafts
- Write to `table.tsv`

### Forbidden
- Send emails — drafts only
- Modify the `table.tsv` header row
- Skip the notes-reading step
- Draft the same contact twice
- Ask "should I continue?" mid-loop

---

## Final Report (on interruption)
```
Drafted: X
Skipped: Y (skip flag or already processed)
Errors: Z
Remaining: N contacts not yet processed
```

If all contacts are processed: report completion and wait.

---

## Append to learnings (before stopping)

Immediately after the final report, append one entry to `knowledge/learnings.md` Section B.

**Default — heartbeat:**
```bash
npx tsx src/learnings.ts append heartbeat --skill follow-up-loop \
  --text "Drafted X / skipped Y / errors Z. Mostly <dominant status> (N). <optional hint>"
```

**Observation (if ≥3 contacts showed the same signal, an unexpected cluster, or a segment behaving differently from Section A):**
```bash
npx tsx src/learnings.ts append observation --skill follow-up-loop \
  --headline "<short pattern name>" \
  --context "<what the batch was>" \
  --observed "<what was noticed, quantitative if possible>" \
  --apply "<concrete rule for next run>"
```

Write observation **instead of** the heartbeat (not both). See `program.md` for the universal teardown rule.
