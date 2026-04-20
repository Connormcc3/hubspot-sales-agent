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
 *   tsx src/tools/hubspot.ts lists list [--limit N]
 *   tsx src/tools/hubspot.ts lists get --id <listId>
 *   tsx src/tools/hubspot.ts lists members --id <listId> [--limit N]
 *   tsx src/tools/hubspot.ts lists add --id <listId> --contact-ids <id1,id2>
 *   tsx src/tools/hubspot.ts lists remove --id <listId> --contact-ids <id1,id2>
 *
 * Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token, starts with "pat-").
 */

import {
  type ParsedArgs,
  createHubSpotRequest,
  getHubSpotToken,
  parseArgs,
  getString,
} from '../lib/hubspot-api.ts';

type Handler = (opts: ParsedArgs) => Promise<void>;

let hubspotRequest: ReturnType<typeof createHubSpotRequest>;
if (!process.argv.includes('--help')) {
  try {
    const token = getHubSpotToken();
    hubspotRequest = createHubSpotRequest(token);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
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

async function contactsCreate(opts: ParsedArgs): Promise<void> {
  const email = getString(opts, 'email');
  if (!email) {
    console.error('Missing --email');
    process.exit(1);
  }
  const properties: Record<string, string> = { email };
  for (const key of ['firstname', 'lastname', 'company', 'jobtitle', 'hs_lead_status']) {
    const val = getString(opts, key);
    if (val) properties[key] = val;
  }
  const data = await hubspotRequest('POST', '/crm/v3/objects/contacts', { properties });
  console.log(JSON.stringify(data, null, 2));
}

async function contactsDelete(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  await hubspotRequest('DELETE', `/crm/v3/objects/contacts/${id}`);
  console.log(JSON.stringify({ archived: true, id }));
}

async function dealsCreate(opts: ParsedArgs): Promise<void> {
  const name = getString(opts, 'name');
  const stage = getString(opts, 'stage');
  if (!name || !stage) {
    console.error('Missing --name or --stage');
    process.exit(1);
  }
  const properties: Record<string, string> = { dealname: name, dealstage: stage };
  const amount = getString(opts, 'amount');
  if (amount) properties.amount = amount;
  const closedate = getString(opts, 'closedate');
  if (closedate) properties.closedate = closedate;

  const body: Record<string, unknown> = { properties };
  const contactId = getString(opts, 'contact-id');
  if (contactId) {
    body.associations = [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
      },
    ];
  }
  const data = await hubspotRequest('POST', '/crm/v3/objects/deals', body);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsUpdate(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  const property = getString(opts, 'property');
  const value = getString(opts, 'value');
  if (!id || !property || value === undefined) {
    console.error('Missing --id, --property, or --value');
    process.exit(1);
  }
  const body = { properties: { [property]: value } };
  const data = await hubspotRequest('PATCH', `/crm/v3/objects/deals/${id}`, body);
  console.log(JSON.stringify(data, null, 2));
}

async function dealsSearch(opts: ParsedArgs): Promise<void> {
  const query = getString(opts, 'query');
  const stage = getString(opts, 'stage');
  const limit = Number(getString(opts, 'limit') ?? '20');

  const filters: unknown[] = [];
  if (stage) {
    filters.push({ propertyName: 'dealstage', operator: 'EQ', value: stage });
  }

  const body: Record<string, unknown> = {
    properties: ['dealname', 'amount', 'dealstage', 'closedate', 'hs_lastmodifieddate'],
    sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
    limit,
  };
  if (query) body.query = query;
  if (filters.length > 0) body.filterGroups = [{ filters }];

  const data = await hubspotRequest('POST', '/crm/v3/objects/deals/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function tasksCreate(opts: ParsedArgs): Promise<void> {
  const title = getString(opts, 'title');
  if (!title) {
    console.error('Missing --title');
    process.exit(1);
  }
  const properties: Record<string, string | number> = {
    hs_task_subject: title,
    hs_task_status: 'NOT_STARTED',
    hs_task_type: 'TODO',
    hs_timestamp: Date.now(),
  };
  const due = getString(opts, 'due');
  if (due) properties.hs_task_remindereventtime = new Date(due).getTime();
  const notes = getString(opts, 'notes');
  if (notes) properties.hs_task_body = notes;
  const owner = getString(opts, 'owner');
  if (owner) properties.hubspot_owner_id = owner;

  const body: Record<string, unknown> = { properties };
  const contactId = getString(opts, 'contact-id');
  if (contactId) {
    body.associations = [
      {
        to: { id: contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 204 }],
      },
    ];
  }
  const data = await hubspotRequest('POST', '/crm/v3/objects/tasks', body);
  console.log(JSON.stringify(data, null, 2));
}

async function tasksList(opts: ParsedArgs): Promise<void> {
  const limit = Number(getString(opts, 'limit') ?? '20');
  const contactId = getString(opts, 'contact-id');

  const filters: unknown[] = [];
  if (contactId) {
    filters.push({
      propertyName: 'associations.contact',
      operator: 'EQ',
      value: contactId,
    });
  }

  const body: Record<string, unknown> = {
    properties: [
      'hs_task_subject',
      'hs_task_status',
      'hs_task_body',
      'hs_task_remindereventtime',
      'hubspot_owner_id',
    ],
    sorts: [{ propertyName: 'hs_timestamp', direction: 'DESCENDING' }],
    limit,
  };
  if (filters.length > 0) body.filterGroups = [{ filters }];

  const data = await hubspotRequest('POST', '/crm/v3/objects/tasks/search', body);
  console.log(JSON.stringify(data, null, 2));
}

async function tasksUpdate(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  const status = getString(opts, 'status');
  if (!id || !status) {
    console.error('Missing --id or --status (COMPLETED | NOT_STARTED | IN_PROGRESS)');
    process.exit(1);
  }
  const body = { properties: { hs_task_status: status } };
  const data = await hubspotRequest('PATCH', `/crm/v3/objects/tasks/${id}`, body);
  console.log(JSON.stringify(data, null, 2));
}

async function listsList(opts: ParsedArgs): Promise<void> {
  const limit = getString(opts, 'limit') ?? '25';
  const offset = getString(opts, 'offset');
  const params = new URLSearchParams({ limit });
  if (offset) params.set('offset', offset);
  const data = await hubspotRequest('GET', `/crm/v3/lists/?${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function listsGet(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const data = await hubspotRequest('GET', `/crm/v3/lists/${id}`);
  console.log(JSON.stringify(data, null, 2));
}

async function listsMembers(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const limit = getString(opts, 'limit') ?? '100';
  const after = getString(opts, 'after');
  const params = new URLSearchParams({ limit });
  if (after) params.set('after', after);
  const data = await hubspotRequest(
    'GET',
    `/crm/v3/lists/${id}/memberships?${params}`,
  );
  console.log(JSON.stringify(data, null, 2));
}

async function listsAdd(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  const contactIds = getString(opts, 'contact-ids');
  if (!id || !contactIds) {
    console.error('Missing --id or --contact-ids (comma-separated)');
    process.exit(1);
  }
  const body = contactIds.split(',').map(Number);
  const data = await hubspotRequest(
    'PUT',
    `/crm/v3/lists/${id}/memberships/add`,
    body,
  );
  console.log(JSON.stringify(data, null, 2));
}

async function listsRemove(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  const contactIds = getString(opts, 'contact-ids');
  if (!id || !contactIds) {
    console.error('Missing --id or --contact-ids (comma-separated)');
    process.exit(1);
  }
  const body = contactIds.split(',').map(Number);
  const data = await hubspotRequest(
    'PUT',
    `/crm/v3/lists/${id}/memberships/remove`,
    body,
  );
  console.log(JSON.stringify(data, null, 2));
}

async function pipelineList(): Promise<void> {
  const data = await hubspotRequest('GET', '/crm/v3/pipelines/deals');
  console.log(JSON.stringify(data, null, 2));
}

const [, , resource, action, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!resource || resource === '--help') {
  console.log(`Usage: tsx src/tools/hubspot.ts <resource> <action> [options]

Resources:
  contacts  list | search | get | create | update | delete
  notes     list | create
  deals     list | get | create | update | search
  tasks     create | list | update
  lists     list | get | members | add | remove
  pipeline  list

Contact commands:
  contacts list [--limit N] [--offset N] [--properties p1,p2]
  contacts search --email <email>
  contacts get --id <contactId>
  contacts create --email <email> [--firstname <fn>] [--lastname <ln>] [--company <co>] [--jobtitle <jt>] [--hs_lead_status <status>]
  contacts update --id <contactId> --property <name> --value <val>
  contacts delete --id <contactId>

Deal commands:
  deals list [--limit N] [--stage <stage>]
  deals get --id <dealId>
  deals create --name <dealname> --stage <dealstage> [--amount <N>] [--contact-id <id>] [--closedate <ISO>]
  deals update --id <dealId> --property <name> --value <val>
  deals search [--query <text>] [--stage <stage>] [--limit N]

Task commands:
  tasks create --title <title> [--contact-id <id>] [--due <ISO>] [--notes <text>] [--owner <ownerId>]
  tasks list [--contact-id <id>] [--limit N]
  tasks update --id <taskId> --status <COMPLETED|NOT_STARTED|IN_PROGRESS>

List commands:
  lists list [--limit N] [--offset N]
  lists get --id <listId>
  lists members --id <listId> [--limit N] [--after <cursor>]
  lists add --id <listId> --contact-ids <id1,id2,...>
  lists remove --id <listId> --contact-ids <id1,id2,...>

Pipeline:
  pipeline list

Auth: Set HUBSPOT_API_TOKEN in .env (HubSpot Private App token).`);
  process.exit(0);
}

const routes: Record<string, Handler> = {
  'contacts:list': contactsList,
  'contacts:search': contactsSearch,
  'contacts:get': contactsGet,
  'contacts:create': contactsCreate,
  'contacts:update': contactsUpdate,
  'contacts:delete': contactsDelete,
  'notes:list': notesList,
  'notes:create': notesCreate,
  'deals:list': dealsList,
  'deals:get': dealsGet,
  'deals:create': dealsCreate,
  'deals:update': dealsUpdate,
  'deals:search': dealsSearch,
  'tasks:create': tasksCreate,
  'tasks:list': tasksList,
  'tasks:update': tasksUpdate,
  'lists:list': listsList,
  'lists:get': listsGet,
  'lists:members': listsMembers,
  'lists:add': listsAdd,
  'lists:remove': listsRemove,
  'pipeline:list': pipelineList,
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
