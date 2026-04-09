interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}

export function MetricCard({ label, value, sub, accent }: MetricCardProps) {
  return (
    <div
      className="relative flex-1 min-w-[140px] overflow-hidden rounded-xl px-5 py-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-0.5"
        style={{ background: accent ?? "rgba(255,255,255,0.1)" }}
      />
      <div
        className="mb-2 font-semibold uppercase tracking-widest"
        style={{ fontSize: "0.7rem", color: "#8b8ba0", letterSpacing: "0.1em" }}
      >
        {label}
      </div>
      <div style={{ color: "#e8e8f0" }}>{value}</div>
      {sub && (
        <div className="mt-1.5" style={{ fontSize: "0.72rem", color: "#6b6b80" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

interface PctProps {
  value: number;
  size?: "sm" | "md" | "lg";
}

export function Pct({ value, size = "md" }: PctProps) {
  const fontSize = size === "lg" ? "2.4rem" : size === "md" ? "1.6rem" : "1rem";
  return (
    <span
      className="font-mono font-bold"
      style={{ fontSize, letterSpacing: "-0.03em" }}
    >
      {(value * 100).toFixed(0)}
      <span style={{ fontSize: "0.6em", opacity: 0.5, marginLeft: 2 }}>%</span>
    </span>
  );
}
