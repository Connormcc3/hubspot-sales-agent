/**
 * CSV reader — parses Apollo and LinkedIn Sales Navigator CSV exports,
 * normalizes column names to canonical fields, and validates required fields.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { CanonicalRow, CsvError, LeadSource } from './types.ts';

/** Apollo export columns → canonical field names */
const APOLLO_COLUMN_MAP: Record<string, keyof CanonicalRow> = {
  'first name': 'first_name',
  'last name': 'last_name',
  company: 'firm_name',
  title: 'title',
  email: 'email',
  'linkedin url': 'linkedin_url',
  website: 'website',
  city: 'city',
  state: 'state',
};

/** Super Lawyers export columns → canonical field names */
const SUPERLAWYERS_COLUMN_MAP: Record<string, keyof CanonicalRow> = {
  'first name': 'first_name',
  'last name': 'last_name',
  'law firm': 'firm_name',
  'field of law': 'practice_area',
  city: 'city',
  phone: 'phone',
};

/** LinkedIn Sales Navigator export columns → canonical field names */
const LINKEDIN_COLUMN_MAP: Record<string, keyof CanonicalRow> = {
  'first name': 'first_name',
  'last name': 'last_name',
  company: 'firm_name',
  title: 'title',
  'email address': 'email',
  'linkedin profile': 'linkedin_url',
  website: 'website',
  location: 'city',
};

const FILENAME_PATTERN = /^(apollo|linkedin|superlawyers)_\d{4}-\d{2}-\d{2}(_.+)?\.csv$/;

export function parseFilename(filePath: string): { source: LeadSource; filename: string } | null {
  const filename = basename(filePath);
  const match = filename.match(FILENAME_PATTERN);
  if (!match) return null;
  return { source: match[1] as LeadSource, filename };
}

export function parseLeadFile(
  filePath: string,
  source: LeadSource,
): { valid: CanonicalRow[]; errors: CsvError[] } {
  const content = readFileSync(filePath, 'utf-8');
  const columnMaps: Record<LeadSource, Record<string, keyof CanonicalRow>> = {
    apollo: APOLLO_COLUMN_MAP,
    linkedin: LINKEDIN_COLUMN_MAP,
    superlawyers: SUPERLAWYERS_COLUMN_MAP,
  };
  const columnMap = columnMaps[source];

  const rawRows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  const valid: CanonicalRow[] = [];
  const errors: CsvError[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    const rowNumber = i + 2; // +2 because row 1 is headers, csv-parse is 0-indexed

    // Normalize column names to canonical fields
    const normalized: Partial<CanonicalRow> = {};
    for (const [rawCol, rawVal] of Object.entries(rawRow)) {
      const canonicalField = columnMap[rawCol.toLowerCase()];
      if (canonicalField && rawVal) {
        normalized[canonicalField] = rawVal;
      }
    }

    const firstName = normalized.first_name?.trim();
    const lastName = normalized.last_name?.trim();
    const firmName = normalized.firm_name?.trim();

    // Skip silently if all three key fields are blank
    if (!firstName && !lastName && !firmName) {
      continue;
    }

    // Validate required fields
    if (!firstName || !lastName || !firmName) {
      const missing: string[] = [];
      if (!firstName) missing.push('first_name');
      if (!lastName) missing.push('last_name');
      if (!firmName) missing.push('firm_name');
      errors.push({
        row: rowNumber,
        reason: `missing ${missing.join(', ')}`,
        rawData: rawRow,
      });
      continue;
    }

    const row: CanonicalRow = {
      first_name: firstName,
      last_name: lastName,
      firm_name: firmName,
    };

    if (normalized.title) row.title = normalized.title;
    if (normalized.email) row.email = normalized.email.trim().toLowerCase();
    if (normalized.linkedin_url) row.linkedin_url = normalized.linkedin_url;
    if (normalized.website) row.website = normalized.website;
    if (normalized.city) row.city = normalized.city;
    if (normalized.state) row.state = normalized.state;
    if (normalized.phone) row.phone = normalized.phone;
    if (normalized.practice_area) row.practice_area = normalized.practice_area;

    valid.push(row);
  }

  return { valid, errors };
}
