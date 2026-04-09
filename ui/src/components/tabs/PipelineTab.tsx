"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { MetricCard, Pct } from "@/components/MetricCard";
import { Badge } from "@/components/Badge";
import { SegmentBar } from "@/components/SegmentBar";
import { leadStatusColor, rowStatusColor, classificationColor } from "@/lib/colors";
import type { TrackerRow, PerformanceReport } from "@/lib/types";

type FilterId = "all" | "awaiting" | "replied" | "positive";

const daysSince = (iso: string): number | null => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
};

export function PipelineTab() {
  const { data: rows, error: rowsError, isLoading: rowsLoading } = useSWR<
    TrackerRow[]
  >("/api/tracker", fetcher, { refreshInterval: 0 });
  const { data: perf } = useSWR<PerformanceReport>(
    "/api/performance?window=7",
    fetcher,
  );

  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const safeRows = rows ?? [];

  const counts = useMemo(
    () => ({
      all: safeRows.length,
      awaiting: safeRows.filter(
        (d) => d.status === "drafted" && !d.reply_classification,
      ).length,
      replied: safeRows.filter((d) => d.reply_classification).length,
      positive: safeRows.filter((d) =>
        d.reply_classification?.startsWith("POSITIVE"),
      ).length,
    }),
    [safeRows],
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") return safeRows;
    if (filter === "awaiting")
      return safeRows.filter(
        (d) => d.status === "drafted" && !d.reply_classification,
      );
    if (filter === "replied") return safeRows.filter((d) => d.reply_classification);
    if (filter === "positive")
      return safeRows.filter((d) =>
        d.reply_classification?.startsWith("POSITIVE"),
      );
    return safeRows;
  }, [safeRows, filter]);

  if (rowsError) {
    return (
      <div
        className="rounded-lg p-5"
        style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444",
        }}
      >
        Failed to load tracker data: {rowsError.message}
      </div>
    );
  }

  return (
    <div>
      {/* Metric cards */}
      <div className="mb-6 flex flex-wrap gap-3.5">
        <MetricCard
          label="Total Contacts"
          value={
            <span
              className="font-mono font-bold"
              style={{ fontSize: "2rem", color: "#e8e8f0" }}
            >
              {rowsLoading ? "…" : safeRows.length}
            </span>
          }
          sub="in tracker"
          accent="#3b82f6"
        />
        <MetricCard
          label="Reply Rate"
          value={<Pct value={perf?.totals.reply_rate ?? 0} size="lg" />}
          sub={
            perf
              ? `${perf.totals.replies} of ${perf.totals.drafts} drafts (7d)`
              : "—"
          }
          accent="#22c55e"
        />
        <MetricCard
          label="Positive Rate"
          value={<Pct value={perf?.totals.positive_rate ?? 0} size="lg" />}
          sub={
            perf
              ? `${perf.totals.positive} meetings/intents (7d)`
              : "—"
          }
          accent="#14b8a6"
        />
        <MetricCard
          label="Awaiting Reply"
          value={
            <span
              className="font-mono font-bold"
              style={{ fontSize: "2rem", color: "#f59e0b" }}
            >
              {rowsLoading ? "…" : counts.awaiting}
            </span>
          }
          sub="no response yet"
          accent="#f59e0b"
        />
      </div>

      {/* Segment distribution */}
      {perf && perf.totals.drafts > 0 && (
        <div className="mb-6">
          <div
            className="mb-2 font-semibold uppercase"
            style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
          >
            Pipeline by Lead Status (last 7 days)
          </div>
          <SegmentBar data={perf.by_lead_status} total={perf.totals.drafts} />
          <div className="mt-2.5 flex flex-wrap gap-4">
            {perf.by_lead_status.map((s) => (
              <div
                key={s.value}
                className="flex items-center gap-1.5"
                style={{ fontSize: "0.68rem" }}
              >
                <div
                  className="h-2 w-2 rounded-sm"
                  style={{ background: leadStatusColor(s.value) }}
                />
                <span style={{ color: "#8b8ba0" }}>
                  {s.value.replace(/_/g, " ")}
                </span>
                <span className="font-mono" style={{ color: "#5a5a6e" }}>
                  {s.drafts}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "all" as const, label: "All", count: counts.all },
            { id: "awaiting" as const, label: "Awaiting", count: counts.awaiting },
            { id: "replied" as const, label: "Replied", count: counts.replied },
            { id: "positive" as const, label: "Positive", count: counts.positive },
          ]
        ).map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all"
              style={{
                fontSize: "0.72rem",
                background: active
                  ? "rgba(255,122,89,0.12)"
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(255,122,89,0.3)" : "rgba(255,255,255,0.06)"}`,
                color: active ? "#ff7a59" : "#8b8ba0",
              }}
            >
              {f.label}
              <span className="font-mono" style={{ fontSize: "0.65rem", opacity: 0.6 }}>
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contact table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="grid px-5 py-2.5 font-semibold uppercase"
          style={{
            gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            color: "#5a5a6e",
            background: "rgba(255,255,255,0.02)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div>Contact</div>
          <div>Notes</div>
          <div>Lead Status</div>
          <div>Status</div>
          <div>Reply</div>
        </div>

        {rowsLoading && (
          <div className="p-6" style={{ fontSize: "0.75rem", color: "#5a5a6e" }}>
            Loading tracker…
          </div>
        )}

        {!rowsLoading && filteredRows.length === 0 && (
          <div className="p-8 text-center" style={{ fontSize: "0.8rem", color: "#5a5a6e" }}>
            {safeRows.length === 0
              ? "No contacts in tracker yet. Run follow-up-loop to populate it."
              : "No contacts match this filter."}
          </div>
        )}

        {filteredRows.map((row, i) => {
          const isSelected = selectedIdx === i;
          return (
            <div key={row.email}>
              <div
                onClick={() => setSelectedIdx(isSelected ? null : i)}
                className="grid cursor-pointer items-center px-5 py-3 transition-colors hover:bg-white/[0.02]"
                style={{
                  gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1fr",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: isSelected ? "rgba(255,122,89,0.04)" : "transparent",
                }}
              >
                <div>
                  <div
                    className="font-semibold"
                    style={{ fontSize: "0.82rem", color: "#e8e8f0" }}
                  >
                    {row.firstname} {row.lastname}
                  </div>
                  <div className="font-mono" style={{ fontSize: "0.68rem", color: "#5a5a6e" }}>
                    {row.company}
                  </div>
                </div>
                <div
                  className="overflow-hidden pr-3"
                  style={{
                    fontSize: "0.72rem",
                    color: "#8b8ba0",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.notes_summary}
                </div>
                <div>
                  {row.lead_status && (
                    <Badge color={leadStatusColor(row.lead_status)}>
                      {row.lead_status.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <div>
                  {row.status && (
                    <Badge color={rowStatusColor(row.status)}>{row.status}</Badge>
                  )}
                </div>
                <div>
                  {row.reply_classification ? (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: classificationColor(row.reply_classification),
                        }}
                      />
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "0.68rem",
                          color: classificationColor(row.reply_classification),
                        }}
                      >
                        {row.reply_classification
                          .replace("POSITIVE_", "+")
                          .replace("NEGATIVE_", "−")}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.68rem", color: "#3a3a4e" }}>—</span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div
                  className="px-5 py-4"
                  style={{
                    background: "rgba(255,255,255,0.015)",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="grid grid-cols-3 gap-5">
                    <div>
                      <div
                        className="mb-1.5 font-semibold uppercase"
                        style={{
                          fontSize: "0.62rem",
                          color: "#5a5a6e",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Contact
                      </div>
                      <div
                        className="font-semibold"
                        style={{ fontSize: "0.8rem", color: "#e8e8f0" }}
                      >
                        {row.firstname} {row.lastname}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#8b8ba0" }}>
                        {row.company}
                      </div>
                      <div
                        className="mt-1 font-mono"
                        style={{ fontSize: "0.68rem", color: "#5a5a6e" }}
                      >
                        {row.email}
                      </div>
                    </div>
                    <div>
                      <div
                        className="mb-1.5 font-semibold uppercase"
                        style={{
                          fontSize: "0.62rem",
                          color: "#5a5a6e",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Timeline
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#8b8ba0" }}>
                        Drafted:{" "}
                        {row.drafted_at
                          ? `${daysSince(row.drafted_at)}d ago`
                          : "—"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#8b8ba0" }}>
                        Reply:{" "}
                        {row.reply_received_at
                          ? `${daysSince(row.reply_received_at)}d ago`
                          : "no reply"}
                      </div>
                      {row.draft_id && (
                        <div
                          className="mt-1 font-mono"
                          style={{ fontSize: "0.65rem", color: "#5a5a6e" }}
                        >
                          draft: {row.draft_id}
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        className="mb-1.5 font-semibold uppercase"
                        style={{
                          fontSize: "0.62rem",
                          color: "#5a5a6e",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Notes
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "#8b8ba0",
                          lineHeight: 1.5,
                        }}
                      >
                        {row.notes_summary || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
