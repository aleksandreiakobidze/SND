/**
 * "Minimum order amount restriction" / მინიმალური შესაკვეთი თანხის შეზღუდვა —
 * minimum order totals by customer segment (OrgT). Pre-transfer checks in the app.
 * Final enforcement should also live in SQL (stored procedure) on the server.
 */
export const MIN_ORDER_BY_ORG_T: Readonly<Record<string, number>> = {
  TT: 150,
  HoReCa: 250,
  "Draft Shop": 230,
};

/** Rows for UI table and agent prompt (canonical OrgT labels). */
export function getMinOrderRulesRows(): { orgT: string; minLari: number }[] {
  return Object.entries(MIN_ORDER_BY_ORG_T).map(([orgT, minLari]) => ({ orgT, minLari }));
}

/**
 * Injected into the AI agent system prompt: rules + how to find orders below minimum on OnlineRealViewAgent.
 */
export function getMinOrderRulesAgentPromptBlock(): string {
  const rows = getMinOrderRulesRows();
  const table = rows.map((r) => `| ${r.orgT} | ${r.minLari} |`).join("\n");
  const thresholds = rows
    .map((r) => {
      const lit = r.orgT.replace(/'/g, "''");
      return `(LOWER(LTRIM(RTRIM(OrgT))) = N'${lit.toLowerCase()}' AND OrderTotal < ${r.minLari})`;
    })
    .join("\n    OR ");

  return `
## Minimum order amount restriction (same values as the app transfer check)

Customer segment **OrgT** → minimum order total (**₾**, line sums **Tanxa** per header):

| OrgT | Min (₾) |
|------|---------|
${table}

### When the user asks to list orders **below** / **under** this minimum (e.g. "ყველა შეკვეთა რომელიც მინიმალურზე ნაკლებია", "orders under minimum", "არ აკმარებს მინიმუმს"):
1. Use **OnlineRealViewAgent** (staging orders).
2. Aggregate **one row per order header**: \`GROUP BY IdOnlineReal1\` (or \`IdReal1\` only if the view uses that name — prefer **IdOnlineReal1**).
3. \`OrderTotal = SUM(Tanxa)\`, \`OrgT\` = e.g. \`MAX(OrgT)\` per header.
4. Keep only rows where **OrderTotal** is **strictly less than** the minimum for that **OrgT** (case-insensitive), using the table above.
5. Orders whose OrgT is **not** in the table have **no** app-side minimum here — do not treat them as "below minimum" unless the user asks otherwise.

### Example pattern (adjust identifiers if your view uses different column names):

\`\`\`sql
WITH agg AS (
  SELECT
    IdOnlineReal1,
    MAX(OrgT) AS OrgT,
    MAX(Org) AS Org,
    CAST(SUM(Tanxa) AS float) AS OrderTotal
  FROM OnlineRealViewAgent
  GROUP BY IdOnlineReal1
)
SELECT IdOnlineReal1, Org, OrgT, OrderTotal
FROM agg
WHERE
    ${thresholds}
\`\`\`

### When the user only wants the **reference table** of min amounts (no live data), you can return a trivial SELECT without FROM is not valid in T-SQL — instead use a **chartType "table"** with a static explanation in **narrative**, or UNION ALL literal rows:

\`SELECT N'TT' AS OrgT, 150 AS MinAmountLari UNION ALL SELECT N'HoReCa', 250 UNION ALL SELECT N'Draft Shop', 230\`
`;
}

function normalizeOrgT(orgT: string | null | undefined): string {
  return (orgT ?? "").trim();
}

/** Returns the configured minimum for this OrgT, or null if no rule is defined here. */
export function getMinOrderForOrgT(orgT: string | null | undefined): number | null {
  const n = normalizeOrgT(orgT);
  const key = Object.keys(MIN_ORDER_BY_ORG_T).find(
    (k) => k.toLowerCase() === n.toLowerCase()
  );
  return key ? MIN_ORDER_BY_ORG_T[key] : null;
}

export function validateMinOrderAmount(
  orgT: string | null | undefined,
  orderTotal: number
): { ok: boolean; minRequired?: number; message?: string } {
  const min = getMinOrderForOrgT(orgT);
  if (min === null) {
    return { ok: true };
  }
  if (orderTotal + 1e-9 < min) {
    return {
      ok: false,
      minRequired: min,
      message: `Order total ₾${orderTotal.toFixed(2)} is below minimum ₾${min} for segment "${orgT ?? ""}".`,
    };
  }
  return { ok: true, minRequired: min };
}
