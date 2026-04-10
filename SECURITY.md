# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

**Email:** marcopatzelt7@gmail.com

Please do **not** open a public GitHub issue for security vulnerabilities.

## Security Design

- The agent creates **drafts only** — it cannot send emails
- **Credentials (Private App tokens, OAuth secrets) live in `.env`** and are never committed to git (enforced by `.gitignore`)
- **`tracker.db` is gitignored** (along with `table.tsv` for backwards compatibility with pre-v2.6 checkouts) to prevent leaking contact data from real campaigns
- **Research reports** in `output/research-reports/` are gitignored
- **Recovery analysis outputs** in `output/recovery-*.md` are gitignored
- All contact processing is logged to `tracker.db` (SQLite, via `src/db.ts`) for a full audit trail. Pre-v2.6 this was `table.tsv`; on first v2.6+ run, any existing `table.tsv` is imported into SQLite and then deleted.
- Gmail OAuth uses a refresh token flow — no long-lived access tokens in the code
- HubSpot uses a Private App token — scoped to specific permissions you choose

## Recommended Hardening

- Use the smallest HubSpot scopes needed (e.g., read-only where possible)
- Rotate your HubSpot Private App token periodically
- Use a dedicated Google account for the Gmail integration, not your main account
- Review drafts manually before sending — the agent is not a send tool
- Keep `.env` permissions restricted: `chmod 600 .env`
