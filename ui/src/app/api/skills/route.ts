import { SKILLS } from "@/lib/skills";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(SKILLS);
}
