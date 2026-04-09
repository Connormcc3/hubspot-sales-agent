/**
 * Types mirroring the CLI outputs. Keep in sync with src/tracker.ts, src/performance.ts,
 * and src/learnings.ts in the parent repo.
 */

// --- tracker.ts rows ---
export interface TrackerRow {
  email: string;
  firstname: string;
  lastname: string;
  company: string;
  lead_status: string;
  notes_summary: string;
  draft_id: string;
  status: string;
  drafted_at: string;
  reply_received_at: string;
  reply_classification: string;
  reply_draft_id: string;
  hubspot_status_after: string;
}

// --- performance.ts ---
export interface PerformanceWindow {
  start: string;
  end: string;
  days: number | null;
}

export interface PerformanceTotals {
  drafts: number;
  replies: number;
  positive: number;
  negative: number;
  reply_rate: number;
  positive_rate: number;
}

export interface BucketMetrics {
  value: string;
  drafts: number;
  replies: number;
  positive: number;
  negative: number;
  reply_rate: number;
  positive_rate: number;
}

export interface CrossMetrics extends BucketMetrics {
  lead_status: string;
  skill: string;
}

export interface Contrast {
  base_dim: "lead_status" | "skill";
  base_value: string;
  contrast_dim: "lead_status" | "skill";
  contrast_value: string;
  bucket_n: number;
  other_n: number;
  bucket_positive_rate: number;
  other_positive_rate: number;
  delta: number;
  proposable: boolean;
  strong: boolean;
}

export interface PerformanceReport {
  window: PerformanceWindow;
  totals: PerformanceTotals;
  positive_breakdown: Record<string, number>;
  negative_breakdown: Record<string, number>;
  by_lead_status: BucketMetrics[];
  by_skill: BucketMetrics[];
  by_lead_status_x_skill: CrossMetrics[];
  contrasts: Contrast[];
  data_warnings: string[];
}

// --- learnings.ts read ---
export type LearningEntryType = "heartbeat" | "observation";

export interface LearningEntry {
  date: string;
  skill: string;
  headline: string;
  type: LearningEntryType;
  body: string;
}

export interface LearningsData {
  sectionA_raw: string;
  sectionB: LearningEntry[];
  sectionC_raw: string;
}

// --- skills metadata ---
export type SkillType = "backward" | "forward" | "action";

export interface SkillMeta {
  id: string;
  label: string;
  icon: string;
  description: string;
  longDescription: string;
  type: SkillType;
}

// --- run modes ---
export type RunMode = "copy" | "terminal";

export interface RunRequest {
  skillId: string;
  mode: RunMode;
  prompt: string;
}

export interface RunResponse {
  ok: boolean;
  mode: RunMode;
  note?: string;
  error?: string;
}
