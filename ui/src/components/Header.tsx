export function Header() {
  return (
    <div
      className="flex items-center justify-between border-b px-8 py-5"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #ff7a59 0%, #ff5733 100%)",
            boxShadow: "0 0 20px rgba(255,122,89,0.2)",
          }}
        >
          S
        </div>
        <div>
          <div
            className="font-bold"
            style={{
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontSize: "1.1rem",
              color: "#e8e8f0",
              letterSpacing: "-0.02em",
            }}
          >
            Sales Agent
          </div>
          <div
            className="font-mono"
            style={{ fontSize: "0.68rem", color: "#5a5a6e" }}
          >
            hubspot-sales-agent · v2.5.0
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="pulse-dot h-1.5 w-1.5 rounded-full"
          style={{
            background: "#22c55e",
            boxShadow: "0 0 8px rgba(34,197,94,0.4)",
          }}
        />
        <span
          className="font-mono"
          style={{ fontSize: "0.7rem", color: "#6b6b80" }}
        >
          localhost · shares state with the agent
        </span>
      </div>
    </div>
  );
}
