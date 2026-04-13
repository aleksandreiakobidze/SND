import OpenAI from "openai";
import {
  SCHEMA_DESCRIPTION,
  VIEW_ROUTING_INSTRUCTIONS,
  ONLINE_SCHEMA_DESCRIPTION,
  getResponseFormatInstructions,
  getComparisonChartPromptBlock,
} from "./schema";
import { getMinOrderRulesAgentPromptBlock } from "./online-transfer-rules";
import type { ComparisonIntentResult } from "./agent-comparison-intent";

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
  options?: { ownerHintsBlock?: string; comparisonIntent?: ComparisonIntentResult },
): Promise<AIResponse> {
  const ownerBlock = options?.ownerHintsBlock?.trim()
    ? `\n\n${options.ownerHintsBlock.trim()}\n\n`
    : "\n\n";
  const comparisonBlock =
    options?.comparisonIntent?.isComparison === true
      ? `\n\n${getComparisonChartPromptBlock(locale)}\n\n`
      : "";
  const systemPrompt = `${VIEW_ROUTING_INSTRUCTIONS}\n\n${SCHEMA_DESCRIPTION}\n\n${ONLINE_SCHEMA_DESCRIPTION}\n\n${getMinOrderRulesAgentPromptBlock()}${ownerBlock}${comparisonBlock}${getResponseFormatInstructions(locale)}`;

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
