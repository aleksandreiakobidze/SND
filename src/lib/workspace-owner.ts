import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const WORKSPACE_OWNER_COOKIE = "snd_workspace_owner";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getOwnerIdFromCookies(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(WORKSPACE_OWNER_COOKIE)?.value?.trim();
  if (v && UUID_RE.test(v)) return v;
  return null;
}

/** Ensures an owner id; generates a new UUID if the cookie is missing or invalid. */
export function ensureOwnerId(existing: string | null): { ownerId: string; isNew: boolean } {
  if (existing && UUID_RE.test(existing)) {
    return { ownerId: existing, isNew: false };
  }
  return { ownerId: randomUUID(), isNew: true };
}

export function applyOwnerCookie(res: NextResponse, ownerId: string): void {
  res.cookies.set(WORKSPACE_OWNER_COOKIE, ownerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}
