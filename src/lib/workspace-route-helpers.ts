import { NextResponse } from "next/server";
import { applyOwnerCookie, ensureOwnerId, getOwnerIdFromCookies } from "@/lib/workspace-owner";

export type OwnerContext = { ownerId: string; setOwnerCookie: boolean };

export async function getOwnerContext(): Promise<OwnerContext> {
  const existing = await getOwnerIdFromCookies();
  const { ownerId, isNew } = ensureOwnerId(existing);
  return { ownerId, setOwnerCookie: isNew };
}

export function withOwnerCookie(res: NextResponse, ctx: OwnerContext): NextResponse {
  if (ctx.setOwnerCookie) applyOwnerCookie(res, ctx.ownerId);
  return res;
}
