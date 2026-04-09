<p align="center">
  <h1 align="center">HubSpot Sales Agent</h1>
  <p align="center">
    Your autonomous sales team — bulk outreach, inbox classification, research-driven personalization, and lead recovery.<br>
    Runs on any local agent harness.
  </p>
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-18+-green.svg" alt="Node.js 18+"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <a href="https://developers.hubspot.com/"><img src="https://img.shields.io/badge/HubSpot-CRM-ff7a59.svg" alt="HubSpot"></a>
  <a href="https://developers.google.com/gmail/api"><img src="https://img.shields.io/badge/Gmail-API-4285f4.svg" alt="Gmail"></a>
  <a href="AGENTS.md"><img src="https://img.shields.io/badge/harness-agnostic-blueviolet.svg" alt="Harness-agnostic"></a>
</p>

---

## What Is This?

A modular, autonomous sales agent that automates the outbound workflow. It reads contacts and deals from HubSpot, generates personalized email drafts in Gmail, classifies replies, and tracks everything in a local SQLite database. **It never sends emails on its own** — it prepares drafts for human review.

**Industry-agnostic** (works for any vertical via a configurable research layer) and **harness-agnostic** (runs on Claude Code, Cursor, Continue, or any local harness via plain CLI tools). Full design rationale in [`docs/architecture.md`](docs/architecture.md).

---

## 5-Minute Quickstart

Get from zero to your first draft in five minutes.

**1. Clone + install** *(1 min)*
```bash
git clone https://github.com/Dominien/hubspot-sales-agent.git
cd hubspot-sales-agent && npm install
```

**2. Add credentials** *(2 min — see [`docs/setup.md`](docs/setup.md) for the full walkthrough)*
```bash
cp .env.example .env
# Fill in HUBSPOT_API_TOKEN and 3 Google OAuth vars
```

**3. Verify** *(30 sec)*
```bash
npx tsx src/tracker.ts read    # prints [] → ready
```

**4. Run your first skill in PREVIEW mode** *(1 min)*

Paste into your Claude Code session:

```
Read skills/follow-up-loop.md and CLAUDE.md in PREVIEW MODE.
Process max 5 contacts — show me each draft, no Gmail calls, no tracker writes.
```

**5. Review** *(30 sec)*

The agent prints drafts to the console. Nothing was sent. Nothing was stored. That's the safety posture: review everything before promoting to a real run.

---

## Seven Composable Skills

| Skill | What It Does |
|-------|-------------|
| **pipeline-analysis** | Analyzes the entire HubSpot pipeline — contacts, deals, segments, agent coverage — and recommends which action-skill to run next (forward-looking) |
| **performance-review** | Closes the feedback loop. Joins tracker drafts with reply outcomes, computes per-segment conversion contrasts, proposes evidence-backed Section C rules for `learnings.md` (backward-looking) |
| **follow-up-loop** | Autonomous bulk outreach to HubSpot contacts — drafts personalized follow-ups until stopped |
| **inbox-classifier** | Reads incoming replies, classifies them into 8 categories, drafts responses to positive replies, and syncs HubSpot status |
| **research-outreach** | Researches a lead's website/business using a configurable audit type, embeds top findings in a personalized email |
| **lead-recovery** | Decision framework for stale/burned-out deals — recommends recovery levers or pipeline cleanup |
| **compose-reply** | Deep-context single-lead composer — assembles full email history + HubSpot data + custom new context and drafts a careful reply for one specific lead |

Each skill is self-contained. Invoke them independently or combine them in workflows. **Monday-morning pair:** run `performance-review` first (what worked last week), then `pipeline-analysis` (what to work on next). The rest of the week runs the action skills the analysis recommended.

---

## Usage

### Analyze your pipeline

```
Read skills/pipeline-analysis.md and CLAUDE.md.
Analyze the entire HubSpot pipeline and recommend which action-skill to run next.
Output: console summary + full report to output/analysis/pipeline-<date>.md.
Do NOT change any HubSpot data. Analysis only.
```

### Run the follow-up loop autonomously

```
Read skills/follow-up-loop.md and CLAUDE.md, then start the autonomous loop.
NEVER STOP. Work through all HubSpot contacts until manually interrupted.
```

The agent fetches contacts from HubSpot, reads each contact's notes, generates a personalized email, creates a Gmail draft, logs to the tracker, and moves to the next contact.

### Classify inbox replies

```
Read skills/inbox-classifier.md and CLAUDE.md.
Run with default filter: newer_than:7d in:inbox.
Classify all new replies, create reply drafts for positive ones, update HubSpot status.
```

### Research-driven outreach for a curated list

```
Read skills/research-outreach.md, knowledge/research-config.md, and CLAUDE.md.
Run for these leads:
- john@example.com, John Smith, Acme Inc, acme.com, ATTEMPTED_TO_CONTACT
- jane@another.com, Jane Doe, Beta Corp, beta.com, NEW

For each lead: audit the domain, extract top-3 findings, save the report,
create an HTML email draft with the findings embedded, log to the tracker
with notes_summary prefix "RES:".
```

### Deep-context reply to a single high-value lead

```
Read skills/compose-reply.md and CLAUDE.md.
Compose a reply to founder@acme.com.

New context:
- They just posted on LinkedIn about expanding to 3 new markets this quarter

Desired outcome:
- Warmly re-engage, use the LinkedIn post as a hook, offer a short call.

Assemble full context from HubSpot + Gmail history + tracker, generate a
brief, then draft the email. Ask me before creating the Gmail draft.
```

See [`prompts/invoke-skill.md`](prompts/invoke-skill.md) for every skill invocation, every mode, and workflow examples.

---

## Workflows

### Workflow A — Weekly planning (recommended starting point)

```
Monday morning:
1. Run performance-review  → last week's numbers + proposed Section C rules
2. Human promotes any proposed rules to knowledge/learnings.md Section C
3. Run pipeline-analysis   → full report + recommended actions
4. Pick top 1-2 actions for the week
5. Run the recommended skills (follow-up-loop / research-outreach / lead-recovery)
6. Human reviews drafts and sends
7. Run inbox-classifier daily through the week
```

The `performance-review` → `pipeline-analysis` pair closes the loop: backward-looking (what worked) informs forward-looking (what to do next).

### Workflow B — Send wave + follow up

```
Day 0:   Run follow-up-loop autonomously → 50-100 drafts in Gmail
Day 0:   Human reviews and sends
Day 1-2: Run inbox-classifier with "newer_than:2d"
Day 2:   Human reviews reply drafts and sends
```

### Workflow C — Pipeline recovery

```
1. Run lead-recovery for stale deals → recommendation per deal
2. Build lead list from "value-first" recommendations
3. Run research-outreach with that list
4. Human reviews and sends
5. Run inbox-classifier 1-2 days later
```

### Workflow D — Daily inbox maintenance

```
Morning: Run inbox-classifier with "newer_than:1d"
Human reviews reply drafts (5 min) and sends
```

---

## State files

Two state files live in the repo — both single sources of truth for their concern:

1. **`tracker.db`** — per-contact tracker (SQLite, 13 columns). Every draft, skip, error, reply classification. Backed by SQLite as of v2.6 — binary-safe fields, WAL concurrency, indexed lookups. Dump to TSV or JSON on demand via `npx tsx src/tracker.ts export`. Full schema + CLI reference in [`docs/architecture.md`](docs/architecture.md).
2. **`knowledge/learnings.md`** — living memory (3 sections). Section A cheat sheets (static, you edit), Section B running log (append-only, skills write), Section C distilled patterns (human-promoted from B). Every skill reads this at start, writes at end via `src/learnings.ts`. The feedback loop is closed weekly by `performance-review`, which proposes Section C rules with evidence that you copy-paste manually.

Both files are gitignored.

---

## Dashboard UI *(optional)*

A local Next.js dashboard lives in `ui/` — read-only over the tracker and learnings, with a skill trigger that copies the composed prompt to your clipboard or opens a new Terminal tab running `claude`.

```bash
npm run ui:install   # first time only
npm run ui:dev       # starts at http://127.0.0.1:3000
```

Four tabs: Pipeline, Performance, Skills, Learnings. Localhost-only, never deploy publicly. Full walkthrough in [`docs/dashboard.md`](docs/dashboard.md).

---

## Safety

- **Drafts only** — the agent can never send emails, only create drafts
- **Human review required** — every outgoing message waits in Gmail for manual approval
- **No duplicate drafts** — tracker check prevents drafting the same contact twice
- **Configurable skip flags** — contacts with certain notes are automatically excluded
- **No invented details** — the agent is instructed to stay generic when notes are unclear
- **No destructive HubSpot operations** — the agent only updates lead status and adds notes, never deletes

---

## Known Limitations

- **Gmail rate limits** — the Gmail API enforces quota limits; large batches may be throttled
- **Notes extraction** — depends on consistent note formatting in your HubSpot CRM
- **Basic webfetch audit** — the built-in `webfetch.ts` covers basic SEO signals. For richer audits (Lighthouse, full-page render, etc.), extend the tool or integrate an external service
- **OAuth setup** — Gmail OAuth requires a one-time refresh token generation. See [`docs/setup.md`](docs/setup.md)
- **No email sending** — by design (drafts only)
- **Dashboard UI is localhost-only** — never deploy publicly. Terminal-run mode is macOS-only; other platforms fall back to clipboard copy

---

## Deeper docs

- [`docs/setup.md`](docs/setup.md) — credentials, install, verify
- [`docs/architecture.md`](docs/architecture.md) — mermaid diagram, project tree, tool paths, tracker schema
- [`docs/dashboard.md`](docs/dashboard.md) — dashboard UI walkthrough + Level 3 design
- [`AGENTS.md`](AGENTS.md) — harness compatibility (Claude Code, Cursor, Continue, custom)
- [`CLAUDE.md`](CLAUDE.md) — email generation rules (tone, greeting, signatures)
- [`program.md`](program.md) — universal skill constraints + teardown rules
- [`knowledge/research-config.md`](knowledge/research-config.md) — configure the `research-outreach` audit type
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to add a skill, a tool, or a new harness adapter
- [`ROADMAP.md`](ROADMAP.md) — known gaps vs mature outbound tooling (scoring, meeting booking, sequences, deep CRM)
- [`CHANGELOG.md`](CHANGELOG.md) — version history

---

## Contributing

Contributions welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Security

See [`SECURITY.md`](SECURITY.md) for reporting vulnerabilities.

## License

[MIT](LICENSE) — Marco Patzelt
