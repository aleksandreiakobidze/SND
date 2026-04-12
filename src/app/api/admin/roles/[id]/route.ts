import { NextRequest, NextResponse } from "next/server";
import {
  countUsersWithPermission,
  deleteRole,
  listRolesWithPermissions,
  setRolePermissionKeys,
  updateRoleName,
} from "@/lib/auth-db";
import { requireManageUsers } from "@/lib/auth-admin";
import { isValidPermissionKey, PERMISSION_MANAGE_USERS } from "@/lib/auth-permissions";

type Params = { id: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  const { id: idStr } = await ctx.params;
  const roleId = parseInt(idStr, 10);
  if (!Number.isFinite(roleId)) {
    return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { name?: unknown; permissionKeys?: unknown };
    const all = await listRolesWithPermissions();
    const existing = all.find((r) => r.id === roleId);
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    if (typeof body.name === "string" && body.name.trim()) {
      await updateRoleName(roleId, body.name);
    }

    if (body.permissionKeys !== undefined) {
      const rawKeys = Array.isArray(body.permissionKeys) ? body.permissionKeys : [];
      const permissionKeys = rawKeys
        .filter((x): x is string => typeof x === "string")
        .filter(isValidPermissionKey);

      const beforeKeys = [...existing.permissionKeys];
      await setRolePermissionKeys(roleId, permissionKeys);
      const n = await countUsersWithPermission(PERMISSION_MANAGE_USERS);
      if (n === 0) {
        await setRolePermissionKeys(roleId, beforeKeys);
        return NextResponse.json(
          { error: "This change would remove all user-management access. Reverted." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/roles/[id]", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update role", details: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  const { id: idStr } = await ctx.params;
  const roleId = parseInt(idStr, 10);
  if (!Number.isFinite(roleId)) {
    return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
  }

  try {
    const all = await listRolesWithPermissions();
    const existing = all.find((r) => r.id === roleId);
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const rolesWithManage = all.filter((r) => r.permissionKeys.includes(PERMISSION_MANAGE_USERS));
    if (rolesWithManage.length === 1 && rolesWithManage[0].id === roleId) {
      return NextResponse.json(
        { error: "Cannot delete the only role that has user-management permission" },
        { status: 400 },
      );
    }

    await deleteRole(roleId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/roles/[id]", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("assigned")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to delete role", details: msg }, { status: 500 });
  }
}
