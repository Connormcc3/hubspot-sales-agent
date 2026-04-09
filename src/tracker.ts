#!/usr/bin/env node
/**
 * TSV tracking helper for table.tsv — Sales Agent Single Source of Truth.
 *
 * As of v2.6, storage is SQLite (tracker.db) via src/db.ts. The CLI surface
 * below is byte-identical to the v2.5 TSV implementation — every skill,
 * prompt, and caller keeps working without changes. A one-time import from
 * the legacy table.tsv happens on first invocation.
 *
 * Usage:
 *   tsx src/tracker.ts read                                              → print all emails (JSON array)
 *   tsx src/tracker.ts rows                                              → print all rows as JSON array of objects
 *   tsx src/tracker.ts exists <email>                                    → print "true" or "false"
 *   tsx src/tracker.ts append <tsv-row>                                  → append a tab-separated row
 *   tsx src/tracker.ts update <email> <classification> [draft_id] [hs]   → set reply fields for existing row
 *   tsx src/tracker.ts export [--format tsv|json] [--out path]           → dump DB to stdout or a file (v2.6)
 *
 * TSV columns (13 total, preserved from v2.5):
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

import { writeFileSync } from 'fs';
import {
  allRows,
  allEmails,
  emailExists,
  appendRow,
  updateReplyFields,
  COLUMNS,
  type RowObject,
} from './db.ts';

// ---------------- Small CLI flag parser (used only by `export`) ----------------

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = 'true';
    }
  }
  return flags;
}

// ---------------- Export formatters ----------------

/**
 * TSV export has one caveat: fields containing tab or newline characters
 * get those characters replaced with a single space. SQLite stores them
 * correctly, but TSV as a wire format can't represent them. Use JSON export
 * for a lossless round-trip.
 */
function rowsToTsv(rows: RowObject[]): string {
  const header = COLUMNS.join('\t');
  const bodyLines = rows.map((row) =>
    COLUMNS.map((col) => (row[col] ?? '').replace(/[\t\n\r]/g, ' ')).join('\t'),
  );
  return [header, ...bodyLines].join('\n') + '\n';
}

function rowsToJson(rows: RowObject[]): string {
  return JSON.stringify(rows, null, 2);
}

// ---------------- CLI dispatch ----------------

const [, , command, ...args] = process.argv;

switch (command) {
  case 'read': {
    console.log(JSON.stringify(allEmails(), null, 2));
    break;
  }
  case 'rows': {
    console.log(JSON.stringify(allRows(), null, 2));
    break;
  }
  case 'exists': {
    if (!args[0]) {
      console.error('Usage: tracker.ts exists <email>');
      process.exit(1);
    }
    console.log(emailExists(args[0]) ? 'true' : 'false');
    break;
  }
  case 'append': {
    // Support: tsx tracker.ts append "col1\tcol2\t..."
    // or:      tsx tracker.ts append col1 col2 col3 ... (space-separated args → joined as TSV)
    const row = args.join('\t');
    if (!row.trim()) {
      console.error('Usage: tracker.ts append <tsv-row>');
      process.exit(1);
    }
    const cols = row.split('\t');
    appendRow(cols);
    console.log('Appended:', cols[0]);
    break;
  }
  case 'update': {
    // tsx tracker.ts update <email> <classification> [reply_draft_id] [hubspot_status_after]
    const [email, classification, replyDraftId, hubspotStatusAfter] = args;
    if (!email || !classification) {
      console.error(
        'Usage: tracker.ts update <email> <classification> [reply_draft_id] [hubspot_status_after]',
      );
      process.exit(1);
    }
    const ok = updateReplyFields(
      email,
      classification,
      replyDraftId ?? '',
      hubspotStatusAfter ?? '',
    );
    if (!ok) {
      console.error(`update: no row found for email "${email.trim().toLowerCase()}"`);
      process.exit(1);
    }
    console.log(`Updated: ${email.trim().toLowerCase()} → ${classification}`);
    break;
  }
  case 'export': {
    const flags = parseFlags(args);
    const format = flags.format ?? 'tsv';
    const outPath = flags.out;

    if (format !== 'tsv' && format !== 'json') {
      console.error(`Unknown format: ${format}. Use --format tsv or --format json.`);
      process.exit(1);
    }

    const rows = allRows();
    const output = format === 'json' ? rowsToJson(rows) : rowsToTsv(rows);

    if (outPath) {
      writeFileSync(outPath, output, 'utf-8');
      console.error(`Exported ${rows.length} rows to ${outPath} (${format}).`);
    } else {
      process.stdout.write(output);
      if (format === 'json') process.stdout.write('\n');
    }
    break;
  }
  default:
    console.error(
      'Usage: tsx src/tracker.ts read | rows | exists <email> | append <tsv-row> | update <email> <classification> [reply_draft_id] [hubspot_status_after] | export [--format tsv|json] [--out path]',
    );
    process.exit(1);
}
