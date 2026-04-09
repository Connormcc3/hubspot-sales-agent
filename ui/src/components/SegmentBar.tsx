import { leadStatusColor } from "@/lib/colors";

interface SegmentBarProps {
  data: { value: string; drafts: number }[];
  total: number;
}

export function SegmentBar({ data, total }: SegmentBarProps) {
  if (total === 0) {
    return (
      <div
        className="h-1.5 rounded-sm"
        style={{ background: "rgba(255,255,255,0.04)" }}
      />
    );
  }
  return (
    <div className="flex h-1.5 gap-px overflow-hidden rounded-sm">
      {data.map((d) => (
        <div
          key={d.value}
          className="transition-all duration-300"
          style={{
            flex: d.drafts / total,
            background: leadStatusColor(d.value),
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}
