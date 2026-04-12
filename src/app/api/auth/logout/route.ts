import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth-db";
import { clearSessionCookie } from "@/lib/auth-cookies";
import { getAuthContext } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (ctx) {
    await deleteSession(ctx.sessionId);
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res, req);
  return res;
}
