import type { TranslationKey } from "@/lib/i18n";
import type { ColumnDisplayMeta } from "@/lib/coordinate-format";

/** Stable ids persisted in DashboardLayout.recentTransactions (JSON) — dashboard sales report table/matrix. */
export const RECENT_TRANSACTIONS_COLUMN_IDS = [
  "date",
  "region",
  "customer",
  "customerCategory",
  "itemCategory",
  "brand",
  "saleType",
  "documentNo",
  "itemCode",
  "item",
  "qty",
  "liter",
  "price",
  "amount",
  "distinctCustomers",
  "preseller",
  "manager",
  "supervisor",
  "month",
  "year",
] as const;

export type RecentTransactionsColumnId = (typeof RECENT_TRANSACTIONS_COLUMN_IDS)[number];

/** Summed (qty, liter, amount) or averaged weighted (price) when the report is grouped. */
export const RECENT_TX_MEASURE_IDS = [
  "qty",
  "liter",
  "price",
  "amount",
  "distinctCustomers",
] as const satisfies readonly RecentTransactionsColumnId[];

export type AggregationType =
  | "sum"
  | "count"
  | "distinct_count"
  | "avg"
  | "min"
  | "max";

export type RecentTxValueDef = {
  valueId: RecentTransactionsColumnId;
  aggregation: AggregationType;
};

type RecentTxValueMeta = {
  sourceField: string;
  formatType: "money" | "liters" | "count" | "quantity";
  defaultAggregation: AggregationType;
  allowedAggregations: AggregationType[];
};

const MEASURE_SET = new Set<string>(RECENT_TX_MEASURE_IDS);

const CATALOG_SET = new Set<string>(RECENT_TRANSACTIONS_COLUMN_IDS);

export function isRecentTxMeasureColumnId(id: RecentTransactionsColumnId): boolean {
  return MEASURE_SET.has(id);
}

export const RECENT_TX_VALUE_META: Partial<Record<RecentTransactionsColumnId, RecentTxValueMeta>> = {
  customer: {
    sourceField: "IdOrg",
    formatType: "count",
    defaultAggregation: "distinct_count",
    allowedAggregations: ["count", "distinct_count"],
  },
  saleType: {
    sourceField: "SaleType",
    formatType: "count",
    defaultAggregation: "count",
    allowedAggregations: ["count", "distinct_count"],
  },
  documentNo: {
    sourceField: "DocumentNo",
    formatType: "count",
    defaultAggregation: "count",
    allowedAggregations: ["count", "distinct_count"],
  },
  itemCode: {
    sourceField: "ItemCode",
    formatType: "count",
    defaultAggregation: "distinct_count",
    allowedAggregations: ["count", "distinct_count"],
  },
  qty: {
    sourceField: "Qty",
    formatType: "quantity",
    defaultAggregation: "sum",
    allowedAggregations: ["sum", "count", "distinct_count", "avg", "min", "max"],
  },
  liter: {
    sourceField: "Liters",
    formatType: "liters",
    defaultAggregation: "sum",
    allowedAggregations: ["sum", "count", "distinct_count", "avg", "min", "max"],
  },
  amount: {
    sourceField: "Amount",
    formatType: "money",
    defaultAggregation: "sum",
    allowedAggregations: ["sum", "count", "distinct_count", "avg", "min", "max"],
  },
  price: {
    sourceField: "Price",
    formatType: "money",
    defaultAggregation: "avg",
    allowedAggregations: ["sum", "count", "distinct_count", "avg", "min", "max"],
  },
  distinctCustomers: {
    sourceField: "IdOrg",
    formatType: "count",
    defaultAggregation: "distinct_count",
    allowedAggregations: ["distinct_count", "count"],
  },
};

export function defaultAggregationForValueId(id: RecentTransactionsColumnId): AggregationType {
  return RECENT_TX_VALUE_META[id]?.defaultAggregation ?? "sum";
}

export function isRecentTxValueEligible(id: RecentTransactionsColumnId): boolean {
  return Boolean(RECENT_TX_VALUE_META[id]);
}

export function allowedAggregationsForValueId(id: RecentTransactionsColumnId): AggregationType[] {
  return RECENT_TX_VALUE_META[id]?.allowedAggregations ?? [];
}

export function normalizeValueDefs(
  valueIds: RecentTransactionsColumnId[],
  valueDefs?: RecentTxValueDef[],
): RecentTxValueDef[] {
  const byId = new Map<RecentTransactionsColumnId, AggregationType>();
  for (const d of valueDefs ?? []) {
    if (!isRecentTxValueEligible(d.valueId)) continue;
    const allowed = RECENT_TX_VALUE_META[d.valueId]?.allowedAggregations ?? ["sum"];
    const agg = allowed.includes(d.aggregation) ? d.aggregation : defaultAggregationForValueId(d.valueId);
    byId.set(d.valueId, agg);
  }
  return valueIds.map((id) => ({
    valueId: id,
    aggregation: byId.get(id) ?? defaultAggregationForValueId(id),
  }));
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
  documentNo: "DocumentNo",
  itemCode: "ItemCode",
  item: "Product",
  qty: "Qty",
  liter: "Liters",
  price: "Price",
  amount: "Amount",
  distinctCustomers: "DistinctCustomerCount",
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

const IDENTIFIER_META: ColumnDisplayMeta = {
  semanticType: "identifier",
  format: "text",
};

export const RECENT_TX_ROW_KEY_DISPLAY_META: Partial<Record<string, ColumnDisplayMeta>> = {
  IdOrg: IDENTIFIER_META,
  DocumentNo: IDENTIFIER_META,
  ItemCode: IDENTIFIER_META,
  CustomerCode: IDENTIFIER_META,
  OrderNo: IDENTIFIER_META,
  InvoiceNo: IDENTIFIER_META,
  OrganizationID: IDENTIFIER_META,
  OrganizationId: IDENTIFIER_META,
};

export function recentTxDisplayMetaForRowKey(rowKey: string): ColumnDisplayMeta | undefined {
  return RECENT_TX_ROW_KEY_DISPLAY_META[rowKey];
}

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
  documentNo: "rtColDocumentNo",
  itemCode: "rtColItemCode",
  item: "rtColItem",
  qty: "rtColQty",
  liter: "rtColLiter",
  price: "rtColPrice",
  amount: "rtColAmount",
  distinctCustomers: "rtColDistinctCustomers",
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
