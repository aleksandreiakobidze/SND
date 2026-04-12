"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ALL_PERMISSION_KEYS } from "@/lib/auth-permissions";
import type { TranslationKey } from "@/lib/i18n";

type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
  roles: string[];
};

type RoleRow = {
  id: number;
  name: string;
  permissionKeys: string[];
};

const PERM_LABEL: Record<string, TranslationKey> = {
  view_dashboard: "permViewDashboard",
  use_agent: "permUseAgent",
  edit_workspace: "permEditWorkspace",
  access_online_orders: "permAccessOnlineOrders",
  manage_users: "permManageUsers",
};

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { permissions, loading: authLoading } = useAuth();
  const { canManageUsers } = useAuthCapabilities(permissions);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permCatalog, setPermCatalog] = useState<string[]>([...ALL_PERMISSION_KEYS]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserRoles, setNewUserRoles] = useState<Record<string, boolean>>({});

  const [sheetUser, setSheetUser] = useState<UserRow | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editRoles, setEditRoles] = useState<Record<string, boolean>>({});
  const [resetPwd, setResetPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const [roleDrafts, setRoleDrafts] = useState<Record<number, { name: string; perms: Record<string, boolean> }>>(
    {},
  );
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePerms, setNewRolePerms] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, rRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/roles", { credentials: "include" }),
      ]);
      if (!uRes.ok) {
        const j = await uRes.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "users");
      }
      if (!rRes.ok) {
        const j = await rRes.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "roles");
      }
      const uJson = (await uRes.json()) as { users: UserRow[] };
      const rJson = (await rRes.json()) as { roles: RoleRow[]; permissionCatalog?: string[] };
      setUsers(uJson.users);
      setRoles(rJson.roles);
      if (Array.isArray(rJson.permissionCatalog) && rJson.permissionCatalog.length > 0) {
        setPermCatalog(rJson.permissionCatalog);
      }
      const nr: Record<string, boolean> = {};
      for (const r of rJson.roles) nr[r.name] = false;
      setNewUserRoles(nr);
      const drafts: Record<number, { name: string; perms: Record<string, boolean> }> = {};
      for (const r of rJson.roles) {
        const perms: Record<string, boolean> = {};
        for (const k of ALL_PERMISSION_KEYS) perms[k] = r.permissionKeys.includes(k);
        drafts[r.id] = { name: r.name, perms };
      }
      setRoleDrafts(drafts);
      const np: Record<string, boolean> = {};
      for (const k of ALL_PERMISSION_KEYS) np[k] = false;
      setNewRolePerms(np);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !canManageUsers) {
      router.replace("/");
    }
  }, [authLoading, canManageUsers, router]);

  useEffect(() => {
    if (canManageUsers) void load();
  }, [canManageUsers, load]);

  function openEdit(u: UserRow) {
    setSheetUser(u);
    setEditDisplayName(u.displayName ?? "");
    setEditActive(u.isActive);
    const er: Record<string, boolean> = {};
    for (const r of roles) er[r.name] = u.roles.includes(r.name);
    setEditRoles(er);
    setResetPwd("");
  }

  async function saveUser() {
    if (!sheetUser) return;
    setSaving(true);
    setMessage(null);
    try {
      const roleNames = Object.entries(editRoles)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch(`/api/admin/users/${sheetUser.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editDisplayName.trim() || null,
          isActive: editActive,
          roleNames,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof j.error === "string" ? j.error : t("error"));
        return;
      }
      if (resetPwd.trim().length >= 8) {
        const pr = await fetch(`/api/admin/users/${sheetUser.id}/password`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: resetPwd }),
        });
        const pj = await pr.json().catch(() => ({}));
        if (!pr.ok) {
          setMessage(typeof pj.error === "string" ? pj.error : t("error"));
          return;
        }
      }
      setSheetUser(null);
      await load();
      setMessage(t("workspaceSaved"));
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    setSaving(true);
    setMessage(null);
    try {
      const roleNames = Object.entries(newUserRoles)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          displayName: newDisplayName.trim() || null,
          roleNames,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof j.error === "string" ? j.error : t("error"));
        return;
      }
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      await load();
      setMessage(t("workspaceSaved"));
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(roleId: number) {
    const d = roleDrafts[roleId];
    if (!d) return;
    setSaving(true);
    setMessage(null);
    try {
      const permissionKeys = Object.entries(d.perms)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name.trim(), permissionKeys }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof j.error === "string" ? j.error : t("error"));
        return;
      }
      await load();
      setMessage(t("workspaceSaved"));
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    setSaving(true);
    setMessage(null);
    try {
      const permissionKeys = Object.entries(newRolePerms)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim(), permissionKeys }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof j.error === "string" ? j.error : t("error"));
        return;
      }
      setNewRoleName("");
      const cleared: Record<string, boolean> = {};
      for (const k of ALL_PERMISSION_KEYS) cleared[k] = false;
      setNewRolePerms(cleared);
      await load();
      setMessage(t("workspaceSaved"));
    } finally {
      setSaving(false);
    }
  }

  async function removeRole(roleId: number) {
    if (!confirm(t("adminDeleteRole"))) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof j.error === "string" ? j.error : t("error"));
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground text-sm">
        {t("loading")}
      </div>
    );
  }

  const allRoleNames = roles.map((r) => r.name);

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("adminUsers")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("adminPageDesc")}</p>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/30">
            {message}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">{t("adminTabUsers")}</TabsTrigger>
            <TabsTrigger value="roles">{t("adminTabRoles")}</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4 space-y-6">
            <Card className="p-4 border-border/80 space-y-3">
              <h2 className="text-sm font-semibold">{t("adminAddUser")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder={t("email")}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  autoComplete="off"
                />
                <Input
                  placeholder={t("password")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
                <Input
                  placeholder={t("adminDisplayName")}
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="sm:col-span-2"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {allRoleNames.map((rn) => (
                  <label key={rn} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newUserRoles[rn]}
                      onChange={(e) => setNewUserRoles((prev) => ({ ...prev, [rn]: e.target.checked }))}
                    />
                    {rn}
                  </label>
                ))}
              </div>
              <Button type="button" size="sm" onClick={() => void createUser()} disabled={saving || loading}>
                {t("adminAddUser")}
              </Button>
            </Card>

            <Card className="border-border/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("adminDisplayName")}</TableHead>
                    <TableHead>{t("adminRolesColumn")}</TableHead>
                    <TableHead>{t("adminActive")}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        {t("loading")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.displayName ?? "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-muted-foreground text-xs">
                          {u.roles.join(", ")}
                        </TableCell>
                        <TableCell>{u.isActive ? t("adminActive") : t("adminInactive")}</TableCell>
                        <TableCell>
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(u)}>
                            {t("adminEditUser")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="mt-4 space-y-4">
            <Card className="p-4 border-border/80 space-y-3">
              <h2 className="text-sm font-semibold">{t("adminCreateRole")}</h2>
              <Input
                placeholder={t("adminRoleName")}
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("adminPermissionsHint")}</p>
              <div className="flex flex-wrap gap-3">
                {permCatalog.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!newRolePerms[k]}
                      onChange={(e) =>
                        setNewRolePerms((prev) => ({ ...prev, [k]: e.target.checked }))
                      }
                    />
                    {t(PERM_LABEL[k] ?? "permViewDashboard")}
                  </label>
                ))}
              </div>
              <Button type="button" size="sm" onClick={() => void createRole()} disabled={saving}>
                {t("adminCreateRole")}
              </Button>
            </Card>

            {roles.map((r) => {
              const d = roleDrafts[r.id];
              if (!d) return null;
              return (
                <Card key={r.id} className="p-4 border-border/80 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Input
                      className="max-w-xs font-medium"
                      value={d.name}
                      onChange={(e) =>
                        setRoleDrafts((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], name: e.target.value },
                        }))
                      }
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void saveRole(r.id)} disabled={saving}>
                        {t("adminSave")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void removeRole(r.id)}
                        disabled={saving}
                      >
                        {t("adminDeleteRole")}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {permCatalog.map((k) => (
                      <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!d.perms[k]}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [r.id]: {
                                ...prev[r.id],
                                perms: { ...prev[r.id].perms, [k]: e.target.checked },
                              },
                            }))
                          }
                        />
                        {t(PERM_LABEL[k] ?? "permViewDashboard")}
                      </label>
                    ))}
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>

        <Sheet open={!!sheetUser} onOpenChange={(o) => !o && setSheetUser(null)}>
          <SheetContent className="flex flex-col gap-4 sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("adminEditUser")}</SheetTitle>
            </SheetHeader>
            {sheetUser && (
              <div className="space-y-4 flex-1">
                <p className="text-sm text-muted-foreground">{sheetUser.email}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium">{t("adminDisplayName")}</label>
                  <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                  {t("adminActive")}
                </label>
                <div className="space-y-2">
                  <p className="text-xs font-medium">{t("adminRolesColumn")}</p>
                  <div className="flex flex-wrap gap-3">
                    {allRoleNames.map((rn) => (
                      <label key={rn} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!editRoles[rn]}
                          onChange={(e) =>
                            setEditRoles((prev) => ({ ...prev, [rn]: e.target.checked }))
                          }
                        />
                        {rn}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium">{t("adminResetPassword")}</p>
                  <Input
                    type="password"
                    placeholder={t("adminNewPasswordPlaceholder")}
                    value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" onClick={() => void saveUser()} disabled={saving}>
                    {t("adminSave")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSheetUser(null)}>
                    {t("adminCancel")}
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
