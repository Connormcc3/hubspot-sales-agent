/**
 * Color mappings for lead statuses, reply classifications, and row statuses.
 * Returns raw hex values so they can be used in inline styles (Tailwind v4
 * arbitrary values work too, but inline is simpler for dynamic props).
 */

export const leadStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    CONNECTED: "#22c55e",
    ATTEMPTED_TO_CONTACT: "#f59e0b",
    UNQUALIFIED: "#6b7280",
    NEW: "#3b82f6",
    IN_PROGRESS: "#a855f7",
    OPEN_DEAL: "#14b8a6",
    BAD_TIMING: "#f97316",
  };
  return map[status] ?? "#8b8ba0";
};

export const rowStatusColor = (status: string): string => {
  const map: Record<string, string> = {
    drafted: "#3b82f6",
    skipped: "#6b7280",
    error: "#ef4444",
    declined: "#f59e0b",
    bounced: "#ef4444",
    awaiting_human: "#a855f7",
  };
  return map[status] ?? "#6b7280";
};

export const classificationColor = (c: string | null | undefined): string => {
  if (!c) return "#5a5a6e";
  if (c.startsWith("POSITIVE")) return "#22c55e";
  if (c === "NEGATIVE_HARD") return "#ef4444";
  if (c === "NEGATIVE_SOFT") return "#f59e0b";
  if (c === "BOUNCE") return "#ef4444";
  if (c === "SPAM_FLAG") return "#ef4444";
  if (c === "NEUTRAL") return "#8b8ba0";
  return "#8b8ba0";
};
