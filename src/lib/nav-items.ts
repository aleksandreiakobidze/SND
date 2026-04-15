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
  MapPin,
  Truck,
  CalendarCheck,
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

/** Logical sections: overview (incl. reports + online orders) → workspace → agent → administration */
export const SIDEBAR_NAV_GROUPS: NavGroupDef[] = [
  { id: "overview", labelKey: "navGroupOverview", order: 0 },
  { id: "workspace", labelKey: "navGroupWorkspace", order: 1 },
  { id: "agent", labelKey: "navGroupAgent", order: 2 },
  { id: "admin", labelKey: "navGroupAdmin", order: 3 },
];

export const SIDEBAR_NAV_ITEMS: SidebarNavItemDef[] = [
  { id: "dashboard", groupId: "overview", href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "sales", groupId: "overview", href: "/reports/sales", labelKey: "salesByRegion", icon: BarChart3 },
  { id: "products", groupId: "overview", href: "/reports/products", labelKey: "products", icon: Package },
  { id: "personnel", groupId: "overview", href: "/reports/personnel", labelKey: "personnel", icon: Users },
  { id: "customers", groupId: "overview", href: "/reports/customers", labelKey: "customers", icon: ShoppingCart },
  { id: "online-orders", groupId: "overview", href: "/online-orders", labelKey: "onlineOrders", icon: Smartphone },
  { id: "workspace", groupId: "workspace", href: "/workspace", labelKey: "myWorkspace", icon: LayoutGrid },
  { id: "agent", groupId: "agent", href: "/agent", labelKey: "aiAgent", icon: Bot },
  { id: "sales-map", groupId: "admin", href: "/sales-map", labelKey: "salesMap", icon: MapPin },
  { id: "vehicles", groupId: "admin", href: "/vehicles", labelKey: "vehicles", icon: Truck },
  { id: "fleet-schedule", groupId: "admin", href: "/fleet-schedule", labelKey: "fleetSchedule", icon: CalendarCheck },
  { id: "admin-users", groupId: "admin", href: "/admin", labelKey: "adminUsers", icon: Shield },
];

export function navItemsInGroup(groupId: string): SidebarNavItemDef[] {
  return SIDEBAR_NAV_ITEMS.filter((i) => i.groupId === groupId);
}
