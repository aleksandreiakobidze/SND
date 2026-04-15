/**
 * Pricing-specific intent detection patterns.
 * Determines the sub-type of pricing question: price analysis, discount, margin, etc.
 */

export type PricingIntentKind =
  | "avg_price"
  | "discount_analysis"
  | "margin_analysis"
  | "dealer_commission"
  | "excise_tax"
  | "transport_cost"
  | "plan_vs_actual"
  | "price_trend"
  | "general_pricing";

export interface PricingIntentResult {
  kind: PricingIntentKind;
}

const PRICE_PATTERNS: RegExp[] = [
  /\baverage\s+(?:selling\s+)?price\b/i,
  /\bavg\s+price\b/i,
  /\bprice\s+per\b/i,
  /\bunit\s+price\b/i,
  /საშუალო\s+ფას/i,
  /ფასი\s+ერთეულ/i,
];

const DISCOUNT_PATTERNS: RegExp[] = [
  /\bdiscount/i,
  /\brebate/i,
  /\bprice\s+reduction/i,
  /ფასდაკლებ/i,
  /შეღავათ/i,
];

const MARGIN_PATTERNS: RegExp[] = [
  /\bmargin/i,
  /\bgross\s+margin/i,
  /\bnet\s+margin/i,
  /\bprofitability/i,
  /\bmarkup/i,
  /მარჟა/i,
  /მოგება/i,
  /რენტაბელ/i,
];

const DEALER_PATTERNS: RegExp[] = [
  /\bdealer\b/i,
  /\bcommission/i,
  /\bdistributor\s+(?:amount|percent|fee)/i,
  /დილერ/i,
  /საკომისიო/i,
];

const EXCISE_PATTERNS: RegExp[] = [
  /\bexcise\b/i,
  /\btax\s+rate\b/i,
  /აქციზ/i,
  /გადასახადი.*ტარიფ/i,
];

const TRANSPORT_PATTERNS: RegExp[] = [
  /\btransport\s+cost/i,
  /\bshipping\s+cost/i,
  /\bdelivery\s+cost/i,
  /\blogistics\s+cost/i,
  /ტრანსპორტ.*ხარჯ/i,
  /მიტანის.*ხარჯ/i,
];

const PLAN_VS_ACTUAL_PATTERNS: RegExp[] = [
  /\bplan\b.*\bactual\b/i,
  /\bbudget\b.*\bactual\b/i,
  /\btarget\b.*\bachiev/i,
  /\bachievement/i,
  /\bplan\s+vs\b/i,
  /გეგმ.*ფაქტ/i,
  /ბიუჯეტ/i,
];

const PRICE_TREND_PATTERNS: RegExp[] = [
  /\bprice\s+trend/i,
  /\bprice\s+(?:change|movement|history)/i,
  /\bpric(?:e|ing)\s+(?:over\s+time|by\s+month|by\s+quarter)/i,
  /ფას.*ტრენდ/i,
  /ფას.*ცვლილებ/i,
  /ფას.*დინამიკ/i,
];

function anyMatch(q: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(q));
}

export function detectPricingIntent(question: string): PricingIntentResult {
  const q = question.trim();

  if (anyMatch(q, PLAN_VS_ACTUAL_PATTERNS)) return { kind: "plan_vs_actual" };
  if (anyMatch(q, DEALER_PATTERNS)) return { kind: "dealer_commission" };
  if (anyMatch(q, EXCISE_PATTERNS)) return { kind: "excise_tax" };
  if (anyMatch(q, TRANSPORT_PATTERNS)) return { kind: "transport_cost" };
  if (anyMatch(q, MARGIN_PATTERNS)) return { kind: "margin_analysis" };
  if (anyMatch(q, DISCOUNT_PATTERNS)) return { kind: "discount_analysis" };
  if (anyMatch(q, PRICE_TREND_PATTERNS)) return { kind: "price_trend" };
  if (anyMatch(q, PRICE_PATTERNS)) return { kind: "avg_price" };

  return { kind: "general_pricing" };
}
