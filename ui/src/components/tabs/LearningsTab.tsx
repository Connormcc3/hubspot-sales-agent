"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Badge } from "@/components/Badge";
import type { LearningsData, LearningEntry } from "@/lib/types";

export function LearningsTab() {
  const { data, error, isLoading } = useSWR<LearningsData>(
    "/api/learnings",
    fetcher,
  );
  const [showSectionA, setShowSectionA] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

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
        Failed to load learnings: {error.message}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div style={{ fontSize: "0.75rem", color: "#5a5a6e" }}>Loading learnings…</div>
    );
  }

  const sectionCHasContent =
    data.sectionC_raw &&
    !data.sectionC_raw.includes("(No patterns distilled yet");

  return (
    <div>
      {/* Section C */}
      <div
        className="mb-6 rounded-xl p-5"
        style={{
          background: "rgba(168,85,247,0.04)",
          border: "1px solid rgba(168,85,247,0.15)",
        }}
      >
        <div
          className="mb-2.5 font-semibold uppercase"
          style={{ fontSize: "0.68rem", color: "#a855f7", letterSpacing: "0.08em" }}
        >
          Section C — Distilled Patterns
        </div>
        {sectionCHasContent ? (
          <pre
            className="whitespace-pre-wrap"
            style={{
              fontSize: "0.74rem",
              color: "#c8c8d8",
              lineHeight: 1.7,
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}
          >
            {data.sectionC_raw}
          </pre>
        ) : (
          <div style={{ fontSize: "0.74rem", color: "#8b8ba0", lineHeight: 1.6 }}>
            No patterns distilled yet. Run{" "}
            <span className="font-mono" style={{ color: "#c8c8d8" }}>
              performance-review
            </span>{" "}
            weekly — it proposes evidence-backed candidates you can promote here manually.
          </div>
        )}
      </div>

      {/* Section B */}
      <div
        className="mb-3 font-semibold uppercase"
        style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
      >
        Section B — Running Log (newest first, {data.sectionB.length} total)
      </div>
      {data.sectionB.length === 0 ? (
        <div
          className="mb-6 rounded-xl p-5"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "0.74rem",
            color: "#8b8ba0",
            lineHeight: 1.6,
          }}
        >
          Empty. Skills write heartbeats and observations here automatically at the end of every run (see{" "}
          <span className="font-mono" style={{ color: "#c8c8d8" }}>
            program.md
          </span>{" "}
          universal teardown).
        </div>
      ) : (
        <div className="relative mb-6 pl-5">
          <div
            className="absolute bottom-0 left-1.5 top-0 w-px"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          {data.sectionB.map((entry, i) => (
            <TimelineEntry
              key={i}
              entry={entry}
              expanded={expandedEntry === `${i}-${entry.date}-${entry.skill}`}
              onToggle={() =>
                setExpandedEntry(
                  expandedEntry === `${i}-${entry.date}-${entry.skill}`
                    ? null
                    : `${i}-${entry.date}-${entry.skill}`,
                )
              }
            />
          ))}
        </div>
      )}

      {/* Section A (collapsed) */}
      <div
        className="rounded-xl"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={() => setShowSectionA(!showSectionA)}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left"
        >
          <span
            className="font-semibold uppercase"
            style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
          >
            Section A — Cheat Sheets
          </span>
          <span style={{ fontSize: "0.72rem", color: "#5a5a6e" }}>
            {showSectionA ? "hide" : "show"}
          </span>
        </button>
        {showSectionA && (
          <div
            className="px-5 pb-5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
          >
            <pre
              className="mt-4 whitespace-pre-wrap"
              style={{
                fontSize: "0.72rem",
                color: "#c8c8d8",
                lineHeight: 1.6,
                fontFamily: "var(--font-dm-sans), sans-serif",
              }}
            >
              {data.sectionA_raw}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineEntry({
  entry,
  expanded,
  onToggle,
}: {
  entry: LearningEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isObservation = entry.type === "observation";
  return (
    <div className="relative mb-4">
      <div
        className="absolute rounded-full"
        style={{
          left: -16,
          top: 5,
          width: 9,
          height: 9,
          background: isObservation ? "#f59e0b" : "#3a3a4e",
          border: `2px solid ${isObservation ? "#f59e0b" : "#2a2a3e"}`,
        }}
      />
      <div
        onClick={onToggle}
        className="cursor-pointer"
        style={{ marginLeft: 4 }}
      >
        <div className="mb-1 flex items-center gap-2">
          <Badge color={isObservation ? "#f59e0b" : "#5a5a6e"}>{entry.type}</Badge>
          <span className="font-mono" style={{ fontSize: "0.68rem", color: "#5a5a6e" }}>
            {entry.skill} · {entry.date}
          </span>
        </div>
        <div style={{ fontSize: "0.76rem", color: "#c8c8d8" }}>{entry.headline}</div>
        {expanded && entry.body && (
          <pre
            className="mt-2 whitespace-pre-wrap rounded-md p-3"
            style={{
              fontSize: "0.7rem",
              color: "#8b8ba0",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              lineHeight: 1.6,
              fontFamily: "var(--font-dm-sans), sans-serif",
            }}
          >
            {entry.body}
          </pre>
        )}
      </div>
    </div>
  );
}
