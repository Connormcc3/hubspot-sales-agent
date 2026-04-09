# Changelog

All notable changes to this project will be documented in this file.

## [2.4.0] - 2026-04-09

### Added
- **`performance-review` skill** (7th skill) — closes the feedback loop between outcomes and drafting decisions. Joins `table.tsv` drafts with their reply outcomes, computes per-segment conversion contrasts with conservative minimum-sample thresholds, produces a weekly report, and proposes exact copy-paste markdown blocks for `learnings.md` Section C. **Does not auto-write Section C** — human review stays in the loop.
- **`src/performance.ts`** — deterministic math helper. Reads `table.tsv`, filters to a review window (default 7 days), computes totals, per-`lead_status` and per-`skill` breakdowns, `lead_status × skill` cross, and contrasts (≥5 per bucket, ≥15pp delta, flagged "proposable" at ≥10 total evidence). Emits structured JSON for the skill agent to interpret.
- **`gmail.ts draft:read`** — new command `draft read --id <draftId>` wrapping `GET /drafts/{id}?format=full`. Enables `performance-review` to fetch actual draft bodies for tone/subject-line extraction (data that isn't in the tracker).
- **Monday-morning workflow pair:** run `performance-review` first (what worked last week) → `pipeline-analysis` (what to work on next). Closes the loop between backward-looking evaluation and forward-looking planning.
- New `output/performance/` directory for weekly reports (gitignored by default).
- `performance` npm script (`tsx src/performance.ts`).

### Changed
- Skill count: 6 → 7
- README: "Six Composable Skills" → "Seven Composable Skills"; added performance-review row to the skill table; added Mermaid diagram node; updated project structure tree; added feedback-loop explanation to the Learnings memory section; inserted performance-review into Workflow A (Weekly Planning)
- `program.md`: added performance-review to Available Skills table and Stopping Criteria
- `prompts/invoke-skill.md`: new "Skill 6: performance-review" section with 3 invocation modes (default weekly, custom window, skill-specific review); existing compose-reply renumbered to Skill 7

### Thresholds (locked; non-negotiable in the skill)
- `MIN_BUCKET_SIZE = 5` — buckets smaller than this are skipped
- `MIN_DELTA = 0.15` — positive-rate delta threshold
- `PROPOSABLE_EVIDENCE = 10` — bucket + other must reach this to flag a contrast as proposable
- Set in `src/performance.ts`; documented in `skills/performance-review.md` as non-negotiable without explicit human edit

## [2.3.0] - 2026-04-09

### Added
- **TypeScript migration** — all `src/` files rewritten in TypeScript (strict mode) and run via `tsx` at runtime. No build step, no `dist/`. New `tsconfig.json` at project root. Added `tsx`, `typescript`, `@types/node` as devDependencies.
- **Learnings memory system** — every skill now reads `knowledge/learnings.md` at the start of a run and appends exactly one entry at the end:
  - New `src/learnings.ts` CLI: `append heartbeat` (default, one-line run summary) and `append observation` (when a genuine pattern is seen)
  - New universal setup/teardown contract in `program.md` — all 6 skills load learnings at start + append at end
  - `learnings.md` restructured into Section A (cheat sheets), Section B (running log, append-only, 100-entry cap), Section C (distilled patterns)
  - Auto-rotation to `knowledge/learnings-archive.md` when Section B exceeds 100 entries
  - `compose-reply` is the one documented exception — observation-only (per-lead, would duplicate `table.tsv`)
- `typecheck` npm script (`tsc --noEmit`)

### Changed
- All doc CLI references: `node src/*.js` → `npx tsx src/*.ts` across 12 files (CHANGELOG.md historical entries left untouched)
- README: new "State files" section, new "Learnings memory" config section (replaces the old "Optional Start Tracking Learnings"), verify-setup block now includes `tsc --noEmit`
- Every skill file gained a "Load learnings" step 0 and an "Append to learnings" section

### Fixed
- Stale skill counts across skill files: `One of 4 skills` / `One of 5 skills` → `One of 6 skills` in `lead-recovery`, `follow-up-loop`, `inbox-classifier`, `research-outreach`, `pipeline-analysis`; `Overview of all 4 skills` → `6 skills` in `prompts/invoke-skill.md`

### Removed
- Old `src/*.js` files (`tracker.js`, `tools/hubspot.js`, `tools/gmail.js`, `tools/webfetch.js`) — replaced by `.ts` equivalents

## [2.2.0] - 2026-04-09

### Added
- **`compose-reply` skill** — deep-context single-lead composer. Assembles full email history (both directions), all HubSpot notes and deals, prior agent interactions, plus custom new context you inject, then generates a structured brief and draft. Use this when bulk skills don't provide enough personalization for a high-value lead.
- 3 invocation modes: full compose, brief-only, save-dossier
- New `output/lead-dossiers/` directory for saved briefs (gitignored by default)

### Changed
- Skill count: 5 → 6
- README, program.md, Mermaid diagram updated

## [2.1.0] - 2026-04-09

### Added
- **`pipeline-analysis` skill** — "zoom out" analysis of the entire HubSpot pipeline. Surfaces contact distribution, deal health, agent coverage, segment insights, and recommends which action-skill to run next. Start here on Monday mornings to plan the week.
- New Workflow A — "Weekly Planning" using pipeline-analysis as the entry point
- New `output/analysis/` directory for pipeline reports (gitignored by default)

### Changed
- Skill count: 4 → 5
- README reframed: pipeline-analysis is the recommended starting point
- Mermaid architecture diagram updated to show 5 skills
- Workflow examples reordered (Weekly Planning first)

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
