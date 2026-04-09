# Changelog

All notable changes to this project will be documented in this file.

## [2.6.0] - 2026-04-10

### Changed
- **Tracker storage migrated from flat TSV to SQLite** (via `better-sqlite3`). Fixes three long-standing issues:
  1. **Field safety** — stored values can now contain tabs or newlines without corrupting rows. (Pre-v2.6: any `\t` or `\n` in a field would silently misalign or break the row.) Note: the CLI `append` command still accepts tab-separated input, so literal tabs in a field value passed through the CLI still get split on that boundary — the storage-level fix matters most for programmatic access and eliminates silent corruption from non-obvious sources.
  2. **Concurrency** — `updateRow()` is no longer a read-modify-write race. WAL journal mode allows non-blocking reads during writes, and writes are atomic. You can now run multiple skills against the tracker in parallel without data loss.
  3. **Scale** — `emailExists()` is O(log n) instead of O(n) per check. `performance.ts` windowing uses an indexed range scan on `drafted_at` instead of parsing the whole file. Comfortable at tens of thousands of rows.
- **CLI interface is identical** to v2.5 — every skill, prompt, and caller keeps working. `tsx src/tracker.ts read | rows | exists | append | update` all produce byte-identical output.
- `src/performance.ts` now queries the tracker via `rowsInWindow()` from `src/db.ts` instead of reading `table.tsv` directly. Output JSON shape unchanged.

### Added
- **`src/db.ts`** — new shared SQLite data layer. Opens `tracker.db` with WAL + `foreign_keys = ON`, runs schema + indexes idempotently, performs a one-time TSV → SQLite import, and exposes a typed data-layer API (`allRows`, `allEmails`, `emailExists`, `rowsInWindow`, `appendRow`, `updateReplyFields`). Prepared statements are reused at module scope.
- **Schema with 3 indexes:** `idx_tracker_drafted_at` (performance windowing), `idx_tracker_status` (UI filter pills), `idx_tracker_classification` (inbox-classifier queries). `email` is `PRIMARY KEY COLLATE NOCASE` — case-insensitive dedup for free.
- **New `tracker.ts export` command:** `tsx src/tracker.ts export [--format tsv|json] [--out path]` — dumps the current DB state to stdout or a file. Use this to open in a spreadsheet (replaces the pre-v2.6 "just open table.tsv" workflow). TSV export strips tabs/newlines in field values (replaces with spaces); JSON export is lossless.
- **`better-sqlite3` dependency.** Native module — `npm install` will fetch a prebuilt binary on most platforms, or compile via node-gyp as a fallback. No change to `engines.node` (still `>=18`).

### Migration
- On first run of any CLI that imports `src/db.ts`, if `tracker.db` doesn't exist but `table.tsv` does: parse the TSV (skipping the header, padding short rows to 13 columns), `INSERT` every row inside a single transaction (with `ON CONFLICT(email) DO NOTHING` for safety), then rename `table.tsv` → `table.tsv.legacy-<ISO timestamp>` for rollback. The legacy file is **not deleted** — remove it manually once you've verified the new tracker.
- If the transaction fails mid-way: the DB rolls back to empty and the legacy file is left untouched. The next invocation retries cleanly.
- If both `tracker.db` (populated) and `table.tsv` are present: the import is skipped. DB wins. The TSV sits harmlessly until the user removes it.
- **Rollback:** `git checkout v2.5` + rename `table.tsv.legacy-<timestamp>` back to `table.tsv` + delete `tracker.db*` files + `npm install`. Clean reversion to the previous version.

### Docs
- README: updated mermaid tracker node, project structure tree, "State files" section (tracker.db + explanatory prose), tracker CLI block (adds `rows` and `export` commands).
- CONTRIBUTING: tracker.ts description updated to reference `src/db.ts`.
- SECURITY: tracker.db + legacy TSV gitignore clarification.
- CHANGELOG historical entries for v2.0-v2.5 are unchanged (frozen).

### What's unchanged
- All 7 skills (no prose changes). All prompts. `knowledge/learnings.md` + `learnings.md` CLI. Every `src/tools/*.ts`. Every UI component, API route, and type in `ui/src/`. The `TrackerRow` interface in `ui/src/lib/types.ts` already matched the new SQLite schema exactly (verified via code audit pre-migration).

## [2.5.0] - 2026-04-09

### Added
- **Local dashboard UI (Next.js 16, App Router)** in a new `ui/` subdirectory. Level 3 architecture — API routes wrap the existing CLI tools (`tracker.ts`, `performance.ts`, `learnings.ts`, etc.) via `child_process.execFile`. UI and agent share one source of truth through `table.tsv` + `knowledge/learnings.md` — no duplicated business logic, no cache layer. Localhost-only (`127.0.0.1:3000`), no auth, never exposed publicly.
- **Four tabs** matching the requested visual design (DM Sans + JetBrains Mono, HubSpot-orange accent, dark theme):
  - **Pipeline** — metric cards, lead-status segmented bar, filter pills, contact table with expandable detail rows
  - **Performance** — window selector (7/14/30d), conversion funnel, per-segment breakdown, proposed Section C rule cards with "Copy block" buttons
  - **Skills** — Monday-morning pair + action skills cards, click opens a slide-over detail panel with per-skill param form, custom prefix textarea, live composed prompt preview
  - **Learnings** — Section C highlights, Section B running-log timeline with type-colored dots, collapsed Section A cheat-sheet viewer
- **Two skill run modes:**
  - **Copy to clipboard (default, universal)** — composed prompt copied via `navigator.clipboard.writeText()` with a toast instructing the user to paste into their existing Claude Code session
  - **Open new Terminal (macOS)** — `/api/skills/run` with `mode=terminal` spawns `osascript` to open Terminal.app with `cd <repo root> && claude`, plus `pbcopy` to put the prompt on the clipboard. Non-macOS returns 501 with a fallback hint.
- `tracker.ts rows` command — returns full TSV rows as JSON array of objects (existing `read` still returns emails only). Powers the Pipeline tab.
- `learnings.ts read [--section A|B|C] [--limit N] [--skill <name>]` command — parses learnings.md into `{sectionA_raw, sectionB, sectionC_raw}` with optional filters. Powers the Learnings tab.
- `ui:dev`, `ui:build`, `ui:install` convenience npm scripts at the repo root.

### Changed
- README: new "Dashboard UI" section explaining how to run it, the Level 3 architecture, and the localhost-only constraint. Updated project structure tree to include `ui/` and new output directories. Known Limitations updated.
- Tracker schema unchanged. Learnings schema unchanged. All existing CLI commands untouched.

### Security notes
- Next.js dev server bound to `127.0.0.1` only (never `0.0.0.0`). No auth, no sessions — the UI has access to the same HubSpot + Gmail credentials the agent uses, so **never expose it publicly**.
- Skill IDs passed to `/api/skills/run` are validated against an allowlist before any child process is spawned.
- All CLI invocations use `execFile` with array args — no shell interpolation, no injection surface.

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
