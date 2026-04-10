# Skill: cold-outreach

> **Architecture:** One of 10 skills in the Sales Agent. See `README.md` for the overview.
> **Shared rules:** `CLAUDE.md` (greeting, tone, signatures).
> **Related skills:** `prospect-research.md` produces dossiers this skill consumes. `follow-up-loop.md` handles warm contacts — this skill handles first-touch cold contacts.

---

## Purpose

Generate first-touch cold emails for prospects with **zero prior relationship**. Different rules than `follow-up-loop` — these people have never heard of you. Emails are shorter, value-first, and use prospect intelligence (dossiers from `prospect-research` or basic HubSpot data) as the hook.

**Difference from `follow-up-loop`:**
- `follow-up-loop` = warm re-engagement ("we spoke before, here's a follow-up")
- `cold-outreach` = first touch ("I noticed X about your company, here's why that matters")

**Difference from `research-outreach`:**
- `research-outreach` = website audit findings as email hook (tactical, "3 issues with your site")
- `cold-outreach` = company intelligence as email hook (strategic, "I saw you're hiring for X, which usually means Y")

## Trigger
Manual with a lead list. Best when paired with `prospect-research` output, but works standalone.

## Output
- Gmail drafts (one per contact, text/plain or text/html depending on template)
- Tracker rows with `status=drafted` and `COLD:` prefix in `notes_summary`
- Optional: HubSpot contact creation for new prospects not yet in CRM

## Stopping
When all leads in the input list are processed. On errors: log and continue.

---

## Setup

0. **Load learnings** — Read `knowledge/learnings.md`. Section A informs greeting/tone, Section B flags recent patterns, Section C lists distilled rules. Universal requirement — see `program.md`.

1. **Receive lead list** (from the user or from `prospect-research` run report):
   - Format: `[{email, firstname, lastname, company, domain?, lead_status?, hubspot_id?}, ...]`
   - If a `prospect-research` dossier exists at `output/prospect-dossiers/<company-slug>.md` → load it for personalization

2. **Tracker check:** `npx tsx src/tracker.ts exists <email>` for each lead.
   - If `true` AND `notes_summary` starts with `COLD:` → already cold-emailed, SKIP
   - If `true` AND `notes_summary` starts with something else → already contacted via different skill. User must explicitly opt in to send a cold email on top (pass `--force` or include in lead list with `force: true`)
   - If `false` → new contact, proceed

3. **Check for dossiers:** For each lead, check if `output/prospect-dossiers/<company-slug>.md` exists.
   - If yes → **dossier mode**: use pain-point hypotheses and recommended approach from dossier
   - If no → **basic mode**: use HubSpot data + company name only

4. **Score leads** (if not already scored):
   ```bash
   npx tsx src/scoring.ts score "<email>" --data '{"industry":"...","jobTitle":"...","numberOfEmployees":"..."}'
   ```
   Sort work queue by priority tier: A first, then B, then C. Skip D-tier unless user explicitly includes them.

---

## Per-Lead Workflow

### Step 1 — Load context

**Dossier mode** (dossier exists):
- Read the dossier from `output/prospect-dossiers/<company-slug>.md`
- Extract: company profile, top pain-point hypothesis, recommended approach, decision-maker communication style, priority tier

**Basic mode** (no dossier):
- Use HubSpot properties: `firstname`, `lastname`, `company`, `jobtitle`, `industry`
- If contact not in HubSpot: use only what's in the lead list input

### Step 2 — Choose template

**Template 1 — Signal-based (dossier mode, high-confidence hypothesis)**
- **When:** Dossier exists with at least one high-confidence pain point
- **Subject pattern:** `<Company> + <specific signal>` (e.g., "Acme's new hiring push — quick thought")
- **Structure:** Open with the signal → connect to their likely need → bridge to your offering → soft CTA
- **Length:** 3-5 sentences max

**Template 2 — Value-first (dossier mode, medium-confidence hypotheses)**
- **When:** Dossier exists but hypotheses are medium/low confidence
- **Subject pattern:** `Quick question about <Company>'s <area>` (e.g., "Quick question about Acme's content strategy")
- **Structure:** Observation about their business → question that implies expertise → brief credential → soft CTA
- **Length:** 3-4 sentences

**Template 3 — Lightweight (basic mode, no dossier)**
- **When:** No dossier, limited data
- **Subject pattern:** `<Company> — <your service area>` (e.g., "Acme — quick thought on your web presence")
- **Structure:** Brief intro + what you do → one relevant question → soft CTA
- **Length:** 3 sentences max. When you know nothing specific, be SHORT.

### Step 3 — Cold email rules

These override the standard `CLAUDE.md` rules for cold context:

**CRITICAL DIFFERENCES from warm emails:**
- **NO "we spoke before" framing** — these people have never heard of you
- **NO "following up"** — there's nothing to follow up on
- **NO "I wanted to reach out"** — weak, passive opener
- **LEAD with THEM, not with you** — first sentence is about their company, not about yours
- **Value before ask** — demonstrate you know something about them before asking for anything
- **One CTA only** — don't overwhelm. "Worth a 15-minute call?" or "Should I send more details?" — not both
- **No attachments, no links in first email** — deliverability killer

**Greeting rules for cold:**
- **Always formal on first touch** unless the dossier explicitly flags casual communication style AND the person is in a casual industry (tech, creative, startup)
- "Hello [First Name]," is the default cold greeting
- Never use "Hey" on first touch to someone you've never met — too familiar
- Use "Mr./Ms. [Last Name]" only if conservative industry (law, medicine, finance, government)

**Subject line rules for cold:**
- Max 6 words — shorter is better for cold
- No spam triggers: avoid "free", "offer", "limited time", "opportunity"
- Must be specific to their company — generic subjects get deleted
- Curiosity + relevance: make them want to open without being clickbait
- Examples:
  - Good: `"Acme's hiring push — quick thought"`
  - Good: `"Your logistics platform's next step"`
  - Bad: `"Great opportunity for Acme"`
  - Bad: `"Introduction — YOUR_DOMAIN"`
  - Bad: `"Following up"`

**Signature for cold:**
Always formal:
```
Kind regards,
YOUR_NAME
YOUR_DOMAIN
```

### Step 4 — Generate email

Apply the chosen template + cold rules. The email structure:

**Template 1 (signal-based):**
```
Hello [First Name],

I noticed [specific signal from dossier — e.g., "you're hiring three frontend developers"].
That usually means [connection to their likely need — e.g., "the platform is scaling and the codebase needs to keep up"].

We've helped [brief credential — one company or one result, NOT a list].
[Soft CTA — "Would it make sense to compare notes for 15 minutes?"]

Kind regards,
YOUR_NAME
YOUR_DOMAIN
```

**Template 2 (value-first):**
```
Hello [First Name],

[Observation — e.g., "Acme's content output has been strong this quarter, but I noticed the blog hasn't touched [specific topic] yet."]
[Question that implies expertise — "Is that a deliberate choice, or just bandwidth?"]

[Brief credential — one sentence. "We handle that exact gap for [similar company type]."]
[Soft CTA — "Happy to share what we've seen work — worth a quick call?"]

Kind regards,
YOUR_NAME
YOUR_DOMAIN
```

**Template 3 (lightweight):**
```
Hello [First Name],

[One relevant observation or question about their company.]
[What you do, in one sentence — framed as relevant to them, not a pitch.]
[Soft CTA.]

Kind regards,
YOUR_NAME
YOUR_DOMAIN
```

### Step 5 — Create Gmail draft

- **MCP:** `mcp__gmail__gmail_create_draft` with `to`, `subject`, `body`, `contentType=text/plain`
- **CLI:** `npx tsx src/tools/gmail.ts draft create --to <email> --subject "..." --body "..."`

Save the returned `draftId`.

### Step 6 — Create HubSpot contact (if new)

If the contact doesn't exist in HubSpot:
- **MCP:** `mcp__hubspot__manage_crm_objects` — create contact with `email`, `firstname`, `lastname`, `company`, `hs_lead_status=NEW`
- **CLI:** `npx tsx src/tools/hubspot.ts contacts create --email <email> --firstname <fn> --lastname <ln> --company <co> --hs_lead_status NEW`

If the contact already exists: no HubSpot changes (cold-outreach doesn't modify existing contacts).

### Step 7 — Log to tracker

```bash
npx tsx src/tracker.ts append "<email>\t<firstname>\t<lastname>\t<company>\t<lead_status>\tCOLD: <template used> - <hook summary>\t<draft_id>\tdrafted\t<ISO timestamp>"
```

**Marker:** `notes_summary` starts with `COLD:` so performance tracking can distinguish cold outreach from warm follow-ups and research-driven outreach.

### Step 8 — Continue to next lead

Move immediately to the next lead. No pausing.

---

## Run Report (at end)

```
Cold Outreach Run — [Date]

Input:              20 leads
Drafts created:     16
├── Template 1 (signal-based):  8
├── Template 2 (value-first):   5
└── Template 3 (lightweight):   3

Priority distribution:
├── Tier A:  5
├── Tier B:  7
├── Tier C:  4
└── Tier D:  0 (skipped)

Skipped:            4
├── Already contacted (COLD:):  2
├── Already contacted (other):  1
├── D-tier (below threshold):   1

Dossier coverage:
├── With dossier:    13 (Template 1 or 2)
└── Without dossier:  3 (Template 3)

Action for human:
→ 16 drafts in Gmail to review and send
→ Consider running inbox-classifier in 2-3 days to catch replies
→ A-tier non-responders: follow up via compose-reply after 5-7 days
```

---

## Append to learnings (end of batch)

After the run report, append one entry to `knowledge/learnings.md` Section B.

**Default — heartbeat:**
```bash
npx tsx src/learnings.ts append heartbeat --skill cold-outreach \
  --text "Cold-emailed N leads, M drafted. Templates: T1=X T2=Y T3=Z. Tier distribution: A=a B=b C=c. Dossier coverage: D%"
```

**Observation (if ≥3 leads in same industry showed similar signal, a template worked notably better, or dossier quality varied by source):**
```bash
npx tsx src/learnings.ts append observation --skill cold-outreach \
  --headline "<short pattern name>" \
  --context "<batch description: industries, dossier coverage, tier mix>" \
  --observed "<quantitative finding pattern>" \
  --apply "<concrete rule for next run>"
```

Write observation **instead of** the heartbeat. See `program.md` for the universal teardown rule.

---

## Recommended Workflows

### Workflow A — Full Pipeline (Best Results)
```
1. Build lead list (manual curation or HubSpot import)
2. Run prospect-research → dossiers created
3. Run cold-outreach → drafts with signal-based hooks
4. Human reviews and sends
5. Run inbox-classifier after 2-3 days
6. Positive replies → compose-reply for deep follow-up
```

### Workflow B — Quick Cold Blast (Acceptable Results)
```
1. Build lead list with basic info
2. Run cold-outreach directly (no dossiers) → lightweight template
3. Human reviews and sends
4. Run inbox-classifier after 2-3 days
```

### Workflow C — Hybrid (Research + Cold + Warm)
```
1. Run pipeline-analysis → recommended actions
2. A-tier leads without dossier → prospect-research first
3. A-tier leads with dossier → cold-outreach (Template 1)
4. B-tier leads → cold-outreach (Template 2 or 3)
5. Existing warm leads → follow-up-loop as normal
```

---

## Constraints

### Allowed
- Read HubSpot contacts and notes
- Read prospect dossiers from `output/prospect-dossiers/`
- Create Gmail drafts (text/plain)
- Create new HubSpot contacts (for prospects not yet in CRM)
- Read and update tracker + scores
- Generate email content following cold-specific rules above

### Forbidden
- Send emails — drafts only
- Draft the same contact twice with `COLD:` prefix (check tracker)
- Modify existing HubSpot contacts (cold-outreach only creates new ones)
- Use "follow-up" or "we spoke before" framing — this is cold
- Invent company details not found in dossier or HubSpot
- Include links or attachments in first-touch cold emails
- Use casual greeting on first touch (unless dossier explicitly flags casual + casual industry)
