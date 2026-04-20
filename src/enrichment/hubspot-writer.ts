/**
 * HubSpot writer — creates enriched contacts and attaches review notes.
 */

import { EnrichmentConfig } from '../enrichment.config.ts';
import { HubSpotApiError, type createHubSpotRequest } from '../lib/hubspot-api.ts';
import type {
  CanonicalRow,
  DedupResult,
  EnrichmentResult,
  LeadSource,
} from './types.ts';

type HubSpotRequest = ReturnType<typeof createHubSpotRequest>;

interface ContactCreateResponse {
  id: string;
  properties: Record<string, string | null>;
}

export async function createEnrichedContact(
  row: CanonicalRow,
  enrichment: EnrichmentResult,
  source: LeadSource,
  dedup: DedupResult,
  request: HubSpotRequest,
  isDryRun: boolean,
): Promise<{ contactId: string | null; error?: string }> {
  const properties: Record<string, string> = {
    firstname: row.first_name,
    lastname: row.last_name,
    company: row.firm_name,
    hs_lead_status: EnrichmentConfig.defaultLeadStatus,
    lead_source: source,
    enrichment_date: new Date().toISOString(),
  };

  if (row.title) properties.jobtitle = row.title;
  if (enrichment.email) properties.email = enrichment.email;
  if (row.website) properties.website = row.website;
  if (row.linkedin_url) properties.hs_linkedin_url = row.linkedin_url;
  if (row.city) properties.city = row.city;
  if (row.state) properties.state = row.state;
  if (row.phone) properties.phone = row.phone;
  if (row.practice_area) {
    properties.practice_area = matchPracticeArea(row.practice_area);
  }

  // Map enrichment confidence
  if (enrichment.email) {
    properties.enrichment_confidence = enrichment.confidence;
  } else {
    properties.enrichment_confidence = 'not_found';
  }

  if (isDryRun) {
    console.error(
      `[dry-run] Would create contact: ${row.first_name} ${row.last_name} at ${row.firm_name}`,
    );
    console.error(`[dry-run] Properties: ${JSON.stringify(properties)}`);
    return { contactId: 'dry-run' };
  }

  try {
    const data = await request<ContactCreateResponse>(
      'POST',
      '/crm/v3/objects/contacts',
      { properties },
    );

    // If fuzzy match flagged for review, create a note
    if (dedup.action === 'review' && data.id) {
      await createReviewNote(data.id, dedup, request);
    }

    return { contactId: data.id };
  } catch (err) {
    if (err instanceof HubSpotApiError && err.statusCode === 409) {
      return { contactId: null, error: 'hubspot_409' };
    }
    throw err;
  }
}

/**
 * Match a raw practice area string to a HubSpot dropdown internal value.
 *
 * 1. Exact label match (case-insensitive)
 * 2. Keyword match against practiceAreaKeywords config
 * 3. Falls back to "other"
 */
function matchPracticeArea(raw: string): string {
  const normalized = raw.trim().toLowerCase();

  // Exact label match
  for (const [label, internalName] of Object.entries(EnrichmentConfig.practiceAreas)) {
    if (label.toLowerCase() === normalized) return internalName;
  }

  // Keyword match — all keywords in a rule must appear in the input
  for (const rule of EnrichmentConfig.practiceAreaKeywords) {
    if (rule.keywords.every((kw) => normalized.includes(kw))) {
      return rule.value;
    }
  }

  console.error(`[enrichment] No practice area match for "${raw}" — using "other"`);
  return 'other';
}

async function createReviewNote(
  contactId: string,
  dedup: DedupResult,
  request: HubSpotRequest,
): Promise<void> {
  const confidence = dedup.confidence?.toFixed(2) ?? 'unknown';
  const matchedId = dedup.matchedContactId ?? 'unknown';
  const body = `Enrichment agent: needs manual review — fuzzy match (confidence: ${confidence}) against existing contact ${matchedId}`;

  await request('POST', '/crm/v3/objects/notes', {
    properties: {
      hs_note_body: body,
      hs_timestamp: Date.now(),
    },
    associations: [
      {
        to: { id: contactId },
        types: [
          { associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 },
        ],
      },
    ],
  });
}
