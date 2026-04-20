export type LeadSource = 'apollo' | 'linkedin' | 'superlawyers';

export interface CanonicalRow {
  first_name: string;
  last_name: string;
  firm_name: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  website?: string;
  city?: string;
  state?: string;
  phone?: string;
  practice_area?: string;
}

export type EmailConfidence =
  | 'verified'
  | 'risky'
  | 'unverified'
  | 'not_found'
  | 'invalid'
  | 'not_attempted';

export interface EnrichmentResult {
  email: string | null;
  confidence: EmailConfidence;
}

export type DedupAction = 'skip' | 'review' | 'proceed';

export interface DedupResult {
  action: DedupAction;
  reason?: string;
  confidence?: number;
  matchedContactId?: string;
}

export type OutcomeType =
  | 'skip:duplicate:email'
  | 'skip:duplicate:name_firm'
  | 'review:fuzzy_match'
  | 'ok:verified'
  | 'ok:risky'
  | 'ok:unverified'
  | 'ok:not_found'
  | 'error:invalid_row'
  | 'error:hubspot_409'
  | 'error:unexpected';

export interface LogEntry {
  rowNumber: number;
  outcome: OutcomeType;
  email?: string;
  firstName: string;
  lastName: string;
  firmName: string;
  confidence?: number;
  error?: string;
}

export interface RunSummary {
  filename: string;
  startedAt: string;
  completedAt: string;
  totalRows: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  flaggedReview: number;
  enriched: number;
  notEnriched: number;
  emailBreakdown: {
    verified: number;
    risky: number;
    unverified: number;
  };
  contactsCreated: number;
  errors: number;
}

export interface CsvError {
  row: number;
  reason: string;
  rawData?: Record<string, string>;
}
