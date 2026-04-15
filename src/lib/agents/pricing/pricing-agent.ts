/**
 * Pricing / Finance Agent — price analysis, discount management, margin analytics.
 * Uses existing RealViewAgent financial columns.
 */

import OpenAI from "openai";
import { PRICING_SCHEMA_DESCRIPTION } from "./pricing-schema";
import { detectPricingIntent, type PricingIntentKind } from "./pricing-intent";
import { getResponseFormatInstructions } from "@/lib/schema";
import type {
  DomainAgent,
  AgentContext,
  AgentResult,
} from "@/lib/agents/agent-base";
import type { AIResponse } from "@/lib/openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getPricingFocusBlock(locale: "en" | "ka", kind: PricingIntentKind): string {
  const lang = locale === "ka" ? "Georgian" : "English";
  const base = `## PRICING ANALYSIS FOCUS (mandatory)\nNarrative and chart title MUST be in ${lang}.\n\n`;

  switch (kind) {
    case "avg_price":
      return base + "Focus on **average selling price** (AVG(Fasi)). Show price by product/brand/category/region as requested.";
    case "discount_analysis":
      return base + "Focus on **discount analysis**. Use Discount column. Show discount depth, total discounts (SUM(Discount * Raod)), discount as % of revenue.";
    case "margin_analysis":
      return base + "Focus on **margin analysis**. Compare BrutoTotal vs Tanxa, calculate gross margin. Use financial columns.";
    case "dealer_commission":
      return base + "Focus on **dealer/distributor commissions**. Use TanxaDiler (dealer amount) and ProcDiler (dealer %). Group by sales rep/region as requested.";
    case "excise_tax":
      return base + "Focus on **excise tax analysis**. Use Aqcizi column. Show excise amounts, excise as % of revenue.";
    case "transport_cost":
      return base + "Focus on **transport cost analysis**. Use TransTanxa column. Show transport costs, transport as % of revenue.";
    case "plan_vs_actual":
      return base + "Focus on **plan vs actual** comparison. Use GegmaTanxa (planned/target) vs Tanxa (actual). Calculate achievement %.";
    case "price_trend":
      return base + "Focus on **price trends over time**. Use AVG(Fasi) grouped by time period (Data/Tve/Celi). Show as line chart.";
    default:
      return base + "General pricing query. Use the most relevant financial columns (Fasi, Discount, TanxaDiler, Aqcizi, TransTanxa, GegmaTanxa, BrutoTotal).";
  }
}

export const pricingAgent: DomainAgent = {
  domain: "pricing",
  label: "Pricing / Finance",
  labelKa: "ფასები / ფინანსები",
  requiredPermission: "use_agent",
  allowedViews: ["RealViewAgent"],

  async generate(ctx: AgentContext): Promise<AgentResult> {
    const pricingIntent = detectPricingIntent(ctx.normalizedQuestion);
    const focusBlock = getPricingFocusBlock(ctx.locale, pricingIntent.kind);

    const systemPrompt = `${PRICING_SCHEMA_DESCRIPTION}\n\n${focusBlock}\n\n${getResponseFormatInstructions(ctx.locale)}`;

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
    if (!content) throw new Error("No response from OpenAI (pricing agent)");

    const parsed = JSON.parse(content) as AIResponse;
    if (!parsed.sql || !parsed.narrative) {
      throw new Error("Invalid pricing agent response structure");
    }

    return { domain: "pricing", response: parsed };
  },
};
