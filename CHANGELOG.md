# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-04-08

### Renamed
- Repository renamed from `hubspot-email-agent` to `hubspot-sales-agent`
- Broader scope: not just outreach email — now handles bulk outreach, inbox classification, research-driven outreach, and lead recovery

### Added
- **4 composable skills** — `follow-up-loop`, `inbox-classifier`, `research-outreach`, `lead-recovery`
- **Inbox Classifier skill** — 8-category reply classification with automatic reply drafts for positive replies and HubSpot lead status sync
- **Research Outreach skill** — configurable research-driven personalized outreach (any audit type: SEO, UX, brand, tech, content, competitive, custom)
- **Lead Recovery skill** — decision framework for stale/burned-out deals with 4 recovery levers
- **Harness-agnostic architecture** — works on Claude Code (via MCP) or any local agent harness (via Node.js CLI tools)
- **Local CLI tools** (`src/tools/`):
  - `hubspot.js` — HubSpot REST API wrapper (contacts, notes, deals)
  - `gmail.js` — Gmail API wrapper (drafts, inbox, threads) with OAuth refresh
  - `webfetch.js` — fetch + basic HTML audit for research-outreach
- **Knowledge layer** (`knowledge/`):
  - `learnings.md` — template for tracking campaign learnings over time
  - `research-config.md` — define your own research/audit approach
- **13-column TSV tracker** with reply classification fields (`reply_received_at`, `reply_classification`, `reply_draft_id`, `hubspot_status_after`)
- **Tracker `update` command** — `node src/tracker.js update <email> <classification> [draft_id] [status]`
- **AGENTS.md** — harness compatibility guide
- **`.env.example`** — credential template for HubSpot + Google OAuth
- **Comprehensive `invoke-skill.md`** prompts for all skills and workflow combinations

### Changed
- `program.md` restructured as a shared shell for all 4 skills (was single follow-up logic)
- `CLAUDE.md` is now focused on email rules only, referenced by all skills
- `README.md` fully rewritten with multi-skill architecture, Mermaid chart, and harness support
- `.gitignore` extended to exclude research reports and recovery outputs
- `package.json` renamed, added dependencies (`dotenv`), removed Claude-specific `start` script

### Removed
- Single-skill limitation — the agent is now modular
- Assumptions about specific industries (SEO, Webflow, agency context) — the agent is branche-agnostic

## [1.0.0] - 2026-04-08

### Added
- Initial release as `hubspot-email-agent`
- Autonomous follow-up email loop
- 5 execution modes: autonomous, preview, resume, single contact, approval
- 9-column TSV tracking with deduplication
- Lead status-based tone and greeting selection
- Gmail draft creation via MCP
- Configurable skip flags
