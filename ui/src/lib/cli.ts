import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const exec = promisify(execFile);

/**
 * Repo root — `ui/` is a subdirectory of the main repo. All CLI invocations
 * run from the repo root so relative paths (src/tracker.ts, knowledge/…) resolve.
 */
export const REPO_ROOT = resolve(process.cwd(), "..");

/**
 * Run a TypeScript CLI in the parent repo via `npx tsx`.
 *
 * - Uses `execFile` with an argv array (no shell interpolation → no injection risk).
 * - Parses stdout as JSON. The repo's CLIs (tracker.ts, performance.ts, learnings.ts)
 *   all emit JSON by contract.
 * - 50 MB stdout buffer — the largest realistic output is a tracker dump, which is
 *   comfortably under that.
 */
export async function runCli<T = unknown>(
  script: string,
  args: string[] = [],
): Promise<T> {
  const { stdout } = await exec("npx", ["tsx", script, ...args], {
    cwd: REPO_ROOT,
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

/**
 * Run a CLI that doesn't return JSON (e.g., `tracker.ts append`). Returns raw stdout.
 */
export async function runCliRaw(
  script: string,
  args: string[] = [],
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await exec("npx", ["tsx", script, ...args], {
    cwd: REPO_ROOT,
    maxBuffer: 50 * 1024 * 1024,
  });
  return { stdout, stderr };
}
