import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  findUserByEmail,
  generateSessionToken,
  insertSession,
  sha256Hex,
} from "@/lib/auth-db";
import { verifyPassword } from "@/lib/auth-password";
import { applySessionCookie } from "@/lib/auth-cookies";
import { SESSION_MAX_AGE_SEC } from "@/lib/auth-constants";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!email.trim() || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = generateSessionToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);
    await insertSession(user.id, tokenHash, expiresAt);

    const res = NextResponse.json({ ok: true });
    applySessionCookie(res, token, req);
    return res;
  } catch (e) {
    console.error("POST /api/auth/login", e);
    const raw = e instanceof Error ? e.message : "Unknown";
    const db = process.env.MSSQL_DATABASE || "SND";
    if (raw.includes("Invalid object name") && (raw.includes("SndApp_User") || raw.includes("SndApp_Session"))) {
      return NextResponse.json(
        {
          error: "Auth tables missing in SQL Server",
          details: `Run scripts/migrations/003-snd-app-auth.sql on database "${db}" (same as MSSQL_DATABASE in .env.local), then try again.`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Login failed", details: raw }, { status: 500 });
  }
}
