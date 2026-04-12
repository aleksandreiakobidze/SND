"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  canAccessOnlineOrders,
  canAssignSalesDriver,
  canManageUsers,
  canUseAgent,
  canViewDashboard,
} from "@/lib/auth-roles";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type AuthState = {
  user: AuthUser | null;
  roles: string[];
  permissions: string[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const json = (await res.json()) as {
        user: AuthUser | null;
        roles: string[];
        permissions?: string[];
      };
      setUser(json.user);
      setRoles(Array.isArray(json.roles) ? json.roles : []);
      setPermissions(Array.isArray(json.permissions) ? json.permissions : []);
    } catch {
      setUser(null);
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      roles,
      permissions,
      loading,
      refresh,
    }),
    [user, roles, permissions, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useAuthCapabilities(permissions: string[]) {
  return useMemo(
    () => ({
      canViewDashboard: canViewDashboard(permissions),
      canUseAgent: canUseAgent(permissions),
      canAccessOnlineOrders: canAccessOnlineOrders(permissions),
      canManageUsers: canManageUsers(permissions),
      canAssignSalesDriver: canAssignSalesDriver(permissions),
    }),
    [permissions],
  );
}
