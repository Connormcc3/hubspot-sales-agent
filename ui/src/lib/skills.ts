/**
 * Skill metadata + prompt templates.
 *
 * The UI reads this to render skill cards and compose prompts. The id must match
 * a file in `skills/*.md` in the parent repo (the agent reads that file when
 * executing the composed prompt).
 */

import type { SkillMeta } from "./types";

export const SKILLS: SkillMeta[] = [
  {
    id: "performance-review",
    label: "Performance Review",
    icon: "◈",
    description: "Last week's numbers + proposed Section C rules",
    longDescription:
      "Closes the feedback loop. Joins table.tsv drafts with reply outcomes, computes per-segment conversion contrasts, and proposes evidence-backed Section C rules for learnings.md. Monday-morning first. Does NOT auto-write Section C — human confirms.",
    type: "backward",
  },
  {
    id: "pipeline-analysis",
    label: "Pipeline Analysis",
    icon: "◇",
    description: "Full pipeline health check + recommended actions",
    longDescription:
      "Forward-looking zoom-out. Analyzes all HubSpot contacts and deals, cross-references with the tracker, surfaces segment insights, and recommends which action-skill to run next. Run after performance-review on Mondays.",
    type: "forward",
  },
  {
    id: "follow-up-loop",
    label: "Follow-Up Loop",
    icon: "↻",
    description: "Autonomous bulk outreach to HubSpot contacts",
    longDescription:
      "Fetches all contacts from HubSpot, reads notes, generates personalized follow-up drafts, logs each to table.tsv. Runs until manually interrupted. Never sends emails — drafts only.",
    type: "action",
  },
  {
    id: "inbox-classifier",
    label: "Inbox Classifier",
    icon: "▤",
    description: "Classify replies (8 categories) + draft responses",
    longDescription:
      "One-shot run. Reads inbox, classifies each reply into 8 categories (POSITIVE_INTENT/MEETING/QUESTION, NEGATIVE_HARD/SOFT, NEUTRAL, BOUNCE, SPAM_FLAG), drafts replies for positive cases, and updates HubSpot lead status. High-signal learnings writer.",
    type: "action",
  },
  {
    id: "research-outreach",
    label: "Research Outreach",
    icon: "⊕",
    description: "Research-driven personalized emails with findings table",
    longDescription:
      "For a curated lead list: audits each domain using the type in knowledge/research-config.md (SEO, UX, brand, tech, content, custom), extracts top-3 findings, saves a full report, creates an HTML email draft with the findings embedded. Much higher reply rate than bulk follow-ups.",
    type: "action",
  },
  {
    id: "lead-recovery",
    label: "Lead Recovery",
    icon: "↺",
    description: "Decision framework for stale or burned-out deals",
    longDescription:
      "For a list of stale / burned-out / bulk-closed deals: assesses recovery chance (HIGH/MED/LOW) and recommends a lever per deal (fresh face, value-first via research-outreach, trigger-based, or close). Output is a prioritized recovery strategy — no outreach.",
    type: "action",
  },
  {
    id: "compose-reply",
    label: "Compose Reply",
    icon: "✎",
    description: "Deep-context single-lead composer",
    longDescription:
      "For ONE specific lead: assembles full email history (both directions), all HubSpot notes and deals, prior agent interactions, plus custom new context you inject, then drafts a careful reply. Use when bulk skills don't have enough personalization for a high-value lead.",
    type: "action",
  },
];

export const getSkill = (id: string): SkillMeta | undefined =>
  SKILLS.find((s) => s.id === id);

export const SKILL_IDS = SKILLS.map((s) => s.id);

// -------- Prompt templates (per skill) --------
// Each template takes a params object and the optional customPrefix, returns the
// final prompt string to feed into Claude Code. Keep these close to the
// invocation examples in prompts/invoke-skill.md.

export interface PromptParams {
  customPrefix?: string;
  // skill-specific:
  window?: number;
  mode?: string;
  singleContact?: string;
  timeFilter?: string;
  dryRun?: boolean;
  leadList?: string;
  dealList?: string;
  email?: string;
  newContext?: string;
  desiredOutcome?: string;
  tone?: string;
  segment?: string;
}

const withCustom = (base: string, customPrefix?: string): string => {
  if (!customPrefix?.trim()) return base;
  return `${base}\n\nAdditional instructions:\n${customPrefix.trim()}`;
};

export const composePrompt = (skillId: string, params: PromptParams): string => {
  switch (skillId) {
    case "performance-review": {
      const window = params.window ?? 7;
      return withCustom(
        `Read skills/performance-review.md, program.md, and knowledge/learnings.md.
Run the skill with a ${window}-day window.

1. Run npx tsx src/performance.ts --window ${window} and interpret the JSON.
2. For each proposable contrast, fetch 2-3 draft bodies from Gmail for tone + subject deepening.
3. Write the full report to output/performance/<YYYY-MM-DD>.md with the 5 sections (headline, segments, contrasts, proposed Section C additions, caveats).
4. Append a learnings heartbeat or observation at the end.

DO NOT auto-write proposed rules to learnings.md Section C — human confirms.
DO NOT lower the minimum-sample thresholds (≥5 per bucket, ≥15pp delta, ≥10 evidence to propose).`,
        params.customPrefix,
      );
    }

    case "pipeline-analysis": {
      const mode = params.mode ?? "full";
      if (mode === "segment" && params.segment) {
        return withCustom(
          `Read skills/pipeline-analysis.md and CLAUDE.md.
Analyze ONE segment of the pipeline: ${params.segment}.

Show: contacts/deals in this segment, win rate vs average, average deal value vs average, agent coverage, sample of untouched contacts (max 10), segment-specific recommended action.`,
          params.customPrefix,
        );
      }
      if (mode === "quick") {
        return withCustom(
          `Read skills/pipeline-analysis.md.
Quick pipeline health check — console output only, no markdown report.
Show: totals by lead_status, open/won/lost counts + win rate, stale (>90d) + zombie (>2y) deal counts, agent coverage %, top 3 recommended actions.`,
          params.customPrefix,
        );
      }
      return withCustom(
        `Read skills/pipeline-analysis.md and CLAUDE.md.
Analyze the entire HubSpot pipeline. Fetch ALL contacts + ALL deals (paginate through all pages).
Produce the 5-section analysis: contact distribution, deal health, agent coverage, segment insights, recommended actions.
Output: console summary + full report to output/analysis/pipeline-<YYYY-MM-DD>.md.
Do NOT change any HubSpot data. Analysis only.`,
        params.customPrefix,
      );
    }

    case "follow-up-loop": {
      const mode = params.mode ?? "autonomous";
      if (mode === "single" && params.singleContact) {
        return withCustom(
          `Read skills/follow-up-loop.md and CLAUDE.md. Process ONLY this one contact:
Email: ${params.singleContact}

1. Load the contact from HubSpot
2. Read all notes
3. Generate the follow-up email
4. Show me: subject + body + brief reasoning

Do NOT create a Gmail draft. Do NOT update table.tsv.`,
          params.customPrefix,
        );
      }
      if (mode === "preview") {
        return withCustom(
          `Read skills/follow-up-loop.md and CLAUDE.md, then start the follow-up loop in PREVIEW MODE.
For each contact: read notes → generate email → print to console (NO Gmail call, NO table.tsv update).
Show for each: email address, lead status, subject, email text.
Process max 10 contacts, then stop and show summary.`,
          params.customPrefix,
        );
      }
      if (mode === "approval") {
        return withCustom(
          `Read skills/follow-up-loop.md and CLAUDE.md. Start the follow-up loop in APPROVAL MODE.
For each contact: generate email → show me → wait for my response.
"ok" → create draft + log to table.tsv. "skip" → skip. "stop" → end loop + show summary.`,
          params.customPrefix,
        );
      }
      if (mode === "resume") {
        return withCustom(
          `Read skills/follow-up-loop.md and CLAUDE.md. Start the autonomous loop in Resume mode.
table.tsv already contains processed contacts — skip them automatically.
NEVER STOP. Continue until manually interrupted.`,
          params.customPrefix,
        );
      }
      // autonomous
      return withCustom(
        `Read skills/follow-up-loop.md and CLAUDE.md, then start the autonomous HubSpot follow-up loop.
NEVER STOP. Work through all contacts until manually stopped.
Follow the 7-step loop strictly. Log every contact immediately to table.tsv.
Do NOT ask for confirmation mid-loop.
When interrupted: print summary.`,
        params.customPrefix,
      );
    }

    case "inbox-classifier": {
      const timeFilter = params.timeFilter ?? "newer_than:7d in:inbox";
      if (params.dryRun) {
        return withCustom(
          `Read skills/inbox-classifier.md, knowledge/learnings.md, and CLAUDE.md.
DRY-RUN: Classify all new replies matching "${timeFilter}",
BUT create NO reply drafts and change NO HubSpot status.
Show me the classifications as a table: email | classification | suggested_action.`,
          params.customPrefix,
        );
      }
      return withCustom(
        `Read skills/inbox-classifier.md, knowledge/learnings.md, and CLAUDE.md.
Run the skill with filter: ${timeFilter}.

For each new reply:
1. Load the thread
2. Load the HubSpot contact
3. Classify (8 categories)
4. For POSITIVE_*: create reply draft
5. Update HubSpot status (NEGATIVE_* → UNQUALIFIED)
6. Update tracker via npx tsx src/tracker.ts update <email> <classification> [draft_id]

At the end: run report with counts per category + action list for human.`,
        params.customPrefix,
      );
    }

    case "research-outreach": {
      const leads = params.leadList?.trim();
      if (!leads) {
        return withCustom(
          `Read skills/research-outreach.md, knowledge/research-config.md, and CLAUDE.md.
I'll provide a lead list. Please wait for it before running.`,
          params.customPrefix,
        );
      }
      return withCustom(
        `Read skills/research-outreach.md, knowledge/research-config.md, and CLAUDE.md.
Run the skill for these leads:

${leads}

For each lead:
1. Research the domain using the audit type configured in research-config.md
2. Extract top-3 findings
3. Write full report to output/research-reports/<domain-slug>.md
4. Create HTML email draft with findings as an embedded table
5. Log to table.tsv with notes_summary prefix "RES:"

For unreachable domains: skip with log.
At the end: run report (audits ok / skipped / drafts created).`,
        params.customPrefix,
      );
    }

    case "lead-recovery": {
      const deals = params.dealList?.trim();
      if (deals) {
        return withCustom(
          `Read skills/lead-recovery.md and CLAUDE.md. Analyze these HubSpot deals:

${deals}

For each deal:
1. Load deal data (amount, stage, close date, last activity)
2. Load linked contact
3. Read last 5 notes
4. Assess recovery chance (HIGH / MEDIUM-HIGH / MEDIUM / LOW / UNCLEAR)
5. Recommend lever (fresh face / value-first / trigger-based / close)

Output: console table + markdown file to output/recovery-<date>.md
with: deal value, chance, lever, ownership, next action, reasoning.`,
          params.customPrefix,
        );
      }
      return withCustom(
        `Read skills/lead-recovery.md.
Load all HubSpot deals with dealstage IN (open, decisionmakerboughtin) OR closedlost with closedate < today - 6 months.
Apply the pipeline hygiene rules from the skill file.
Output: list of closing candidates with reasoning.
Do NOT change anything in HubSpot without my confirmation.`,
        params.customPrefix,
      );
    }

    case "compose-reply": {
      const email = params.email?.trim() ?? "<email>";
      const ctx = params.newContext?.trim() ?? "";
      const outcome = params.desiredOutcome?.trim() ?? "";
      const tone = params.tone?.trim() ?? "match the prior conversation";
      return withCustom(
        `Read skills/compose-reply.md and CLAUDE.md.
Compose a reply to this lead:

Email: ${email}

New context:
${ctx || "(none)"}

Desired outcome:
${outcome || "(warm re-engagement, book a short call)"}

Tone: ${tone}

Assemble full context from HubSpot + Gmail history + tracker.
Generate a structured brief, then draft the email.
SHOW me the brief and draft first. Ask before creating the Gmail draft.`,
        params.customPrefix,
      );
    }

    default:
      return `Read skills/${skillId}.md and run the skill.\n\n${params.customPrefix ?? ""}`.trim();
  }
};
