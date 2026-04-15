/**
 * Purchase Agent — procurement analytics, supplier performance, inbound logistics.
 * Queries PurchaseViewAgent (new DB view — must be created by DBA).
 */

import OpenAI from "openai";
import { PURCHASE_SCHEMA_DESCRIPTION } from "./purchase-schema";
import { detectPurchaseIntent, type PurchaseIntentKind } from "./purchase-intent";
import { getResponseFormatInstructions } from "@/lib/schema";
import type {
  DomainAgent,
  AgentContext,
  AgentResult,
} from "@/lib/agents/agent-base";
import type { AIResponse } from "@/lib/openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getPurchaseFocusBlock(locale: "en" | "ka", kind: PurchaseIntentKind): string {
  const lang = locale === "ka" ? "Georgian" : "English";
  const base = `## PURCHASE ANALYSIS FOCUS (mandatory)\nNarrative and chart title MUST be in ${lang}.\n\n`;

  switch (kind) {
    case "supplier_performance":
      return base + "Focus on **supplier performance**. Group by Supplier. Show purchase amounts, order counts, and trends per supplier.";
    case "purchase_cost":
      return base + "Focus on **purchase cost analysis**. Use SUM(Tanxa) for total cost, AVG(Fasi) for average cost price. Compare products/brands by cost.";
    case "purchase_volume":
      return base + "Focus on **purchase volume**. Use SUM(TevadobaTotal) for liters or SUM(Raod) for units as the user requests.";
    case "purchase_trend":
      return base + "Focus on **purchase trends over time**. Group by time period (Data/Tve/Celi). Show as line chart.";
    case "warehouse_inbound":
      return base + "Focus on **warehouse inbound analysis**. Group by Sac (warehouse). Show received volumes and costs per warehouse.";
    default:
      return base + "General purchase/procurement query. Use the most relevant columns.";
  }
}

export const purchaseAgent: DomainAgent = {
  domain: "purchase",
  label: "Purchase",
  labelKa: "შესყიდვები",
  requiredPermission: "use_agent",
  allowedViews: ["PurchaseViewAgent"],

  async generate(ctx: AgentContext): Promise<AgentResult> {
    const purchaseIntent = detectPurchaseIntent(ctx.normalizedQuestion);
    const focusBlock = getPurchaseFocusBlock(ctx.locale, purchaseIntent.kind);

    const systemPrompt = `${PURCHASE_SCHEMA_DESCRIPTION}\n\n${focusBlock}\n\n${getResponseFormatInstructions(ctx.locale)}`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...ctx.history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: ctx.normalizedQuestion },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI (purchase agent)");

    const parsed = JSON.parse(content) as AIResponse;
    if (!parsed.sql || !parsed.narrative) {
      throw new Error("Invalid purchase agent response structure");
    }

    return { domain: "purchase", response: parsed };
  },
};
