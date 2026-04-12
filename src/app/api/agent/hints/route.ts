import { NextRequest, NextResponse } from "next/server";
import {
  createOwnerAgentHint,
  listOwnerAgentHints,
  MAX_OWNER_AGENT_HINT_BODY_CHARS,
  MAX_OWNER_AGENT_HINTS,
} from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    const hints = await listOwnerAgentHints(auth.ctx.user.id);
    return NextResponse.json({
      hints,
      limits: { maxHints: MAX_OWNER_AGENT_HINTS, maxBodyChars: MAX_OWNER_AGENT_HINT_BODY_CHARS },
    });
  } catch (e) {
    console.error("GET /api/agent/hints", e);
    return NextResponse.json(
      { error: "Failed to load hints", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    const body = (await req.json()) as { title?: unknown; body?: unknown };
    const title = typeof body.title === "string" ? body.title : null;
    const text = typeof body.body === "string" ? body.body : "";
    const result = await createOwnerAgentHint(auth.ctx.user.id, { title, body: text });
    if ("error" in result) {
      if (result.error === "empty") {
        return NextResponse.json({ error: "body is required" }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Maximum number of instructions reached", max: MAX_OWNER_AGENT_HINTS },
        { status: 409 },
      );
    }
    return NextResponse.json({ id: result.id });
  } catch (e) {
    console.error("POST /api/agent/hints", e);
    return NextResponse.json(
      { error: "Failed to create hint", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
