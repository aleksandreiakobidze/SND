import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/lib/auth-constants";

/**
 * `Secure` must match the actual request scheme. Using `NODE_ENV === "production"`
 * breaks `next start` and HTTP deployments: the browser drops the cookie on HTTP.
 */
export function sessionCookieSecure(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return req.nextUrl.protocol === "https:";
}

export function applySessionCookie(res: NextResponse, token: string, req: NextRequest): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: sessionCookieSecure(req),
  });
}

export function clearSessionCookie(res: NextResponse, req: NextRequest): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: sessionCookieSecure(req),
  });
}
