#!/usr/bin/env node
/**
 * Gmail CLI wrapper — harness-agnostic Gmail API access.
 *
 * Any local agent harness can shell out to this CLI instead of using MCP tools.
 * Outputs JSON to stdout.
 *
 * Usage:
 *   tsx src/tools/gmail.ts draft create --to <email> --subject "<s>" --body "<b>" [--content-type text/plain|text/html]
 *   tsx src/tools/gmail.ts draft list [--query "<q>"]
 *   tsx src/tools/gmail.ts draft read --id <draftId>
 *   tsx src/tools/gmail.ts inbox search --query "newer_than:7d in:inbox"
 *   tsx src/tools/gmail.ts thread read --id <threadId>
 *   tsx src/tools/gmail.ts message read --id <messageId>
 *
 * Auth: Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env.
 * See README for OAuth setup instructions.
 */

import 'dotenv/config';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ParsedArgs {
  [key: string]: string | true | undefined;
}

type Handler = (opts: ParsedArgs) => Promise<void>;

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface RawEmailInput {
  to: string;
  subject: string;
  body: string;
  contentType?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `Error: ${name} not set. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.`,
    );
    console.error('See README.md for OAuth setup instructions.');
    process.exit(1);
  }
  return v;
}

const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET');
const GOOGLE_REFRESH_TOKEN = requireEnv('GOOGLE_REFRESH_TOKEN');

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`OAuth error: ${text}`);
    process.exit(1);
  }
  const data = (await res.json()) as AccessTokenResponse;
  return data.access_token;
}

async function gmailRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body: unknown = null,
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const init: RequestInit = { method, headers };
  if (body) init.body = JSON.stringify(body);

  const res = await fetch(`${GMAIL_API}${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    console.error(`Gmail API error [${res.status}]: ${text}`);
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

function buildRawEmail({ to, subject, body, contentType = 'text/plain' }: RawEmailInput): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    body,
  ].join('\r\n');
  // Base64url encode
  return Buffer.from(headers)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function draftCreate(opts: ParsedArgs): Promise<void> {
  const to = getString(opts, 'to');
  const subject = getString(opts, 'subject');
  const body = getString(opts, 'body');
  if (!to || !subject || !body) {
    console.error('Missing --to, --subject, or --body');
    process.exit(1);
  }
  const raw = buildRawEmail({
    to,
    subject,
    body,
    contentType: getString(opts, 'content-type') ?? 'text/plain',
  });
  const data = await gmailRequest('POST', '/drafts', { message: { raw } });
  console.log(JSON.stringify(data, null, 2));
}

async function draftList(opts: ParsedArgs): Promise<void> {
  const query = getString(opts, 'query');
  const params = query ? `?q=${encodeURIComponent(query)}` : '';
  const data = await gmailRequest('GET', `/drafts${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function draftRead(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const data = await gmailRequest('GET', `/drafts/${id}?format=full`);
  console.log(JSON.stringify(data, null, 2));
}

async function inboxSearch(opts: ParsedArgs): Promise<void> {
  const query = getString(opts, 'query');
  if (!query) {
    console.error('Missing --query');
    process.exit(1);
  }
  const params = `?q=${encodeURIComponent(query)}`;
  const data = await gmailRequest('GET', `/messages${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function threadRead(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const data = await gmailRequest('GET', `/threads/${id}`);
  console.log(JSON.stringify(data, null, 2));
}

async function messageRead(opts: ParsedArgs): Promise<void> {
  const id = getString(opts, 'id');
  if (!id) {
    console.error('Missing --id');
    process.exit(1);
  }
  const data = await gmailRequest('GET', `/messages/${id}`);
  console.log(JSON.stringify(data, null, 2));
}

const [, , resource, action, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!resource || resource === '--help') {
  console.log(`Usage: tsx src/tools/gmail.ts <resource> <action> [options]

Resources:
  draft   create | list | read
  inbox   search
  thread  read
  message read

Examples:
  tsx src/tools/gmail.ts draft create --to foo@bar.com --subject "Hi" --body "Hello"
  tsx src/tools/gmail.ts draft read --id <draftId>
  tsx src/tools/gmail.ts inbox search --query "newer_than:7d in:inbox"
  tsx src/tools/gmail.ts thread read --id <threadId>

Auth: Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env.
See README.md for OAuth setup.`);
  process.exit(0);
}

const routes: Record<string, Handler> = {
  'draft:create': draftCreate,
  'draft:list': draftList,
  'draft:read': draftRead,
  'inbox:search': inboxSearch,
  'thread:read': threadRead,
  'message:read': messageRead,
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
