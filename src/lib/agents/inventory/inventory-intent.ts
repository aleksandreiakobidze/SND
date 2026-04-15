/**
 * Inventory-specific intent detection.
 */

export type InventoryIntentKind =
  | "stock_levels"
  | "below_safety_stock"
  | "stock_movement"
  | "stock_turnover"
  | "days_of_supply"
  | "warehouse_utilization"
  | "general_inventory";

export interface InventoryIntentResult {
  kind: InventoryIntentKind;
}

const STOCK_LEVEL_PATTERNS: RegExp[] = [
  /\bcurrent\s+stock\b/i,
  /\bstock\s+level/i,
  /\bstock\s+on\s+hand/i,
  /\bavailable\s+stock/i,
  /\binventory\s+level/i,
  /მიმდინარე\s+მარაგ/i,
  /ნაშთ/i,
  /არსებული\s+მარაგ/i,
];

const SAFETY_STOCK_PATTERNS: RegExp[] = [
  /\bbelow\s+safety\b/i,
  /\bsafety\s+stock\b/i,
  /\bstock[\s-]?out\b/i,
  /\blow[\s-]?stock\b/i,
  /\bout\s+of\s+stock\b/i,
  /\bcritical\s+stock\b/i,
  /უსაფრთხოების\s+მარაგ/i,
  /დეფიციტ/i,
  /ამოწურ/i,
];

const MOVEMENT_PATTERNS: RegExp[] = [
  /\bstock\s+movement/i,
  /\bmovement\s+(?:history|journal|log)/i,
  /\binbound\b.*\boutbound\b/i,
  /\btransfer/i,
  /\bwrite[\s-]?off/i,
  /მოძრაობ/i,
  /ტრანსფერ/i,
  /ჩამოწერ/i,
];

const TURNOVER_PATTERNS: RegExp[] = [
  /\bstock\s+turnover/i,
  /\bturnover\s+ratio/i,
  /\binventory\s+turnover/i,
  /ბრუნვა.*მარაგ/i,
  /მარაგ.*ბრუნვ/i,
];

const DOS_PATTERNS: RegExp[] = [
  /\bdays[\s-]?of[\s-]?supply\b/i,
  /\bDOS\b/,
  /\bstock\s+cover/i,
  /\bdays[\s-]?cover/i,
  /მარაგის\s+დღეებ/i,
];

const WAREHOUSE_UTIL_PATTERNS: RegExp[] = [
  /\bwarehouse\s+utiliz/i,
  /\bwarehouse\s+capacity/i,
  /\bstock\s+distribution/i,
  /\bwarehouse\s+comparison/i,
  /საწყობ.*გამოყენებ/i,
  /საწყობ.*განაწილებ/i,
];

function anyMatch(q: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(q));
}

export function detectInventoryIntent(question: string): InventoryIntentResult {
  const q = question.trim();

  if (anyMatch(q, SAFETY_STOCK_PATTERNS)) return { kind: "below_safety_stock" };
  if (anyMatch(q, TURNOVER_PATTERNS)) return { kind: "stock_turnover" };
  if (anyMatch(q, DOS_PATTERNS)) return { kind: "days_of_supply" };
  if (anyMatch(q, MOVEMENT_PATTERNS)) return { kind: "stock_movement" };
  if (anyMatch(q, WAREHOUSE_UTIL_PATTERNS)) return { kind: "warehouse_utilization" };
  if (anyMatch(q, STOCK_LEVEL_PATTERNS)) return { kind: "stock_levels" };

  return { kind: "general_inventory" };
}
