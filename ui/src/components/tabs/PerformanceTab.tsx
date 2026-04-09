"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/Badge";
import { leadStatusColor } from "@/lib/colors";
import { useToast } from "@/components/Toast";
import type { PerformanceReport, Contrast } from "@/lib/types";

const WINDOWS = [7, 14, 30];

function sectionCBlock(c: Contrast): string {
  const patternName = `${c.base_value} × ${c.contrast_value}`;
  const bucketPct = (c.bucket_positive_rate * 100).toFixed(0);
  const otherPct = (c.other_positive_rate * 100).toFixed(0);
  const deltaPct = (c.delta * 100).toFixed(0);
  const today = new Date().toISOString().slice(0, 10);
  return `### Pattern: ${patternName}
- Evidence: performance-review ${today} — ${c.bucket_n} drafts in ${c.contrast_value} vs ${c.other_n} in other, positive rate ${bucketPct}% vs ${otherPct}%, delta ${deltaPct} pp
- Apply: Prefer ${c.contrast_value} for ${c.base_value} leads`;
}

export function PerformanceTab() {
  const [window, setWindow] = useState<number>(7);
  const toast = useToast();
  const { data, error, isLoading } = useSWR<PerformanceReport>(
    `/api/performance?window=${window}`,
    fetcher,
  );

  if (error) {
    return (
      <div
        className="rounded-lg p-5"
        style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444",
        }}
      >
        Failed to load performance data: {error.message}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div style={{ fontSize: "0.75rem", color: "#5a5a6e" }}>Loading performance…</div>
    );
  }

  const proposable = data.contrasts.filter((c) => c.proposable);

  const handleCopyBlock = async (c: Contrast) => {
    try {
      await navigator.clipboard.writeText(sectionCBlock(c));
      toast.show("Section C block copied. Paste into knowledge/learnings.md", "success");
    } catch {
      toast.show("Clipboard write failed — check browser permissions", "error");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="font-mono" style={{ fontSize: "0.68rem", color: "#5a5a6e" }}>
          Window: {data.window.start.slice(0, 10)} → {data.window.end.slice(0, 10)}
        </div>
        <div className="flex gap-1.5">
          {WINDOWS.map((w) => {
            const active = window === w;
            return (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className="cursor-pointer rounded-md px-3 py-1 font-medium"
                style={{
                  fontSize: "0.7rem",
                  background: active
                    ? "rgba(255,122,89,0.12)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(255,122,89,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#ff7a59" : "#8b8ba0",
                }}
              >
                {w}d
              </button>
            );
          })}
        </div>
      </div>

      {/* Data warnings */}
      {data.data_warnings.length > 0 && (
        <div
          className="mb-6 rounded-lg p-4"
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
          }}
        >
          <div
            className="mb-2 font-semibold uppercase"
            style={{
              fontSize: "0.65rem",
              color: "#f59e0b",
              letterSpacing: "0.08em",
            }}
          >
            Data warnings
          </div>
          {data.data_warnings.map((w, i) => (
            <div
              key={i}
              style={{ fontSize: "0.74rem", color: "#c8c8d8", lineHeight: 1.6 }}
            >
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Conversion funnel */}
      <div className="mb-8 flex items-center py-5">
        {[
          { label: "Drafted", value: data.totals.drafts, color: "#3b82f6" },
          { label: "Replied", value: data.totals.replies, color: "#f59e0b" },
          { label: "Positive", value: data.totals.positive, color: "#22c55e" },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center">
            <div
              className="rounded-xl px-8 py-4 text-center"
              style={{
                background: `${step.color}08`,
                border: `1px solid ${step.color}20`,
                minWidth: 120,
              }}
            >
              <div
                className="font-mono font-bold"
                style={{ fontSize: "2rem", color: step.color }}
              >
                {step.value}
              </div>
              <div
                className="mt-1 font-semibold uppercase"
                style={{
                  fontSize: "0.7rem",
                  color: "#8b8ba0",
                  letterSpacing: "0.06em",
                }}
              >
                {step.label}
              </div>
            </div>
            {i < 2 && (
              <div
                className="px-4"
                style={{ color: "#3a3a4e", fontSize: "1.2rem" }}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Conversion by lead status */}
      <div
        className="mb-3 font-semibold uppercase"
        style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
      >
        Conversion by lead status
      </div>
      <div
        className="mb-7 overflow-hidden rounded-xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {data.by_lead_status.length === 0 && (
          <div className="p-5" style={{ fontSize: "0.74rem", color: "#5a5a6e" }}>
            No data in this window.
          </div>
        )}
        {data.by_lead_status.map((seg, i) => (
          <div
            key={seg.value}
            className="grid items-center px-5 py-3"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 3fr",
              borderBottom:
                i < data.by_lead_status.length - 1
                  ? "1px solid rgba(255,255,255,0.03)"
                  : "none",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-sm"
                style={{ background: leadStatusColor(seg.value) }}
              />
              <span style={{ fontSize: "0.76rem", fontWeight: 500, color: "#e8e8f0" }}>
                {seg.value.replace(/_/g, " ")}
              </span>
            </div>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "#8b8ba0" }}>
              {seg.drafts} drafts
            </div>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "#8b8ba0" }}>
              {seg.replies} replies
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="relative h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ background: `${leadStatusColor(seg.value)}30` }}
              >
                <div
                  className="absolute bottom-0 left-0 top-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${seg.positive_rate * 100}%`,
                    background: leadStatusColor(seg.value),
                  }}
                />
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: "0.7rem",
                  color: "#8b8ba0",
                  minWidth: 35,
                }}
              >
                {(seg.positive_rate * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Proposed Section C rules */}
      <div
        className="mb-3 font-semibold uppercase"
        style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
      >
        Proposed Section C rules
      </div>
      {proposable.length === 0 ? (
        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "0.74rem",
            color: "#8b8ba0",
            lineHeight: 1.6,
          }}
        >
          No contrasts passed the thresholds (≥5 per bucket, ≥15pp delta, ≥10 total evidence). Run{" "}
          <span className="font-mono" style={{ color: "#c8c8d8" }}>
            performance-review
          </span>{" "}
          weekly — patterns accumulate over time.
        </div>
      ) : (
        proposable.map((c, i) => (
          <div
            key={i}
            className="mb-2.5 rounded-xl p-4"
            style={{
              background: "rgba(34,197,94,0.04)",
              border: "1px solid rgba(34,197,94,0.15)",
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#22c55e" }}>
                ◈
              </span>
              <span
                className="font-semibold"
                style={{ fontSize: "0.82rem", color: "#e8e8f0" }}
              >
                {c.base_value} × {c.contrast_value}
              </span>
              <Badge color="#22c55e">
                {c.delta >= 0 ? "+" : ""}
                {(c.delta * 100).toFixed(0)}pp
              </Badge>
              {c.strong && <Badge color="#14b8a6">strong</Badge>}
              <button
                onClick={() => handleCopyBlock(c)}
                className="ml-auto cursor-pointer rounded-md px-3 py-1 font-medium transition-all hover:opacity-90"
                style={{
                  fontSize: "0.68rem",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "#22c55e",
                }}
              >
                Copy block
              </button>
            </div>
            <div
              className="font-mono"
              style={{ fontSize: "0.72rem", color: "#8b8ba0", lineHeight: 1.6 }}
            >
              Positive rate {(c.bucket_positive_rate * 100).toFixed(0)}% (n=
              {c.bucket_n}) vs {(c.other_positive_rate * 100).toFixed(0)}% (n=
              {c.other_n})
            </div>
            <div
              className="mt-2 italic"
              style={{ fontSize: "0.7rem", color: "#6b6b80" }}
            >
              → Promote to Section C: &ldquo;Prefer {c.contrast_value} for {c.base_value} leads&rdquo;
            </div>
          </div>
        ))
      )}
    </div>
  );
}
