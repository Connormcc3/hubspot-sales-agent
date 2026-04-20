/**
 * Logger — accumulates row-level log entries and generates run summaries.
 * Writes console summary to stderr and per-file log to leads/processed/.
 */

import { writeFileSync } from 'node:fs';
import type { CsvError, LogEntry, OutcomeType, RunSummary } from './types.ts';

export class EnrichmentLogger {
  private entries: LogEntry[] = [];
  private filename: string;
  private startedAt: string;

  constructor(filename: string) {
    this.filename = filename;
    this.startedAt = new Date().toISOString();
  }

  addEntry(entry: LogEntry): void {
    this.entries.push(entry);
  }

  getSummary(): RunSummary {
    const completedAt = new Date().toISOString();

    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    let flaggedReview = 0;
    let enriched = 0;
    let notEnriched = 0;
    let errors = 0;
    let contactsCreated = 0;
    const emailBreakdown = { verified: 0, risky: 0, unverified: 0 };

    for (const entry of this.entries) {
      switch (entry.outcome) {
        case 'error:invalid_row':
          skippedInvalid++;
          errors++;
          break;
        case 'skip:duplicate:email':
        case 'skip:duplicate:name_firm':
          skippedDuplicate++;
          break;
        case 'review:fuzzy_match':
          flaggedReview++;
          contactsCreated++;
          break;
        case 'ok:verified':
          enriched++;
          contactsCreated++;
          emailBreakdown.verified++;
          break;
        case 'ok:risky':
          enriched++;
          contactsCreated++;
          emailBreakdown.risky++;
          break;
        case 'ok:unverified':
          enriched++;
          contactsCreated++;
          emailBreakdown.unverified++;
          break;
        case 'ok:not_found':
          notEnriched++;
          contactsCreated++;
          break;
        case 'error:hubspot_409':
        case 'error:unexpected':
          errors++;
          break;
      }
    }

    return {
      filename: this.filename,
      startedAt: this.startedAt,
      completedAt,
      totalRows: this.entries.length,
      skippedInvalid,
      skippedDuplicate,
      flaggedReview,
      enriched,
      notEnriched,
      emailBreakdown,
      contactsCreated,
      errors,
    };
  }

  /** Print summary to stderr (console). */
  printSummary(): void {
    const s = this.getSummary();
    const lines = [
      ``,
      `Enrichment Run — ${s.filename}`,
      `Started: ${s.startedAt}`,
      `Completed: ${s.completedAt}`,
      ``,
      `Total rows:         ${pad(s.totalRows)}`,
      `Skipped (invalid):  ${pad(s.skippedInvalid)}   — missing required fields`,
      `Skipped (duplicate): ${pad(s.skippedDuplicate)}  — exact email or high-confidence name+firm match`,
      `Flagged (review):   ${pad(s.flaggedReview)}   — fuzzy match, written to HubSpot with needs_review flag`,
      `Enriched:           ${pad(s.enriched)}   — email found and verified`,
      `Not enriched:       ${pad(s.notEnriched)}   — could not find email (written to HubSpot without email)`,
      ``,
      `Email confidence breakdown (of ${s.enriched} enriched):`,
      `  verified:    ${s.emailBreakdown.verified}`,
      `  risky:       ${s.emailBreakdown.risky}`,
      `  unverified:  ${s.emailBreakdown.unverified}`,
      ``,
      `HubSpot contacts created: ${s.contactsCreated}`,
      `Errors:                   ${s.errors}`,
      ``,
    ];
    console.error(lines.join('\n'));
  }

  /** Write full log (summary + row-level entries) to a file. */
  writeLogFile(logPath: string): void {
    const s = this.getSummary();
    const lines: string[] = [];

    // Summary section
    lines.push(`Enrichment Run — ${s.filename}`);
    lines.push(`Started: ${s.startedAt}`);
    lines.push(`Completed: ${s.completedAt}`);
    lines.push('');
    lines.push(`Total rows:         ${pad(s.totalRows)}`);
    lines.push(`Skipped (invalid):  ${pad(s.skippedInvalid)}`);
    lines.push(`Skipped (duplicate): ${pad(s.skippedDuplicate)}`);
    lines.push(`Flagged (review):   ${pad(s.flaggedReview)}`);
    lines.push(`Enriched:           ${pad(s.enriched)}`);
    lines.push(`Not enriched:       ${pad(s.notEnriched)}`);
    lines.push('');
    lines.push(`Email confidence breakdown (of ${s.enriched} enriched):`);
    lines.push(`  verified:    ${s.emailBreakdown.verified}`);
    lines.push(`  risky:       ${s.emailBreakdown.risky}`);
    lines.push(`  unverified:  ${s.emailBreakdown.unverified}`);
    lines.push('');
    lines.push(`HubSpot contacts created: ${s.contactsCreated}`);
    lines.push(`Errors:                   ${s.errors}`);
    lines.push('');
    lines.push('--- Row-Level Log ---');
    lines.push('');

    // Row-level entries
    for (const entry of this.entries) {
      lines.push(formatLogEntry(entry));
    }

    writeFileSync(logPath, lines.join('\n') + '\n');
  }

  /** Write errored rows to CSV for manual inspection. */
  writeErrorFile(errorPath: string, csvErrors: CsvError[]): void {
    if (csvErrors.length === 0) return;

    const headers = ['row', 'error_reason', 'raw_data'];
    const rows = csvErrors.map((e) => {
      const rawData = e.rawData ? JSON.stringify(e.rawData) : '';
      return [String(e.row), e.reason, rawData]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(',');
    });

    writeFileSync(errorPath, [headers.join(','), ...rows].join('\n') + '\n');
  }
}

function pad(n: number): string {
  return String(n).padStart(3);
}

function formatLogEntry(entry: LogEntry): string {
  const tag = outcomeTag(entry.outcome);
  const name = `${entry.firstName} ${entry.lastName}, ${entry.firmName}`;

  switch (entry.outcome) {
    case 'skip:duplicate:email':
      return `[SKIP:duplicate:email]     ${entry.email ?? ''} — ${name}`;
    case 'skip:duplicate:name_firm':
      return `[SKIP:duplicate:name_firm] — ${name} (confidence: ${entry.confidence?.toFixed(2) ?? '?'})`;
    case 'review:fuzzy_match':
      return `[REVIEW:fuzzy_match]       — ${name} (confidence: ${entry.confidence?.toFixed(2) ?? '?'})`;
    case 'ok:verified':
      return `[OK:verified]              ${entry.email ?? ''} — ${name}`;
    case 'ok:risky':
      return `[OK:risky]                 ${entry.email ?? ''} — ${name}`;
    case 'ok:unverified':
      return `[OK:unverified]            ${entry.email ?? ''} — ${name}`;
    case 'ok:not_found':
      return `[OK:not_found]             — ${name} (no email found)`;
    case 'error:invalid_row':
      return `[ERROR:invalid_row]        Row ${entry.rowNumber} — ${entry.error ?? 'missing fields'}`;
    case 'error:hubspot_409':
      return `[ERROR:hubspot_409]        — ${name} (HubSpot conflict on create)`;
    case 'error:unexpected':
      return `[ERROR:unexpected]         — ${name} (${entry.error ?? 'unknown error'})`;
    default:
      return `[${tag}] ${name}`;
  }
}

function outcomeTag(outcome: OutcomeType): string {
  return outcome.toUpperCase().replace(/:/g, ':');
}
