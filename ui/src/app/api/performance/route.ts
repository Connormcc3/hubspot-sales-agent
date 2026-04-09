import { runCli } from "@/lib/cli";
import type { PerformanceReport } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const windowParam = request.nextUrl.searchParams.get("window") ?? "7";
  // Validate: must be a positive integer
  const windowNum = parseInt(windowParam, 10);
  if (!Number.isFinite(windowNum) || windowNum < 1 || windowNum > 365) {
    return Response.json(
      { error: "Invalid window — must be an integer between 1 and 365" },
      { status: 400 },
    );
  }

  try {
    const report = await runCli<PerformanceReport>("src/performance.ts", [
      "--window",
      String(windowNum),
    ]);
    return Response.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
