import { NextRequest, NextResponse } from "next/server";
import {
  countUsers,
  createUserWithRoles,
  generateSessionToken,
  insertSession,
  sha256Hex,
} from "@/lib/auth-db";

export async function GET() {
  const n = await countUsers();
  return NextResponse.json({ allowRegister: n === 0 });
}
import { hashPassword } from "@/lib/auth-password";
import { applySessionCookie } from "@/lib/auth-cookies";
import { SESSION_MAX_AGE_SEC } from "@/lib/auth-constants";
import {
  ROLE_ADMIN,
  ROLE_ANALYST,
  ROLE_OPERATOR,
  ROLE_VIEWER,
} from "@/lib/auth-constants";

/** First user only — assigns all seeded roles so you can test operator/viewer flows. */
export async function POST(req: NextRequest) {
  try {
    const n = await countUsers();
    if (n > 0) {
      return NextResponse.json({ error: "Registration is closed" }, { status: 403 });
    }

    const body = (await req.json()) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    };
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName = typeof body.displayName === "string" ? body.displayName : null;

    if (!email.trim() || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Valid email and password (min 8 characters) are required" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = await createUserWithRoles(email, passwordHash, displayName, [
      ROLE_ADMIN,
      ROLE_ANALYST,
      ROLE_VIEWER,
      ROLE_OPERATOR,
    ]);

    const token = generateSessionToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);
    await insertSession(userId, tokenHash, expiresAt);

    const res = NextResponse.json({ ok: true, userId });
    applySessionCookie(res, token, req);
    return res;
  } catch (e) {
    console.error("POST /api/auth/register", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed", details: msg }, { status: 500 });
  }
}
