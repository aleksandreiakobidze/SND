/**
 * Deterministic domain classifier for the orchestrator.
 * Uses regex patterns (EN + KA) to decide which agent should handle a question.
 * Falls back to "sales" when ambiguous (most common domain).
 */

import type { AgentDomain } from "@/lib/agents/agent-base";

export interface DomainClassification {
  primary: AgentDomain;
  confidence: "high" | "medium" | "low";
  secondary?: AgentDomain;
}

const ONLINE_PATTERNS: RegExp[] = [
  /\border(?:s|ing)?\b/i,
  /\bonline\s+order/i,
  /\bmobile\s+order/i,
  /\bpocket\b/i,
  /\bstaging\b/i,
  /\bbefore\s+transfer\b/i,
  /\bpending\s+order/i,
  /\bvisit(?:s|ed)?\b/i,
  /\bpreseller\b/i,
  /\bpre-seller\b/i,
  /\bfield\s+(?:sales|operation|app)/i,
  /\bbelow\s+minimum\b/i,
  /\bunder\s+(?:the\s+)?minimum\b/i,
  /\bmin(?:imum)?\s+order\b/i,
  /შეკვეთ/i,
  /მინიმალურ/i,
  /მინიმუმ/i,
  /პრისეილერ/i,
  /ვიზიტ/i,
  /ონლაინ/i,
  /მობილური/i,
];

const PRICING_PATTERNS: RegExp[] = [
  /\bpric(?:e|es|ing)\b/i,
  /\bdiscount/i,
  /\bmargin/i,
  /\bmarkup/i,
  /\bexcise\b/i,
  /\bdealer\s+(?:commission|amount|percent)/i,
  /\bgross\s+margin\b/i,
  /\bnet\s+margin\b/i,
  /\bprice\s+list\b/i,
  /\bprice\s+trend\b/i,
  /\baverage\s+(?:selling\s+)?price\b/i,
  /\bcost\s+price\b/i,
  /\bprofitability\b/i,
  /ფას(?:ი|ის|ებ)/i,
  /ფასდაკლებ/i,
  /მარჟა/i,
  /აქციზ/i,
  /დილერ/i,
  /მოგება/i,
  /რენტაბელ/i,
];

const PURCHASE_PATTERNS: RegExp[] = [
  /\bpurchas(?:e|es|ed|ing)\b/i,
  /\bprocurement\b/i,
  /\bsupplier/i,
  /\binbound\b/i,
  /\bbuy(?:ing)?\b/i,
  /\bpurchase\s+(?:order|cost|price|volume)/i,
  /\bsupplier\s+(?:performance|delivery|fill)/i,
  /შესყიდ/i,
  /მომწოდებ/i,
  /მიმწოდებ/i,
  /შეძენ/i,
];

const INVENTORY_PATTERNS: RegExp[] = [
  /\bstock\b/i,
  /\binventor(?:y|ies)\b/i,
  /\bwarehouse\s+(?:level|utiliz|capac)/i,
  /\bstock[\s-]?out\b/i,
  /\bsafety\s+stock\b/i,
  /\bdays[\s-]?of[\s-]?supply\b/i,
  /\bturnover\s+ratio\b/i,
  /\breorder\b/i,
  /\bstock\s+movement/i,
  /\bstock\s+level/i,
  /მარაგ/i,
  /საწყობ/i,
  /ნაშთ/i,
  /ბრუნვა.*მარაგ/i,
];

const SALES_BOOST_PATTERNS: RegExp[] = [
  /\brevenue\b/i,
  /\bsales\s+(?:report|trend|performance|analytics|by|category)/i,
  /\btop\s+(?:product|customer|brand)/i,
  /\bmanager\s+performance\b/i,
  /\bsalesman\b/i,
  /\bdashboard\b/i,
  /\bKPI\b/i,
  /\btrend\b/i,
  /\byear[\s-]?over[\s-]?year\b/i,
  /\bmonth[\s-]?over[\s-]?month\b/i,
  /გაყიდვ/i,
  /შემოსავ/i,
  /ბრუნვა(?!.*მარაგ)/i,
  /რეპორტ/i,
  /ანალიტიკ/i,
];

function countMatches(q: string, patterns: RegExp[]): number {
  return patterns.filter((re) => re.test(q)).length;
}

export function classifyDomain(question: string): DomainClassification {
  const q = question.trim();
  if (!q) return { primary: "sales", confidence: "low" };

  const scores: Record<AgentDomain, number> = {
    sales: countMatches(q, SALES_BOOST_PATTERNS),
    online: countMatches(q, ONLINE_PATTERNS),
    pricing: countMatches(q, PRICING_PATTERNS),
    purchase: countMatches(q, PURCHASE_PATTERNS),
    inventory: countMatches(q, INVENTORY_PATTERNS),
  };

  const sorted = (Object.entries(scores) as Array<[AgentDomain, number]>)
    .sort((a, b) => b[1] - a[1]);

  const [topDomain, topScore] = sorted[0];
  const [secondDomain, secondScore] = sorted[1];

  if (topScore === 0) {
    return { primary: "sales", confidence: "low" };
  }

  if (topScore > 0 && secondScore > 0 && topScore - secondScore <= 1) {
    return {
      primary: topDomain,
      confidence: "medium",
      secondary: secondDomain,
    };
  }

  return {
    primary: topDomain,
    confidence: topScore >= 2 ? "high" : "medium",
    ...(secondScore > 0 ? { secondary: secondDomain } : {}),
  };
}

/** Track which domain was used last so follow-up questions re-route correctly. */
export function resolveWithContext(
  classification: DomainClassification,
  lastDomain: AgentDomain | null,
): AgentDomain {
  if (classification.confidence === "low" && lastDomain) {
    return lastDomain;
  }
  return classification.primary;
}

/** Cross-domain patterns that require multiple agents working together. */
const CROSS_DOMAIN_PATTERNS: Array<{ pattern: RegExp; domains: [AgentDomain, AgentDomain] }> = [
  { pattern: /\bmargin\b.*\b(?:product|brand|category)\b/i, domains: ["sales", "pricing"] },
  { pattern: /\bcost.*(?:vs|versus|compared?\s+to).*(?:price|revenue|sales)/i, domains: ["purchase", "pricing"] },
  { pattern: /\b(?:purchase|cost).*(?:vs|versus|compared?\s+to).*(?:sell|revenue|sales)/i, domains: ["purchase", "sales"] },
  { pattern: /\bstock\s+turnover\b/i, domains: ["inventory", "sales"] },
  { pattern: /\b(?:reorder|replenish)/i, domains: ["inventory", "purchase"] },
  { pattern: /\bstock.*(?:vs|versus).*sales/i, domains: ["inventory", "sales"] },
  { pattern: /\bsales.*(?:vs|versus).*stock/i, domains: ["sales", "inventory"] },
  { pattern: /მარჟა.*პროდუქტ/i, domains: ["sales", "pricing"] },
  { pattern: /შესყიდვ.*გაყიდვ/i, domains: ["purchase", "sales"] },
  { pattern: /გაყიდვ.*შესყიდვ/i, domains: ["sales", "purchase"] },
  { pattern: /მარაგ.*გაყიდვ/i, domains: ["inventory", "sales"] },
  { pattern: /მარაგ.*შესყიდვ/i, domains: ["inventory", "purchase"] },
];

export interface CrossDomainClassification {
  isCrossDomain: boolean;
  domains: AgentDomain[];
}

export function detectCrossDomain(question: string): CrossDomainClassification {
  const q = question.trim();
  for (const rule of CROSS_DOMAIN_PATTERNS) {
    if (rule.pattern.test(q)) {
      return { isCrossDomain: true, domains: rule.domains };
    }
  }
  return { isCrossDomain: false, domains: [] };
}
