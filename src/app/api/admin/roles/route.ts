import { NextRequest, NextResponse } from "next/server";
import {
  createRole,
  listRolesWithPermissions,
  setRolePermissionKeys,
} from "@/lib/auth-db";
import { requireManageUsers } from "@/lib/auth-admin";
import { ALL_PERMISSION_KEYS, isValidPermissionKey } from "@/lib/auth-permissions";

export async function GET() {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  try {
    const roles = await listRolesWithPermissions();
    return NextResponse.json({ roles, permissionCatalog: [...ALL_PERMISSION_KEYS] });
  } catch (e) {
    console.error("GET /api/admin/roles", e);
    return NextResponse.json(
      { error: "Failed to list roles", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json()) as { name?: unknown; permissionKeys?: unknown };
    const name = typeof body.name === "string" ? body.name : "";
    const rawKeys = Array.isArray(body.permissionKeys) ? body.permissionKeys : [];
    const permissionKeys = rawKeys.filter((x): x is string => typeof x === "string").filter(isValidPermissionKey);

    if (!name.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const roleId = await createRole(name);
    await setRolePermissionKeys(roleId, permissionKeys);
    return NextResponse.json({ ok: true, roleId });
  } catch (e) {
    console.error("POST /api/admin/roles", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    if (msg.includes("UNIQUE") || msg.includes("duplicate")) {
      return NextResponse.json({ error: "Role name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create role", details: msg }, { status: 500 });
  }
}
