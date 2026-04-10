#!/usr/bin/env node
/**
 * Performance math tool — reads the tracker, filters to a review window,
 * computes per-segment reply/positive rates, and surfaces contrasts between
 * segments.
 *
 * As of v2.6, the tracker is SQLite (tracker.db) and this tool queries it via
 * `rowsInWindow(start, end)` from src/db.ts — an indexed range scan on
 * `drafted_at`. Pre-v2.6 it parsed table.tsv directly.
 *
 * Deterministic math so the weekly report is reproducible. The skill agent
 * (skills/performance-review.md) calls this, interprets the JSON, fetches
 * draft bodies from Gmail, and writes the narrative report.
 *
 * Usage:
 *   tsx src/performance.ts [--window <days>] [--since <ISO>] [--until <ISO>]
 *
 * Defaults:
 *   --window 7     (last 7 days ending now)
 *
 * Emits JSON to stdout with: window, totals, by_lead_status, by_skill,
 * by_lead_status_x_skill, contrasts, data_warnings.
 *
 * Thresholds (non-negotiable without human review — see skills/performance-review.md):
 *   MIN_BUCKET_SIZE = 5     — buckets smaller than this are skipped
 *   MIN_DELTA       = 0.15  — positive-rate delta threshold (15 percentage points)
 *   PROPOSABLE_EVIDENCE = 10 — bucket_n + other_n ≥ this → propose a Section C rule
 */

import { rowsInWindow, type RowObject } from './db.ts';

const MIN_BUCKET_SIZE = 5;
const MIN_DELTA = 0.15;
const PROPOSABLE_EVIDENCE = 10;

type SkillTag =
  | 'follow-up-loop'
  | 'research-outreach'
  | 'compose-reply'
  | 'inbox-classifier'
  | 'cold-outreach'
  | 'unknown';

type Outcome =
  | 'no_reply'
  | 'POSITIVE_INTENT'
  | 'POSITIVE_MEETING'
  | 'POSITIVE_QUESTION'
  | 'NEGATIVE_HARD'
  | 'NEGATIVE_SOFT'
  | 'NEUTRAL'
  | 'BOUNCE'
  | 'SPAM_FLAG'
  | string;

interface Feature {
  email: string;
  leadStatus: string;
  skill: SkillTag;
  rowStatus: string;
  draftId: string;
  draftedAt: string; // ISO
  outcome: Outcome;
  isPositive: boolean;
  isNegative: boolean;
  hasReply: boolean;
}

interface BucketMetrics {
  value: string;
  drafts: number;
  replies: number;
  positive: number;
  negative: number;
  reply_rate: number;
  positive_rate: number;
}

interface CrossMetrics extends BucketMetrics {
  lead_status: string;
  skill: string;
}

interface Contrast {
  base_dim: 'lead_status' | 'skill';
  base_value: string;
  contrast_dim: 'lead_status' | 'skill';
  contrast_value: string;
  bucket_n: number;
  other_n: number;
  bucket_positive_rate: number;
  other_positive_rate: number;
  delta: number;
  proposable: boolean;
  strong: boolean;
}

interface Window {
  start: string;
  end: string;
  days: number | null;
}

interface PerformanceReport {
  window: Window;
  totals: {
    drafts: number;
    replies: number;
    positive: number;
    negative: number;
    reply_rate: number;
    positive_rate: number;
  };
  positive_breakdown: Record<string, number>;
  negative_breakdown: Record<string, number>;
  by_lead_status: BucketMetrics[];
  by_skill: BucketMetrics[];
  by_lead_status_x_skill: CrossMetrics[];
  contrasts: Contrast[];
  data_warnings: string[];
}

interface ParsedArgs {
  [key: string]: string | true | undefined;
}

function parseArgs(args: string[]): ParsedArgs {
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

function getString(opts: ParsedArgs, key: string): string | undefined {
  const v = opts[key];
  return typeof v === 'string' ? v : undefined;
}

function inferSkill(notesSummary: string, rowStatus: string): SkillTag {
  const trimmed = notesSummary.trim();
  if (trimmed.startsWith('RES:')) return 'research-outreach';
  if (trimmed.startsWith('COMPOSE:')) return 'compose-reply';
  if (trimmed.startsWith('COLD:')) return 'cold-outreach';
  // inbox-classifier doesn't typically create NEW tracker rows — it updates
  // existing ones with reply fields. A row with classification but no draft
  // source prefix is still a follow-up-loop row that received a reply.
  if (rowStatus === 'drafted' || rowStatus === 'skipped' || rowStatus === 'error') {
    return 'follow-up-loop';
  }
  return 'unknown';
}

function isPositiveClassification(c: string): boolean {
  return c.startsWith('POSITIVE');
}

function isNegativeClassification(c: string): boolean {
  return c.startsWith('NEGATIVE');
}

function parseIsoOrNull(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function resolveWindow(opts: ParsedArgs): { start: Date; end: Date; days: number | null } {
  const sinceStr = getString(opts, 'since');
  const untilStr = getString(opts, 'until');
  const windowStr = getString(opts, 'window');

  const now = new Date();

  if (sinceStr || untilStr) {
    const start = sinceStr ? parseIsoOrNull(sinceStr) ?? new Date(0) : new Date(0);
    const end = untilStr ? parseIsoOrNull(untilStr) ?? now : now;
    return { start, end, days: null };
  }

  const days = windowStr ? Math.max(1, parseInt(windowStr, 10) || 7) : 7;
  const end = now;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end, days };
}

/**
 * Maps windowed rows to Feature records. `rowsInWindow()` already filtered
 * by drafted_at via the SQLite index, but we still validate each row's
 * drafted_at as a defensive check — if a row has a malformed timestamp,
 * lexicographic comparison in SQL could include it unexpectedly.
 */
function extractFeatures(rows: RowObject[]): Feature[] {
  const features: Feature[] = [];
  for (const row of rows) {
    if (!parseIsoOrNull(row.drafted_at)) continue;

    const leadStatus = (row.lead_status || '(unset)').trim() || '(unset)';
    const rowStatus = (row.status || '').trim();
    const classification = (row.reply_classification || '').trim();
    const hasReply = classification.length > 0;
    const outcome: Outcome = hasReply ? classification : 'no_reply';

    features.push({
      email: (row.email || '').trim(),
      leadStatus,
      skill: inferSkill(row.notes_summary || '', rowStatus),
      rowStatus,
      draftId: (row.draft_id || '').trim(),
      draftedAt: row.drafted_at,
      outcome,
      isPositive: hasReply && isPositiveClassification(classification),
      isNegative: hasReply && isNegativeClassification(classification),
      hasReply,
    });
  }
  return features;
}

function bucketMetrics(features: Feature[], dim: 'leadStatus' | 'skill'): BucketMetrics[] {
  const groups = new Map<string, Feature[]>();
  for (const f of features) {
    const key = f[dim];
    const arr = groups.get(key);
    if (arr) {
      arr.push(f);
    } else {
      groups.set(key, [f]);
    }
  }
  const result: BucketMetrics[] = [];
  for (const [value, arr] of groups) {
    const drafts = arr.length;
    const replies = arr.filter((f) => f.hasReply).length;
    const positive = arr.filter((f) => f.isPositive).length;
    const negative = arr.filter((f) => f.isNegative).length;
    result.push({
      value,
      drafts,
      replies,
      positive,
      negative,
      reply_rate: drafts > 0 ? replies / drafts : 0,
      positive_rate: drafts > 0 ? positive / drafts : 0,
    });
  }
  // Sort by drafts desc for readability
  result.sort((a, b) => b.drafts - a.drafts);
  return result;
}

function crossMetrics(features: Feature[]): CrossMetrics[] {
  const groups = new Map<string, Feature[]>();
  for (const f of features) {
    const key = `${f.leadStatus}||${f.skill}`;
    const arr = groups.get(key);
    if (arr) {
      arr.push(f);
    } else {
      groups.set(key, [f]);
    }
  }
  const result: CrossMetrics[] = [];
  for (const [key, arr] of groups) {
    const [lead_status, skill] = key.split('||');
    const drafts = arr.length;
    const replies = arr.filter((f) => f.hasReply).length;
    const positive = arr.filter((f) => f.isPositive).length;
    const negative = arr.filter((f) => f.isNegative).length;
    result.push({
      value: `${lead_status} × ${skill}`,
      lead_status,
      skill,
      drafts,
      replies,
      positive,
      negative,
      reply_rate: drafts > 0 ? replies / drafts : 0,
      positive_rate: drafts > 0 ? positive / drafts : 0,
    });
  }
  result.sort((a, b) => b.drafts - a.drafts);
  return result;
}

function computeContrasts(features: Feature[]): Contrast[] {
  const contrasts: Contrast[] = [];

  // Contrast skills WITHIN a lead_status bucket
  const byLeadStatus = new Map<string, Feature[]>();
  for (const f of features) {
    const arr = byLeadStatus.get(f.leadStatus);
    if (arr) arr.push(f);
    else byLeadStatus.set(f.leadStatus, [f]);
  }

  for (const [leadStatus, subset] of byLeadStatus) {
    const skills = new Set(subset.map((f) => f.skill));
    for (const skill of skills) {
      const bucket = subset.filter((f) => f.skill === skill);
      const other = subset.filter((f) => f.skill !== skill);
      if (bucket.length < MIN_BUCKET_SIZE || other.length < MIN_BUCKET_SIZE) continue;

      const bucketPos = bucket.filter((f) => f.isPositive).length / bucket.length;
      const otherPos = other.filter((f) => f.isPositive).length / other.length;
      const delta = bucketPos - otherPos;

      if (Math.abs(delta) < MIN_DELTA) continue;

      const evidence = bucket.length + other.length;
      contrasts.push({
        base_dim: 'lead_status',
        base_value: leadStatus,
        contrast_dim: 'skill',
        contrast_value: skill,
        bucket_n: bucket.length,
        other_n: other.length,
        bucket_positive_rate: round3(bucketPos),
        other_positive_rate: round3(otherPos),
        delta: round3(delta),
        proposable: evidence >= PROPOSABLE_EVIDENCE,
        strong: evidence >= 20 && Math.abs(delta) >= 0.25,
      });
    }
  }

  // Contrast lead_status WITHIN a skill bucket
  const bySkill = new Map<string, Feature[]>();
  for (const f of features) {
    const arr = bySkill.get(f.skill);
    if (arr) arr.push(f);
    else bySkill.set(f.skill, [f]);
  }

  for (const [skill, subset] of bySkill) {
    const statuses = new Set(subset.map((f) => f.leadStatus));
    for (const status of statuses) {
      const bucket = subset.filter((f) => f.leadStatus === status);
      const other = subset.filter((f) => f.leadStatus !== status);
      if (bucket.length < MIN_BUCKET_SIZE || other.length < MIN_BUCKET_SIZE) continue;

      const bucketPos = bucket.filter((f) => f.isPositive).length / bucket.length;
      const otherPos = other.filter((f) => f.isPositive).length / other.length;
      const delta = bucketPos - otherPos;

      if (Math.abs(delta) < MIN_DELTA) continue;

      const evidence = bucket.length + other.length;
      contrasts.push({
        base_dim: 'skill',
        base_value: skill,
        contrast_dim: 'lead_status',
        contrast_value: status,
        bucket_n: bucket.length,
        other_n: other.length,
        bucket_positive_rate: round3(bucketPos),
        other_positive_rate: round3(otherPos),
        delta: round3(delta),
        proposable: evidence >= PROPOSABLE_EVIDENCE,
        strong: evidence >= 20 && Math.abs(delta) >= 0.25,
      });
    }
  }

  // Sort by evidence weight: stronger and more-evidenced first
  contrasts.sort((a, b) => {
    const aScore = Math.abs(a.delta) * Math.min(a.bucket_n, a.other_n);
    const bScore = Math.abs(b.delta) * Math.min(b.bucket_n, b.other_n);
    return bScore - aScore;
  });

  return contrasts;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function buildReport(opts: ParsedArgs): PerformanceReport {
  const { start, end, days } = resolveWindow(opts);
  const rows = rowsInWindow(start.toISOString(), end.toISOString());
  const features = extractFeatures(rows);

  const totals = {
    drafts: features.length,
    replies: features.filter((f) => f.hasReply).length,
    positive: features.filter((f) => f.isPositive).length,
    negative: features.filter((f) => f.isNegative).length,
    reply_rate: 0,
    positive_rate: 0,
  };
  totals.reply_rate = totals.drafts > 0 ? round3(totals.replies / totals.drafts) : 0;
  totals.positive_rate = totals.drafts > 0 ? round3(totals.positive / totals.drafts) : 0;

  const positive_breakdown: Record<string, number> = {};
  const negative_breakdown: Record<string, number> = {};
  for (const f of features) {
    if (f.isPositive) {
      positive_breakdown[f.outcome] = (positive_breakdown[f.outcome] || 0) + 1;
    }
    if (f.isNegative) {
      negative_breakdown[f.outcome] = (negative_breakdown[f.outcome] || 0) + 1;
    }
  }

  const data_warnings: string[] = [];
  if (totals.drafts === 0) {
    data_warnings.push('No drafts in window — nothing to analyze.');
  } else if (totals.drafts < 5) {
    data_warnings.push(
      `Only ${totals.drafts} drafts in window — below the minimum for any contrast analysis. Report will have no contrasts.`,
    );
  } else if (totals.drafts < 20) {
    data_warnings.push(
      `Only ${totals.drafts} drafts in window — directional signals only. Do not promote Section C rules without more evidence across multiple weeks.`,
    );
  }
  if (totals.replies === 0 && totals.drafts > 0) {
    data_warnings.push('No replies in window — positive-rate metrics are all zero. Conversion analysis not possible.');
  }

  return {
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      days,
    },
    totals,
    positive_breakdown,
    negative_breakdown,
    by_lead_status: bucketMetrics(features, 'leadStatus'),
    by_skill: bucketMetrics(features, 'skill'),
    by_lead_status_x_skill: crossMetrics(features),
    contrasts: computeContrasts(features),
    data_warnings,
  };
}

function printHelp(): void {
  console.log(`Usage: tsx src/performance.ts [--window <days>] [--since <ISO>] [--until <ISO>]

Queries the tracker (tracker.db via src/db.ts), filters draft rows to a
review window, computes per-segment reply/positive rates, and surfaces
contrasts. Emits JSON to stdout.

Options:
  --window <days>   Review window size in days (default: 7)
  --since <ISO>     Explicit start date (overrides --window)
  --until <ISO>     Explicit end date (overrides --window)

Thresholds (non-negotiable without human review):
  MIN_BUCKET_SIZE     = ${MIN_BUCKET_SIZE}
  MIN_DELTA           = ${MIN_DELTA} (positive-rate delta threshold)
  PROPOSABLE_EVIDENCE = ${PROPOSABLE_EVIDENCE} (bucket + other to flag a contrast as proposable)

Called by skills/performance-review.md — the skill agent interprets the JSON,
fetches draft bodies from Gmail for deepening, and writes the narrative report.`);
}

const [, , ...rest] = process.argv;

if (rest[0] === '--help' || rest[0] === '-h') {
  printHelp();
  process.exit(0);
}

const opts = parseArgs(rest);
const report = buildReport(opts);
console.log(JSON.stringify(report, null, 2));
