"use client";

import { useEffect, useMemo, useState } from "react";
import { composePrompt, type PromptParams } from "@/lib/skills";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/Badge";
import { renderSkillForm } from "./SkillForms";
import type { RunMode, RunResponse, SkillMeta } from "@/lib/types";

interface Props {
  skill: SkillMeta;
  onClose: () => void;
}

export function SkillDetailPanel({ skill, onClose }: Props) {
  const [params, setParams] = useState<PromptParams>({});
  const [mode, setMode] = useState<RunMode>("copy");
  const [isRunning, setIsRunning] = useState(false);
  const toast = useToast();

  const composedPrompt = useMemo(
    () => composePrompt(skill.id, params),
    [skill.id, params],
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      if (mode === "copy") {
        // Client-side clipboard write
        await navigator.clipboard.writeText(composedPrompt);
        toast.show(
          "Prompt copied. Switch to your Claude Code session and paste (Cmd+V).",
          "success",
        );
      } else if (mode === "terminal") {
        const res = await fetch("/api/skills/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId: skill.id, mode, prompt: composedPrompt }),
        });
        const data = (await res.json()) as RunResponse;
        if (data.ok) {
          toast.show(
            data.note ??
              "Terminal opened. Prompt copied — paste once claude is ready.",
            "success",
          );
        } else {
          toast.show(
            data.error ??
              "Terminal mode failed — falling back to clipboard would be safer.",
            "error",
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.show(`Run failed: ${message}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  const badgeColor =
    skill.type === "backward"
      ? "#a855f7"
      : skill.type === "forward"
      ? "#3b82f6"
      : "#14b8a6";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
      />

      {/* Slide-over panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col"
        style={{
          background: "#0c0c14",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2.5">
              <span style={{ fontSize: "1.4rem", color: "#ff7a59" }}>{skill.icon}</span>
              <span
                className="font-semibold"
                style={{
                  fontSize: "1.05rem",
                  color: "#e8e8f0",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}
              >
                {skill.label}
              </span>
              <Badge color={badgeColor}>{skill.type}</Badge>
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#8b8ba0",
                lineHeight: 1.6,
              }}
            >
              {skill.longDescription}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 cursor-pointer rounded-md p-2 transition-colors hover:bg-white/[0.04]"
            style={{ color: "#5a5a6e", fontSize: "1.3rem", lineHeight: 1 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderSkillForm(skill.id, params, setParams)}

          {/* Custom prefix */}
          <div className="mb-4">
            <label
              style={{
                fontSize: "0.65rem",
                color: "#8b8ba0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 6,
                display: "block",
              }}
            >
              Custom additions (optional)
            </label>
            <textarea
              className="w-full rounded-md px-3 py-2 font-mono transition-all focus:outline-none"
              style={{
                fontSize: "0.76rem",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#e8e8f0",
                minHeight: 70,
                resize: "vertical",
              }}
              value={params.customPrefix ?? ""}
              onChange={(e) => setParams({ ...params, customPrefix: e.target.value })}
              placeholder="Any extra constraints, focus areas, or overrides…"
            />
          </div>

          {/* Prompt preview */}
          <div className="mb-4">
            <label
              style={{
                fontSize: "0.65rem",
                color: "#8b8ba0",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 6,
                display: "block",
              }}
            >
              Composed prompt
            </label>
            <pre
              className="whitespace-pre-wrap rounded-md px-4 py-3 font-mono"
              style={{
                fontSize: "0.72rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#c8c8d8",
                lineHeight: 1.6,
                maxHeight: 240,
                overflow: "auto",
              }}
            >
              {composedPrompt}
            </pre>
          </div>
        </div>

        {/* Footer: mode + run */}
        <div
          className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex gap-1.5">
            <ModeButton
              active={mode === "copy"}
              onClick={() => setMode("copy")}
              label="Copy to clipboard"
              hint="paste into your current claude session"
            />
            <ModeButton
              active={mode === "terminal"}
              onClick={() => setMode("terminal")}
              label="Open new Terminal"
              hint="macOS · starts claude in a fresh tab"
            />
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="cursor-pointer rounded-md px-5 py-2.5 font-semibold transition-all disabled:opacity-50"
            style={{
              fontSize: "0.8rem",
              background: "linear-gradient(135deg, #ff7a59 0%, #ff5733 100%)",
              color: "#fff",
              border: "none",
              boxShadow: "0 0 20px rgba(255,122,89,0.2)",
            }}
          >
            {isRunning ? "Running…" : mode === "copy" ? "Copy prompt" : "Open terminal"}
          </button>
        </div>
      </div>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-md px-3 py-1.5 text-left transition-all"
      style={{
        background: active ? "rgba(255,122,89,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(255,122,89,0.3)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          color: active ? "#ff7a59" : "#c8c8d8",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.62rem", color: "#5a5a6e", marginTop: 1 }}>
        {hint}
      </div>
    </button>
  );
}
