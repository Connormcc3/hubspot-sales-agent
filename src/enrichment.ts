#!/usr/bin/env node
/**
 * Enrichment Agent CLI — reads lead CSVs, deduplicates against HubSpot,
 * enriches emails, and writes clean contacts to HubSpot.
 *
 * Usage:
 *   tsx src/enrichment.ts run                              Process all files in leads/inbox/
 *   tsx src/enrichment.ts run --dry-run                    Process without writing to HubSpot or moving files
 *   tsx src/enrichment.ts run --file leads/inbox/file.csv  Process a single file
 *
 * File naming: {source}_{YYYY-MM-DD}[_N].csv  (source: apollo | linkedin | superlawyers)
 */

import 'dotenv/config';
import { readdirSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { EnrichmentConfig } from './enrichment.config.ts';
import { createHubSpotRequest, getHubSpotToken, parseArgs, getString } from './lib/hubspot-api.ts';
import { parseFilename, parseLeadFile } from './enrichment/csv-reader.ts';
import { checkDuplicate } from './enrichment/dedup.ts';
import { enrichEmail } from './enrichment/email-enrichment.ts';
import { createEnrichedContact } from './enrichment/hubspot-writer.ts';
import { validateHubSpotSchema, printValidationErrors } from './enrichment/hubspot-validator.ts';
import { EnrichmentLogger } from './enrichment/logger.ts';
import type { LogEntry, OutcomeType } from './enrichment/types.ts';

const [, , command, ...rest] = process.argv;
const opts = parseArgs(rest);

if (!command || command === '--help') {
  console.log(`Usage: tsx src/enrichment.ts <command> [options]

Commands:
  run                              Process all CSV files in leads/inbox/
  run --dry-run                    Process files without writing to HubSpot or moving files
  run --file <path>                Process a single CSV file

File naming convention:
  {source}_{YYYY-MM-DD}[_N].csv   source: apollo | linkedin | superlawyers
  Examples: apollo_2026-04-17.csv, linkedin_2026-04-17_2.csv, superlawyers_2026-04-17.csv`);
  process.exit(0);
}

if (command !== 'run') {
  console.error(`Unknown command: ${command}. Run with --help for usage.`);
  process.exit(1);
}

const isDryRun = opts['dry-run'] === true;
const singleFile = getString(opts, 'file');

async function run(): Promise<void> {
  // Initialize HubSpot API client
  const token = getHubSpotToken();
  const hubspotRequest = createHubSpotRequest(token);

  // Validate HubSpot custom property schema before processing any rows.
  // In dry-run mode we skip this since we aren't writing to HubSpot.
  if (!isDryRun) {
    console.error('[enrichment] Validating HubSpot custom property schema...');
    const validation = await validateHubSpotSchema(hubspotRequest);
    if (!validation.ok) {
      printValidationErrors(validation);
      process.exit(1);
    }
    console.error('[enrichment] ✓ Schema validation passed');
  }

  // Determine which files to process
  let filePaths: string[];
  if (singleFile) {
    filePaths = [singleFile];
  } else {
    const inboxFiles = readdirSync(EnrichmentConfig.inboxDir).filter(
      (f) => f.endsWith('.csv'),
    );
    filePaths = inboxFiles.map((f) => join(EnrichmentConfig.inboxDir, f));
  }

  if (filePaths.length === 0) {
    console.error('[enrichment] No CSV files found in leads/inbox/');
    return;
  }

  console.error(`[enrichment] Found ${filePaths.length} file(s) to process`);
  if (isDryRun) console.error('[enrichment] DRY RUN — no writes to HubSpot, no file moves');

  for (const filePath of filePaths) {
    await processFile(filePath, hubspotRequest);
  }
}

async function processFile(
  filePath: string,
  hubspotRequest: ReturnType<typeof createHubSpotRequest>,
): Promise<void> {
  const parsed = parseFilename(filePath);
  if (!parsed) {
    console.error(
      `[enrichment] Skipping ${basename(filePath)} — filename does not match pattern {source}_{YYYY-MM-DD}.csv`,
    );
    return;
  }

  const { source, filename } = parsed;
  console.error(`\n[enrichment] Processing ${filename} (source: ${source})`);

  const logger = new EnrichmentLogger(filename);

  // Install SIGINT handler to flush log file on Ctrl+C so you can see what happened
  const sigintHandler = () => {
    console.error(`\n[enrichment] Interrupted — flushing partial log to ${EnrichmentConfig.processedDir}/${filename.replace('.csv', '.log')}`);
    const logPath = join(EnrichmentConfig.processedDir, filename.replace('.csv', '.log'));
    try {
      logger.printSummary();
      logger.writeLogFile(logPath);
    } catch {
      // best effort
    }
    process.exit(130); // 128 + SIGINT
  };
  process.on('SIGINT', sigintHandler);

  // Parse CSV
  const { valid: rows, errors: csvErrors } = parseLeadFile(filePath, source);
  console.error(`[enrichment] Parsed ${rows.length} valid rows, ${csvErrors.length} errors`);

  // Log CSV validation errors
  for (const csvError of csvErrors) {
    logger.addEntry({
      rowNumber: csvError.row,
      outcome: 'error:invalid_row',
      firstName: '',
      lastName: '',
      firmName: '',
      error: csvError.reason,
    });
  }

  // Process each valid row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // account for header row

    try {
      // Step 1: Dedup check
      const dedup = await checkDuplicate(row, hubspotRequest);

      if (dedup.action === 'skip') {
        const outcome: OutcomeType =
          dedup.reason === 'duplicate:email'
            ? 'skip:duplicate:email'
            : 'skip:duplicate:name_firm';

        logger.addEntry({
          rowNumber,
          outcome,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          firmName: row.firm_name,
          confidence: dedup.confidence,
        });
        continue;
      }

      // Step 2: Email enrichment
      const enrichment = await enrichEmail(row);

      // Step 3: Write to HubSpot
      const { contactId, error } = await createEnrichedContact(
        row,
        enrichment,
        source,
        dedup,
        hubspotRequest,
        isDryRun,
      );

      if (error === 'hubspot_409') {
        logger.addEntry({
          rowNumber,
          outcome: 'error:hubspot_409',
          email: enrichment.email ?? undefined,
          firstName: row.first_name,
          lastName: row.last_name,
          firmName: row.firm_name,
        });
        continue;
      }

      // Determine outcome type
      let outcome: OutcomeType;
      if (dedup.action === 'review') {
        outcome = 'review:fuzzy_match';
      } else if (enrichment.email) {
        switch (enrichment.confidence) {
          case 'verified':
            outcome = 'ok:verified';
            break;
          case 'risky':
            outcome = 'ok:risky';
            break;
          default:
            outcome = 'ok:unverified';
            break;
        }
      } else {
        outcome = 'ok:not_found';
      }

      const logEntry: LogEntry = {
        rowNumber,
        outcome,
        email: enrichment.email ?? undefined,
        firstName: row.first_name,
        lastName: row.last_name,
        firmName: row.firm_name,
        confidence: dedup.confidence,
      };
      logger.addEntry(logEntry);

      // Per-row confirmation of HubSpot upload
      if (!isDryRun && contactId) {
        console.error(
          `[enrichment] ✓ [${i + 1}/${rows.length}] HubSpot contact ${contactId} created: ${row.first_name} ${row.last_name}${enrichment.email ? ` (${enrichment.email})` : ' (no email)'}`,
        );
      } else if (isDryRun) {
        console.error(`[enrichment] [${i + 1}/${rows.length}] (dry-run) ${row.first_name} ${row.last_name}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[enrichment] ✗ [${i + 1}/${rows.length}] ERROR on ${row.first_name} ${row.last_name}: ${errorMessage}`,
      );
      logger.addEntry({
        rowNumber,
        outcome: 'error:unexpected',
        firstName: row.first_name,
        lastName: row.last_name,
        firmName: row.firm_name,
        error: errorMessage,
      });
    }
  }

  // Loop completed normally — remove the interrupt handler
  process.off('SIGINT', sigintHandler);

  // Print summary
  logger.printSummary();

  // Write log file
  const logPath = join(EnrichmentConfig.processedDir, filename.replace('.csv', '.log'));
  logger.writeLogFile(logPath);
  console.error(`[enrichment] Log written to ${logPath}`);

  // Write error file if there were CSV errors
  if (csvErrors.length > 0) {
    const errorPath = join(EnrichmentConfig.errorsDir, filename);
    logger.writeErrorFile(errorPath, csvErrors);
    console.error(`[enrichment] Error rows written to ${errorPath}`);
  }

  // Move file to processed (unless dry run)
  if (!isDryRun) {
    const destPath = join(EnrichmentConfig.processedDir, filename);
    renameSync(filePath, destPath);
    console.error(`[enrichment] Moved ${filename} to ${EnrichmentConfig.processedDir}/`);
  }
}

run().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[enrichment] Fatal error: ${msg}`);
  process.exit(1);
});
