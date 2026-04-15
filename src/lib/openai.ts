import OpenAI from "openai";
import {
  SCHEMA_DESCRIPTION,
  VIEW_ROUTING_INSTRUCTIONS,
  ONLINE_SCHEMA_DESCRIPTION,
  getResponseFormatInstructions,
  getComparisonChartPromptBlock,
  getMinOrderAmountInterpretationBlock,
} from "./schema";
import { getMinOrderRulesAgentPromptBlock } from "./online-transfer-rules";
import type { ComparisonIntentResult } from "./agent-comparison-intent";
import type { MetricIntentResult } from "./agent-metric-intent";
import { getMetricIntentPromptBlock } from "./agent-metric-intent";
import type { NormalizedAliasContext } from "./agent-alias-normalize";
import type { MinOrderAmountIntent } from "./agent-min-order-amount-intent";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  sql: string;
  chartType: "bar" | "line" | "pie" | "area" | "table" | "number";
  chartConfig: {
    xKey?: string;
    yKeys?: string[];
    title?: string;
  };
  narrative: string;
  suggestedQuestions: string[];
}

export async function generateSQLFromQuestion(
  question: string,
  conversationHistory: ConversationMessage[] = [],
  locale: "en" | "ka" = "en",
  options?: {
    ownerHintsBlock?: string;
    comparisonIntent?: ComparisonIntentResult;
    metricIntent?: MetricIntentResult;
    aliasContext?: NormalizedAliasContext;
    minOrderAmountIntent?: MinOrderAmountIntent;
    /** When set, previous JSON failed validation — model must fix and return new JSON. */
    validationFeedback?: string;
  },
): Promise<AIResponse> {
  const ownerBlock = options?.ownerHintsBlock?.trim()
    ? `\n\n${options.ownerHintsBlock.trim()}\n\n`
    : "\n\n";
  const metricIntent = options?.metricIntent;
  const metricBlock =
    metricIntent !== undefined
      ? `\n\n${getMetricIntentPromptBlock(locale, metricIntent)}\n\n`
      : "";
  const comparisonBlock =
    options?.comparisonIntent?.isComparison === true
      ? `\n\n${getComparisonChartPromptBlock(locale)}\n\n`
      : "";
  const aliasContext = options?.aliasContext;
  const aliasLines = (aliasContext?.resolutions ?? [])
    .filter((r, idx, arr) => arr.findIndex((x) => x.alias === r.alias) === idx)
    .map((r) => `- ${r.alias} -> ${r.canonical} (${r.kind})`);
  const aliasBlock = aliasLines.length
    ? `\n\n## ALIAS RESOLUTION (must follow)\nThe user has configured semantic aliases. These aliases are already normalized in the user question, but you must enforce the same semantics in SQL and narrative:\n${aliasLines.join("\n")}\n\nRules:\n- If an alias resolves to a dimension and appears in \"by <alias>\" intent, treat it as grouping dimension.\n- Never generate a literal filter that compares the resolved dimension field to the alias text.\n- Do not emit WHERE clauses equivalent to ProdT = N'aliasToken' for dimension aliases unless user explicitly requests literal member value.\n`
    : "";
  const fixBlock = options?.validationFeedback?.trim()
    ? `\n\n## CORRECTION REQUIRED\nYour previous response was **rejected** by validation. Fix ALL issues below and return **only** a new valid JSON object (same schema as before).\n\n${options.validationFeedback.trim()}\n\n`
    : "";
  const minOrderIntent = options?.minOrderAmountIntent;
  const minOrderPlanLines: string[] = [];
  if (minOrderIntent?.requestedInOutput) {
    minOrderPlanLines.push("- Output: include MinOrderAmount in SELECT.");
  }
  if (minOrderIntent?.filter) {
    if (minOrderIntent.filter.operator === "is_not_null") {
      minOrderPlanLines.push("- Filter: WHERE MinOrderAmount IS NOT NULL.");
    } else if (minOrderIntent.filter.operator === "is_null") {
      minOrderPlanLines.push("- Filter: WHERE MinOrderAmount IS NULL.");
    } else if (minOrderIntent.filter.value !== undefined) {
      const opSql =
        minOrderIntent.filter.operator === "gt"
          ? ">"
          : minOrderIntent.filter.operator === "gte"
            ? ">="
            : minOrderIntent.filter.operator === "lt"
              ? "<"
              : minOrderIntent.filter.operator === "lte"
                ? "<="
                : minOrderIntent.filter.operator === "neq"
                  ? "<>"
                  : "=";
      minOrderPlanLines.push(`- Filter: WHERE MinOrderAmount ${opSql} ${minOrderIntent.filter.value}.`);
    }
  }
  const minOrderPlanBlock = minOrderPlanLines.length
    ? `\n\n## MinOrderAmount intent extracted from user question\n${minOrderPlanLines.join("\n")}\n\nDo not change this intent mapping. Keep output selection and filtering separate.\n`
    : "";
  const systemPrompt = `${VIEW_ROUTING_INSTRUCTIONS}\n\n${SCHEMA_DESCRIPTION}\n\n${ONLINE_SCHEMA_DESCRIPTION}\n\n${getMinOrderRulesAgentPromptBlock()}\n\n${getMinOrderAmountInterpretationBlock()}${ownerBlock}${metricBlock}${comparisonBlock}${aliasBlock}${minOrderPlanBlock}${getResponseFormatInstructions(locale)}${fixBlock}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content) as AIResponse;

  if (!parsed.sql || !parsed.narrative) {
    throw new Error("Invalid AI response structure");
  }

  return parsed;
}
