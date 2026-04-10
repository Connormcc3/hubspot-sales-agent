# Skill: compose-reply

> **Architecture:** One of 10 skills in the Sales Agent. See `README.md` for the overview.
> **Shared rules:** `CLAUDE.md` (greeting, tone, templates, signatures).
> **Related skills:** `inbox-classifier` handles bulk reply classification. This skill is for the ONE lead where you need full context and careful composition.

---

## Purpose

**Deep-context single-lead composer.** For ONE specific lead, assemble the complete context — every email ever sent or received, all HubSpot notes and deals, prior agent interactions — plus any new context you want to inject, then generate a high-quality reply or outreach draft.

**When to use this instead of the bulk skills:**
- A high-value lead just replied with a complex question
- You're about to re-engage a VIP after a long silence
- A fresh piece of intelligence changes how you'd approach a lead (e.g., "they just raised a round", "new product launch", "competitor just lost them")
- You want to reply carefully and the bulk skills don't provide enough personalization
- You need to reference specific prior conversations accurately

**When NOT to use this:**
- Bulk outreach → use `follow-up-loop`
- First-touch research-driven outreach → use `research-outreach`
- Routine reply handling → use `inbox-classifier`

## Trigger
Manual with a single lead email or HubSpot contact ID. Invocation examples in `prompts/invoke-skill.md`.

## Output
- **Context brief** to console — summary of who they are, relationship history, current status
- **Email draft** to console — for review before creating in Gmail
- **Gmail draft** (optional — only when user confirms)
- **Tracker entry** with `notes_summary` prefix `COMPOSE:`
- **Optional dossier** at `output/lead-dossiers/<email>.md` for future reference

## Stopping
One-shot. Processes one lead, outputs brief + draft, stops.

---

## Setup

The invocation always includes:
1. **Lead identifier** — email address OR HubSpot contact ID
2. **New context** (optional) — anything the user wants to inject into the composition
3. **Desired outcome** (optional) — e.g., "book a meeting", "soft re-engagement", "answer their question directly", "propose next step"
4. **Tone preference** (optional) — overrides the default from CLAUDE.md if needed

---

## Per-Lead 6-Step Loop

### Step 0 — Load learnings (once per run)

Read `knowledge/learnings.md`. Section A informs greeting/tone, Section B (recent entries) flags patterns observed across other skills that might apply to this lead, Section C lists distilled rules. Universal requirement — see `program.md`.

### Step 1 — Identify the lead
Resolve the input to a HubSpot contact:
- **MCP:** `mcp__hubspot__search_crm_objects` with `objectType=contacts`, query by email
- **CLI:** `npx tsx src/tools/hubspot.ts contacts search --email <email>`

If not found in HubSpot: continue with email history only, flag as "no HubSpot record".

### Step 2 — Assemble historical context

Fetch **everything** available about this lead. Unlike `follow-up-loop` which reads only the last few notes, this skill reads the full history.

**2a. HubSpot notes (ALL notes, not last 5):**
- **MCP:** `mcp__hubspot__search_crm_objects` — `objectType=notes`, filter by contact ID, sort by timestamp ASC for chronological order
- **CLI:** `npx tsx src/tools/hubspot.ts notes list --contact-id <id> --limit 200`

**2b. HubSpot deals linked to this contact:**
- Read all deals with their stage, amount, create date, last activity, and any associated notes
- Note the deal trajectory: did they come close? What blocked it? When did it go cold?

**2c. Email history (both directions):**
- **MCP:** `mcp__gmail__gmail_search_messages` — query: `from:<email> OR to:<email>`
- **CLI:** `npx tsx src/tools/gmail.ts inbox search --query "from:<email> OR to:<email>"`
- For each thread, read the full bodies (not just snippets):
  - **MCP:** `mcp__gmail__gmail_read_thread`
  - **CLI:** `npx tsx src/tools/gmail.ts thread read --id <threadId>`

**2d. Prior agent interactions:**
- Check `tracker` for any rows matching this email
- If present, note: when was the agent's last draft? What was the notes_summary? Was there a classification? Did the lead reply?

### Step 3 — Accept custom context injection

The user's invocation provides a "New Context" block. Examples:
- "They just raised a Series A yesterday — I saw it on LinkedIn"
- "Competitor X just lost them, they're shopping again"
- "They're hiring a Head of Marketing — someone new is probably making decisions"
- "Include this specific technical detail: [X]"
- "They mentioned budget constraints last time — address that directly"

This context is INJECTED INTO THE BRIEF, not treated as the only source. Combine with the historical context.

### Step 4 — Synthesize the brief

Generate a structured brief about the lead:

```
Lead Brief: <Name> <<email>>

Who they are:
- Role: <title>
- Company: <company>
- Industry: <industry>
- HubSpot status: <lead_status>

Relationship history:
- First touch: <date> — <what happened>
- Key moments: <2-3 bullets of meaningful interactions>
- Last activity: <date> — <what happened>
- Agent prior interactions: <drafted X times, reply classification Y>

Current state:
- Open deal: <yes/no, amount, stage>
- Last conversation status: <where it left off>
- Temperature: <cold / warm / hot>

New context (from user):
- <injected new information>

Recommended angle:
- <1-2 sentence framing for the email: tone, hook, CTA>
- Greeting: <casual / formal — with reason if override applies>
- Key references: <which specific prior interactions to mention>
- Things to AVOID: <what the context warns against>
```

### Step 5 — Draft the email

Using the brief + `CLAUDE.md` rules + `knowledge/learnings.md`:

**Core rules for this skill:**
- Match the tone of the prior conversation (check actual email history, not just HubSpot status)
- Reference SPECIFIC prior interactions — but ONLY real ones from the assembled context (never invent)
- Incorporate the new custom context naturally
- Add a concrete CTA based on the desired outcome specified in the invocation
- Length: can be slightly longer than bulk follow-ups (7-10 sentences OK) because this is high-stakes and curated

**Critical:** If the context is sparse (no email history, no HubSpot notes), say so in the brief and generate a conservative, generic draft. Better to be honest about limited context than to invent details.

### Step 6 — Output + optional Gmail draft

Print to console:
1. The full brief (Section 4)
2. The draft (subject + body)
3. Ask: "Create Gmail draft? (y/n)"

**If user confirms:**
- **MCP:** `mcp__gmail__gmail_create_draft` with `contentType=text/plain` (or `text/html` if body is HTML)
- **CLI:** `npx tsx src/tools/gmail.ts draft create --to <email> --subject "..." --body "..."`
- Append to tracker: `npx tsx src/tracker.ts append "<email>\t<firstname>\t<lastname>\t<company>\t<lead_status>\tCOMPOSE: <1-sentence summary of angle used>\t<draft_id>\tdrafted\t<ISO timestamp>"`

**Optional dossier save:**
If the invocation includes `--save-dossier`, write the full brief + draft to `output/lead-dossiers/<email>.md` for future reference. This is useful for VIP leads you'll revisit.

---

## Example Invocation (what the user sends to the agent)

```
Read skills/compose-reply.md and CLAUDE.md.
Compose a reply to this lead:

Email: founder@acme.com

New context:
- They just posted on LinkedIn that they're expanding to 3 new markets this quarter
- I noticed their website still uses the old pricing page we discussed improving last year

Desired outcome:
- Re-engage warmly, reference the LinkedIn post as a hook, offer a short call to discuss
  how the new market expansion could benefit from the work we proposed before.

Tone: casual (we had documented Du-contact in notes).

Assemble the full context from HubSpot + Gmail history + tracker,
generate a brief, then draft the email. Ask me before creating the Gmail draft.
```

---

## Append to learnings (observation-only, if surprising)

`compose-reply` is the one skill that does **not** write a heartbeat. It runs per-lead, frequently, and `tracker` already records each invocation — heartbeats here would be noise.

**Only append if the lead was genuinely surprising:**
- A new pattern not in existing learnings (Section B or C)
- Context that contradicted an assumption baked into Section A
- A hook/angle that worked (or clearly won't work) and is reusable across leads

```bash
npx tsx src/learnings.ts append observation --skill compose-reply \
  --headline "<short pattern name>" \
  --context "<lead profile, anonymized: role, industry, deal stage>" \
  --observed "<what was surprising about this lead>" \
  --apply "<concrete rule for similar leads next time>"
```

Otherwise: skip. No heartbeat. See `program.md` for the universal teardown rule (this skill is the documented exception).

---

## Constraints

### Allowed
- Read all HubSpot data for the lead (contact, notes, deals)
- Read full Gmail thread history for the lead (both directions)
- Read `tracker` for prior agent interactions
- Generate briefs and drafts with full context
- Create Gmail drafts (only with explicit user confirmation)
- Save dossiers to `output/lead-dossiers/` (only with explicit flag)

### Forbidden
- Bulk operations (this skill is single-lead only)
- Invent prior conversations, meeting dates, or relationship details
- Use details from other leads (cross-contamination risk — each run is strictly scoped to ONE lead)
- Create Gmail drafts without user confirmation
- Write the dossier file without explicit `--save-dossier` flag
- Touch HubSpot data (read-only)
- Skip the brief — the human needs to see the assembled context before approving the draft

---

## Why the Brief Matters

The brief is NOT optional filler. It's the control point:
- You catch false personalizations before they become drafts
- You see whether the agent has enough context or is fabricating
- You can inject corrections ("no, that was a different lead") before the draft is finalized
- It doubles as a dossier for future manual work

If the brief looks wrong, the draft will be wrong. Always review the brief first.
