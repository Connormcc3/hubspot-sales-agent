/**
 * Email enrichment pipeline — finds and verifies attorney emails.
 *
 * Step 1: Brave Search — search for attorney email, extract from snippets or find firm website
 * Step 2: Firecrawl — scrape contact/team page for emails (only if snippet extraction missed)
 * Step 3: Claude extraction — identify the target attorney's email from scraped text
 * Step 4: Hunter.io — verify deliverability of candidate email
 */

import Anthropic from '@anthropic-ai/sdk';
import { EnrichmentConfig } from '../enrichment.config.ts';
import type { CanonicalRow, EmailConfidence, EnrichmentResult } from './types.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ─── Provider Circuit Breaker ────────────────────────────────────────────────
// Tracks providers that have exhausted their quota during this run.
// Once marked exhausted, subsequent calls short-circuit without hitting the API.

type Provider = 'brave' | 'firecrawl' | 'anthropic' | 'hunter';
const providerExhausted: Record<Provider, boolean> = {
  brave: false,
  firecrawl: false,
  anthropic: false,
  hunter: false,
};

function markProviderExhausted(provider: Provider, reason: string): void {
  if (!providerExhausted[provider]) {
    providerExhausted[provider] = true;
    console.error(`[enrichment] ⚠ ${provider.toUpperCase()} exhausted (${reason}) — will skip for remaining rows`);
  }
}

/**
 * Wrap fetch with retry logic + clear error identification.
 * Retries transient network errors (fetch failed, ETIMEDOUT, ECONNRESET, etc.)
 * up to 2 times with exponential backoff.
 *
 * Throws a labeled error on final failure so row-level logs show which service died.
 */
async function fetchWithRetry(
  provider: Provider,
  url: string | URL,
  init?: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) break;
      const backoffMs = 500 * Math.pow(2, attempt); // 500ms, 1000ms
      console.error(`[enrichment]   ${provider} fetch failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[${provider}] fetch failed after ${maxRetries + 1} attempts: ${msg}`);
}

/** Detect quota/credit-exhaustion signals from an HTTP response. */
function isQuotaError(statusCode: number, bodyText: string): boolean {
  // 402 Payment Required — almost always "out of credits"
  if (statusCode === 402) return true;
  // 429 Too Many Requests — could be short-term rate limit OR monthly quota
  if (statusCode === 429) {
    const lower = bodyText.toLowerCase();
    if (lower.includes('quota') || lower.includes('credit') || lower.includes('limit') || lower.includes('plan')) {
      return true;
    }
  }
  return false;
}

/** Common legal prefixes to strip before building domain-matching slugs. */
const LEGAL_PREFIXES = /^(law\s+offices?\s+of|offices?\s+of|the\s+law\s+offices?\s+of|the\s+)/i;

/**
 * Build multiple slug candidates for firm-to-domain matching.
 * "Law Offices of Ani Garikian" → ["lawoff", "gariki", "anigar"]
 * "Smith Elder Law" → ["smit he", "smithe"]
 */
function buildFirmSlugs(firmName: string): string[] {
  const normalized = firmName.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const slugs = new Set<string>();

  // Slug from full firm name
  const full = normalized.replace(/\s+/g, '');
  if (full.length >= 4) {
    slugs.add(full.slice(0, Math.min(full.length, 6)));
  }

  // Slug after stripping legal prefixes (handles "Law Offices of X")
  const stripped = normalized.replace(LEGAL_PREFIXES, '').trim().replace(/\s+/g, '');
  if (stripped.length >= 4 && stripped !== full) {
    slugs.add(stripped.slice(0, Math.min(stripped.length, 6)));
  }

  // Also try each significant word (3+ chars) as a slug — catches "Garikian" → "gariki"
  const words = normalized.split(/\s+/).filter(
    (w) => w.length >= 4 && !['law', 'office', 'offices', 'the', 'of', 'and', 'group', 'firm'].includes(w),
  );
  for (const word of words) {
    slugs.add(word.slice(0, Math.min(word.length, 6)));
  }

  return [...slugs];
}

// ─── Brave Search ────────────────────────────────────────────────────────────

const BRAVE_SEARCH_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

interface BraveSearchResult {
  snippetEmails: string[];
  firmWebsiteUrl: string | null;
  /** The firm's domain (e.g., "garikianlaw.com") for pattern inference. */
  firmDomain: string | null;
  /** Specific result URLs from Brave that are on the firm's domain (e.g., attorney profile pages). */
  firmPageUrls: string[];
  /** Top non-directory search result URLs (any domain — state bar, profiles, etc.). */
  topResultUrls: string[];
}

async function searchForAttorney(
  firstName: string,
  lastName: string,
  firmName: string,
): Promise<BraveSearchResult> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    console.error('[enrichment] BRAVE_API_KEY not set, skipping web search');
    return { snippetEmails: [], firmWebsiteUrl: null, firmDomain: null, firmPageUrls: [], topResultUrls: [] };
  }
  if (providerExhausted.brave) {
    return { snippetEmails: [], firmWebsiteUrl: null, firmDomain: null, firmPageUrls: [], topResultUrls: [] };
  }

  const query = `${firstName} ${lastName} ${firmName} attorney email`;
  const params = new URLSearchParams({ q: query, count: '10' });

  const res = await fetchWithRetry('brave', `${BRAVE_SEARCH_ENDPOINT}?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[enrichment] Brave Search error [${res.status}]: ${errorText}`);
    if (isQuotaError(res.status, errorText)) {
      markProviderExhausted('brave', `HTTP ${res.status}`);
    }
    return { snippetEmails: [], firmWebsiteUrl: null, firmDomain: null, firmPageUrls: [], topResultUrls: [] };
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        url: string;
        title: string;
        description?: string;
        extra_snippets?: string[];
      }>;
    };
  };

  const results = data.web?.results ?? [];
  const normalizedFirm = firmName.toLowerCase().replace(/[^\w]/g, '');
  const normalizedFirst = firstName.toLowerCase();
  const normalizedLast = lastName.toLowerCase();

  // Extract emails from all snippets — collect everything, then rank
  const allEmails = new Map<string, number>(); // email → relevance score
  for (const result of results) {
    const textBlob = [result.title, result.description, ...(result.extra_snippets ?? [])].join(' ');
    const found = textBlob.match(EMAIL_REGEX) ?? [];
    for (const email of found) {
      const lower = email.toLowerCase();
      if (allEmails.has(lower)) continue;

      // Skip generic addresses unlikely to be a person
      const localPart = lower.split('@')[0] ?? '';
      if (['info', 'contact', 'office', 'admin', 'support', 'help', 'mail', 'hello'].includes(localPart)) continue;

      // Score by relevance to target attorney
      const domain = lower.split('@')[1] ?? '';
      let score = 1; // base score for any non-generic email
      if (localPart.includes(normalizedLast)) score += 3;
      if (localPart.includes(normalizedFirst)) score += 2;
      if (domain.includes(normalizedFirm.slice(0, Math.min(normalizedFirm.length, 6)))) score += 2;

      allEmails.set(lower, score);
    }
  }

  // Sort by relevance score descending
  const snippetEmails = [...allEmails.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);

  // Build multiple slug candidates from the firm name to improve domain matching.
  // "Law Offices of Ani Garikian" → slugs: ["lawoff", "gariki"] (with and without legal prefix)
  const firmSlugs = buildFirmSlugs(firmName);

  // Collect URLs from search results
  const firmPageUrls: string[] = [];
  const topResultUrls: string[] = [];
  let firmWebsiteUrl: string | null = null;
  let firmDomain: string | null = null;

  for (const result of results) {
    const url = new URL(result.url);
    const domain = url.hostname.toLowerCase();

    // Skip blocked directory sites
    if (EnrichmentConfig.directoryDomains.some((d) => domain.includes(d))) continue;

    // Keep all non-directory result URLs (state bar pages, profiles, etc.)
    if (topResultUrls.length < 5) {
      topResultUrls.push(result.url);
    }

    const domainClean = domain.replace(/[^\w]/g, '');
    const isFirmDomain = firmSlugs.some((slug) => domainClean.includes(slug));

    if (isFirmDomain) {
      if (!firmPageUrls.includes(result.url)) {
        firmPageUrls.push(result.url);
      }
      // Always capture firmDomain from the first firm-domain match (independent of firmWebsiteUrl)
      if (!firmDomain) {
        firmDomain = url.hostname.replace(/^www\./, '');
      }
      if (!firmWebsiteUrl) {
        firmWebsiteUrl = `${url.protocol}//${url.hostname}`;
      }
    } else if (!firmWebsiteUrl) {
      firmWebsiteUrl = `${url.protocol}//${url.hostname}`;
    }
  }

  // Log what Brave returned
  console.error(`[enrichment]   Brave returned ${results.length} results:`);
  for (const r of results.slice(0, 5)) {
    console.error(`[enrichment]     - ${r.url}`);
  }
  if (snippetEmails.length > 0) {
    console.error(`[enrichment]   Snippet emails: ${snippetEmails.join(', ')}`);
  }

  return { snippetEmails, firmWebsiteUrl, firmDomain, firmPageUrls, topResultUrls };
}

// ─── Firecrawl ───────────────────────────────────────────────────────────────

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v1/scrape';

/**
 * Scrape a single URL via Firecrawl. Returns markdown text or null.
 */
async function scrapeUrl(url: string, apiKey: string): Promise<string | null> {
  if (providerExhausted.firecrawl) return null;

  const res = await fetchWithRetry('firecrawl', FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    if (isQuotaError(res.status, errorText)) {
      markProviderExhausted('firecrawl', `HTTP ${res.status}`);
    }
    return null;
  }

  const data = (await res.json()) as {
    success: boolean;
    data?: { markdown?: string };
  };

  if (data.success && data.data?.markdown) {
    return data.data.markdown.slice(0, EnrichmentConfig.maxPageTextChars);
  }
  return null;
}

/**
 * Scrape firm pages looking for one that contains email addresses.
 *
 * Strategy:
 * 1. Try specific URLs Brave returned (e.g., attorney profile pages, state bar pages)
 * 2. Try common subpaths on the firm's base domain
 * 3. Prefer pages that actually contain an @ sign (email-bearing pages)
 * 4. Fall back to any page with content if no email-bearing page found
 */
async function scrapeFirmPages(
  firmWebsiteUrl: string | null,
  firmPageUrls: string[],
  topResultUrls: string[],
): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('[enrichment] FIRECRAWL_API_KEY not set, skipping scrape');
    return null;
  }
  if (providerExhausted.firecrawl) {
    return null;
  }

  // Build ordered list of URLs to try:
  // 1. Specific firm pages Brave found (attorney profiles, etc.)
  // 2. Top search result URLs (state bar pages, legal profiles, etc.)
  // 3. Common subpaths on the firm's base domain
  const subpathUrls: string[] = [];
  if (firmWebsiteUrl) {
    const base = firmWebsiteUrl.replace(/\/$/, '');
    const subpaths = ['/contact', '/contact-us', '/attorneys', '/our-team', '/team', '/about', '/people', '/staff', ''];
    for (const p of subpaths) {
      subpathUrls.push(base + p);
    }
  }

  // Deduplicate, keeping order (firm pages → top results → subpaths)
  const seen = new Set<string>();
  const urlsToTry: string[] = [];
  for (const url of [...firmPageUrls, ...topResultUrls, ...subpathUrls]) {
    const normalized = url.replace(/\/$/, '');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urlsToTry.push(url);
    }
  }

  let fallbackText: string | null = null;

  for (const url of urlsToTry) {
    const text = await scrapeUrl(url, apiKey);
    if (!text) continue;

    // Check if this page actually contains an email address
    if (EMAIL_REGEX.test(text)) {
      console.error(`[enrichment]   Firecrawl found email-bearing page: ${url}`);
      return text;
    }

    // Keep first successful page as fallback
    if (!fallbackText) {
      fallbackText = text;
    }
  }

  if (fallbackText) {
    console.error(`[enrichment]   Firecrawl: no page with email found, using fallback content`);
  } else {
    console.error(`[enrichment]   Firecrawl: all pages failed to load`);
  }
  return fallbackText;
}

// ─── Claude Extraction ───────────────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are extracting attorney contact information from scraped law firm website text.
Respond with JSON only. No explanation, no markdown, no preamble.

Output schema:
{
  "email": "found@email.com or null",
  "email_source": "direct" | "inferred" | null,
  "confidence": "high" | "medium" | "low" | null
}

Rules:
- "direct": email appears explicitly on the page
- "inferred": email follows a clear pattern visible elsewhere on the page
  (e.g., two other attorneys have firstname@firmname.com format)
- Never invent an email with no evidence
- If multiple emails found, return the one most likely to belong to the target attorney
- If you cannot determine which email belongs to the target, return null`;

interface ExtractionResult {
  email: string | null;
  email_source: 'direct' | 'inferred' | null;
  confidence: 'high' | 'medium' | 'low' | null;
}

async function extractEmail(
  firstName: string,
  lastName: string,
  firmName: string,
  pageText: string,
): Promise<ExtractionResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[enrichment] ANTHROPIC_API_KEY not set, skipping extraction');
    return null;
  }
  if (providerExhausted.anthropic) return null;

  const client = new Anthropic({ apiKey });
  const userPrompt = `Target attorney: ${firstName} ${lastName} at ${firmName}\n\nPage content:\n${pageText}`;

  let response;
  try {
    response = await client.messages.create({
      model: EnrichmentConfig.extractionModel,
      max_tokens: 256,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const statusCode = (err as { status?: number }).status ?? 0;
    console.error(`[enrichment] Anthropic error: ${msg}`);
    if (isQuotaError(statusCode, msg)) {
      markProviderExhausted('anthropic', `HTTP ${statusCode}`);
    }
    return null;
  }

  const text =
    response.content[0].type === 'text' ? response.content[0].text : null;
  if (!text) return null;

  // Strip markdown code fences if present (e.g. ```json ... ```)
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned) as ExtractionResult;
  } catch {
    console.error('[enrichment] Failed to parse Claude extraction response:', text);
    return null;
  }
}

// ─── Hunter.io Verification ──────────────────────────────────────────────────

const HUNTER_VERIFY_ENDPOINT = 'https://api.hunter.io/v2/email-verifier';

async function verifyEmail(email: string): Promise<EmailConfidence> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.error('[enrichment] HUNTER_API_KEY not set, skipping verification');
    return 'not_attempted';
  }
  if (providerExhausted.hunter) return 'not_attempted';

  const params = new URLSearchParams({ email, api_key: apiKey });

  const res = await fetchWithRetry('hunter', `${HUNTER_VERIFY_ENDPOINT}?${params}`);
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[enrichment] Hunter.io error [${res.status}]: ${errorText}`);
    if (isQuotaError(res.status, errorText)) {
      markProviderExhausted('hunter', `HTTP ${res.status}`);
    }
    return 'not_attempted';
  }

  const data = (await res.json()) as {
    data?: { result?: string };
  };

  const result = data.data?.result;
  switch (result) {
    case 'deliverable':
      return 'verified';
    case 'risky':
      return 'risky';
    case 'undeliverable':
      return 'invalid';
    case 'unknown':
    default:
      return 'unverified';
  }
}

// ─── Pattern Inference ───────────────────────────────────────────────────────

/**
 * Generate candidate email addresses from name + firm domain and verify each.
 * Common patterns at law firms: first@, flast@, first.last@, firstlast@, finitial.last@
 */
async function inferEmailByPattern(
  firstName: string,
  lastName: string,
  firmDomain: string,
): Promise<EnrichmentResult> {
  const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const initial = first.charAt(0);

  const candidates = [
    `${first}@${firmDomain}`,
    `${first}.${last}@${firmDomain}`,
    `${initial}${last}@${firmDomain}`,
    `${first}${last}@${firmDomain}`,
    `${initial}.${last}@${firmDomain}`,
    `${last}@${firmDomain}`,
  ];

  console.error(`[enrichment]   Trying pattern inference on ${firmDomain}: ${candidates.join(', ')}`);

  for (const candidate of candidates) {
    const confidence = await verifyEmail(candidate);
    if (confidence === 'verified' || confidence === 'risky') {
      console.error(`[enrichment]   ✓ Pattern match verified: ${candidate} (${confidence})`);
      return { email: candidate, confidence };
    }
  }

  console.error(`[enrichment]   ✗ No pattern matched`);
  return { email: null, confidence: 'not_found' };
}

// ─── Composed Pipeline ───────────────────────────────────────────────────────

export async function enrichEmail(row: CanonicalRow): Promise<EnrichmentResult> {
  // If email already exists from source, just verify it
  if (row.email) {
    const confidence = await verifyEmail(row.email);
    if (confidence === 'invalid') {
      // Discard invalid email per spec
      return { email: null, confidence: 'invalid' };
    }
    return { email: row.email, confidence };
  }

  console.error(`[enrichment]   Searching: ${row.first_name} ${row.last_name} at ${row.firm_name}`);

  // Step 1: Brave Search — search for email in snippets + find firm website
  const { snippetEmails, firmWebsiteUrl, firmDomain, firmPageUrls, topResultUrls } = await searchForAttorney(
    row.first_name,
    row.last_name,
    row.firm_name,
  );
  await sleep(EnrichmentConfig.braveRequestDelayMs);

  // Fast path: if we found an email in search snippets, verify and return
  if (snippetEmails.length > 0) {
    for (const candidateEmail of snippetEmails) {
      const confidence = await verifyEmail(candidateEmail);
      if (confidence !== 'invalid') {
        console.error(`[enrichment]   ✓ Found email from snippet: ${candidateEmail} (${confidence})`);
        return { email: candidateEmail, confidence };
      }
    }
    console.error(`[enrichment]   Snippet emails all invalid, falling through to scrape`);
  }

  if (!firmWebsiteUrl && firmPageUrls.length === 0 && topResultUrls.length === 0) {
    console.error(`[enrichment]   ✗ No URLs to scrape`);
    if (firmDomain) {
      return inferEmailByPattern(row.first_name, row.last_name, firmDomain);
    }
    return { email: null, confidence: 'not_found' };
  }

  // Step 2: Firecrawl — scrape pages (firm pages → top results → subpaths)
  const pageText = await scrapeFirmPages(firmWebsiteUrl, firmPageUrls, topResultUrls);
  if (!pageText) {
    if (firmDomain) {
      return inferEmailByPattern(row.first_name, row.last_name, firmDomain);
    }
    return { email: null, confidence: 'not_found' };
  }

  // Step 3: Claude extraction — identify attorney's email
  const extraction = await extractEmail(
    row.first_name,
    row.last_name,
    row.firm_name,
    pageText,
  );

  if (extraction?.email) {
    console.error(`[enrichment]   Claude extracted: ${extraction.email} (source: ${extraction.email_source}, confidence: ${extraction.confidence})`);

    // Step 4: Hunter.io — verify the candidate email
    const confidence = await verifyEmail(extraction.email);
    if (confidence !== 'invalid') {
      console.error(`[enrichment]   ✓ Verified: ${extraction.email} (${confidence})`);
      return { email: extraction.email.trim().toLowerCase(), confidence };
    }
    console.error(`[enrichment]   ✗ Hunter.io: Claude's email is undeliverable`);
  } else {
    console.error(`[enrichment]   ✗ Claude could not extract email from page text`);
  }

  // Step 5: Pattern inference fallback — try common email patterns on firm domain
  if (firmDomain) {
    return inferEmailByPattern(row.first_name, row.last_name, firmDomain);
  }

  return { email: null, confidence: 'not_found' };
}
