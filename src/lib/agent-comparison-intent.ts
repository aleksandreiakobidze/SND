/**
 * Deterministic detection of "comparison" analytical intent for the SQL agent.
 * Used to inject BI-style prompt rules and post-process charts/tables.
 */

export type ComparisonSignals = {
  /** User asked to compare entities or periods */
  hasVersus: boolean;
  /** User asked for breakdown by month/week/quarter/year or trend language */
  hasTimeBreakdown: boolean;
};

export type ComparisonIntentResult = {
  isComparison: boolean;
  signals: ComparisonSignals;
  /** User explicitly asked for pie/donut/share-of-total (do not coerce away from pie for single-period share) */
  explicitPieOrShare: boolean;
};

const VERSUS_PATTERNS: RegExp[] = [
  /\bcompare\b/i,
  /\bcomparison\b/i,
  /\bversus\b/i,
  /\bvs\.?\b/i,
  /შედარებ/i, // Georgian — do not use \b (ASCII word boundaries fail on Georgian letters)
  /შეადარე/i,
];

const TIME_BREAKDOWN_PATTERNS: RegExp[] = [
  /\bby\s+month\b/i,
  /\bby\s+week\b/i,
  /\bby\s+quarter\b/i,
  /\bby\s+year\b/i,
  /\bper\s+month\b/i,
  /\bmonthly\b/i,
  /\bweekly\b/i,
  /\bquarterly\b/i,
  /\byearly\b/i,
  /\bmonth[\s-]to[\s-]month\b/i,
  /\bmom\b/i,
  /\byoy\b/i,
  /\byear[\s-]over[\s-]year\b/i,
  /\btrend\b/i,
  /\bacross\s+months?\b/i,
  /\bacross\s+weeks?\b/i,
  /\bover\s+time\b/i,
  /\bperformance\s+over\s+time\b/i,
  /\bcurrent\s+year\b/i,
  /\bthis\s+year\b/i,
  /თვე(ებ)?\s+მიხედვით/i,
  /თვეების\s+მიხედვით/i,
  /თვე.*მიხედვით/i,
  /კვირ(ებ)?\s+მიხედვით/i,
  /\bკვარტალ/i,
  /\bწლ(ის|იური)\b/i,
  /\bტრენდ/i,
];

/** Explicitly wants share / proportion visualization (pie/donut allowed in edge cases). */
const EXPLICIT_PIE_SHARE_PATTERNS: RegExp[] = [
  /\bpie\s+chart\b/i,
  /\bdonut\b/i,
  /\bshare\s+of\b/i,
  /\bproportion\b/i,
  /\bmarket\s+share\b/i,
  /\b%?\s*of\s+total\b/i,
  /\bწილი\b/i,
  /\bპროპორცი/i,
  /\bდიაგრამა\s*\(pie\)/i,
];

export function detectComparisonIntent(question: string): ComparisonIntentResult {
  const q = question.trim();
  if (!q) {
    return {
      isComparison: false,
      signals: { hasVersus: false, hasTimeBreakdown: false },
      explicitPieOrShare: false,
    };
  }

  const hasVersus = VERSUS_PATTERNS.some((re) => re.test(q));
  const hasTimeBreakdown = TIME_BREAKDOWN_PATTERNS.some((re) => re.test(q));
  const explicitPieOrShare = EXPLICIT_PIE_SHARE_PATTERNS.some((re) => re.test(q));

  const isComparison =
    hasVersus ||
    hasTimeBreakdown ||
    /\bcompare\s+\w+\s+by\b/i.test(q) ||
    /\bcompare\s+.+\s+across\b/i.test(q);

  return {
    isComparison,
    signals: { hasVersus, hasTimeBreakdown },
    explicitPieOrShare,
  };
}
