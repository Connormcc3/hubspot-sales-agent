"use client";

export type TabId = "pipeline" | "performance" | "skills" | "learnings";

const TABS: { id: TabId; label: string }[] = [
  { id: "pipeline", label: "Pipeline" },
  { id: "performance", label: "Performance" },
  { id: "skills", label: "Skills" },
  { id: "learnings", label: "Learnings" },
];

interface TabsProps {
  active: TabId;
  onChange: (id: TabId) => void;
}

export function Tabs({ active, onChange }: TabsProps) {
  return (
    <div
      className="flex border-b px-8"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="cursor-pointer border-none bg-none px-5 pb-3 pt-3.5 font-semibold transition-all"
            style={{
              fontSize: "0.78rem",
              fontFamily: "var(--font-dm-sans), sans-serif",
              color: isActive ? "#e8e8f0" : "#5a5a6e",
              borderBottom: `2px solid ${isActive ? "#ff7a59" : "transparent"}`,
              letterSpacing: "0.01em",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
