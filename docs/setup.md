# Setup

Full credentials + install walkthrough. If you just want to see the agent generate a draft without wiring real credentials, see the 5-minute quickstart in the repo [`README.md`](../README.md).

---

## Prerequisites

- **Node.js 18+**
- **HubSpot account** with a Private App token
- **Gmail account** with Google Cloud OAuth credentials
- **An agent harness** that can read markdown and execute shell commands (e.g., [Claude Code](https://claude.ai/code))

---

## Installation

```bash
# Clone the repo
git clone https://github.com/Dominien/hubspot-sales-agent.git
cd hubspot-sales-agent

# Install dependencies
npm install

# Set up credentials
cp .env.example .env
# Edit .env with your HubSpot token and Google OAuth credentials
```

---

## HubSpot Private App Token

1. Go to HubSpot Settings → Integrations → Private Apps
2. Create a new Private App
3. Scopes needed: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.read`, `crm.objects.notes.read`, `crm.objects.notes.write`
4. Copy the token (starts with `pat-`) into `.env` as `HUBSPOT_API_TOKEN`

---

## Google OAuth (Gmail API)

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Use a tool like [Google OAuth Playground](https://developers.google.com/oauthplayground/) to generate a refresh token with scope `https://www.googleapis.com/auth/gmail.modify`
5. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` in `.env`

---

## Verify setup

```bash
npx tsx src/tools/hubspot.ts --help     # should print usage
npx tsx src/tools/gmail.ts --help       # should print usage
npx tsx src/tools/webfetch.ts --help    # should print usage
npx tsx src/tracker.ts read             # should print []
npx tsx src/learnings.ts --help         # should print usage
npx tsx src/performance.ts --window 7   # should print JSON with zero counts on an empty tracker
npx tsc --noEmit                        # TypeScript type check, should exit 0
```

If all of those succeed, you're ready. Head back to the [README](../README.md) and run your first skill.

---

## Customize `CLAUDE.md`

Edit the placeholders to match your sender identity and offering:

- `YOUR_NAME` → your name
- `YOUR_EMAIL` → your email
- `YOUR_DOMAIN` → your website / company

Also customize the **email tone table** and **greeting override rules** for your market.

---

## Define your research approach (`knowledge/research-config.md`)

The `research-outreach` skill runs a configurable audit against each lead's website. Pick ONE (or more) audit types that match what you sell:

- **SEO Audit** — for SEO agencies, content marketers
- **UX / Conversion Audit** — for CRO consultants, UX designers
- **Brand / Positioning Audit** — for branding agencies, strategists
- **Tech Stack Audit** — for developers, DevOps, performance specialists
- **Content Strategy Audit** — for content marketers, editors
- **Competitive Analysis** — for market researchers, strategists
- **Custom** — define your own

This is what makes the `research-outreach` skill industry-agnostic.

---

## Dashboard UI setup (optional)

If you want the local dashboard:

```bash
npm run ui:install   # first time only
npm run ui:dev       # starts at http://127.0.0.1:3000
```

See [`dashboard.md`](dashboard.md) for the full walkthrough. Localhost-only, never deploy publicly.
