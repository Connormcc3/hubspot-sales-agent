# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

**Email:** marcopatzelt7@gmail.com

Please do **not** open a public GitHub issue for security vulnerabilities.

## Security Design

- The agent creates **drafts only** — it cannot send emails
- No API keys or credentials are stored in the codebase
- MCP integrations handle authentication externally via Claude Code
- `table.tsv` is gitignored by default to prevent leaking contact data
- All contact processing is logged for full audit trail
