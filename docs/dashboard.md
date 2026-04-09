# Dashboard UI

A local web dashboard lives in `ui/` — Next.js 16 App Router, read-only over the tracker and learnings, with a skill trigger that either copies the composed prompt to your clipboard or opens a new Terminal tab running `claude`.

**Localhost-only. Never deploy publicly.** The UI has access to the same HubSpot + Gmail credentials the agent uses.

---

## Architecture — Level 3 (UI wraps the same CLIs the agent uses)

```
Browser  ──HTTP──▶  Next.js API routes  ──execFile──▶  src/*.ts (tracker / performance / learnings)
                                                              │
                                                              ▼
                                               tracker.db + knowledge/learnings.md
                                                              ▲
                                                              │
                                                      Claude Code (agent)
```

The UI and the agent share one source of truth. Every API request re-runs the CLI — no server-side cache, no duplicated business logic, no data drift. Read-only on state; the only write path is triggering a skill (which runs in Claude Code, not in the UI server).

---

## Run it

```bash
# First time
npm run ui:install

# Dev server (binds to 127.0.0.1 — localhost-only, never public)
npm run ui:dev
# → open http://127.0.0.1:3000
```

Or from the repo root directly: `cd ui && npm install && npm run dev`.

---

## What's in it

- **Pipeline tab** — metric cards (total contacts, reply rate, positive rate, awaiting), lead-status segmented bar, filter pills, contact table with expandable detail rows. Reads the tracker via `tracker.ts rows`.
- **Performance tab** — window selector (7/14/30 days), conversion funnel, per-segment conversion breakdown, proposed Section C rule cards with one-click "Copy block". Reads `performance.ts`.
- **Skills tab** — 7 skill cards (Monday-morning pair + action skills). Click a card → slide-over detail panel with a per-skill parameter form, custom prefix textarea, live composed prompt preview, and two run modes (see below).
- **Learnings tab** — Section C distilled patterns, Section B running-log timeline (observations vs heartbeats color-coded), collapsed Section A cheat-sheet viewer. Reads `learnings.md` via `learnings.ts read`.

---

## Skill run modes

- **Copy to clipboard** (default, universal) — composed prompt → `navigator.clipboard.writeText()` → toast. Switch to your Claude Code session and paste (Cmd+V). Works on every platform.
- **Open new Terminal** (macOS only) — server runs `osascript` to open Terminal.app with `cd <repo root> && claude`, plus `pbcopy` to put the prompt on the clipboard. Paste once `claude` finishes booting. Non-macOS falls back to Copy mode with a 501 message.

Neither mode sends emails or touches state directly. Both paths end with you reviewing and running a Claude Code session — the dashboard just composes the prompt and gets you there faster.

---

## Security posture

- **Bound to `127.0.0.1` only.** Never expose publicly — the UI has access to the same HubSpot + Gmail credentials your agent uses.
- **No auth, no sessions, no CSRF.** Local tool by design.
- **Skill IDs validated against an allowlist** before any child process spawns.
- **CLI calls use `execFile` with array args** — no shell interpolation.

---

## File layout

```
ui/
├── src/app/
│   ├── page.tsx                       # Dashboard shell + 4-tab navigation
│   ├── layout.tsx                     # Fonts, globals, root layout
│   └── api/
│       ├── tracker/route.ts           # GET → runCli("src/tracker.ts", ["rows"])
│       ├── performance/route.ts       # GET → runCli("src/performance.ts", ["--window", N])
│       ├── learnings/route.ts         # GET → runCli("src/learnings.ts", ["read", ...])
│       └── skills/
│           ├── route.ts               # GET → static skill metadata
│           └── run/route.ts           # POST → validated skill run (copy or terminal)
├── src/components/
│   ├── tabs/                          # PipelineTab, PerformanceTab, SkillsTab, LearningsTab
│   ├── skills/                        # SkillDetailPanel, SkillForms, ModeSelector
│   ├── Header.tsx, Tabs.tsx, MetricCard.tsx, Badge.tsx, SegmentBar.tsx, Toast.tsx
└── src/lib/
    ├── cli.ts                         # execFile wrapper (the only thing that talks to src/*.ts)
    ├── types.ts                       # TrackerRow, PerformanceReport, LearningsData, SkillMeta
    ├── skills.ts                      # Skill metadata + prompt templates (one per skill)
    ├── colors.ts                      # Lead-status and classification color maps
    └── fetcher.ts                     # SWR fetcher
```

Every API route is a ~20-line wrapper that spawns `npx tsx src/<script>.ts <args>` via `execFile`, parses the JSON output, and returns it. No business logic lives in `ui/`.
