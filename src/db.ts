/**
 * Shared SQLite data layer for the tracker.
 *
 * Opens `tracker.db` at module load, runs the schema + indexes idempotently,
 * performs a one-time TSV → SQLite import on first run (when `table.tsv`
 * exists but the DB is empty), then exposes a typed data-layer API consumed
 * by `src/tracker.ts` (CLI) and `src/performance.ts` (analytics).
 *
 * Design notes:
 * - WAL journal mode → non-blocking reads during writes, fixes the v2.5
 *   read-modify-write concurrency bug in `updateRow()`.
 * - `email` is PRIMARY KEY COLLATE NOCASE → case-insensitive dedup for free.
 * - Three indexes: `drafted_at` (performance windowing), `status` (UI filter
 *   pills), `reply_classification` (inbox-classifier queries).
 * - Prepared statements are reused at module scope for hot paths.
 * - The one-time import runs inside a single transaction — any failure rolls
 *   back the DB, leaves the legacy file untouched, and the next invocation
 *   will retry cleanly.
 *
 * See: /Users/marco/.claude/plans/vivid-forging-hippo.md (v2.6 SQLite migration plan).
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../tracker.db');
const LEGACY_TSV_PATH = resolve(__dirname, '../table.tsv');

/**
 * Canonical column list — the single source of truth for the tracker schema.
 * Changing this requires a schema migration. The order matches the TSV layout
 * pre-v2.6 so the legacy import can map positional TSV columns to named fields.
 */
export const COLUMNS = [
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
] as const;

export type ColumnName = (typeof COLUMNS)[number];
export type RowObject = Record<ColumnName, string>;

const NUM_COLS = COLUMNS.length;
const PLACEHOLDERS = COLUMNS.map(() => '?').join(', ');
const COLUMN_LIST = COLUMNS.join(', ');

// ---------------- Module-level initialization ----------------

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tracker (
    email                 TEXT PRIMARY KEY COLLATE NOCASE,
    firstname             TEXT NOT NULL DEFAULT '',
    lastname              TEXT NOT NULL DEFAULT '',
    company               TEXT NOT NULL DEFAULT '',
    lead_status           TEXT NOT NULL DEFAULT '',
    notes_summary         TEXT NOT NULL DEFAULT '',
    draft_id              TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT '',
    drafted_at            TEXT NOT NULL DEFAULT '',
    reply_received_at     TEXT NOT NULL DEFAULT '',
    reply_classification  TEXT NOT NULL DEFAULT '',
    reply_draft_id        TEXT NOT NULL DEFAULT '',
    hubspot_status_after  TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_tracker_drafted_at     ON tracker(drafted_at);
  CREATE INDEX IF NOT EXISTS idx_tracker_status         ON tracker(status);
  CREATE INDEX IF NOT EXISTS idx_tracker_classification ON tracker(reply_classification);
`);

runLegacyImportIfNeeded();

// ---------------- Legacy TSV import (runs at most once per install) ----------------
//
// If a pre-v2.6 `table.tsv` exists alongside an empty DB, import the rows and
// delete the TSV. v2.6.1: no rollback preservation — the project is still in
// testing, there are no users to protect, and carrying a legacy-file safety
// net just adds noise. If you ever need to roll back, checkout v2.5 and
// re-run the agent from a clean state.

function runLegacyImportIfNeeded(): void {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM tracker').get() as { c: number };
  if (countRow.c > 0) return;
  if (!existsSync(LEGACY_TSV_PATH)) return;

  const content = readFileSync(LEGACY_TSV_PATH, 'utf-8');
  const lines = content.split('\n').filter((line) => line.length > 0);
  // lines[0] is the TSV header; data starts at index 1
  const dataLines = lines.slice(1);

  if (dataLines.length === 0) {
    // Header-only or empty file — just delete so we don't re-check every run.
    try {
      unlinkSync(LEGACY_TSV_PATH);
      console.error('[tracker] Found empty table.tsv (header only). Deleted.');
    } catch {
      console.error('[tracker] Could not delete empty table.tsv. Remove it manually.');
    }
    return;
  }

  const insert = db.prepare(
    `INSERT INTO tracker (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ON CONFLICT(email) DO NOTHING`,
  );

  const importAll = db.transaction((rows: string[][]) => {
    for (const cols of rows) {
      insert.run(...cols);
    }
  });

  const parsedRows: string[][] = dataLines.map((line) => {
    const cols = line.split('\t');
    while (cols.length < NUM_COLS) cols.push('');
    if (cols.length > NUM_COLS) cols.length = NUM_COLS;
    cols[0] = (cols[0] || '').trim().toLowerCase();
    return cols;
  });

  try {
    importAll(parsedRows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tracker] Import failed: ${message}. DB rolled back. table.tsv left in place — fix the issue and retry.`);
    return;
  }

  try {
    unlinkSync(LEGACY_TSV_PATH);
    console.error(
      `[tracker] Imported ${parsedRows.length} rows from table.tsv → tracker.db. table.tsv deleted.`,
    );
  } catch {
    console.error(
      `[tracker] Imported ${parsedRows.length} rows from table.tsv → tracker.db. Warning: could not delete table.tsv; remove it manually to prevent re-import attempts.`,
    );
  }
}

// ---------------- Prepared statements (reused across calls) ----------------

const stmtAllRows = db.prepare(`SELECT ${COLUMN_LIST} FROM tracker ORDER BY drafted_at ASC`);
const stmtAllEmails = db.prepare('SELECT email FROM tracker');
const stmtEmailExists = db.prepare('SELECT 1 FROM tracker WHERE email = ? LIMIT 1');
const stmtRowsInWindow = db.prepare(
  `SELECT ${COLUMN_LIST} FROM tracker
   WHERE drafted_at >= ? AND drafted_at <= ?
   ORDER BY drafted_at ASC`,
);
const stmtInsertRow = db.prepare(
  `INSERT INTO tracker (${COLUMN_LIST}) VALUES (${PLACEHOLDERS}) ON CONFLICT(email) DO NOTHING`,
);
const stmtUpdateReply = db.prepare(`
  UPDATE tracker SET
    reply_received_at    = ?,
    reply_classification = ?,
    reply_draft_id       = COALESCE(NULLIF(?, ''), reply_draft_id),
    hubspot_status_after = COALESCE(NULLIF(?, ''), hubspot_status_after)
  WHERE email = ?
`);

// ---------------- Public data-layer API ----------------

export function allRows(): RowObject[] {
  return stmtAllRows.all() as RowObject[];
}

export function allEmails(): string[] {
  const rows = stmtAllEmails.all() as { email: string }[];
  return rows.map((r) => r.email);
}

export function emailExists(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return stmtEmailExists.get(normalized) !== undefined;
}

/**
 * Returns rows with `drafted_at` in `[startIso, endIso]`, ordered ascending.
 * Both bounds are inclusive. Uses the `idx_tracker_drafted_at` index for an
 * indexed range scan — no full-table read. Used by src/performance.ts.
 */
export function rowsInWindow(startIso: string, endIso: string): RowObject[] {
  return stmtRowsInWindow.all(startIso, endIso) as RowObject[];
}

/**
 * Append a row from a pre-split column array. The caller is responsible for
 * ordering the columns to match `COLUMNS`. Missing columns are padded with
 * empty strings; extras are truncated. The email (col 0) is normalized to
 * lowercase + trimmed before insert.
 *
 * Uses ON CONFLICT(email) DO NOTHING — calling append twice for the same
 * email is a no-op, matching the v2.5 behavior where the follow-up-loop's
 * tracker check prevents double-drafting.
 */
export function appendRow(cols: string[]): void {
  const padded = cols.slice(0, NUM_COLS);
  while (padded.length < NUM_COLS) padded.push('');
  padded[0] = (padded[0] || '').trim().toLowerCase();
  stmtInsertRow.run(...padded);
}

/**
 * Update the reply_* fields of an existing row. Returns true if a row was
 * matched and updated, false if the email doesn't exist.
 *
 * `reply_received_at` is always set to the current ISO timestamp. Empty-string
 * values for `replyDraftId` / `hubspotStatusAfter` leave the existing column
 * value alone (matches v2.5 semantics via COALESCE(NULLIF(...), ...)).
 */
export function updateReplyFields(
  email: string,
  classification: string,
  replyDraftId: string = '',
  hubspotStatusAfter: string = '',
): boolean {
  const normalized = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const result = stmtUpdateReply.run(
    now,
    classification,
    replyDraftId,
    hubspotStatusAfter,
    normalized,
  );
  return result.changes > 0;
}
