# Skill: crm-manager

> **Architecture:** One of 10 skills in the Sales Agent. See `README.md` for the overview.
> **Purpose:** Manage HubSpot entirely from the terminal. No more switching to the HubSpot web UI.

---

## Purpose

Full CRM management from the terminal. Create contacts, move deals through stages, assign tasks, add notes, check pipeline health. HubSpot stays the source of truth but all interaction happens through natural language in your agent harness.

**This is NOT an outreach skill.** It doesn't draft emails or classify replies. It manages the CRM data that the outreach skills read from.

## Trigger
Conversational. User says things like:
- "Create a contact for john@acme.com"
- "Move the Acme deal to proposal stage"
- "Show me all open deals"
- "Create a follow-up task for next Tuesday"
- "What stages does my pipeline have?"

## Output
- HubSpot objects created/updated (contacts, deals, tasks, notes)
- Console confirmation of what changed
- No tracker writes (this skill manages HubSpot, not outreach state)

## Stopping
Conversational. Responds to individual requests. No loop.

---

## Tool Paths

### Path A — MCP (Claude Code, Cursor, Continue, any MCP harness)

| Action | MCP Tool |
|--------|----------|
| Search contacts/deals/tasks | `mcp__hubspot__search_crm_objects` |
| Get single object by ID | `mcp__hubspot__get_crm_objects` |
| Create/update/delete objects | `mcp__hubspot__manage_crm_objects` |
| List properties/fields | `mcp__hubspot__get_properties` |
| Find HubSpot users (owners) | `mcp__hubspot__search_owners` |
| Account info | `mcp__hubspot__get_user_details` |

### Path B — CLI (any harness with shell access)

```bash
# Contacts
npx tsx src/tools/hubspot.ts contacts list [--limit N] [--offset N] [--properties p1,p2]
npx tsx src/tools/hubspot.ts contacts search --email <email>
npx tsx src/tools/hubspot.ts contacts get --id <contactId>
npx tsx src/tools/hubspot.ts contacts create --email <email> [--firstname <fn>] [--lastname <ln>] [--company <co>] [--jobtitle <jt>] [--hs_lead_status <status>]
npx tsx src/tools/hubspot.ts contacts update --id <contactId> --property <name> --value <val>
npx tsx src/tools/hubspot.ts contacts delete --id <contactId>

# Notes
npx tsx src/tools/hubspot.ts notes list --contact-id <contactId> [--limit N]
npx tsx src/tools/hubspot.ts notes create --contact-id <contactId> --body "<text>"

# Deals
npx tsx src/tools/hubspot.ts deals list [--limit N] [--stage <stage>]
npx tsx src/tools/hubspot.ts deals get --id <dealId>
npx tsx src/tools/hubspot.ts deals create --name <dealname> --stage <dealstage> [--amount <N>] [--contact-id <id>] [--closedate <ISO>]
npx tsx src/tools/hubspot.ts deals update --id <dealId> --property <name> --value <val>
npx tsx src/tools/hubspot.ts deals search [--query <text>] [--stage <stage>] [--limit N]

# Tasks
npx tsx src/tools/hubspot.ts tasks create --title <title> [--contact-id <id>] [--due <ISO>] [--notes <text>] [--owner <ownerId>]
npx tsx src/tools/hubspot.ts tasks list [--contact-id <id>] [--limit N]
npx tsx src/tools/hubspot.ts tasks update --id <taskId> --status <COMPLETED|NOT_STARTED|IN_PROGRESS>

# Pipeline
npx tsx src/tools/hubspot.ts pipeline list
```

---

## Contact Management

### Create a contact

User: "Create a contact for john@acme.com, John Smith, CEO at Acme Inc"

**MCP:**
```
mcp__hubspot__manage_crm_objects
  action: create
  objectType: contacts
  properties: { email: "john@acme.com", firstname: "John", lastname: "Smith", company: "Acme Inc", jobtitle: "CEO", hs_lead_status: "NEW" }
```

**CLI:**
```bash
npx tsx src/tools/hubspot.ts contacts create --email john@acme.com --firstname John --lastname Smith --company "Acme Inc" --jobtitle CEO --hs_lead_status NEW
```

### Edit a contact

User: "Change John's lead status to IN_PROGRESS"

First look up the contact ID, then update:

**MCP:**
```
mcp__hubspot__search_crm_objects → get contact ID
mcp__hubspot__manage_crm_objects → update property
```

**CLI:**
```bash
npx tsx src/tools/hubspot.ts contacts search --email john@acme.com   # get ID
npx tsx src/tools/hubspot.ts contacts update --id <id> --property hs_lead_status --value IN_PROGRESS
```

### Look up a contact

User: "Find the contact for jane@beta.io"

**MCP:** `mcp__hubspot__search_crm_objects` with email filter
**CLI:** `npx tsx src/tools/hubspot.ts contacts search --email jane@beta.io`

### Archive a contact

User: "Delete the test contact"

**MCP:** `mcp__hubspot__manage_crm_objects` with action: archive
**CLI:** `npx tsx src/tools/hubspot.ts contacts delete --id <contactId>`

**Note:** HubSpot archives (soft-deletes), not permanent deletes. Contacts can be restored from HubSpot's recycle bin.

---

## Deal Management

### Create a deal

User: "Create a deal for Acme Inc, 10k, appointment scheduled, close date end of month"

**MCP:**
```
mcp__hubspot__manage_crm_objects
  action: create
  objectType: deals
  properties: { dealname: "Acme Inc", dealstage: "appointmentscheduled", amount: "10000", closedate: "2026-04-30" }
  associations: [{ contactId: "<id>", type: "deal_to_contact" }]  // if contact ID known
```

**CLI:**
```bash
npx tsx src/tools/hubspot.ts deals create --name "Acme Inc" --stage appointmentscheduled --amount 10000 --contact-id <id> --closedate 2026-04-30
```

### Move a deal through stages

User: "Move the Acme deal to proposal stage"

**CLI:**
```bash
npx tsx src/tools/hubspot.ts deals search --query "Acme"   # get deal ID
npx tsx src/tools/hubspot.ts deals update --id <dealId> --property dealstage --value presentationscheduled
```

**Important:** Stage names are internal IDs, not display names. Run `pipeline list` first to see valid stage names.

### Update deal amount or close date

User: "Update the Acme deal to 15k"

```bash
npx tsx src/tools/hubspot.ts deals update --id <dealId> --property amount --value 15000
```

### Search deals

User: "Show me all deals in the proposal stage"

```bash
npx tsx src/tools/hubspot.ts deals search --stage presentationscheduled
```

User: "Find the deal for Beta Corp"

```bash
npx tsx src/tools/hubspot.ts deals search --query "Beta Corp"
```

---

## Task Management

### Create a follow-up task

User: "Remind me to follow up with John next Tuesday"

**CLI:**
```bash
npx tsx src/tools/hubspot.ts tasks create --title "Follow up with John Smith" --contact-id <id> --due 2026-04-14
```

With notes:
```bash
npx tsx src/tools/hubspot.ts tasks create --title "Send proposal to Acme" --contact-id <id> --due 2026-04-15 --notes "They asked for pricing on the full package"
```

### List open tasks

User: "What tasks do I have?"

```bash
npx tsx src/tools/hubspot.ts tasks list
```

For a specific contact:
```bash
npx tsx src/tools/hubspot.ts tasks list --contact-id <id>
```

### Complete a task

User: "Mark the John follow-up as done"

```bash
npx tsx src/tools/hubspot.ts tasks list   # find task ID
npx tsx src/tools/hubspot.ts tasks update --id <taskId> --status COMPLETED
```

---

## Notes Management

### Add a note to a contact

User: "Add a note to John: discussed pricing, he'll get back to us next week"

**CLI:**
```bash
npx tsx src/tools/hubspot.ts contacts search --email john@acme.com   # get contact ID
npx tsx src/tools/hubspot.ts notes create --contact-id <id> --body "Discussed pricing. Will get back to us next week."
```

### Read notes

```bash
npx tsx src/tools/hubspot.ts notes list --contact-id <id> --limit 5
```

---

## Pipeline Visibility

### List pipeline stages

User: "What stages does my deal pipeline have?"

```bash
npx tsx src/tools/hubspot.ts pipeline list
```

Returns all pipelines with their stages and internal IDs. Use these IDs when creating/moving deals.

---

## Constraints

### Allowed
- Create, read, update, archive HubSpot contacts
- Create, read, update deals (stage, amount, close date, any property)
- Create, read, update/complete tasks
- Create, read notes
- List pipeline stages
- Search across all object types

### Forbidden
- Permanently delete data (HubSpot only supports archiving via API)
- Bulk operations without user confirmation (always confirm before batch creates/updates)
- Modify pipeline structure (stages, pipelines) via API (do this in HubSpot settings)
- Access data outside the authenticated portal
