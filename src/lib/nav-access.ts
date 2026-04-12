import type { SidebarNavItemDef } from "@/lib/nav-items";

export type NavCapabilities = {
  canViewDashboard: boolean;
  canUseAgent: boolean;
  canAccessOnlineOrders: boolean;
  canManageUsers: boolean;
  canAssignSalesDriver: boolean;
};

/** Which sidebar items the user may see (server still enforces API). */
export function isNavItemVisible(item: SidebarNavItemDef, c: NavCapabilities): boolean {
  switch (item.id) {
    case "dashboard":
    case "sales":
    case "products":
    case "personnel":
    case "customers":
      return c.canViewDashboard;
    case "sales-map":
      return c.canViewDashboard;
    case "workspace":
      return c.canViewDashboard;
    case "agent":
      return c.canUseAgent || c.canViewDashboard;
    case "online-orders":
      return c.canAccessOnlineOrders;
    case "admin-users":
      return c.canManageUsers;
    default:
      return true;
  }
}
