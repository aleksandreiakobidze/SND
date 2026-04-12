import { forbidden, requireAuth } from "@/lib/auth-route-helpers";
import { canManageUsers } from "@/lib/auth-roles";

export async function requireManageUsers() {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  if (!canManageUsers(auth.ctx.permissions)) {
    return { ok: false as const, res: forbidden() };
  }
  return auth;
}
