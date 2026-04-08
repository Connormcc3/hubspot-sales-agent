#!/usr/bin/env node
/**
 * TSV tracking helper for table.tsv
 * Mirrors Karpathy's autoresearch results.tsv pattern.
 *
 * Usage:
 *   node src/tracker.js read                    → print all emails in table.tsv (JSON array)
 *   node src/tracker.js exists <email>          → print "true" or "false"
 *   node src/tracker.js append <tsv-row>        → append a tab-separated row to table.tsv
 *
 * TSV columns: email, firstname, lastname, company, lead_status, notes_summary, draft_id, status, drafted_at
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TABLE_PATH = resolve(__dirname, '../table.tsv');

const HEADER = 'email\tfirstname\tlastname\tcompany\tlead_status\tnotes_summary\tdraft_id\tstatus\tdrafted_at';

function readRows() {
  if (!existsSync(TABLE_PATH)) return [];
  const lines = readFileSync(TABLE_PATH, 'utf-8').split('\n').filter(Boolean);
  // skip header
  return lines.slice(1).map(line => line.split('\t'));
}

function getEmails() {
  return new Set(readRows().map(cols => (cols[0] || '').trim().toLowerCase()));
}

function emailExists(email) {
  return getEmails().has(email.trim().toLowerCase());
}

function appendRow(row) {
  // Ensure file exists with header
  if (!existsSync(TABLE_PATH)) {
    writeFileSync(TABLE_PATH, HEADER + '\n', 'utf-8');
  }
  // Normalize the email in the row (first column)
  const cols = row.split('\t');
  if (cols[0]) cols[0] = cols[0].trim().toLowerCase();
  appendFileSync(TABLE_PATH, cols.join('\t') + '\n', 'utf-8');
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
  default:
    console.error('Usage: node src/tracker.js read | exists <email> | append <tsv-row>');
    process.exit(1);
}
