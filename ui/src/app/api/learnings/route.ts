import { runCli } from "@/lib/cli";
import type { LearningsData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section");
  const limit = request.nextUrl.searchParams.get("limit");
  const skill = request.nextUrl.searchParams.get("skill");

  const args: string[] = ["read"];
  if (section && ["A", "B", "C"].includes(section)) {
    args.push("--section", section);
  }
  if (limit) {
    const limitNum = parseInt(limit, 10);
    if (Number.isFinite(limitNum) && limitNum >= 1 && limitNum <= 1000) {
      args.push("--limit", String(limitNum));
    }
  }
  if (skill) {
    // skill is a whitelist-checked string; pass as-is (execFile with array args → no shell injection)
    args.push("--skill", skill);
  }

  try {
    const data = await runCli<LearningsData>("src/learnings.ts", args);
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
