# HubSpot Sales Agent — Program

This is the shared program file for all skills in the Sales Agent.
Read this file first, then read `CLAUDE.md` for email generation rules and `skills/<skill>.md` for the specific skill you are invoking.

## Mission

Automate the outbound sales flow:
- Read contacts, deals, and notes from HubSpot
- Generate personalized email drafts in Gmail (NEVER send)
- Classify incoming replies and sync HubSpot status
- Track everything in `tracker` as the single source of truth

**Critical:** The agent NEVER sends emails on its own. It prepares drafts for human review.

## Available Skills

| Skill | File | Purpose |
|-------|------|---------|
| **pipeline-analysis** | `skills/pipeline-analysis.md` | Full pipeline health check + recommendations (forward-looking, run Mondays) |
| **performance-review** | `skills/performance-review.md` | Closes the feedback loop — joins tracker drafts with reply outcomes, computes per-segment contrasts, proposes Section C rules for `learnings.md` (backward-looking, run Mondays before pipeline-analysis) |
| **follow-up-loop** | `skills/follow-up-loop.md` | Bulk outreach to HubSpot contacts |
| **inbox-classifier** | `skills/inbox-classifier.md` | Classify replies + auto-draft responses |
| **research-outreach** | `skills/research-outreach.md` | Research-driven personalized outreach (configurable audit type) |
| **lead-recovery** | `skills/lead-recovery.md` | Decision framework for stale deals |
| **compose-reply** | `skills/compose-reply.md` | Deep-context single-lead composer with full history + custom context |
| **prospect-research** | `skills/prospect-research.md` | Deep intelligence gathering — company profile, signals, decision-maker, pain-point hypotheses. Outputs dossiers for `cold-outreach` |
| **cold-outreach** | `skills/cold-outreach.md` | First-touch cold emails — value-first framing, uses prospect dossiers or basic data. Different rules than follow-up-loop |
| **crm-manager** | `skills/crm-manager.md` | Full HubSpot CRM management from terminal — create/edit contacts, deals, tasks, notes. No more switching to the web UI |

See `prompts/invoke-skill.md` for how to invoke each skill.

## Scoring Utility

Lead scoring is a **utility**, not a skill. It runs as a natural step when skills need to prioritize contacts.

```bash
npx tsx src/scoring.ts score <email> [--data <json>]   # score one contact
npx tsx src/scoring.ts score-tracker                    # score all tracker contacts (engagement)
npx tsx src/scoring.ts rank                             # print all scored contacts by priority
npx tsx src/scoring.ts tier <email>                     # print priority tier for one contact
npx tsx src/scoring.ts update <email> <fit> <eng>       # manual score override
```

Configuration: `knowledge/scoring-config.md` defines ICP weights and tier matrix (A/B/C/D).
Skills that use scoring: `follow-up-loop` (sort queue), `cold-outreach` (prioritize leads), `pipeline-analysis` (report distribution), `prospect-research` (update fit scores from research).

## Two Paths: MCP or CLI

This agent runs on any local agent harness. Each skill supports two interchangeable execution paths:

**Path A — MCP tools (any MCP-capable harness):**
Works with Claude Code, Cursor, Continue, Windsurf, Zed, or any custom harness with an MCP client. Install the HubSpot + Gmail MCP servers in your harness and go.
- HubSpot via `mcp__claude_ai_HubSpot__*`
- Gmail via `mcp__claude_ai_Gmail__*`

**Path B — Local CLI tools (universal fallback):**
Works with any harness that can execute shell commands. Run `npm install`, fill in `.env`, and the agent shells out to:
```bash
npx tsx src/tools/hubspot.ts <command>    # HubSpot REST API wrapper
npx tsx src/tools/gmail.ts <command>      # Gmail API wrapper
npx tsx src/tools/webfetch.ts <command>   # HTML fetch + parse
```

Pick whichever matches your setup. You can also mix both paths (e.g., MCP for HubSpot + CLI for webfetch). See `AGENTS.md` for harness compatibility details.

## Universal Constraints (apply to all skills)

### Required setup and teardown (every run)

- **Setup — load learnings:** At the start of every skill run, read `knowledge/learnings.md`.
  - Section A (cheat sheets) informs greeting/tone decisions.
  - Section B (running log) reflects recent patterns — scan the most recent ~20 entries plus any entries tagged with the current skill.
  - Section C (distilled patterns) lists human-curated rules to apply if they match the current context.

- **Teardown — append to learnings:** At the end of every skill run, append exactly one entry to `knowledge/learnings.md` Section B via `npx tsx src/learnings.ts append ...`.
  - Default: `append heartbeat` with a one-line run summary (counts, distribution, any notable hint).
  - If a genuine pattern was seen (≥3 leads showing the same signal, an unexpected cluster, or a segment behaving differently from Section A): `append observation` **instead of** the heartbeat.
  - Empty or filler observations are worse than a heartbeat — if nothing surprising happened, write the heartbeat.
  - `compose-reply` is the one exception: observation-only (no heartbeat), because it runs per-lead and heartbeats would duplicate `tracker`.

### What the agent CAN do
- Read HubSpot contacts, notes, and deals
- Generate email content freely (following `CLAUDE.md` rules)
- Create Gmail drafts
- Update HubSpot lead status (only in `inbox-classifier`)
- Fetch external URLs for research (only in `research-outreach`)
- Write to `tracker` and `output/` files

### What the agent CANNOT do
- **Send emails** — drafts only
- Draft the same contact twice (check `tracker` first)
- Skip the notes-reading step
- Invent personalized details not present in notes
- Ask "should I continue?" mid-loop in autonomous skills
- Modify the tracker schema (columns are fixed — see `src/db.ts`)

## Error Handling (shared across skills)

- **HubSpot API error:** log `status=error` in `tracker`, continue to next contact
- **Gmail API error:** retry once after 2 seconds. If still failing: log `status=error`, continue
- **Contact has no email:** skip silently (don't log to `tracker`)
- **Log all errors** to `output/errors.log`: `[ISO-TIMESTAMP] ERROR: <email> — <message>`

## Stopping Criteria

Each skill defines its own stopping rules:
- **pipeline-analysis:** ONE-SHOT — analyze the workspace, write report, then STOP
- **performance-review:** ONE-SHOT — analyze the review window, write report, propose Section C rules (never auto-write), then STOP
- **follow-up-loop:** NEVER STOP until manually interrupted
- **inbox-classifier:** ONE-SHOT — process all new replies, then STOP
- **research-outreach:** Process the given lead list, then STOP
- **lead-recovery:** Analyze the given deals, then STOP (no outreach, just recommendations)
- **compose-reply:** ONE-SHOT — process one lead, output brief + draft, then STOP
- **prospect-research:** Process the given lead list, then STOP (research only, no outreach)
- **cold-outreach:** Process the given lead list, then STOP
- **crm-manager:** Conversational — responds to individual CRM requests, no loop

Refer to each skill file for the exact behavior.
