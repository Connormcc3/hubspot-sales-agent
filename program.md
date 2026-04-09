# HubSpot Sales Agent — Program

This is the shared program file for all skills in the Sales Agent.
Read this file first, then read `CLAUDE.md` for email generation rules and `skills/<skill>.md` for the specific skill you are invoking.

## Mission

Automate the outbound sales flow:
- Read contacts, deals, and notes from HubSpot
- Generate personalized email drafts in Gmail (NEVER send)
- Classify incoming replies and sync HubSpot status
- Track everything in `table.tsv` as the single source of truth

**Critical:** The agent NEVER sends emails on its own. It prepares drafts for human review.

## Available Skills

| Skill | File | Purpose |
|-------|------|---------|
| **pipeline-analysis** | `skills/pipeline-analysis.md` | Full pipeline health check + recommendations (start here) |
| **follow-up-loop** | `skills/follow-up-loop.md` | Bulk outreach to HubSpot contacts |
| **inbox-classifier** | `skills/inbox-classifier.md` | Classify replies + auto-draft responses |
| **research-outreach** | `skills/research-outreach.md` | Research-driven personalized outreach (configurable audit type) |
| **lead-recovery** | `skills/lead-recovery.md` | Decision framework for stale deals |

See `prompts/invoke-skill.md` for how to invoke each skill.

## Two Paths: MCP or CLI

This agent runs on any local agent harness. Each skill supports two interchangeable execution paths:

**Path A — MCP tools (any MCP-capable harness):**
Works with Claude Code, Cursor, Continue, Windsurf, Zed, or any custom harness with an MCP client. Install the HubSpot + Gmail MCP servers in your harness and go.
- HubSpot via `mcp__claude_ai_HubSpot__*`
- Gmail via `mcp__claude_ai_Gmail__*`

**Path B — Local CLI tools (universal fallback):**
Works with any harness that can execute shell commands. Run `npm install`, fill in `.env`, and the agent shells out to:
```bash
node src/tools/hubspot.js <command>    # HubSpot REST API wrapper
node src/tools/gmail.js <command>      # Gmail API wrapper
node src/tools/webfetch.js <command>   # HTML fetch + parse
```

Pick whichever matches your setup. You can also mix both paths (e.g., MCP for HubSpot + CLI for webfetch). See `AGENTS.md` for harness compatibility details.

## Universal Constraints (apply to all skills)

### What the agent CAN do
- Read HubSpot contacts, notes, and deals
- Generate email content freely (following `CLAUDE.md` rules)
- Create Gmail drafts
- Update HubSpot lead status (only in `inbox-classifier`)
- Fetch external URLs for research (only in `research-outreach`)
- Write to `table.tsv` and `output/` files

### What the agent CANNOT do
- **Send emails** — drafts only
- Draft the same contact twice (check `table.tsv` first)
- Skip the notes-reading step
- Invent personalized details not present in notes
- Ask "should I continue?" mid-loop in autonomous skills
- Modify the `table.tsv` header row

## Error Handling (shared across skills)

- **HubSpot API error:** log `status=error` in `table.tsv`, continue to next contact
- **Gmail API error:** retry once after 2 seconds. If still failing: log `status=error`, continue
- **Contact has no email:** skip silently (don't log to `table.tsv`)
- **Log all errors** to `output/errors.log`: `[ISO-TIMESTAMP] ERROR: <email> — <message>`

## Stopping Criteria

Each skill defines its own stopping rules:
- **pipeline-analysis:** ONE-SHOT — analyze the workspace, write report, then STOP
- **follow-up-loop:** NEVER STOP until manually interrupted
- **inbox-classifier:** ONE-SHOT — process all new replies, then STOP
- **research-outreach:** Process the given lead list, then STOP
- **lead-recovery:** Analyze the given deals, then STOP (no outreach, just recommendations)

Refer to each skill file for the exact behavior.
