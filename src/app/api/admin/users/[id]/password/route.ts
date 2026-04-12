import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-password";
import { findUserById, updateUserPasswordHash } from "@/lib/auth-db";
import { requireManageUsers } from "@/lib/auth-admin";

type Params = { id: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const body = (await req.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const hash = await hashPassword(password);
    await updateUserPasswordHash(id, hash);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/admin/users/[id]/password", e);
    return NextResponse.json(
      { error: "Failed to reset password", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
