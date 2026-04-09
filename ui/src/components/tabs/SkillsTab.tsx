"use client";

import { useState } from "react";
import { SKILLS } from "@/lib/skills";
import { Badge } from "@/components/Badge";
import { SkillDetailPanel } from "@/components/skills/SkillDetailPanel";
import type { SkillMeta } from "@/lib/types";

export function SkillsTab() {
  const [selected, setSelected] = useState<SkillMeta | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const mondayPair = SKILLS.filter((s) => s.type !== "action");
  const actionSkills = SKILLS.filter((s) => s.type === "action");

  return (
    <div>
      <div
        className="mb-4 font-semibold uppercase"
        style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
      >
        Monday morning pair
      </div>
      <div className="mb-7 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {mondayPair.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            isHighlighted={true}
            isHovered={hovered === skill.id}
            onHover={setHovered}
            onClick={() => setSelected(skill)}
          />
        ))}
      </div>

      <div
        className="mb-4 font-semibold uppercase"
        style={{ fontSize: "0.68rem", color: "#5a5a6e", letterSpacing: "0.08em" }}
      >
        Action skills
      </div>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {actionSkills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            isHighlighted={false}
            isHovered={hovered === skill.id}
            onHover={setHovered}
            onClick={() => setSelected(skill)}
          />
        ))}
      </div>

      {selected && (
        <SkillDetailPanel skill={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function SkillCard({
  skill,
  isHighlighted,
  isHovered,
  onHover,
  onClick,
}: {
  skill: SkillMeta;
  isHighlighted: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const badgeColor =
    skill.type === "backward"
      ? "#a855f7"
      : skill.type === "forward"
      ? "#3b82f6"
      : "#14b8a6";

  return (
    <div
      onMouseEnter={() => onHover(skill.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      className="cursor-pointer rounded-xl px-5 py-4.5 transition-all"
      style={{
        padding: "18px 20px",
        background: isHovered
          ? isHighlighted
            ? "rgba(255,122,89,0.06)"
            : "rgba(255,255,255,0.04)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${
          isHovered
            ? isHighlighted
              ? "rgba(255,122,89,0.2)"
              : "rgba(255,255,255,0.1)"
            : "rgba(255,255,255,0.06)"
        }`,
      }}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span style={{ fontSize: "1.2rem", color: isHighlighted ? "#ff7a59" : "#8b8ba0" }}>
          {skill.icon}
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: "0.88rem", color: "#e8e8f0" }}
        >
          {skill.label}
        </span>
        {isHighlighted && <Badge color={badgeColor}>{skill.type}</Badge>}
      </div>
      <div style={{ fontSize: "0.74rem", color: "#8b8ba0", lineHeight: 1.5 }}>
        {skill.description}
      </div>
    </div>
  );
}
