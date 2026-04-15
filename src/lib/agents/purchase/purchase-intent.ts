/**
 * Purchase-specific intent detection.
 */

export type PurchaseIntentKind =
  | "supplier_performance"
  | "purchase_cost"
  | "purchase_volume"
  | "purchase_trend"
  | "warehouse_inbound"
  | "general_purchase";

export interface PurchaseIntentResult {
  kind: PurchaseIntentKind;
}

const SUPPLIER_PATTERNS: RegExp[] = [
  /\bsupplier/i,
  /\bvendor/i,
  /\bsupply\s+chain/i,
  /\bfill\s+rate/i,
  /\blead\s+time/i,
  /\bdelivery\s+(?:time|performance|rate)/i,
  /მომწოდებ/i,
  /მიმწოდებ/i,
];

const COST_PATTERNS: RegExp[] = [
  /\bpurchase\s+cost/i,
  /\bcost\s+(?:price|per|analysis)/i,
  /\bcost\s+of\s+goods/i,
  /\bhighest\s+(?:purchase\s+)?cost/i,
  /შესყიდვის.*ფას/i,
  /ღირებულებ/i,
  /თვითღირებულებ/i,
];

const VOLUME_PATTERNS: RegExp[] = [
  /\bpurchase\s+volume/i,
  /\binbound\s+(?:volume|quantity)/i,
  /\bpurchased\s+(?:liters|quantity|units)/i,
  /შესყიდვის.*მოცულობ/i,
  /შესყიდული.*ლიტრ/i,
];

const TREND_PATTERNS: RegExp[] = [
  /\bpurchase\s+trend/i,
  /\bprocurement\s+trend/i,
  /\bpurchas.*(?:by\s+month|over\s+time|monthly|quarterly)/i,
  /შესყიდვ.*ტრენდ/i,
  /შესყიდვ.*დინამიკ/i,
];

const WAREHOUSE_PATTERNS: RegExp[] = [
  /\bwarehouse\s+(?:inbound|receiving)/i,
  /\bpurchas.*(?:by\s+)?warehouse/i,
  /\binbound\s+(?:by\s+)?warehouse/i,
  /საწყობ.*შესყიდვ/i,
  /შესყიდვ.*საწყობ/i,
];

function anyMatch(q: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(q));
}

export function detectPurchaseIntent(question: string): PurchaseIntentResult {
  const q = question.trim();

  if (anyMatch(q, SUPPLIER_PATTERNS)) return { kind: "supplier_performance" };
  if (anyMatch(q, TREND_PATTERNS)) return { kind: "purchase_trend" };
  if (anyMatch(q, COST_PATTERNS)) return { kind: "purchase_cost" };
  if (anyMatch(q, VOLUME_PATTERNS)) return { kind: "purchase_volume" };
  if (anyMatch(q, WAREHOUSE_PATTERNS)) return { kind: "warehouse_inbound" };

  return { kind: "general_purchase" };
}
