# HubSpot Follow-up Email Agent — Program

This is the authoritative instruction file for the autonomous email agent.
Read this file first before doing anything. Then read CLAUDE.md for email generation rules.

## Goal

Draft personalized follow-up emails for HubSpot leads and save them as Gmail drafts.
One email per contact. Never draft the same contact twice.
The goal: wake up to a full inbox of ready-to-send drafts.

## Setup

Before starting the loop:

1. **Read `table.tsv`** — this is your experiment log. Extract the `email` column to build a skip-set of already-processed contacts.
2. **Fetch ALL contacts from HubSpot** using `search_crm_objects`:
   - objectType: `contacts`
   - properties: `firstname`, `lastname`, `email`, `company`, `jobtitle`, `hs_lead_status`
   - Paginate: repeat with increasing `offset` until `offset >= total`
3. **Build your work queue**: contacts where:
   - `email` is not empty
   - `hs_lead_status` is NOT in your exclude list (configure in CLAUDE.md)
   - email is NOT already in `table.tsv`

Confirm setup is complete, then start the loop immediately.

## Per-Contact Loop — NEVER STOP

For each contact in the work queue:

### Step 1 — Read Notes
Call `search_crm_objects` with:
- objectType: `notes`
- properties: `hs_note_body`, `hs_timestamp`
- filterGroups: associatedWith contact ID
- sorts: `hs_timestamp DESCENDING`

If no notes exist: generate email based on lead status only (skip to Step 3).

### Step 2 — Check for Skip Flags
Scan all note bodies for skip phrases (case-insensitive). Configure your own skip flags — examples:
- `do not contact`
- `already in contact with [team member]`
- `not interested`
- `already a customer`

If ANY flag found → log to `table.tsv` with `status=skipped`, notes_summary = the flag found. Move to next contact immediately.

### Step 3 — Extract Context from Notes
From the most recent notes, extract:
- **Project type**: What did they originally want? (Website, SEO, Ads, Platform, etc.)
- **Status**: Where did things end? (Meeting scheduled, no feedback, proposal sent, etc.)
- **Budget**: Any numbers mentioned?
- **Special details**: Anything specific that makes this contact memorable

This context is the email hook. Use it.

### Step 4 — Generate Email
See CLAUDE.md for full rules. Key points:
- Greeting and tone are determined by `hs_lead_status`
- Subject: reference the project, NOT just "Follow-up"
- Body: max 5-7 sentences, end with concrete CTA
- Hook: pick up exactly where things were left, or reference the project they discussed
- If no notes: use lead status + company/job title for personalization

### Step 5 — Create Gmail Draft
Call `gmail_create_draft`:
- `to`: contact email
- `subject`: generated subject
- `body`: generated email text
- `contentType`: `text/plain`

Save the returned `draftId`.

### Step 6 — Log to table.tsv
Immediately after draft creation, append one row to `table.tsv`:
```
<email>	<firstname>	<lastname>	<company>	<lead_status>	<notes_summary>	<draft_id>	drafted	<ISO timestamp>
```

Use `node src/tracker.js append "..."` or write directly. Do NOT skip this step.
notes_summary: max 1 sentence, the key context used for the email.

### Step 7 — Continue
Move immediately to the next contact. Do NOT pause. Do NOT ask for confirmation.

## What you CAN do
- Read HubSpot notes for any contact
- Generate email content freely
- Create Gmail drafts

## What you CANNOT do
- Send emails — drafts only
- Modify the `table.tsv` header row
- Skip the notes-reading step
- Draft the same contact twice
- Ask "should I continue?" mid-loop

## Error Handling
- HubSpot API error: log `status=error` in table.tsv, continue to next contact
- Gmail API error: retry once after 2 seconds. If still failing: log `status=error`, continue
- Contact has no email: skip silently (don't log to table.tsv)
- Log all errors to `output/errors.log`: `[ISO-TIMESTAMP] ERROR: <email> — <message>`

## Stopping Criteria

**NEVER STOP on your own.** Run until manually interrupted by the human.

When interrupted, print final report:
```
Drafted: X
Skipped: Y (skip flag or already processed)
Errors: Z
Remaining: N contacts not yet processed
```

If you run out of contacts in the current batch: fetch the next page and continue.
If all contacts are processed: report completion and wait.
