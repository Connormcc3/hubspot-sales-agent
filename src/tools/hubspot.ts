#!/usr/bin/env node
/**
 * HubSpot CLI wrapper — harness-agnostic HubSpot API access.
 *
 * Any local agent harness can shell out to this CLI instead of using MCP tools.
 * Outputs JSON to stdout (parseable by any agent).
 *
 * Usage:
 *   tsx src/tools/hubspot.ts contacts list [--limit N] [--offset N] [--properties p1,p2,p3]
 *   tsx src/tools/hubspot.ts contacts search --email <email>
 *   tsx src/tools/hubspot.ts contacts get --id <contactId>
 *   tsx src/tools/hubspot.ts contacts update --id <contactId> --property <name> --value <val>
 *   tsx src/tools/hubspot.ts notes list --contact-id <contactId> [--limit N]
 *   tsx src/tools/hubspot.ts notes create --contact-id <contactId> --body "<text>"
 *   tsx src/tools/hubspot.ts deals list [--limit N] [--stage <stage>]
 *   tsx src/tools/hubspot.ts deals get --id <dealId>
 *
 * Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token, starts with "pat-").
 */

import 'dotenv/config';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ParsedArgs {
  [key: string]: string | true | undefined;
}

type Handler = (opts: ParsedArgs) => Promise<void>;

const API_BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_API_TOKEN;

if (!TOKEN) {
  console.error(
    'Error: HUBSPOT_API_TOKEN not set. Copy .env.example to .env and fill in your Private App token.',
  );
  process.exit(1);
}

const baseHeaders: Record<string, string> = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function hubspotRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body: unknown = null,
): Promise<T> {
  const init: RequestInit = { method, headers: baseHeaders };
  if (body) init.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, init);
  const text = await res.text();

  if (!res.ok) {
    console.error(`HubSpot API error [${res.status}]: ${text}`);
    process.exit(1);
  }

  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      const val: string | true = next && !next.startsWith('--') ? next : true;
      parsed[key] = val;
      if (val !== true) i++;
    }
  }
  return parsed;
}

function getString(opts: ParsedArgs, key: string): string | undefined {
  const v = opts[key];
  return typeof v === 'string' ? v : undefined;
}

async function contactsList(opts: ParsedArgs): Promise<void> {
  const limit = getString(opts, 'limit') ?? '100';
  const propertiesStr =
    getString(opts, 'properties') ?? 'firstname,lastname,email,company,jobtitle,hs_lead_status';
  const after = getString(opts, 'offset');

  const params = new URLSearchParams({ limit, properties: propertiesStr });
  if (after) params.set('after', after);

  const data = await hubspotRequest('GET', `/crm/v3/objects/contacts?${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function contactsSearch(opts: ParsedArgs): Promise<void> {
  const email = getString(opts, 'email');
  if (!email) {
    console.error('Missing --email');
    process.exit(1);
  }

  const body = {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['firstname', 'lastname', 'email', 'company', 'jobtitle', 'hs_lead_status'],
    limit: 10,
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/contacts/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function contactsGet(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const properties = 'firstname,lastname,email,company,jobtitle,hs_lead_status';
  const data = await hubspotRequest(
    'GET',
    `/crm/v3/objects/contacts/${id}?properties=${properties}`,
  );
  console.log(JSON.stringify(data, null, 2));
}

async function contactsUpdate(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  const property = getString(opts, 'property');
  const value = getString(opts, 'value');
  if (!id || !property || value === undefined) {
    console.error('Missing --id, --property, or --value');
    process.exit(1);
  }
  const body = { properties: { [property]: value } };
  const data = await hubspotRequest('PATCH', `/crm/v3/objects/contacts/${id}`, body);
  console.log(JSON.stringify(data, null, 2));
}

async function notesList(opts: ParsedArgs): Promise<void> {
  const contactId = getString(opts, 'contact-id');
  if (!contactId) {
    console.error('Missing --contact-id');
    process.exit(1);
  }
  const limit = Number(getString(opts, 'limit') ?? '10');

  const body = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: 'associations.contact',
            operator: 'EQ',
            value: contactId,
          },
        ],
      },
    ],
    properties: ['hs_note_body', 'hs_timestamp'],
    sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
    limit,
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/notes/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function notesCreate(opts: ParsedArgs): Promise<void> {
  const contactId = getString(opts, 'contact-id');
  const noteBody = getString(opts, 'body');
  if (!contactId || !noteBody) {
    console.error('Missing --contact-id or --body');
    process.exit(1);
  }

  const note = {
    properties: {
      hs_note_body: noteBody,
      hs_timestamp: Date.now(),
    },
    associations: [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
      },
    ],
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/notes', note);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsList(opts: ParsedArgs): Promise<void> {
  const limit = getString(opts, 'limit') ?? '100';
  const properties = 'dealname,amount,dealstage,closedate,hs_lastmodifieddate';
  const params = new URLSearchParams({ limit, properties });
  const data = await hubspotRequest('GET', `/crm/v3/objects/deals?${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsGet(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const properties = 'dealname,amount,dealstage,closedate,hs_lastmodifieddate';
  const data = await hubspotRequest(
    'GET',
    `/crm/v3/objects/deals/${id}?properties=${properties}`,
  );
  console.log(JSON.stringify(data, null, 2));
}

const [, , resource, action, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!resource || resource === '--help') {
  console.log(`Usage: tsx src/tools/hubspot.ts <resource> <action> [options]

Resources:
  contacts list | search | get | update
  notes    list | create
  deals    list | get

Examples:
  tsx src/tools/hubspot.ts contacts list --limit 50
  tsx src/tools/hubspot.ts contacts search --email foo@example.com
  tsx src/tools/hubspot.ts notes list --contact-id 123
  tsx src/tools/hubspot.ts deals list --stage open

Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token).`);
  process.exit(0);
}

const routes: Record<string, Handler> = {
  'contacts:list': contactsList,
  'contacts:search': contactsSearch,
  'contacts:get': contactsGet,
  'contacts:update': contactsUpdate,
  'notes:list': notesList,
  'notes:create': notesCreate,
  'deals:list': dealsList,
  'deals:get': dealsGet,
};

const handler = routes[`${resource}:${action}`];
if (!handler) {
  console.error(`Unknown command: ${resource} ${action}`);
  console.error('Run with --help for usage.');
  process.exit(1);
}

handler(opts).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Error:', msg);
  process.exit(1);
});
