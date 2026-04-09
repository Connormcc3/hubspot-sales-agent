#!/usr/bin/env node
/**
 * HubSpot CLI wrapper — harness-agnostic HubSpot API access.
 *
 * Any local agent harness can shell out to this CLI instead of using MCP tools.
 * Outputs JSON to stdout (parseable by any agent).
 *
 * Usage:
 *   node src/tools/hubspot.js contacts list [--limit N] [--offset N] [--properties p1,p2,p3]
 *   node src/tools/hubspot.js contacts search --email <email>
 *   node src/tools/hubspot.js contacts get --id <contactId>
 *   node src/tools/hubspot.js contacts update --id <contactId> --property <name> --value <val>
 *   node src/tools/hubspot.js notes list --contact-id <contactId> [--limit N]
 *   node src/tools/hubspot.js notes create --contact-id <contactId> --body "<text>"
 *   node src/tools/hubspot.js deals list [--limit N] [--stage <stage>]
 *   node src/tools/hubspot.js deals get --id <dealId>
 *
 * Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token, starts with "pat-").
 */

import 'dotenv/config';

const API_BASE = 'https://api.hubapi.com';
const TOKEN = process.env.HUBSPOT_API_TOKEN;

if (!TOKEN) {
  console.error('Error: HUBSPOT_API_TOKEN not set. Copy .env.example to .env and fill in your Private App token.');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function hubspotRequest(method, path, body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();

  if (!res.ok) {
    console.error(`HubSpot API error [${res.status}]: ${text}`);
    process.exit(1);
  }

  if (!text) return {};
  return JSON.parse(text);
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = val;
      if (val !== true) i++;
    }
  }
  return parsed;
}

async function contactsList(opts) {
  const limit = opts.limit || 100;
  const properties = (opts.properties || 'firstname,lastname,email,company,jobtitle,hs_lead_status').split(',');
  const after = opts.offset || undefined;

  const params = new URLSearchParams({ limit, properties: properties.join(',') });
  if (after) params.set('after', after);

  const data = await hubspotRequest('GET', `/crm/v3/objects/contacts?${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function contactsSearch(opts) {
  if (!opts.email) { console.error('Missing --email'); process.exit(1); }

  const body = {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: opts.email }] }],
    properties: ['firstname', 'lastname', 'email', 'company', 'jobtitle', 'hs_lead_status'],
    limit: 10,
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/contacts/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function contactsGet(opts) {
  if (!opts.id) { console.error('Missing --id'); process.exit(1); }
  const properties = 'firstname,lastname,email,company,jobtitle,hs_lead_status';
  const data = await hubspotRequest('GET', `/crm/v3/objects/contacts/${opts.id}?properties=${properties}`);
  console.log(JSON.stringify(data, null, 2));
}

async function contactsUpdate(opts) {
  if (!opts.id || !opts.property || opts.value === undefined) {
    console.error('Missing --id, --property, or --value');
    process.exit(1);
  }
  const body = { properties: { [opts.property]: opts.value } };
  const data = await hubspotRequest('PATCH', `/crm/v3/objects/contacts/${opts.id}`, body);
  console.log(JSON.stringify(data, null, 2));
}

async function notesList(opts) {
  const contactId = opts['contact-id'];
  if (!contactId) { console.error('Missing --contact-id'); process.exit(1); }
  const limit = opts.limit || 10;

  const body = {
    filterGroups: [{
      filters: [{
        propertyName: 'associations.contact',
        operator: 'EQ',
        value: contactId,
      }],
    }],
    properties: ['hs_note_body', 'hs_timestamp'],
    sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
    limit,
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/notes/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function notesCreate(opts) {
  const contactId = opts['contact-id'];
  if (!contactId || !opts.body) { console.error('Missing --contact-id or --body'); process.exit(1); }

  const note = {
    properties: {
      hs_note_body: opts.body,
      hs_timestamp: Date.now(),
    },
    associations: [{
      to: { id: contactId },
      types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
    }],
  };
  const data = await hubspotRequest('POST', '/crm/v3/objects/notes', note);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsList(opts) {
  const limit = opts.limit || 100;
  const properties = 'dealname,amount,dealstage,closedate,hs_lastmodifieddate';
  const params = new URLSearchParams({ limit, properties });
  const data = await hubspotRequest('GET', `/crm/v3/objects/deals?${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsGet(opts) {
  if (!opts.id) { console.error('Missing --id'); process.exit(1); }
  const properties = 'dealname,amount,dealstage,closedate,hs_lastmodifieddate';
  const data = await hubspotRequest('GET', `/crm/v3/objects/deals/${opts.id}?properties=${properties}`);
  console.log(JSON.stringify(data, null, 2));
}

const [,, resource, action, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!resource || resource === '--help') {
  console.log(`Usage: node src/tools/hubspot.js <resource> <action> [options]

Resources:
  contacts list | search | get | update
  notes    list | create
  deals    list | get

Examples:
  node src/tools/hubspot.js contacts list --limit 50
  node src/tools/hubspot.js contacts search --email foo@example.com
  node src/tools/hubspot.js notes list --contact-id 123
  node src/tools/hubspot.js deals list --stage open

Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token).`);
  process.exit(0);
}

const routes = {
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

handler(opts).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
