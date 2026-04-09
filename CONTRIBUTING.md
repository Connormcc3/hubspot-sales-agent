# Contributing to HubSpot Sales Agent

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a branch: `git checkout -b feature/your-feature`
4. `npm install`
5. `cp .env.example .env` and fill in credentials

## Project Structure

- **`program.md`** — Shared constraints and setup for all skills
- **`CLAUDE.md`** — Shared email generation rules (referenced by all outreach skills)
- **`skills/`** — One file per composable skill
  - `follow-up-loop.md` — bulk outreach autonomous loop
  - `inbox-classifier.md` — 8-category reply classification
  - `research-outreach.md` — research-driven personalized outreach
  - `lead-recovery.md` — decision framework for stale deals
- **`knowledge/`** — User-editable knowledge base
  - `learnings.md` — track what works
  - `research-config.md` — define your research approach
- **`prompts/`** — Copy-paste invocation prompts
- **`src/tracker.js`** — TSV tracking CLI
- **`src/tools/`** — Harness-agnostic CLI wrappers (HubSpot, Gmail, webfetch)
- **`AGENTS.md`** — Harness compatibility guide

## Making Changes

### Adding a New Skill

1. Create `skills/your-skill.md` following the existing pattern (purpose, trigger, setup, loop, constraints)
2. Reference both MCP and CLI tool paths in your skill so it works on any harness
3. Add invocation prompts to `prompts/invoke-skill.md`
4. Document the new skill in `README.md`

### Adding a New Tool

1. Create `src/tools/your-tool.js` as an ES module
2. Load credentials from `.env` via `dotenv`
3. Output JSON to stdout (parseable by any harness)
4. Include `--help` flag with usage examples
5. Follow the patterns in `hubspot.js` and `gmail.js`

### Modifying Existing Behavior

- Change agent loop logic → edit `program.md` or the specific `skills/<skill>.md`
- Change email rules → edit `CLAUDE.md`
- Change tracking → edit `src/tracker.js` (carefully — it's the single source of truth)

## Testing

1. Use **Preview Mode** for safe testing — no Gmail drafts created
2. Use a test HubSpot workspace or a small subset of contacts
3. Verify CLI tools work standalone: `node src/tools/hubspot.js --help`
4. Test the tracker: `node src/tracker.js read`

## Submitting Changes

1. Ensure no personal data or API credentials are committed
2. Test your changes with Preview Mode
3. Update relevant documentation (README, CHANGELOG, skill files)
4. Commit with a clear message describing the change
5. Push to your fork and open a Pull Request

## Reporting Issues

- Use the [Bug Report](https://github.com/Dominien/hubspot-sales-agent/issues/new?template=bug_report.md) template for bugs
- Use the [Feature Request](https://github.com/Dominien/hubspot-sales-agent/issues/new?template=feature_request.md) template for ideas

## Questions?

Open a [Discussion](https://github.com/Dominien/hubspot-sales-agent/discussions).
