#!/usr/bin/env node
/**
 * TSV tracking helper for table.tsv — Sales Agent Single Source of Truth.
 *
 * Usage:
 *   node src/tracker.js read                                              → print all emails (JSON array)
 *   node src/tracker.js exists <email>                                    → print "true" or "false"
 *   node src/tracker.js append <tsv-row>                                  → append a tab-separated row
 *   node src/tracker.js update <email> <classification> [draft_id] [hs]   → set reply fields for existing row
 *
 * TSV columns (13 total):
 *   1.  email
 *   2.  firstname
 *   3.  lastname
 *   4.  company
 *   5.  lead_status
 *   6.  notes_summary
 *   7.  draft_id
 *   8.  status                  (drafted | skipped | error | declined | bounced | awaiting_human)
 *   9.  drafted_at              (ISO timestamp of outreach draft)
 *  10.  reply_received_at       (ISO timestamp when reply came in — set by inbox-classifier)
 *  11.  reply_classification    (POSITIVE_INTENT | POSITIVE_MEETING | NEGATIVE_HARD | etc.)
 *  12.  reply_draft_id          (Gmail draft ID of the prepared reply, if any)
 *  13.  hubspot_status_after    (HubSpot lead status after sync, if changed)
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE_PATH = resolve(__dirname, '../table.tsv');

const COLUMNS = [
  'email',
  'firstname',
  'lastname',
  'company',
  'lead_status',
  'notes_summary',
  'draft_id',
  'status',
  'drafted_at',
  'reply_received_at',
  'reply_classification',
  'reply_draft_id',
  'hubspot_status_after',
];
const HEADER = COLUMNS.join('\t');
const NUM_COLS = COLUMNS.length;

function readAllLines() {
  if (!existsSync(TABLE_PATH)) return [];
  return readFileSync(TABLE_PATH, 'utf-8').split('\n').filter(Boolean);
}

function readRows() {
  const lines = readAllLines();
  if (lines.length === 0) return [];
  // skip header
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    // pad short rows (legacy 9-column rows) to current length
    while (cols.length < NUM_COLS) cols.push('');
    return cols;
  });
}

function getEmails() {
  return new Set(readRows().map(cols => (cols[0] || '').trim().toLowerCase()));
}

function emailExists(email) {
  return getEmails().has(email.trim().toLowerCase());
}

function ensureFile() {
  if (!existsSync(TABLE_PATH)) {
    writeFileSync(TABLE_PATH, HEADER + '\n', 'utf-8');
  }
}

function appendRow(row) {
  ensureFile();
  // Normalize email (first column) and pad to NUM_COLS
  const cols = row.split('\t');
  if (cols[0]) cols[0] = cols[0].trim().toLowerCase();
  while (cols.length < NUM_COLS) cols.push('');
  appendFileSync(TABLE_PATH, cols.join('\t') + '\n', 'utf-8');
}

function updateRow(email, classification, replyDraftId = '', hubspotStatusAfter = '') {
  ensureFile();
  const lines = readAllLines();
  if (lines.length === 0) {
    console.error(`update: table.tsv is empty — nothing to update`);
    process.exit(1);
  }

  const targetEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();

  let foundIdx = -1;
  const updatedLines = lines.map((line, idx) => {
    if (idx === 0) return line; // header

    const cols = line.split('\t');
    while (cols.length < NUM_COLS) cols.push('');

    if ((cols[0] || '').trim().toLowerCase() === targetEmail) {
      foundIdx = idx;
      cols[9] = now;                                  // reply_received_at
      cols[10] = classification;                       // reply_classification
      if (replyDraftId) cols[11] = replyDraftId;       // reply_draft_id
      if (hubspotStatusAfter) cols[12] = hubspotStatusAfter; // hubspot_status_after
      return cols.join('\t');
    }

    return cols.join('\t');
  });

  if (foundIdx === -1) {
    console.error(`update: no row found for email "${targetEmail}"`);
    process.exit(1);
  }

  writeFileSync(TABLE_PATH, updatedLines.join('\n') + '\n', 'utf-8');
  console.log(`Updated: ${targetEmail} → ${classification}`);
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'read': {
    const emails = [...getEmails()];
    console.log(JSON.stringify(emails, null, 2));
    break;
  }
  case 'exists': {
    if (!args[0]) { console.error('Usage: tracker.js exists <email>'); process.exit(1); }
    console.log(emailExists(args[0]) ? 'true' : 'false');
    break;
  }
  case 'append': {
    // Support: node tracker.js append "col1\tcol2\t..."
    // or: node tracker.js append col1 col2 col3 ... (space-separated args → joined as TSV)
    const row = args.join('\t');
    if (!row.trim()) { console.error('Usage: tracker.js append <tsv-row>'); process.exit(1); }
    appendRow(row);
    console.log('Appended:', row.split('\t')[0]);
    break;
  }
  case 'update': {
    // node tracker.js update <email> <classification> [reply_draft_id] [hubspot_status_after]
    const [email, classification, replyDraftId, hubspotStatusAfter] = args;
    if (!email || !classification) {
      console.error('Usage: tracker.js update <email> <classification> [reply_draft_id] [hubspot_status_after]');
      process.exit(1);
    }
    updateRow(email, classification, replyDraftId, hubspotStatusAfter);
    break;
  }
  default:
    console.error('Usage: node src/tracker.js read | exists <email> | append <tsv-row> | update <email> <classification> [reply_draft_id] [hubspot_status_after]');
    process.exit(1);
}
