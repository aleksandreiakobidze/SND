/** Must match dbo.SndApp_Permission.[Key] (see scripts/migrations/004-auth-permissions.sql). */
export const PERMISSION_VIEW_DASHBOARD = "view_dashboard";
export const PERMISSION_USE_AGENT = "use_agent";
export const PERMISSION_EDIT_WORKSPACE = "edit_workspace";
export const PERMISSION_ACCESS_ONLINE_ORDERS = "access_online_orders";
export const PERMISSION_MANAGE_USERS = "manage_users";
/** RealViewAgent IdMdz bulk update from /sales-map */
export const PERMISSION_ASSIGN_SALES_DRIVER = "assign_sales_driver";

export const ALL_PERMISSION_KEYS = [
  PERMISSION_VIEW_DASHBOARD,
  PERMISSION_USE_AGENT,
  PERMISSION_EDIT_WORKSPACE,
  PERMISSION_ACCESS_ONLINE_ORDERS,
  PERMISSION_MANAGE_USERS,
  PERMISSION_ASSIGN_SALES_DRIVER,
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

export function isValidPermissionKey(k: string): k is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(k);
}

export function hasPermission(permissions: string[], key: string): boolean {
  return permissions.includes(key);
}

/** When SndApp_RolePermission is empty / not migrated, derive from role names (matches 004 seed). */
export function legacyPermissionsFromRoleNames(roleNames: string[]): string[] {
  const set = new Set<string>();
  for (const raw of roleNames) {
    const n = raw.trim().toLowerCase();
    if (n === "admin") {
      ALL_PERMISSION_KEYS.forEach((k) => set.add(k));
    } else if (n === "analyst") {
      set.add(PERMISSION_VIEW_DASHBOARD);
      set.add(PERMISSION_USE_AGENT);
      set.add(PERMISSION_EDIT_WORKSPACE);
      set.add(PERMISSION_ACCESS_ONLINE_ORDERS);
      set.add(PERMISSION_ASSIGN_SALES_DRIVER);
    } else if (n === "viewer") {
      set.add(PERMISSION_VIEW_DASHBOARD);
    } else if (n === "operator") {
      set.add(PERMISSION_VIEW_DASHBOARD);
      set.add(PERMISSION_ACCESS_ONLINE_ORDERS);
    }
  }
  return [...set];
}
