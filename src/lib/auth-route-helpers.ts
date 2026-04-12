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
