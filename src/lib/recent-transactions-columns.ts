import type { TranslationKey } from "@/lib/i18n";

/** Stable ids persisted in DashboardLayout.recentTransactions (JSON) — dashboard sales report table/matrix. */
export const RECENT_TRANSACTIONS_COLUMN_IDS = [
  "date",
  "region",
  "customer",
  "customerCategory",
  "itemCategory",
  "brand",
  "saleType",
  "itemCode",
  "item",
  "qty",
  "liter",
  "price",
  "amount",
  "preseller",
  "manager",
  "supervisor",
  "month",
  "year",
] as const;

export type RecentTransactionsColumnId = (typeof RECENT_TRANSACTIONS_COLUMN_IDS)[number];

/** Summed (qty, liter, amount) or averaged weighted (price) when the report is grouped. */
export const RECENT_TX_MEASURE_IDS = ["qty", "liter", "price", "amount"] as const satisfies readonly RecentTransactionsColumnId[];

const MEASURE_SET = new Set<string>(RECENT_TX_MEASURE_IDS);

const CATALOG_SET = new Set<string>(RECENT_TRANSACTIONS_COLUMN_IDS);

export function isRecentTxMeasureColumnId(id: RecentTransactionsColumnId): boolean {
  return MEASURE_SET.has(id);
}

/** Row keys returned by dashboard SQL (PascalCase aliases). */
export const RECENT_TX_ID_TO_ROW_KEY: Record<RecentTransactionsColumnId, string> = {
  date: "Date",
  region: "Region",
  customer: "Org",
  customerCategory: "OrgType",
  itemCategory: "Category",
  brand: "Brand",
  saleType: "SaleType",
  itemCode: "ItemCode",
  item: "Product",
  qty: "Qty",
  liter: "Liters",
  price: "Price",
  amount: "Amount",
  preseller: "Preseller",
  manager: "Manager",
  supervisor: "Supervisor",
  month: "Month",
  year: "Year",
};

export const RECENT_TX_ROW_KEY_TO_ID: Record<string, RecentTransactionsColumnId> = Object.fromEntries(
  (Object.entries(RECENT_TX_ID_TO_ROW_KEY) as [RecentTransactionsColumnId, string][]).map(([id, key]) => [
    key,
    id,
  ]),
) as Record<string, RecentTransactionsColumnId>;

export function rowKeyForColumnId(id: RecentTransactionsColumnId): string {
  return RECENT_TX_ID_TO_ROW_KEY[id];
}

/** i18n keys for table headers (must exist in translations en + ka). */
export const RECENT_TX_COLUMN_LABEL_KEY: Record<RecentTransactionsColumnId, TranslationKey> = {
  date: "rtColDate",
  region: "rtColRegion",
  customer: "rtColCustomer",
  customerCategory: "rtColCustomerCategory",
  itemCategory: "rtColItemCategory",
  brand: "rtColBrand",
  saleType: "rtColSaleType",
  itemCode: "rtColItemCode",
  item: "rtColItem",
  qty: "rtColQty",
  liter: "rtColLiter",
  price: "rtColPrice",
  amount: "rtColAmount",
  preseller: "rtColPreseller",
  manager: "rtColManager",
  supervisor: "rtColSupervisor",
  month: "rtColMonth",
  year: "rtColYear",
};

export function isRecentTransactionsColumnId(s: string): s is RecentTransactionsColumnId {
  return CATALOG_SET.has(s);
}

export function getDefaultRecentTransactionsPrefs(): {
  columnOrder: RecentTransactionsColumnId[];
  hiddenColumnIds: RecentTransactionsColumnId[];
} {
  return {
    columnOrder: [...RECENT_TRANSACTIONS_COLUMN_IDS],
    hiddenColumnIds: [],
  };
}
