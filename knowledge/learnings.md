# Campaign Learnings

> Track what you learn from each outreach wave here.
> This file is referenced by `skills/inbox-classifier.md` and `skills/research-outreach.md`
> to help the agent improve over time. Update it manually after each wave.

---

## Template: Campaign Wave Entry

Copy this structure for each wave you run:

```markdown
## Wave N — YYYY-MM-DD (X sent, Y opened, Z replies)

**Open rate:** ?% (Y/X)
**Reply rate:** ?% (Z/X) — W positive, V negative
**Click rate:** ?% (if tracked)

### Signal 1: [label] — <generic description, no real names>

**Profile:** <role, industry, deal stage>
**Subject:** "..."
**Reply summary:** <paraphrase the reply, no real names>

**What worked:**
- ...
- ...

**What didn't:**
- ...
- ...

**Lesson:** <one-sentence actionable rule you'll follow next time>

---
```

---

## Your Greeting Rules (override the default in CLAUDE.md)

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

---

## Reply Strategy by Response Type

### Positive with intent ("Yes, do you have an offering?")
1. Reply within 30 minutes
2. **No invented "details from notes"** — either real notes or none at all
3. Send scheduling link: `[YOUR_SCHEDULING_LINK]`
4. One open question to qualify ("What's the main focus for you right now?")
5. HubSpot: set lead status to `IN_PROGRESS` or `OPEN_DEAL`

### Positive without intent ("Meeting rescheduling")
1. Confirm briefly
2. Send scheduling link if no meeting yet
3. Tracker: log meeting date for follow-up

### Negative ("No, not right now")
1. Brief polite acknowledgment (optional)
2. HubSpot: lead status to `UNQUALIFIED` (not LOST — leave door open)
3. Tracker: status to `declined`, no more follow-up loop
4. **Retry in 6+ months** — this time with value-first (research-outreach), not generic mail

### Bounce (not deliverable)
1. HubSpot: mark email as invalid
2. Try to find alternative email (LinkedIn, website contact page)
3. Tracker: mark `email_invalid`

---

## Open Rate Benchmarks

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

## Bounce Patterns (track your own)

Domains from small businesses often expire. Before sending: DNS check of recipient domains can save 5-10% bounce rate.

Track recurring bounce patterns here:

| Email | Reason | Date |
|-------|--------|------|
| ... | ... | ... |

---

## Notes

- Add observations about unusual patterns
- Track what industries respond well vs. poorly
- Document subject lines that converted
- Track what time of day/week works best
