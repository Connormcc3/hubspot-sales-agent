/**
 * Deduplication — checks incoming leads against existing HubSpot contacts.
 *
 * Check 1: Exact email match
 * Check 2: Fuzzy name + firm match (exact last name search, Dice coefficient on firm name)
 */

import { EnrichmentConfig } from '../enrichment.config.ts';
import type { createHubSpotRequest } from '../lib/hubspot-api.ts';
import type { CanonicalRow, DedupResult } from './types.ts';

type HubSpotRequest = ReturnType<typeof createHubSpotRequest>;

interface HubSpotSearchResponse {
  total: number;
  results: Array<{
    id: string;
    properties: Record<string, string | null>;
  }>;
}

/** Strip legal suffixes and normalize firm name for comparison. */
function normalizeFirmName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(law\s+firm|law\s+office|law\s+offices|law\s+group|legal\s+group|llp|llc|plc|apc|pc|pllc|pa|esq)\b/g,
      '',
    )
    .replace(/[^\w\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient (bigram overlap) for string similarity. */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
  }

  let intersections = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2);
    const count = bigramsA.get(bigram);
    if (count && count > 0) {
      bigramsA.set(bigram, count - 1);
      intersections++;
    }
  }

  return (2 * intersections) / (a.length - 1 + (b.length - 1));
}

export async function checkDuplicate(
  row: CanonicalRow,
  request: HubSpotRequest,
): Promise<DedupResult> {
  // Check 1: Exact email match
  if (row.email) {
    const emailResult = await request<HubSpotSearchResponse>(
      'POST',
      '/crm/v3/objects/contacts/search',
      {
        filterGroups: [
          { filters: [{ propertyName: 'email', operator: 'EQ', value: row.email }] },
        ],
        properties: ['firstname', 'lastname', 'email', 'company'],
        limit: 1,
      },
    );

    if (emailResult.total > 0) {
      return {
        action: 'skip',
        reason: 'duplicate:email',
        confidence: 1.0,
        matchedContactId: emailResult.results[0].id,
      };
    }
  }

  // Check 2: Fuzzy name + firm match
  const lastNameResult = await request<HubSpotSearchResponse>(
    'POST',
    '/crm/v3/objects/contacts/search',
    {
      filterGroups: [
        {
          filters: [
            { propertyName: 'lastname', operator: 'EQ', value: row.last_name },
          ],
        },
      ],
      properties: ['firstname', 'lastname', 'email', 'company'],
      limit: 100,
    },
  );

  if (lastNameResult.total === 0) {
    return { action: 'proceed' };
  }

  const normalizedInputFirm = normalizeFirmName(row.firm_name);
  let bestConfidence = 0;
  let bestMatchId: string | undefined;

  for (const contact of lastNameResult.results) {
    const contactFirm = contact.properties.company;
    if (!contactFirm) continue;

    const normalizedContactFirm = normalizeFirmName(contactFirm);
    const firmSimilarity = diceCoefficient(normalizedInputFirm, normalizedContactFirm);

    // Exact last name match + firm similarity scoring (per spec)
    let confidence = 0;
    if (firmSimilarity >= 0.8) {
      confidence = 0.90;
    } else if (firmSimilarity >= 0.6) {
      confidence = 0.75;
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatchId = contact.id;
    }
  }

  if (bestConfidence >= EnrichmentConfig.fuzzySkipThreshold) {
    return {
      action: 'skip',
      reason: 'duplicate:name_firm',
      confidence: bestConfidence,
      matchedContactId: bestMatchId,
    };
  }

  if (bestConfidence >= EnrichmentConfig.fuzzyReviewThreshold) {
    return {
      action: 'review',
      reason: 'fuzzy_match',
      confidence: bestConfidence,
      matchedContactId: bestMatchId,
    };
  }

  return { action: 'proceed' };
}
