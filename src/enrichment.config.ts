export const EnrichmentConfig = {
  // Directories
  inboxDir: 'leads/inbox',
  processedDir: 'leads/processed',
  errorsDir: 'leads/errors',

  // Dedup thresholds
  fuzzySkipThreshold: 0.85,
  fuzzyReviewThreshold: 0.60,

  // Enrichment behavior
  maxPageTextChars: 5000,
  braveRequestDelayMs: 500,
  directoryDomains: [
    'avvo.com',
    'martindale.com',
    'lawyers.com',
    'yelp.com',
    'superlawyers.com',
    'justia.com',
    'findlaw.com',
    'lawinfo.com',
  ],

  // HubSpot
  defaultLeadStatus: 'NEW',

  // Valid practice_area dropdown values in HubSpot (label → internal name).
  // Update this list when new values are added to the HubSpot dropdown.
  practiceAreas: {
    'Elder Law': 'elder_law',
    'Estate & Trust Litigation': 'estate_trust_litigation',
    'Estate Planning': 'estate_planning',
    'Probate': 'probate',
    'Family Law': 'family_law',
    'General Litigation': 'general_litigation',
    'Civil Litigation': 'civil_litigation',
    'Other': 'other',
  } as Record<string, string>,

  // Keywords that map to practice areas for fuzzy matching.
  // Order matters — first match wins, so put more specific patterns first.
  practiceAreaKeywords: [
    { keywords: ['elder'], value: 'elder_law' },
    { keywords: ['estate', 'trust', 'lit'], value: 'estate_trust_litigation' },
    { keywords: ['estate', 'planning'], value: 'estate_planning' },
    { keywords: ['probate', 'conserv'], value: 'probate' },
    { keywords: ['family', 'divorce', 'custody'], value: 'family_law' },
    { keywords: ['general', 'lit'], value: 'general_litigation' },
    { keywords: ['civil', 'lit'], value: 'civil_litigation' },
  ] as Array<{ keywords: string[]; value: string }>,

  // Claude model for extraction
  extractionModel: 'claude-haiku-4-5-20251001',
} as const;
