/**
 * HubSpot property validator — queries the contact property schema at startup
 * and verifies required custom properties exist before processing any rows.
 *
 * Runs before any row is processed so we fail fast with a clear error message
 * instead of having every row fail individually at write time.
 */

import { EnrichmentConfig } from '../enrichment.config.ts';
import type { createHubSpotRequest } from '../lib/hubspot-api.ts';

type HubSpotRequest = ReturnType<typeof createHubSpotRequest>;

interface PropertyOption {
  label: string;
  value: string;
}

interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  options?: PropertyOption[];
}

interface PropertySchemaResponse {
  results: HubSpotProperty[];
}

interface RequiredProperty {
  name: string;
  description: string;
  suggestedType: string;
  /** Internal values that must exist as options if it's an enumeration. */
  requiredOptions?: string[];
}

const REQUIRED_PROPERTIES: RequiredProperty[] = [
  {
    name: 'enrichment_date',
    description: 'Date/time the enrichment agent created this contact',
    suggestedType: 'Date and time picker',
  },
  {
    name: 'enrichment_confidence',
    description: 'Email verification result from Hunter.io',
    suggestedType: 'Dropdown select',
    requiredOptions: ['verified', 'risky', 'unverified', 'not_found'],
  },
  {
    name: 'practice_area',
    description: 'Attorney practice area (source: Field of Law column)',
    suggestedType: 'Dropdown select',
    requiredOptions: Object.values(EnrichmentConfig.practiceAreas),
  },
  {
    name: 'lead_source',
    description: 'Source CSV provider (apollo | linkedin | superlawyers)',
    suggestedType: 'Single-line text (or Dropdown)',
  },
];

export interface ValidationResult {
  ok: boolean;
  missingProperties: string[];
  missingOptions: Array<{ property: string; missingValues: string[] }>;
}

/**
 * Validates that all required custom properties exist in the HubSpot account.
 * Returns a ValidationResult — caller should abort if `ok` is false.
 */
export async function validateHubSpotSchema(
  request: HubSpotRequest,
): Promise<ValidationResult> {
  const schema = await request<PropertySchemaResponse>('GET', '/crm/v3/properties/contacts');
  const existingProps = new Map(schema.results.map((p) => [p.name, p]));

  const missingProperties: string[] = [];
  const missingOptions: Array<{ property: string; missingValues: string[] }> = [];

  for (const required of REQUIRED_PROPERTIES) {
    const prop = existingProps.get(required.name);
    if (!prop) {
      missingProperties.push(required.name);
      continue;
    }

    // Check dropdown options if required
    if (required.requiredOptions && prop.options) {
      const existingValues = new Set(prop.options.map((o) => o.value));
      const missing = required.requiredOptions.filter((v) => !existingValues.has(v));
      if (missing.length > 0) {
        missingOptions.push({ property: required.name, missingValues: missing });
      }
    }
  }

  return {
    ok: missingProperties.length === 0 && missingOptions.length === 0,
    missingProperties,
    missingOptions,
  };
}

/** Pretty-print validation failures with setup instructions. */
export function printValidationErrors(result: ValidationResult): void {
  console.error('');
  console.error('[enrichment] ✗ HubSpot schema validation failed — aborting before any writes.');
  console.error('');

  if (result.missingProperties.length > 0) {
    console.error('Missing custom contact properties:');
    for (const name of result.missingProperties) {
      const required = REQUIRED_PROPERTIES.find((r) => r.name === name)!;
      console.error(`  • ${name}`);
      console.error(`      Description: ${required.description}`);
      console.error(`      Type:        ${required.suggestedType}`);
      if (required.requiredOptions) {
        console.error(`      Options:     ${required.requiredOptions.join(', ')}`);
      }
    }
    console.error('');
  }

  if (result.missingOptions.length > 0) {
    console.error('Dropdown properties missing required option values:');
    for (const { property, missingValues } of result.missingOptions) {
      console.error(`  • ${property} is missing options: ${missingValues.join(', ')}`);
    }
    console.error('');
  }

  console.error('To fix: HubSpot → Settings → Properties → Contact properties → Create property');
  console.error('');
}
