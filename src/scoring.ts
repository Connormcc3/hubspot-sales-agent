#!/usr/bin/env node
/**
 * Lead scoring utility — computes fit + engagement scores for tracker contacts,
 * derives a priority tier (A/B/C/D), and writes results back to the tracker.
 *
 * NOT a skill. A utility that skills call naturally:
 * - `follow-up-loop` sorts its work queue by priority_tier
 * - `pipeline-analysis` reports score distribution
 * - `research-outreach` / `cold-outreach` prioritize A-tier leads
 *
 * Usage:
 *   tsx src/scoring.ts score <email>                → score one contact (needs HubSpot data as JSON on stdin or --data flag)
 *   tsx src/scoring.ts score-tracker                → score all tracker contacts using tracker data only (engagement scores)
 *   tsx src/scoring.ts rank                         → print all scored contacts sorted by priority
 *   tsx src/scoring.ts tier <email>                 → print priority tier for one contact
 *   tsx src/scoring.ts update <email> <fit> <eng>   → manually set scores + compute tier
 *
 * Fit scoring requires HubSpot properties (industry, company size, job title,
 * location). The agent passes these when invoking `score`. Engagement scoring
 * uses tracker data only.
 *
 * Configuration: knowledge/scoring-config.md defines ICP weights and tier matrix.
 * The engine uses hardcoded defaults that match the config file — edit both
 * together if you change the model.
 */

import {
  allRows,
  emailExists,
  updateScores,
  rowsByPriority,
  type RowObject,
} from './db.ts';

// ──────────────────────── Engagement scoring (from tracker data) ────────────────────────

interface EngagementInput {
  status: string;
  replyClassification: string;
  replyReceivedAt: string;
  notesSummary: string;
}

function computeEngagement(input: EngagementInput): number {
  let score = 0;
  const classification = input.replyClassification.trim();
  const replyDate = input.replyReceivedAt.trim();

  // Positive reply
  if (classification.startsWith('POSITIVE')) {
    score += 40;
  } else if (classification && classification !== 'BOUNCE' && classification !== 'SPAM_FLAG') {
    // Any non-bounce reply (including NEGATIVE_SOFT, NEUTRAL)
    score += 20;
  }

  // Recency of reply
  if (replyDate) {
    const daysSinceReply = (Date.now() - new Date(replyDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReply <= 30) score += 15;
    else if (daysSinceReply <= 90) score += 10;
  }

  // Was drafted (outreach sent)
  if (input.status === 'drafted') score += 10;

  // Research outreach (higher-effort touch)
  if (input.notesSummary.trim().startsWith('RES:')) score += 10;

  // Compose-reply (personalized touch)
  if (input.notesSummary.trim().startsWith('COMPOSE:')) score += 5;

  // Hard negative penalty
  if (classification === 'NEGATIVE_HARD') score -= 20;

  // Bounce penalty
  if (classification === 'BOUNCE') score -= 30;

  return Math.max(0, Math.min(100, score));
}

// ──────────────────────── Fit scoring (from HubSpot properties) ────────────────────────

interface FitInput {
  industry?: string;
  numberOfEmployees?: string;
  jobTitle?: string;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Compute fit score from HubSpot properties. Uses a generic model that
 * gives partial credit for any data present. Users should customize the
 * scoring-config.md tables and this function together for their ICP.
 *
 * Without customization, the default model rewards:
 * - Having an industry (vs blank)
 * - Decision-maker titles
 * - Known company size
 * - Known location
 */
function computeFit(input: FitInput): number {
  let score = 0;

  // Industry: 0-40 points
  // Default: any known industry gets 20, blank gets 5
  // Users override by editing scoring-config.md + this function
  const industry = (input.industry || '').trim().toLowerCase();
  if (industry) {
    score += 20; // Known industry — partial credit
  } else {
    score += 5;  // Unknown
  }

  // Company size: 0-25 points
  const employees = parseInt(input.numberOfEmployees || '', 10);
  if (!isNaN(employees)) {
    if (employees >= 10 && employees <= 200) score += 25;      // Sweet spot default
    else if (employees >= 1 && employees < 10) score += 15;    // Small
    else if (employees > 200 && employees <= 1000) score += 15; // Medium-large
    else if (employees > 1000) score += 10;                     // Enterprise
    else score += 10;
  } else {
    score += 10; // Unknown — benefit of the doubt
  }

  // Job title: 0-25 points
  const title = (input.jobTitle || '').trim().toLowerCase();
  if (title) {
    if (/\b(ceo|founder|owner|geschäftsführer|inhaber|managing director|cto|coo)\b/.test(title)) {
      score += 25;
    } else if (/\b(vp|vice president|director|head of|leiter)\b/.test(title)) {
      score += 20;
    } else if (/\b(manager|teamlead|team lead)\b/.test(title)) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    score += 10; // Unknown
  }

  // Location: 0-10 points
  // Default: any known location gets 7, blank gets 5
  const hasLocation = (input.city || input.state || input.country || '').trim().length > 0;
  score += hasLocation ? 7 : 5;

  return Math.max(0, Math.min(100, score));
}

// ──────────────────────── Priority tier matrix ────────────────────────

function deriveTier(fitScore: number, engagementScore: number): 'A' | 'B' | 'C' | 'D' {
  const fitBand = fitScore >= 71 ? 'high' : fitScore >= 41 ? 'med' : 'low';
  const engBand = engagementScore >= 61 ? 'high' : engagementScore >= 31 ? 'med' : 'low';

  // Matrix from scoring-config.md
  if (fitBand === 'high' && engBand === 'high') return 'A';
  if (fitBand === 'high' && engBand === 'med') return 'A';
  if (fitBand === 'med' && engBand === 'high') return 'A';
  if (fitBand === 'high' && engBand === 'low') return 'B';
  if (fitBand === 'med' && engBand === 'med') return 'B';
  if (fitBand === 'low' && engBand === 'high') return 'B';
  if (fitBand === 'med' && engBand === 'low') return 'C';
  if (fitBand === 'low' && engBand === 'med') return 'C';
  return 'D'; // low × low
}

// ──────────────────────── Score a single contact ────────────────────────

interface ScoreResult {
  email: string;
  fit_score: number;
  engagement_score: number;
  priority_tier: string;
}

function scoreContact(email: string, fitInput: FitInput, engInput: EngagementInput): ScoreResult {
  const fit = computeFit(fitInput);
  const eng = computeEngagement(engInput);
  const tier = deriveTier(fit, eng);
  return { email, fit_score: fit, engagement_score: eng, priority_tier: tier };
}

// ──────────────────────── Score all tracker contacts (engagement only) ────────────────────────

function scoreAllTracker(): ScoreResult[] {
  const rows = allRows();
  const results: ScoreResult[] = [];

  for (const row of rows) {
    const eng = computeEngagement({
      status: row.status,
      replyClassification: row.reply_classification,
      replyReceivedAt: row.reply_received_at,
      notesSummary: row.notes_summary,
    });

    // If existing fit_score, keep it; otherwise default to 50 (unknown)
    const existingFit = parseInt(row.fit_score, 10);
    const fit = isNaN(existingFit) || row.fit_score === '' ? 50 : existingFit;

    const tier = deriveTier(fit, eng);

    updateScores(row.email, fit, eng, tier);
    results.push({
      email: row.email,
      fit_score: fit,
      engagement_score: eng,
      priority_tier: tier,
    });
  }

  return results;
}

// ──────────────────────── CLI dispatch ────────────────────────

const [, , command, ...args] = process.argv;

switch (command) {
  case 'score': {
    // Score a single contact: tsx scoring.ts score <email> --data '{"industry":"tech",...}'
    const email = args[0];
    if (!email) {
      console.error('Usage: scoring.ts score <email> [--data <json>]');
      process.exit(1);
    }

    let fitData: FitInput = {};
    const dataIdx = args.indexOf('--data');
    if (dataIdx !== -1 && args[dataIdx + 1]) {
      try {
        fitData = JSON.parse(args[dataIdx + 1]);
      } catch {
        console.error('Invalid JSON for --data');
        process.exit(1);
      }
    }

    // Get engagement data from tracker if the contact exists
    const rows = allRows();
    const row = rows.find((r) => r.email.toLowerCase() === email.trim().toLowerCase());

    const engInput: EngagementInput = row
      ? {
          status: row.status,
          replyClassification: row.reply_classification,
          replyReceivedAt: row.reply_received_at,
          notesSummary: row.notes_summary,
        }
      : { status: '', replyClassification: '', replyReceivedAt: '', notesSummary: '' };

    const result = scoreContact(email, fitData, engInput);

    // Update tracker if contact exists
    if (row) {
      updateScores(email, result.fit_score, result.engagement_score, result.priority_tier);
    }

    console.log(JSON.stringify(result, null, 2));
    break;
  }

  case 'score-tracker': {
    // Score all contacts in tracker using engagement data (fit defaults to 50 or existing)
    const results = scoreAllTracker();
    console.log(JSON.stringify(results, null, 2));
    console.error(`Scored ${results.length} contacts.`);
    break;
  }

  case 'rank': {
    // Print all scored contacts sorted by priority
    const ranked = rowsByPriority();
    if (ranked.length === 0) {
      console.log('No scored contacts. Run `scoring.ts score-tracker` first.');
      break;
    }
    const summary = ranked.map((r) => ({
      email: r.email,
      company: r.company,
      tier: r.priority_tier,
      fit: r.fit_score,
      engagement: r.engagement_score,
      status: r.status,
      reply: r.reply_classification || '(none)',
    }));
    console.log(JSON.stringify(summary, null, 2));
    break;
  }

  case 'tier': {
    const email = args[0];
    if (!email) {
      console.error('Usage: scoring.ts tier <email>');
      process.exit(1);
    }
    const rows = allRows();
    const row = rows.find((r) => r.email.toLowerCase() === email.trim().toLowerCase());
    if (!row) {
      console.error(`No tracker row for "${email}"`);
      process.exit(1);
    }
    console.log(row.priority_tier || '(unscored)');
    break;
  }

  case 'update': {
    // Manual override: tsx scoring.ts update <email> <fit> <engagement>
    const [email, fitStr, engStr] = args;
    if (!email || !fitStr || !engStr) {
      console.error('Usage: scoring.ts update <email> <fit_score> <engagement_score>');
      process.exit(1);
    }
    const fit = Math.max(0, Math.min(100, parseInt(fitStr, 10) || 0));
    const eng = Math.max(0, Math.min(100, parseInt(engStr, 10) || 0));
    const tier = deriveTier(fit, eng);

    if (!emailExists(email)) {
      console.error(`No tracker row for "${email}"`);
      process.exit(1);
    }

    updateScores(email, fit, eng, tier);
    console.log(JSON.stringify({ email, fit_score: fit, engagement_score: eng, priority_tier: tier }));
    break;
  }

  default:
    console.error(
      'Usage: tsx src/scoring.ts score <email> [--data <json>] | score-tracker | rank | tier <email> | update <email> <fit> <eng>',
    );
    process.exit(1);
}
