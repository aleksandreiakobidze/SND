import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-session";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ user: null, roles: [], permissions: [] });
  }
  return NextResponse.json({
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      displayName: ctx.user.displayName,
    },
    roles: ctx.roles,
    permissions: ctx.permissions,
  });
}
