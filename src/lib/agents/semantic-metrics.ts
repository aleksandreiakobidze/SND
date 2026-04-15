/**
 * Centralized business metric definitions.
 * Domain agents reference this registry instead of hardcoding measure logic.
 */

import type { AgentDomain } from "./agent-base";
import type { ChartMeasureDisplay } from "@/types";

export interface SemanticMetric {
  id: string;
  name: string;
  nameKa: string;
  sqlExpression: string;
  alias: string;
  format: ChartMeasureDisplay | "count";
  unit: string;
  unitKa: string;
  domain: AgentDomain;
}

export const SEMANTIC_METRICS: SemanticMetric[] = [
  {
    id: "revenue_gel",
    name: "Revenue",
    nameKa: "შემოსავალი",
    sqlExpression: "SUM(Tanxa)",
    alias: "Revenue",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "sales",
  },
  {
    id: "volume_liters",
    name: "Volume (Liters)",
    nameKa: "მოცულობა (ლიტრი)",
    sqlExpression: "SUM(TevadobaTotal)",
    alias: "Liters",
    format: "liters",
    unit: "L",
    unitKa: "ლ",
    domain: "sales",
  },
  {
    id: "quantity_units",
    name: "Quantity (Units)",
    nameKa: "რაოდენობა (ცალი)",
    sqlExpression: "SUM(Raod)",
    alias: "Quantity",
    format: "quantity",
    unit: "units",
    unitKa: "ცალი",
    domain: "sales",
  },
  {
    id: "transaction_count",
    name: "Transaction Count",
    nameKa: "ტრანზაქციების რაოდენობა",
    sqlExpression: "COUNT(DISTINCT IdReal1)",
    alias: "Orders",
    format: "count",
    unit: "",
    unitKa: "",
    domain: "sales",
  },
  {
    id: "active_customers",
    name: "Active Customers",
    nameKa: "აქტიური კლიენტები",
    sqlExpression: "COUNT(DISTINCT IdOrg)",
    alias: "Customers",
    format: "count",
    unit: "",
    unitKa: "",
    domain: "sales",
  },
  {
    id: "gross_total",
    name: "Gross Total",
    nameKa: "ბრუტო ჯამი",
    sqlExpression: "SUM(BrutoTotal)",
    alias: "GrossTotal",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "sales",
  },
  {
    id: "avg_price",
    name: "Average Price",
    nameKa: "საშუალო ფასი",
    sqlExpression: "AVG(Fasi)",
    alias: "AvgPrice",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "pricing",
  },
  {
    id: "avg_discount",
    name: "Average Discount",
    nameKa: "საშუალო ფასდაკლება",
    sqlExpression: "AVG(Discount)",
    alias: "AvgDiscount",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "pricing",
  },
  {
    id: "dealer_amount",
    name: "Dealer Amount",
    nameKa: "დილერის თანხა",
    sqlExpression: "SUM(TanxaDiler)",
    alias: "DealerAmount",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "pricing",
  },
  {
    id: "excise_tax",
    name: "Excise Tax",
    nameKa: "აქციზი",
    sqlExpression: "SUM(Aqcizi)",
    alias: "ExciseTax",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "pricing",
  },
  {
    id: "transport_cost",
    name: "Transport Cost",
    nameKa: "ტრანსპორტის ხარჯი",
    sqlExpression: "SUM(TransTanxa)",
    alias: "TransportCost",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "pricing",
  },
  {
    id: "online_order_count",
    name: "Online Order Count",
    nameKa: "ონლაინ შეკვეთების რაოდენობა",
    sqlExpression: "COUNT(DISTINCT IdOnlineReal1)",
    alias: "OrderCount",
    format: "count",
    unit: "",
    unitKa: "",
    domain: "online",
  },
  {
    id: "online_order_value",
    name: "Online Order Value",
    nameKa: "ონლაინ შეკვეთის თანხა",
    sqlExpression: "SUM(Tanxa)",
    alias: "OrderValue",
    format: "money",
    unit: "GEL",
    unitKa: "ლარი",
    domain: "online",
  },
];

export function getMetricsByDomain(domain: AgentDomain): SemanticMetric[] {
  return SEMANTIC_METRICS.filter((m) => m.domain === domain);
}

export function getMetricById(id: string): SemanticMetric | undefined {
  return SEMANTIC_METRICS.find((m) => m.id === id);
}
