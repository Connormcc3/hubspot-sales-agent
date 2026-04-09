#!/usr/bin/env node
/**
 * Gmail CLI wrapper — harness-agnostic Gmail API access.
 *
 * Any local agent harness can shell out to this CLI instead of using MCP tools.
 * Outputs JSON to stdout.
 *
 * Usage:
 *   node src/tools/gmail.js draft create --to <email> --subject "<s>" --body "<b>" [--content-type text/plain|text/html]
 *   node src/tools/gmail.js draft list [--query "<q>"]
 *   node src/tools/gmail.js inbox search --query "newer_than:7d in:inbox"
 *   node src/tools/gmail.js thread read --id <threadId>
 *   node src/tools/gmail.js message read --id <messageId>
 *
 * Auth: Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env.
 * See README for OAuth setup instructions.
 */

import 'dotenv/config';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('Error: Google OAuth credentials not set. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.');
  console.error('See README.md for OAuth setup instructions.');
  process.exit(1);
}

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function getAccessToken() {
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
  const data = await res.json();
  return data.access_token;
}

async function gmailRequest(method, path, body = null) {
  const accessToken = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GMAIL_API}${path}`, opts);
  const text = await res.text();
  if (!res.ok) {
    console.error(`Gmail API error [${res.status}]: ${text}`);
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

function buildRawEmail({ to, subject, body, contentType = 'text/plain' }) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    body,
  ].join('\r\n');
  // Base64url encode
  return Buffer.from(headers).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function draftCreate(opts) {
  if (!opts.to || !opts.subject || !opts.body) {
    console.error('Missing --to, --subject, or --body');
    process.exit(1);
  }
  const raw = buildRawEmail({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    contentType: opts['content-type'] || 'text/plain',
  });
  const data = await gmailRequest('POST', '/drafts', { message: { raw } });
  console.log(JSON.stringify(data, null, 2));
}

async function draftList(opts) {
  const params = opts.query ? `?q=${encodeURIComponent(opts.query)}` : '';
  const data = await gmailRequest('GET', `/drafts${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function inboxSearch(opts) {
  if (!opts.query) { console.error('Missing --query'); process.exit(1); }
  const params = `?q=${encodeURIComponent(opts.query)}`;
  const data = await gmailRequest('GET', `/messages${params}`);
  console.log(JSON.stringify(data, null, 2));
}

async function threadRead(opts) {
  if (!opts.id) { console.error('Missing --id'); process.exit(1); }
  const data = await gmailRequest('GET', `/threads/${opts.id}`);
  console.log(JSON.stringify(data, null, 2));
}

async function messageRead(opts) {
  if (!opts.id) { console.error('Missing --id'); process.exit(1); }
  const data = await gmailRequest('GET', `/messages/${opts.id}`);
  console.log(JSON.stringify(data, null, 2));
}

const [,, resource, action, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!resource || resource === '--help') {
  console.log(`Usage: node src/tools/gmail.js <resource> <action> [options]

Resources:
  draft   create | list
  inbox   search
  thread  read
  message read

Examples:
  node src/tools/gmail.js draft create --to foo@bar.com --subject "Hi" --body "Hello"
  node src/tools/gmail.js inbox search --query "newer_than:7d in:inbox"
  node src/tools/gmail.js thread read --id <threadId>

Auth: Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in .env.
See README.md for OAuth setup.`);
  process.exit(0);
}

const routes = {
  'draft:create': draftCreate,
  'draft:list': draftList,
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

handler(opts).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
