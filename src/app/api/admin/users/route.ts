import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth-password";
import { createUserWithRoles, listUsers } from "@/lib/auth-db";
import { requireManageUsers } from "@/lib/auth-admin";

export async function GET() {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/admin/users", e);
    return NextResponse.json(
      { error: "Failed to list users", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
      roleNames?: unknown;
    };
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName : null;
    const roleNames = Array.isArray(body.roleNames)
      ? body.roleNames.filter((x): x is string => typeof x === "string")
      : [];

    if (!email.trim() || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Valid email and password (min 8 characters) are required" },
        { status: 400 },
      );
    }
    if (roleNames.length === 0) {
      return NextResponse.json({ error: "At least one role is required" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const userId = await createUserWithRoles(email, passwordHash, displayName, roleNames);
    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    console.error("POST /api/admin/users", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user", details: msg }, { status: 500 });
  }
}
