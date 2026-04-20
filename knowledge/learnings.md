# Campaign Learnings

> **Living memory for the Sales Agent.** Every skill reads this file at the start of a run and appends an entry at the end via `npx tsx src/learnings.ts append ...`.
>
> **Three sections:**
> - **Section A — Cheat Sheets** (static, human-maintained): greeting rules, reply strategy.
> - **Section B — Running Log** (append-only, written by skills): chronological observations, newest first. Grows unbounded.
> - **Section C — Distilled Patterns** (human-curated): when ≥3 Section B entries converge on the same theme, a human promotes the finding here as a rule.

---

## Section A — Cheat Sheets

### Greeting Rules (override CLAUDE.md defaults)

Track observations about when casual vs. formal greetings work for your market:

| Situation | Greeting | Reasoning |
|-----------|----------|-----------|
| `CONNECTED` + documented casual contact in notes | Casual | Relationship established |
| `CONNECTED` + young founder / tech / startup | Casual | Industry norm |
| `CONNECTED` + conservative industry (tax, law, medicine) | **Formal** | Safer default |
| `CONNECTED` + person over 50 / owner-run business | **Formal** | Cultural norm |
| `CONNECTED` + unclear | **Formal** | When in doubt, stay formal |
| All other statuses | Formal | Default |

**Rule of thumb:** Casual only if explicitly documented or obviously appropriate (first-name email, tech industry, young founder). Otherwise formal.

### Reply Strategy by Response Type

#### Positive with intent ("Yes, do you have an offering?")
1. Reply within 30 minutes
2. **No invented "details from notes"** — either real notes or none at all
3. Send scheduling link: `[YOUR_SCHEDULING_LINK]`
4. One open question to qualify ("What's the main focus for you right now?")
5. HubSpot: set lead status to `IN_PROGRESS` or `OPEN_DEAL`

#### Positive without intent ("Meeting rescheduling")
1. Confirm briefly
2. Send scheduling link if no meeting yet
3. Tracker: log meeting date for follow-up

#### Negative ("No, not right now")
1. Brief polite acknowledgment (optional)
2. HubSpot: lead status to `UNQUALIFIED` (not LOST — leave door open)
3. Tracker: status to `declined`, no more follow-up loop
4. **Retry in 6+ months** — this time with value-first (research-outreach), not generic mail

#### Bounce (not deliverable)
1. HubSpot: mark email as invalid
2. Try to find alternative email (LinkedIn, website contact page)
3. Tracker: mark `email_invalid`

---

## Section B — Running Log

> Skills append entries here at the end of every run via `npx tsx src/learnings.ts append ...`. Newest first. The log grows unbounded — trim manually via your editor if it ever gets too long.
>
> **Entry types:**
> - `heartbeat` — always written by default. One-line run summary.
> - `observation` — written instead of a heartbeat when something notable was seen: ≥3 similar signals, an unexpected cluster, or a segment behaving differently from Section A.

<!-- LEARNINGS_LOG_START -->

### 2026-04-16 · cold-outreach · Super Lawyers SoCal batch — personalized opener + attorney-control framing
- **Context:** 60 Southern California attorneys from Super Lawyers Outreach list. All formal tone (legal profession override). Mix of Family Law (30), Estate & Trust Litigation (13), Estate Planning & Probate (12), Elder Law (4). 36 unique firms.
- **Observed:** Connor rejected AI-forward framing and long drafts. 3-4 sentences with firm-name+practice-area opener performed best in review. One data quality issue: Scott Grossman (grossmanjustice.com) listed as Estate & Trust Litigation in HubSpot but website is personal injury firm in NJ — flagged as mismatch, fell back to generic.
- **Apply next time:** Cold outreach to attorneys: (1) Never lead with AI framing — attorneys distrust AI efficacy. Frame Percheron as outcome (saves time on fact-finding, drafting, form-filling) with attorney staying in driver's seat. (2) Always open with firm name + specific practice-area reference. (3) 3-4 sentences max. (4) Verify website matches HubSpot practice area before personalizing deeply — mismatch = fall back to generic hook.

<!-- LEARNINGS_LOG_END -->

---

## Section C — Distilled Patterns

> When ≥3 Section B entries converge on the same theme, promote the finding here as a pattern. Human-curated only — skills do not write to this section.
>
> **Format:**
> ```
> ### Pattern: <name>
> - Evidence: <Section B entry dates>
> - Apply: <concrete rule>
> ```

_(No patterns distilled yet. Check Section B periodically and promote recurring signals.)_

---

## Appendix — Open Rate Benchmarks (reference)

Typical benchmarks for reference:
- Cold outreach standard: 15-25%
- Warm re-engagement: 30-50%
- Personalized research-driven pitch: 40-60%

**Levers to improve open rate:**
- Subject line A/B testing (concrete > generic)
- Send time optimization (test morning vs. afternoon)
- Sender reputation (check SPF/DKIM/DMARC)
- Audience segmentation (different templates per industry)

---

## Appendix — Bounce Patterns (manual tracking)

Domains from small businesses often expire. Before sending: DNS check of recipient domains can save 5-10% bounce rate.

Track recurring bounce patterns here:

| Email | Reason | Date |
|-------|--------|------|
| ... | ... | ... |
