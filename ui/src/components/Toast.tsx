"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastContextValue {
  show: (text: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const show = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {messages.map((m) => (
          <ToastItem key={m.id} message={m} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ message }: { message: ToastMessage }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const color =
    message.kind === "success"
      ? "#22c55e"
      : message.kind === "error"
      ? "#ef4444"
      : "#8b8ba0";

  return (
    <div
      className="pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium transition-all"
      style={{
        background: "rgba(12,12,20,0.95)",
        border: `1px solid ${color}40`,
        color: "#e8e8f0",
        backdropFilter: "blur(8px)",
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${color}20`,
        minWidth: 280,
        maxWidth: 420,
        transform: mounted ? "translateX(0)" : "translateX(20px)",
        opacity: mounted ? 1 : 0,
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="mt-1.5 h-1.5 w-1.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}80`, flexShrink: 0 }}
        />
        <div className="flex-1" style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>
          {message.text}
        </div>
      </div>
    </div>
  );
}
