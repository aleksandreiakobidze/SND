import { NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/lib/auth-session";

export async function requireAuth(): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; res: NextResponse }
> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, ctx };
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(s: string): boolean {
  return UUID_RE.test(s.trim());
}
