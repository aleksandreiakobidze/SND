import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LayoutGrid,
  Bot,
  BarChart3,
  Package,
  Users,
  ShoppingCart,
  Smartphone,
  Shield,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

export type NavGroupDef = {
  id: string;
  labelKey: TranslationKey;
  /** Lower = higher in the sidebar */
  order: number;
};

export type SidebarNavItemDef = {
  /** Stable id for storage (rename / hide) */
  id: string;
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  groupId: string;
};

/** Logical sections: overview → workspace → sales → orders → agent */
export const SIDEBAR_NAV_GROUPS: NavGroupDef[] = [
  { id: "overview", labelKey: "navGroupOverview", order: 0 },
  { id: "workspace", labelKey: "navGroupWorkspace", order: 1 },
  { id: "sales", labelKey: "navGroupSales", order: 2 },
  { id: "orders", labelKey: "navGroupOrders", order: 3 },
  { id: "agent", labelKey: "navGroupAgent", order: 4 },
  { id: "admin", labelKey: "navGroupAdmin", order: 5 },
];

export const SIDEBAR_NAV_ITEMS: SidebarNavItemDef[] = [
  { id: "dashboard", groupId: "overview", href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "workspace", groupId: "workspace", href: "/workspace", labelKey: "myWorkspace", icon: LayoutGrid },
  { id: "sales", groupId: "sales", href: "/reports/sales", labelKey: "salesByRegion", icon: BarChart3 },
  { id: "products", groupId: "sales", href: "/reports/products", labelKey: "products", icon: Package },
  { id: "personnel", groupId: "sales", href: "/reports/personnel", labelKey: "personnel", icon: Users },
  { id: "customers", groupId: "sales", href: "/reports/customers", labelKey: "customers", icon: ShoppingCart },
  { id: "online-orders", groupId: "orders", href: "/online-orders", labelKey: "onlineOrders", icon: Smartphone },
  { id: "agent", groupId: "agent", href: "/agent", labelKey: "aiAgent", icon: Bot },
  { id: "admin-users", groupId: "admin", href: "/admin", labelKey: "adminUsers", icon: Shield },
];

export function navItemsInGroup(groupId: string): SidebarNavItemDef[] {
  return SIDEBAR_NAV_ITEMS.filter((i) => i.groupId === groupId);
}
