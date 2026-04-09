import { runCli } from "@/lib/cli";
import type { TrackerRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await runCli<TrackerRow[]>("src/tracker.ts", ["rows"]);
    return Response.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
