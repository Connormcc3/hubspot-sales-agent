interface BadgeProps {
  color: string;
  children: React.ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  return (
    <span
      className="inline-block rounded px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}
