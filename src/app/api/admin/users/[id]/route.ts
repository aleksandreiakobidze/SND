import { NextRequest, NextResponse } from "next/server";
import {
  countUsersWithPermission,
  findUserById,
  getPermissionsUnionForRoleNames,
  getUserPermissions,
  setUserRoles,
  updateUserProfile,
} from "@/lib/auth-db";
import { requireManageUsers } from "@/lib/auth-admin";
import { PERMISSION_MANAGE_USERS } from "@/lib/auth-permissions";

type Params = { id: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  const auth = await requireManageUsers();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;
  try {
    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      displayName?: unknown;
      isActive?: unknown;
      roleNames?: unknown;
    };

    if (body.roleNames !== undefined) {
      const roleNames = Array.isArray(body.roleNames)
        ? body.roleNames.filter((x): x is string => typeof x === "string")
        : [];
      if (roleNames.length === 0) {
        return NextResponse.json({ error: "At least one role is required" }, { status: 400 });
      }

      const beforePerms = await getUserPermissions(id);
      const newPerms = await getPermissionsUnionForRoleNames(roleNames);

      if (beforePerms.includes(PERMISSION_MANAGE_USERS) && !newPerms.includes(PERMISSION_MANAGE_USERS)) {
        const n = await countUsersWithPermission(PERMISSION_MANAGE_USERS);
        if (n <= 1) {
          return NextResponse.json(
            { error: "Cannot remove the last user with user-management permission" },
            { status: 400 },
          );
        }
      }

      await setUserRoles(id, roleNames);
    }

    if (body.isActive === false && user.isActive) {
      const perms = await getUserPermissions(id);
      if (perms.includes(PERMISSION_MANAGE_USERS)) {
        const n = await countUsersWithPermission(PERMISSION_MANAGE_USERS);
        if (n <= 1) {
          return NextResponse.json(
            { error: "Cannot deactivate the last user with user-management permission" },
            { status: 400 },
          );
        }
      }
    }

    if (body.displayName !== undefined || body.isActive !== undefined) {
      await updateUserProfile(id, {
        displayName:
          typeof body.displayName === "string" || body.displayName === null
            ? (body.displayName as string | null)
            : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/users/[id]", e);
    return NextResponse.json(
      { error: "Failed to update user", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
