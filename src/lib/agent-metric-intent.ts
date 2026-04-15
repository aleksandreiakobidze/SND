/**
 * Deterministic detection of which business measure the user asked for (liters vs money vs units).
 * Used to steer SQL generation, validation, and UI formatters.
 */

import type { ChartConfig, ChartMeasureDisplay } from "@/types";

export type MetricIntentKind =
  | "volume_liters"
  | "quantity_units"
  | "revenue_gel"
  | "mixed"
  | "unspecified";

export type MetricIntentResult = {
  kind: MetricIntentKind;
  hasVolume: boolean;
  hasQuantity: boolean;
  hasMoney: boolean;
};

/** Volume / liters — English + Georgian */
const VOLUME_PATTERNS: RegExp[] = [
  /\bliters?\b/i,
  /\bvolume\b/i,
  /\bsales\s+volume\b/i,
  /ლიტრი/i,
  /ლიტრებ/i,
  /ლიტრით/i,
  /ლიტრების/i,
  /ლიტრებში/i,
  /მოცულობა/i,
  /მოცულობით/i,
];

/** Unit count (not liters) — English + Georgian */
const QUANTITY_PATTERNS: RegExp[] = [
  /\bcount\b/i,
  /\bnumber\s+of\b/i,
  /\bdistinct\s+(customers?|clients?|orders?|organizations?)\b/i,
  /\bcustomers?\s+count\b/i,
  /\borders?\s+count\b/i,
  /\borganizations?\s+count\b/i,
  /\bqty\b/i,
  /\bquantity\b/i,
  /\bquantities\b/i,
  /\bunits?\b/i,
  /\bcases?\b/i,
  /\bbottles?\b/i,
  /\bpieces?\b/i,
  /რაოდენობა/i,
  /რაოდენობით/i,
  /ცალი/i,
  /ცალობით/i,
  /კოლოფი/i,
  /ყუთი/i,
];

/** Money / value — English + Georgian */
const MONEY_PATTERNS: RegExp[] = [
  /\brevenue\b/i,
  /\bturnover\b/i,
  /\bamount\b/i,
  /\bsales\s+amount\b/i,
  /\bsales\s+value\b/i,
  /\bvalue\b/i,
  /\bmoney\b/i,
  /\bGEL\b/i,
  /\blari\b/i,
  /₾/,
  /თანხა/i,
  /თანხის/i,
  /ბრუნვა/i,
  /ბრუნვის/i,
  /ლარ/i,
  /ფული/i,
];

function anyMatch(q: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(q));
}

/**
 * Classify the user's requested measure. When multiple families appear, `mixed`.
 * Bare "sales" / "გაყიდვა" without volume/qty/money hints → unspecified (downstream defaults to revenue-style analytics).
 */
export function detectMetricIntent(question: string): MetricIntentResult {
  const q = question.trim();
  if (!q) {
    return {
      kind: "unspecified",
      hasVolume: false,
      hasQuantity: false,
      hasMoney: false,
    };
  }

  const hasVolume = anyMatch(q, VOLUME_PATTERNS);
  const hasQuantity = anyMatch(q, QUANTITY_PATTERNS);
  const hasMoney = anyMatch(q, MONEY_PATTERNS);

  const families = [hasVolume, hasQuantity, hasMoney].filter(Boolean).length;

  if (families >= 2) {
    return { kind: "mixed", hasVolume, hasQuantity, hasMoney };
  }
  if (hasVolume) {
    return { kind: "volume_liters", hasVolume, hasQuantity, hasMoney };
  }
  if (hasQuantity) {
    return { kind: "quantity_units", hasVolume, hasQuantity, hasMoney };
  }
  if (hasMoney) {
    return { kind: "revenue_gel", hasVolume, hasQuantity, hasMoney };
  }

  return { kind: "unspecified", hasVolume, hasQuantity, hasMoney };
}

/** Map intent kind to ChartConfig.measureDisplay (unspecified → money as product default for analytics). */
export function metricIntentToMeasureDisplay(kind: MetricIntentKind): ChartMeasureDisplay | undefined {
  switch (kind) {
    case "volume_liters":
      return "liters";
    case "quantity_units":
      return "quantity";
    case "revenue_gel":
      return "money";
    case "mixed":
      return "mixed";
    case "unspecified":
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Resolve how to format chart/matrix numbers: prefer persisted `measureDisplay`, else infer from column names.
 */
export function resolveMeasureDisplay(
  chartConfig: ChartConfig | null | undefined,
  data?: Record<string, unknown>[] | null,
): ChartMeasureDisplay {
  const keys = [
    ...(chartConfig?.yKeys ?? []),
    ...(data?.[0] ? Object.keys(data[0]) : []),
    chartConfig?.comparison?.measure ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const hasCountSignal =
    /\bcount\b|distinct|customercount|ordercount|orgcount|organizationcount|customer_count|order_count/i.test(
      keys,
    );

  const md = chartConfig?.measureDisplay;
  // Count-like metrics must never be displayed as money, even if persisted metadata says "money".
  if (md === "money" && hasCountSignal) return "quantity";
  if (md === "liters" || md === "money" || md === "quantity" || md === "mixed") {
    return md;
  }
  if (/liters|tevadoba|volume/i.test(keys)) return "liters";
  if (hasCountSignal) {
    return "quantity";
  }
  if (/\braod\b|quantity|units/i.test(keys)) return "quantity";
  return "money";
}

/**
 * Injected after schema / comparison blocks. Tells the model exactly which aggregate to use.
 */
export function getMetricIntentPromptBlock(
  locale: "en" | "ka",
  intent: MetricIntentResult,
): string {
  const lang = locale === "ka" ? "Georgian" : "English";

  const base = `
## REQUESTED MEASURE (mandatory — follow exactly)

The user's question was analyzed for **which metric** they want. Narrative and chart **title** MUST be in ${lang} and MUST describe **this** measure, not a different one.

`;

  switch (intent.kind) {
    case "volume_liters":
      return (
        base +
        `**Intent: volume in LITERS (not money, not unit count in pieces).**

- In SQL use **SUM(TevadobaTotal)** for total liters on the line. Alias it **Liters** or **VolumeLiters**.
- Do **not** use **SUM(Tanxa)** as the primary value for this question. Do **not** describe the result as revenue or GEL.
- Chart title and narrative must say **liters** / **volume** (or Georgian equivalents: ლიტრები, მოცულობა). Do **not** use ₾, GEL, or "revenue" for this single-measure answer.
- If the result shape is tidy (Month, Brand, one measure), that measure column must be liters from **TevadobaTotal**.
`
      );
    case "quantity_units":
      return (
        base +
        `**Intent: quantity in UNITS / pieces (Raod), not liters unless the user also asked for liters.**

- Use **SUM(Raod)** for quantity. Alias **Quantity** or **Units**.
- Do not substitute **TevadobaTotal** unless the user asked for liters.
- Title/narrative: quantity / units / ცალი / რაოდენობა — not liters, not GEL unless they also asked for money.
`
      );
    case "revenue_gel":
      return (
        base +
        `**Intent: monetary REVENUE / amount (GEL).**

- Use **SUM(Tanxa)** for line revenue. Alias **Revenue** or **AmountGEL** as appropriate.
- Title/narrative may refer to revenue, amount, GEL / თანხა / ბრუნვა.
`
      );
    case "mixed":
      return (
        base +
        `**Intent: MORE THAN ONE measure** (e.g. liters and revenue).

- Return **both** measures with clear English aliases (e.g. **Liters** from SUM(TevadobaTotal) and **Revenue** from SUM(Tanxa)) in tidy long form, or two clearly named columns.
- Narrative and title must **separate** liters vs money — do not conflate them.
- Do not show only one measure if the user asked for two.
`
      );
    case "unspecified":
    default:
      return (
        base +
        `**Intent: measure not explicitly named** (e.g. generic "sales").

- Prefer **revenue** (**SUM(Tanxa)**) for generic "sales" analytics unless the question clearly implies liters (already covered above) or quantity.
- State in narrative what you chose (revenue vs other) briefly if helpful.
`
      );
  }
}
