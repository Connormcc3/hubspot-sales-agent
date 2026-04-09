import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import { SKILL_IDS } from "@/lib/skills";
import { REPO_ROOT } from "@/lib/cli";
import type { RunRequest, RunResponse } from "@/lib/types";

const exec = promisify(execFile);

export const dynamic = "force-dynamic";

/**
 * POST /api/skills/run
 *
 * Body: { skillId, mode: "copy" | "terminal", prompt }
 *
 * - Mode "copy" is technically handled client-side via navigator.clipboard, but
 *   this endpoint exists so the frontend always has a server anchor. For "copy"
 *   the server just validates + echoes the prompt back.
 * - Mode "terminal" (macOS only) copies the prompt to the system clipboard via
 *   pbcopy, then runs osascript to open Terminal.app with `claude` running in
 *   the repo root. Non-macOS returns a 501 with a fallback message.
 */
export async function POST(request: Request) {
  let body: RunRequest;
  try {
    body = (await request.json()) as RunRequest;
  } catch {
    return Response.json(
      { ok: false, mode: "copy", error: "Invalid JSON body" } satisfies RunResponse,
      { status: 400 },
    );
  }

  const { skillId, mode, prompt } = body ?? {};

  // Validate skillId against allowlist (prevents any accidental shell exposure)
  if (!skillId || !SKILL_IDS.includes(skillId)) {
    return Response.json(
      { ok: false, mode: mode ?? "copy", error: "Unknown skillId" } satisfies RunResponse,
      { status: 400 },
    );
  }
  if (!prompt || typeof prompt !== "string" || prompt.length < 5) {
    return Response.json(
      { ok: false, mode: mode ?? "copy", error: "Missing or too-short prompt" } satisfies RunResponse,
      { status: 400 },
    );
  }
  if (prompt.length > 50_000) {
    return Response.json(
      { ok: false, mode: mode ?? "copy", error: "Prompt too long (max 50k chars)" } satisfies RunResponse,
      { status: 400 },
    );
  }

  if (mode === "copy") {
    // No-op on the server. The frontend copies via navigator.clipboard.writeText.
    return Response.json({
      ok: true,
      mode: "copy",
      note: "Prompt validated. Frontend handles the clipboard write.",
    } satisfies RunResponse);
  }

  if (mode === "terminal") {
    if (platform() !== "darwin") {
      return Response.json(
        {
          ok: false,
          mode: "terminal",
          error:
            "Terminal mode is macOS-only. Fall back to Copy mode — the prompt is still available client-side.",
        } satisfies RunResponse,
        { status: 501 },
      );
    }

    try {
      // 1. Copy the prompt to the system clipboard via pbcopy (stdin → pbcopy)
      await new Promise<void>((res, rej) => {
        const child = execFile("pbcopy", [], (err) => (err ? rej(err) : res()));
        child.stdin?.end(prompt, "utf-8");
      });

      // 2. Open Terminal.app with `cd REPO_ROOT && claude`
      // NOTE: osascript command string escaping — REPO_ROOT should be safe (comes from
      // process.cwd() + "..", no user input), but we still quote it to be defensive.
      const safeRoot = REPO_ROOT.replace(/"/g, '\\"');
      const banner =
        "echo '→ Prompt copied to clipboard. Paste with Cmd+V once claude is ready.'";
      const script = `tell application "Terminal"
  activate
  do script "cd \\"${safeRoot}\\" && clear && ${banner} && claude"
end tell`;

      await exec("osascript", ["-e", script]);

      return Response.json({
        ok: true,
        mode: "terminal",
        note: "Terminal.app opened. Prompt copied — paste once claude is ready.",
      } satisfies RunResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json(
        { ok: false, mode: "terminal", error: message } satisfies RunResponse,
        { status: 500 },
      );
    }
  }

  return Response.json(
    { ok: false, mode: mode ?? "copy", error: `Unknown mode: ${String(mode)}` } satisfies RunResponse,
    { status: 400 },
  );
}
