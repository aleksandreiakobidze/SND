import {
  hasPermission,
  PERMISSION_ACCESS_ONLINE_ORDERS,
  PERMISSION_ASSIGN_SALES_DRIVER,
  PERMISSION_EDIT_WORKSPACE,
  PERMISSION_MANAGE_USERS,
  PERMISSION_USE_AGENT,
  PERMISSION_VIEW_DASHBOARD,
} from "@/lib/auth-permissions";

/** Agent SQL generation + personal hints */
export function canUseAgent(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_USE_AGENT);
}

/** Workspace and saved reports CRUD */
export function canEditWorkspace(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_EDIT_WORKSPACE);
}

/** Online orders list + transfer */
export function canAccessOnlineOrders(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_ACCESS_ONLINE_ORDERS);
}

/** Dashboard + report pages + read-only workspace (GET) */
export function canViewDashboard(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_VIEW_DASHBOARD);
}

/** Sales map: assign driver (IdMdz) on RealViewAgent */
export function canAssignSalesDriver(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_ASSIGN_SALES_DRIVER);
}

/** Admin: users + roles CRUD */
export function canManageUsers(permissions: string[]): boolean {
  return hasPermission(permissions, PERMISSION_MANAGE_USERS);
}

/** Viewer is read-only for agent/workspace writes */
export function isViewerOnly(permissions: string[]): boolean {
  return (
    hasPermission(permissions, PERMISSION_VIEW_DASHBOARD) &&
    !hasPermission(permissions, PERMISSION_USE_AGENT)
  );
}
