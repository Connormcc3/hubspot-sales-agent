# Enrichment Agent — Module Spec
# Percheron Sales Outreach Pipeline

## Status: Ready for implementation
## Do not deviate from this spec without checking back with the war room (Claude.ai Project)

---

## Overview

The enrichment agent is a new module that sits between the prospecting layer (Apollo/LinkedIn
Sales Navigator CSV exports) and the existing research + draft layer (sales outreach agent).

Its job is narrow and well-defined:
1. Read exported lead CSVs from a watched inbox directory
2. Deduplicate against HubSpot (primary source of truth)
3. Find and verify email addresses for contacts that don't have one
4. Write enriched contacts into HubSpot with source metadata
5. Move processed files to an archive directory

It does not draft emails. It does not do research. It does not send anything.
It produces clean, verified, deduped contacts in HubSpot for the existing sales agent to consume.

---

## Directory Structure

Add the following to the project root (alongside existing `src/`, `docs/`, etc.):

```
leads/
├── inbox/           ← drop new CSV exports here (agent reads from here)
├── processed/       ← agent moves files here after successful ingestion
└── errors/          ← agent moves files here if processing fails entirely
```

Add to `.gitignore`:
```
leads/inbox/*
leads/processed/*
leads/errors/*
```

Do not gitignore the `leads/` directory itself — commit it empty with a `.gitkeep` in each
subdirectory so the directory structure is preserved on fresh clones.

---

## File Naming Convention

Exported files must follow this convention (agent will reject files that don't match):

```
{source}_{YYYY-MM-DD}.csv

Examples:
  apollo_2026-04-17.csv
  linkedin_2026-04-17.csv
```

Valid source values: `apollo`, `linkedin`

If the same source is exported twice on the same date, append a counter:
```
apollo_2026-04-17_2.csv
```

---

## Input CSV Schema

The agent must tolerate column name variations from Apollo and LinkedIn exports.
Use the canonical field map below — normalize on ingest.

### Apollo export columns → canonical field names

| Apollo column        | Canonical field     | Required |
|----------------------|---------------------|----------|
| `First Name`         | `first_name`        | Yes      |
| `Last Name`          | `last_name`         | Yes      |
| `Company`            | `firm_name`         | Yes      |
| `Title`              | `title`             | No       |
| `Email`              | `email`             | No       |
| `LinkedIn URL`       | `linkedin_url`      | No       |
| `Website`            | `website`           | No       |
| `City`               | `city`              | No       |
| `State`              | `state`             | No       |

### LinkedIn Sales Navigator export columns → canonical field names

| LinkedIn column      | Canonical field     | Required |
|----------------------|---------------------|----------|
| `First Name`         | `first_name`        | Yes      |
| `Last Name`          | `last_name`         | Yes      |
| `Company`            | `firm_name`         | Yes      |
| `Title`              | `title`             | No       |
| `Email Address`      | `email`             | No       |
| `LinkedIn Profile`   | `linkedin_url`      | No       |
| `Website`            | `website`           | No       |
| `Location`           | `city`              | No       |

### Validation rules

- Rows missing `first_name`, `last_name`, OR `firm_name` → log as error, skip row
- Rows where `first_name` + `last_name` + `firm_name` are all blank → skip silently
- Do not crash on unexpected columns — ignore them

---

## Processing Pipeline (per row)

```
READ row from CSV
    │
    ▼
NORMALIZE field names (Apollo vs LinkedIn column map)
    │
    ▼
VALIDATE required fields (first_name, last_name, firm_name)
    │   fail → log error row, continue to next
    ▼
DEDUP CHECK 1 — exact email match in HubSpot
    │   if email present in row AND matches HubSpot contact → skip, log "duplicate:email"
    ▼
DEDUP CHECK 2 — fuzzy name + firm match in HubSpot
    │   if confidence ≥ 0.85 → skip, log "duplicate:name_firm"
    │   if confidence 0.60–0.84 → flag for manual review, log "review:fuzzy_match"
    │   if confidence < 0.60 → treat as new contact, continue
    ▼
EMAIL ENRICHMENT (only if no verified email from source)
    │
    ├── STEP 1: Brave Search API
    │   Query: "{first_name} {last_name} {firm_name} attorney email"
    │   Extract: candidate firm website URL
    │
    ├── STEP 2: Firecrawl
    │   Target: firm website contact/team/attorney page
    │   Extract: email addresses, attorney profile links
    │
    ├── STEP 3: Claude extraction
    │   Input: scraped page text
    │   Task: identify email address belonging to this specific attorney
    │   Output: email string or null
    │   Fallback: infer pattern from firm domain (e.g., first@firmname.com)
    │           — only if pattern seen elsewhere on page
    │
    └── STEP 4: Hunter.io Verify API
        Input: candidate email
        Output: { result: "deliverable" | "risky" | "undeliverable" | "unknown" }
        Map to confidence:
            "deliverable"   → email_confidence: "verified"
            "risky"         → email_confidence: "risky"    (include but flag)
            "undeliverable" → discard email, set email_confidence: "invalid"
            "unknown"       → email_confidence: "unverified"
    │
    ▼
WRITE TO HUBSPOT
    │   Create contact with fields below
    │   If HubSpot returns 409 conflict → log "duplicate:hubspot_conflict", skip
    ▼
LOG result row
    │
    ▼
NEXT ROW
```

---

## HubSpot Contact Fields on Creation

Write the following fields when creating a new contact:

| HubSpot field              | Value                                              |
|----------------------------|----------------------------------------------------|
| `firstname`                | `first_name`                                       |
| `lastname`                 | `last_name`                                        |
| `company`                  | `firm_name`                                        |
| `jobtitle`                 | `title` (if present)                               |
| `email`                    | verified email (if found)                          |
| `website`                  | firm website (if found)                            |
| `linkedin`                 | `linkedin_url` (if present)                        |
| `city`                     | `city` (if present)                                |
| `state`                    | `state` (if present)                               |
| `hs_lead_status`           | `NEW`                                              |
| `lead_source`              | `apollo` or `linkedin` (from filename)             |
| `enrichment_confidence`    | `verified` / `risky` / `unverified` / `not_found`  |
| `enrichment_date`          | ISO timestamp of enrichment run                    |

Note: `enrichment_confidence` and `enrichment_date` are custom HubSpot properties.
Create them manually in HubSpot before running the agent:
- Settings → Properties → Contact properties → Create property
- `enrichment_confidence`: Dropdown (values: verified, risky, unverified, not_found)
- `enrichment_date`: Date property

---

## Dedup Logic — Implementation Detail

### Check 1: Exact email match

```python
def check_exact_email(email: str, hubspot_client) -> bool:
    """
    Returns True if contact with this email already exists in HubSpot.
    Only called if email is present in the source row.
    """
    if not email:
        return False
    results = hubspot_client.search_contacts(
        filter_property="email",
        filter_value=email,
        limit=1
    )
    return len(results) > 0
```

### Check 2: Fuzzy name + firm match

```python
def check_fuzzy_name_firm(
    first_name: str,
    last_name: str,
    firm_name: str,
    hubspot_client
) -> tuple[bool, float, str | None]:
    """
    Returns (should_skip, confidence_score, matched_contact_id | None)

    Confidence scoring:
    - Exact last name match + firm name similarity ≥ 0.8 → 0.90
    - Exact last name match + firm name similarity 0.6–0.79 → 0.75
    - Fuzzy last name match (≥ 0.85) + firm name similarity ≥ 0.8 → 0.80
    - Below all thresholds → 0.0

    Use difflib.SequenceMatcher for string similarity.
    Normalize firm names before comparison:
        - lowercase
        - strip: "law firm", "law office", "llp", "llc", "plc", "apc", "pc", "esq"
        - strip punctuation
    """
```

Threshold decisions:
- ≥ 0.85 → skip (high confidence duplicate)
- 0.60–0.84 → write to HubSpot anyway BUT set a `needs_review: true` flag in notes
- < 0.60 → treat as new, proceed

The reason we write fuzzy matches rather than skip them: a false negative (skipping a
genuinely new person who happens to share a last name with a firm) is worse than a
false positive that gets caught in your daily review. The `needs_review` flag surfaces
these for 30 seconds of human judgment without blocking the pipeline.

---

## Email Enrichment — Implementation Detail

### Brave Search API

```python
BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

def search_firm_website(
    first_name: str,
    last_name: str,
    firm_name: str,
    brave_api_key: str
) -> str | None:
    """
    Returns the most likely firm website URL, or None.

    Query construction:
        f"{first_name} {last_name} {firm_name} attorney"
    
    From results:
    - Prefer results where URL domain contains a recognizable fragment of firm_name
    - Prefer .com over .net/.org for law firms
    - Reject: avvo.com, martindale.com, lawyers.com, yelp.com, superlawyers.com,
              justia.com, findlaw.com — these are directories, not firm sites
    - Return the first non-directory result URL
    - If no non-directory result → return None (do not scrape directory sites for email)
    """
```

Rate limiting: Brave Search API free tier allows 2,000 queries/month. At 197 contacts,
one enrichment run costs ~197 queries. Add a 500ms delay between requests.

### Firecrawl

```python
def scrape_contact_page(website_url: str, firecrawl_api_key: str) -> str | None:
    """
    Scrapes the firm website and returns raw text for Claude extraction.

    Strategy:
    1. Try {website_url}/contact first
    2. Try {website_url}/attorneys or {website_url}/team
    3. Try {website_url} (homepage — some solos put email on homepage)
    4. If all 404 → return None

    Return: plain text content of the first successful page, max 5000 chars
    Do not return HTML — strip tags before returning.
    """
```

### Claude Extraction Prompt

```python
EXTRACTION_SYSTEM_PROMPT = """
You are extracting attorney contact information from scraped law firm website text.
Respond with JSON only. No explanation, no markdown, no preamble.

Output schema:
{
  "email": "found@email.com or null",
  "email_source": "direct" | "inferred" | null,
  "confidence": "high" | "medium" | "low" | null
}

Rules:
- "direct": email appears explicitly on the page
- "inferred": email follows a clear pattern visible elsewhere on the page
  (e.g., two other attorneys have firstname@firmname.com format)
- Never invent an email with no evidence
- If multiple emails found, return the one most likely to belong to the target attorney
- If you cannot determine which email belongs to the target, return null
"""

EXTRACTION_USER_PROMPT = """
Target attorney: {first_name} {last_name} at {firm_name}

Page content:
{page_text}
"""
```

Use `claude-haiku-4-5-20251001` for extraction — this is a structured extraction task,
not a reasoning task. Haiku is fast and cheap enough to run on every row.

### Hunter.io Verification

```python
HUNTER_VERIFY_ENDPOINT = "https://api.hunter.io/v2/email-verifier"

def verify_email(email: str, hunter_api_key: str) -> str:
    """
    Returns one of: "verified", "risky", "unverified", "invalid", "not_attempted"

    Map Hunter.io result field:
        "deliverable"   → "verified"
        "risky"         → "risky"
        "undeliverable" → "invalid"
        "unknown"       → "unverified"
        API error       → "not_attempted" (do not discard email, just flag)
    """
```

Hunter.io free tier: 25 verifications/month. Paid starts at $49/month for 500.
For 197 contacts, budget one month of paid tier for initial enrichment run.
After that, only new contacts per batch need verification.

---

## Run Modes

The agent supports two run modes via CLI flag:

```bash
# Process all files in leads/inbox/ (standard mode)
npx tsx src/enrichment.ts run

# Dry run — process files but do not write to HubSpot or move files
npx tsx src/enrichment.ts run --dry-run

# Process a single file (useful for testing)
npx tsx src/enrichment.ts run --file leads/inbox/apollo_2026-04-17.csv
```

---

## Output and Logging

### Per-run summary (printed to console and written to `leads/processed/{filename}.log`)

```
Enrichment Run — apollo_2026-04-17.csv
Started: 2026-04-17T10:00:00Z
Completed: 2026-04-17T10:14:32Z

Total rows:         197
Skipped (invalid):    3   — missing required fields
Skipped (duplicate):  12  — exact email or high-confidence name+firm match
Flagged (review):      4  — fuzzy match, written to HubSpot with needs_review flag
Enriched:            142  — email found and verified
Not enriched:         36  — could not find email (written to HubSpot without email)

Email confidence breakdown (of 142 enriched):
  verified:    98
  risky:       21
  unverified:  23

HubSpot contacts created: 182
Errors:                     0
```

### Row-level log (written to `leads/processed/{filename}.log` after summary)

```
[SKIP:duplicate:email]     john.smith@smithlaw.com — John Smith, Smith Law
[SKIP:duplicate:name_firm] — Jane Doe, Doe Family Law (confidence: 0.91)
[REVIEW:fuzzy_match]       — Robert Johnson, Johnson & Associates (confidence: 0.72)
[OK:verified]              mary.jones@joneslegal.com — Mary Jones, Jones Legal
[OK:risky]                 bob@boblaw.com — Bob Brown, Brown Law
[OK:unverified]            carol@carolslaw.com — Carol White, White Firm
[OK:not_found]             — David Lee, Lee Elder Law (no email found)
[ERROR:invalid_row]        Row 14 — missing last_name
[ERROR:hubspot_409]        — Sarah Green, Green Law (HubSpot conflict on create)
```

### Error file

Rows that errored entirely are written to `leads/errors/{original_filename}` as a CSV
with an added `error_reason` column. This lets you manually inspect and re-process them.

---

## File Lifecycle

```
On successful run:
leads/inbox/apollo_2026-04-17.csv
    → leads/processed/apollo_2026-04-17.csv
    → leads/processed/apollo_2026-04-17.log

On complete failure (agent crashes mid-run):
    File stays in leads/inbox/ — agent is idempotent and safe to re-run.
    Contacts already written to HubSpot will be caught by dedup on re-run.
```

---

## Environment Variables

Add the following to `.env` (and document in `.env.example`):

```
BRAVE_API_KEY=
FIRECRAWL_API_KEY=
HUNTER_API_KEY=
ANTHROPIC_API_KEY=        # already present in sales agent
HUBSPOT_API_KEY=          # already present in sales agent
```

---

## Configuration File

Add `src/enrichment.config.ts` (or `.json` if preferred):

```typescript
export const EnrichmentConfig = {
  // Directories
  inboxDir: "leads/inbox",
  processedDir: "leads/processed",
  errorsDir: "leads/errors",

  // Dedup thresholds
  fuzzySkipThreshold: 0.85,       // skip if above this
  fuzzyReviewThreshold: 0.60,     // flag for review if above this

  // Enrichment behavior
  maxPageTextChars: 5000,
  braveRequestDelayMs: 500,
  directoryDomains: [             // never scrape these for emails
    "avvo.com", "martindale.com", "lawyers.com", "yelp.com",
    "superlawyers.com", "justia.com", "findlaw.com", "lawinfo.com"
  ],

  // HubSpot
  defaultLeadStatus: "NEW",
  
  // Claude model for extraction
  extractionModel: "claude-haiku-4-5-20251001",
}
```

---

## Integration with Existing Sales Agent

The enrichment agent writes contacts to HubSpot with `hs_lead_status: "NEW"`.
The existing sales agent already reads NEW contacts from HubSpot to generate drafts.

No changes required to the existing sales agent — the enrichment agent feeds it
naturally via HubSpot lead status.

The one addition to the existing agent's CLAUDE.md: when generating a draft for a
contact with `enrichment_confidence: "risky"` or `"unverified"`, note this in the
tracker log so you know to double-check the email before sending.

---

## Implementation Order

Do these in order. Do not proceed to the next step until the current one passes
a dry-run test.

1. Create directory structure (`leads/inbox`, `leads/processed`, `leads/errors`)
2. Implement CSV reader with column normalization (Apollo + LinkedIn field maps)
3. Implement row validation
4. Implement HubSpot dedup (exact email first, then fuzzy name+firm)
5. Implement Brave Search firm website lookup
6. Implement Firecrawl page scraper (contact page → homepage fallback)
7. Implement Claude email extraction prompt
8. Implement Hunter.io email verification
9. Implement HubSpot contact creation with all fields
10. Implement file lifecycle (move to processed/ on completion)
11. Implement logging (console summary + per-file log)
12. Implement error file output
13. Implement CLI flags (`--dry-run`, `--file`)
14. End-to-end dry-run test against real apollo CSV with --dry-run flag
15. Live run against 5-row test CSV, verify HubSpot contacts created correctly

---

## Known Limitations and Deferred Work

- **Multi-page scraping:** Agent currently scrapes one page per firm. Some firms have
  attorney-specific profile pages linked from the team page. Scraping two levels deep
  would improve hit rate but adds complexity — deferred to v2.

- **Attorney directory fallback:** If no firm website found, Avvo and Super Lawyers
  profiles often contain emails. Currently skipped to avoid scraping complexity —
  deferred to v2.

- **Brave Search rate limit monitoring:** No alerting if monthly quota is approached.
  Add a query counter to the log and warn at 80% of monthly limit — deferred.

- **HubSpot custom property creation:** `enrichment_confidence` and `enrichment_date`
  must be created manually in HubSpot before first run. Automate via HubSpot API
  on first run if properties don't exist — deferred.