"use client";

import type { PromptParams } from "@/lib/skills";

interface FormProps {
  params: PromptParams;
  onChange: (params: PromptParams) => void;
}

const inputClass =
  "w-full rounded-md px-3 py-2 font-mono transition-all focus:outline-none";
const inputStyle: React.CSSProperties = {
  fontSize: "0.76rem",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#e8e8f0",
};
const labelStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  color: "#8b8ba0",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ModePills<T extends string>({
  modes,
  value,
  onChange,
}: {
  modes: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {modes.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className="cursor-pointer rounded-md px-3 py-1.5 font-medium transition-all"
            style={{
              fontSize: "0.72rem",
              background: active ? "rgba(255,122,89,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? "rgba(255,122,89,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: active ? "#ff7a59" : "#8b8ba0",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Individual form components ----

export function PerformanceReviewForm({ params, onChange }: FormProps) {
  return (
    <>
      <Field label="Window (days)">
        <ModePills
          modes={[
            { id: "7", label: "7 days" },
            { id: "14", label: "14 days" },
            { id: "30", label: "30 days" },
          ]}
          value={String(params.window ?? 7)}
          onChange={(v) => onChange({ ...params, window: parseInt(v, 10) })}
        />
      </Field>
    </>
  );
}

export function PipelineAnalysisForm({ params, onChange }: FormProps) {
  const mode = (params.mode ?? "full") as "full" | "quick" | "segment";
  return (
    <>
      <Field label="Analysis mode">
        <ModePills
          modes={[
            { id: "full", label: "Full report" },
            { id: "quick", label: "Quick check" },
            { id: "segment", label: "Segment deep-dive" },
          ]}
          value={mode}
          onChange={(m) => onChange({ ...params, mode: m })}
        />
      </Field>
      {mode === "segment" && (
        <Field label="Segment (industry, lead_status, or source)">
          <input
            className={inputClass}
            style={inputStyle}
            value={params.segment ?? ""}
            onChange={(e) => onChange({ ...params, segment: e.target.value })}
            placeholder="Manufacturing"
          />
        </Field>
      )}
    </>
  );
}

export function FollowUpLoopForm({ params, onChange }: FormProps) {
  const mode = (params.mode ?? "autonomous") as
    | "autonomous"
    | "preview"
    | "resume"
    | "single"
    | "approval";
  return (
    <>
      <Field label="Run mode">
        <ModePills
          modes={[
            { id: "autonomous", label: "Autonomous" },
            { id: "preview", label: "Preview (no drafts)" },
            { id: "resume", label: "Resume" },
            { id: "approval", label: "Per-contact approval" },
            { id: "single", label: "Single contact" },
          ]}
          value={mode}
          onChange={(m) => onChange({ ...params, mode: m })}
        />
      </Field>
      {mode === "single" && (
        <Field label="Contact email">
          <input
            className={inputClass}
            style={inputStyle}
            value={params.singleContact ?? ""}
            onChange={(e) => onChange({ ...params, singleContact: e.target.value })}
            placeholder="founder@example.com"
          />
        </Field>
      )}
    </>
  );
}

export function InboxClassifierForm({ params, onChange }: FormProps) {
  const timeFilter = params.timeFilter ?? "newer_than:7d in:inbox";
  return (
    <>
      <Field label="Gmail search filter">
        <input
          className={inputClass}
          style={inputStyle}
          value={timeFilter}
          onChange={(e) => onChange({ ...params, timeFilter: e.target.value })}
          placeholder="newer_than:7d in:inbox"
        />
      </Field>
      <Field label="Dry-run (no drafts, no HubSpot updates)">
        <label
          className="flex cursor-pointer items-center gap-2"
          style={{ fontSize: "0.76rem", color: "#c8c8d8" }}
        >
          <input
            type="checkbox"
            checked={!!params.dryRun}
            onChange={(e) => onChange({ ...params, dryRun: e.target.checked })}
          />
          Classify only, no writes
        </label>
      </Field>
    </>
  );
}

export function ResearchOutreachForm({ params, onChange }: FormProps) {
  return (
    <Field label="Lead list (one per line: email, firstname, lastname, company, domain, lead_status)">
      <textarea
        className={inputClass}
        style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
        value={params.leadList ?? ""}
        onChange={(e) => onChange({ ...params, leadList: e.target.value })}
        placeholder="john@acme.com, John, Smith, Acme Inc, acme.com, ATTEMPTED_TO_CONTACT"
      />
    </Field>
  );
}

export function LeadRecoveryForm({ params, onChange }: FormProps) {
  return (
    <Field label="Deal IDs (one per line, or leave empty for 'all stale')">
      <textarea
        className={inputClass}
        style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
        value={params.dealList ?? ""}
        onChange={(e) => onChange({ ...params, dealList: e.target.value })}
        placeholder="1234567890&#10;9876543210"
      />
    </Field>
  );
}

export function ComposeReplyForm({ params, onChange }: FormProps) {
  return (
    <>
      <Field label="Lead email">
        <input
          className={inputClass}
          style={inputStyle}
          value={params.email ?? ""}
          onChange={(e) => onChange({ ...params, email: e.target.value })}
          placeholder="founder@acme.com"
        />
      </Field>
      <Field label="New context (fresh info to inject)">
        <textarea
          className={inputClass}
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={params.newContext ?? ""}
          onChange={(e) => onChange({ ...params, newContext: e.target.value })}
          placeholder="They just posted on LinkedIn about expanding to 3 new markets"
        />
      </Field>
      <Field label="Desired outcome">
        <input
          className={inputClass}
          style={inputStyle}
          value={params.desiredOutcome ?? ""}
          onChange={(e) => onChange({ ...params, desiredOutcome: e.target.value })}
          placeholder="Book a 20-min call this week"
        />
      </Field>
      <Field label="Tone">
        <ModePills
          modes={[
            { id: "match", label: "Match prior" },
            { id: "casual", label: "Casual" },
            { id: "formal", label: "Formal" },
          ]}
          value={params.tone ?? "match"}
          onChange={(v) => onChange({ ...params, tone: v })}
        />
      </Field>
    </>
  );
}

// Map skillId → form component
export function renderSkillForm(
  skillId: string,
  params: PromptParams,
  onChange: (p: PromptParams) => void,
): React.ReactNode {
  const props = { params, onChange };
  switch (skillId) {
    case "performance-review":
      return <PerformanceReviewForm {...props} />;
    case "pipeline-analysis":
      return <PipelineAnalysisForm {...props} />;
    case "follow-up-loop":
      return <FollowUpLoopForm {...props} />;
    case "inbox-classifier":
      return <InboxClassifierForm {...props} />;
    case "research-outreach":
      return <ResearchOutreachForm {...props} />;
    case "lead-recovery":
      return <LeadRecoveryForm {...props} />;
    case "compose-reply":
      return <ComposeReplyForm {...props} />;
    default:
      return null;
  }
}
