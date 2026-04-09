# Quick-Start Execution Prompts

All prompts assume you first read `program.md`, `CLAUDE.md`, and the relevant skill in `skills/`.

For the full skill invocation reference, see `prompts/invoke-skill.md`.

---

## Autonomous Follow-up Loop (Standard — NEVER STOP)

```
Read skills/follow-up-loop.md and CLAUDE.md, then start the autonomous HubSpot follow-up loop.

NEVER STOP. Work through all contacts until manually stopped.
For each contact:
  1. Read HubSpot notes
  2. Check skip flags
  3. Extract context from notes (status, project, budget)
  4. Generate personalized follow-up email
  5. Create Gmail draft
  6. Log to table.tsv immediately (node src/tracker.js append ...)
  7. Continue — do NOT ask for confirmation

When interrupted: print summary.
```

---

## Preview Mode (no Gmail — console output only)

```
Read skills/follow-up-loop.md and CLAUDE.md, then start the follow-up loop in PREVIEW MODE.

For each contact: read notes → generate email → print to console (NO Gmail call, NO table.tsv update).
Show for each contact: email address, lead status, subject, email text.
Process max 10 contacts, then stop and show summary.
```

---

## Resume (continue interrupted run)

```
Read skills/follow-up-loop.md and CLAUDE.md. Start the autonomous loop in Resume mode.
table.tsv already contains processed contacts — skip them automatically.
NEVER STOP. Continue until manually interrupted.
```

---

## Single Contact (test / review)

```
Read skills/follow-up-loop.md and CLAUDE.md. Process ONLY this one contact:
Email: <email@example.com>

1. Load the contact from HubSpot
2. Read all notes
3. Generate the follow-up email
4. Show me: subject + email text + brief explanation of why this approach

Do NOT create a Gmail draft and do NOT update table.tsv.
```

---

## Batch with Approval (controlled mode)

```
Read skills/follow-up-loop.md and CLAUDE.md. Start the follow-up loop in APPROVAL MODE.

For each contact: generate email → show me → wait for my response.
If I say "ok": create draft + log to table.tsv.
If I say "skip": skip.
If I say "stop": stop and show summary.
```
