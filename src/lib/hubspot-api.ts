/**
 * Shared HubSpot API utilities — used by both the CLI tool (src/tools/hubspot.ts)
 * and the enrichment agent (src/enrichment/).
 */

import 'dotenv/config';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface ParsedArgs {
  [key: string]: string | true | undefined;
}

export class HubSpotApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(`HubSpot API error [${statusCode}]: ${responseBody}`);
    this.name = 'HubSpotApiError';
  }
}

const API_BASE = 'https://api.hubapi.com';

export function getHubSpotToken(): string {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) {
    throw new Error(
      'HUBSPOT_API_TOKEN not set. Copy .env.example to .env and fill in your Private App token.',
    );
  }
  return token;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createHubSpotRequest(token: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  return async function hubspotRequest<T = unknown>(
    method: HttpMethod,
    path: string,
    body: unknown = null,
  ): Promise<T> {
    const init: RequestInit = { method, headers };
    if (body) init.body = JSON.stringify(body);

    const maxRetries = 2;
    let lastError: unknown;
    let res: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        res = await fetch(`${API_BASE}${path}`, init);
        break;
      } catch (err) {
        lastError = err;
        if (attempt === maxRetries) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`[hubspot] fetch failed after ${maxRetries + 1} attempts: ${msg}`);
        }
        await sleep(500 * Math.pow(2, attempt));
      }
    }

    if (!res) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`[hubspot] fetch failed: ${msg}`);
    }

    const text = await res.text();

    if (!res.ok) {
      throw new HubSpotApiError(res.status, text);
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  };
}

export function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      const val: string | true = next && !next.startsWith('--') ? next : true;
      parsed[key] = val;
      if (val !== true) i++;
    }
  }
  return parsed;
}

export function getString(opts: ParsedArgs, key: string): string | undefined {
  const v = opts[key];
  return typeof v === 'string' ? v : undefined;
}
