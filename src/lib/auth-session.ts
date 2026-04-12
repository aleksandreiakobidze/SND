import { cookies } from "next/headers";
import {
  findValidSession,
  getUserPermissions,
  getUserRoles,
  sha256Hex,
  type SessionUser,
} from "@/lib/auth-db";
import { SESSION_COOKIE } from "@/lib/auth-constants";

export type AuthContext = {
  user: {
    id: string;
    email: string;
    displayName: string | null;
  };
  roles: string[];
  permissions: string[];
  sessionId: string;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value?.trim();
  if (!raw || raw.length < 32) return null;
  const tokenHash = sha256Hex(raw);
  const su = await findValidSession(tokenHash);
  if (!su) return null;
  const [roles, permissions] = await Promise.all([
    getUserRoles(su.userId),
    getUserPermissions(su.userId),
  ]);
  return {
    sessionId: su.sessionId,
    user: {
      id: su.userId,
      email: su.email,
      displayName: su.displayName,
    },
    roles,
    permissions,
  };
}

/** For logging / auditing */
export async function getSessionUserFromToken(rawToken: string): Promise<SessionUser | null> {
  return findValidSession(sha256Hex(rawToken));
}
