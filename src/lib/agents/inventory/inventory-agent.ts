/**
 * Inventory / Warehouse Agent — stock management, movements, turnover.
 * Queries InventoryViewAgent (new DB view — must be created by DBA).
 */

import OpenAI from "openai";
import { INVENTORY_SCHEMA_DESCRIPTION } from "./inventory-schema";
import { detectInventoryIntent, type InventoryIntentKind } from "./inventory-intent";
import { getResponseFormatInstructions } from "@/lib/schema";
import type {
  DomainAgent,
  AgentContext,
  AgentResult,
} from "@/lib/agents/agent-base";
import type { AIResponse } from "@/lib/openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getInventoryFocusBlock(locale: "en" | "ka", kind: InventoryIntentKind): string {
  const lang = locale === "ka" ? "Georgian" : "English";
  const base = `## INVENTORY ANALYSIS FOCUS (mandatory)\nNarrative and chart title MUST be in ${lang}.\n\n`;

  switch (kind) {
    case "stock_levels":
      return base + "Focus on **current stock levels**. Show StockQty, StockLiters, StockValue by warehouse/product/brand.";
    case "below_safety_stock":
      return base + "Focus on **below safety stock / stock-out risk**. Filter WHERE StockQty < SafetyStockQty. Show deficit amounts.";
    case "stock_movement":
      return base + "Focus on **stock movements**. Group by MovementType (IN/OUT/TRANSFER/WRITEOFF). Show quantities and values.";
    case "stock_turnover":
      return base + "Focus on **stock turnover ratio**. Calculate outbound movement / average stock level. Higher turnover = faster-selling products.";
    case "days_of_supply":
      return base + "Focus on **days of supply (DOS)**. Calculate average daily outbound vs current stock. Show how many days current stock will last.";
    case "warehouse_utilization":
      return base + "Focus on **warehouse utilization**. Compare stock distribution across warehouses. Show stock value/volume percentages.";
    default:
      return base + "General inventory query. Use the most relevant stock-related columns.";
  }
}

export const inventoryAgent: DomainAgent = {
  domain: "inventory",
  label: "Inventory / Warehouse",
  labelKa: "მარაგი / საწყობი",
  requiredPermission: "use_agent",
  allowedViews: ["InventoryViewAgent"],

  async generate(ctx: AgentContext): Promise<AgentResult> {
    const inventoryIntent = detectInventoryIntent(ctx.normalizedQuestion);
    const focusBlock = getInventoryFocusBlock(ctx.locale, inventoryIntent.kind);

    const systemPrompt = `${INVENTORY_SCHEMA_DESCRIPTION}\n\n${focusBlock}\n\n${getResponseFormatInstructions(ctx.locale)}`;

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
    if (!content) throw new Error("No response from OpenAI (inventory agent)");

    const parsed = JSON.parse(content) as AIResponse;
    if (!parsed.sql || !parsed.narrative) {
      throw new Error("Invalid inventory agent response structure");
    }

    return { domain: "inventory", response: parsed };
  },
};
