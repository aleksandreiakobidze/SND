import { NextRequest, NextResponse } from "next/server";
import { generateSQLFromQuestion } from "@/lib/openai";
import { executeReadOnlyQuery } from "@/lib/db";
import { formatOwnerHintsForSystemPrompt, listOwnerAgentHints } from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";
import { detectComparisonIntent } from "@/lib/agent-comparison-intent";
import { postprocessAgentComparison } from "@/lib/agent-comparison-postprocess";
import { detectMetricIntent, metricIntentToMeasureDisplay } from "@/lib/agent-metric-intent";
import {
  validateAgentResponse,
  formatValidationFeedbackForRetry,
} from "@/lib/agent-response-validate";
import {
  extractAliasMapFromHints,
  normalizeQuestionWithAliases,
} from "@/lib/agent-alias-normalize";
import { parseMinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    const { question, history, locale } = await req.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const hints = await listOwnerAgentHints(auth.ctx.user.id);
    const ownerHintsBlock = formatOwnerHintsForSystemPrompt(hints);
    const aliasMap = extractAliasMapFromHints(hints);
    const aliasContext = normalizeQuestionWithAliases(question, aliasMap);
    const normalizedQuestion = aliasContext.normalizedQuestion;

    const lang = locale === "ka" ? "ka" : "en";
    const comparisonIntent = detectComparisonIntent(normalizedQuestion);
    const metricIntent = detectMetricIntent(normalizedQuestion);
    const minOrderAmountIntent = parseMinOrderAmountIntent(normalizedQuestion);

    const genOpts = {
      ownerHintsBlock: ownerHintsBlock || undefined,
      comparisonIntent,
      metricIntent,
      aliasContext,
      minOrderAmountIntent,
    };

    let aiResponse = await generateSQLFromQuestion(normalizedQuestion, history || [], lang, genOpts);

    let validation = validateAgentResponse(
      aiResponse,
      metricIntent,
      aliasContext,
      minOrderAmountIntent,
    );
    if (!validation.ok) {
      aiResponse = await generateSQLFromQuestion(normalizedQuestion, history || [], lang, {
        ...genOpts,
        validationFeedback: formatValidationFeedbackForRetry(validation.reasons),
      });
      validation = validateAgentResponse(
        aiResponse,
        metricIntent,
        aliasContext,
        minOrderAmountIntent,
      );
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: "Agent response failed metric validation",
            details: validation.reasons.join(" "),
            sql: aiResponse.sql,
            narrative: aiResponse.narrative,
          },
          { status: 422 }
        );
      }
    }

    let data: Record<string, unknown>[] = [];
    try {
      data = await executeReadOnlyQuery(aiResponse.sql);
    } catch (sqlError) {
      return NextResponse.json(
        {
          error: "SQL execution failed",
          details: sqlError instanceof Error ? sqlError.message : "Unknown error",
          sql: aiResponse.sql,
          narrative: aiResponse.narrative,
        },
        { status: 422 }
      );
    }

    const processed = postprocessAgentComparison({
      intent: comparisonIntent,
      chartType: aiResponse.chartType,
      chartConfig: aiResponse.chartConfig,
      data,
      metricIntent,
    });

    const measureDisplay = metricIntentToMeasureDisplay(metricIntent.kind);
    const narrative = aliasContext.byDimensionUses.reduce((acc, use) => {
      const re = new RegExp(`\\b${use.alias}\\b`, "gi");
      return acc.replace(re, use.label);
    }, aiResponse.narrative ?? "");
    const isEmpty = processed.data.length === 0;
    const emptyNarrative = lang === "ka"
      ? "ფილტრის შედეგად შესაბამისი ჩანაწერები ვერ მოიძებნა. გადაამოწმეთ, არის თუ არა MinOrderAmount ძირითადად ცარიელი, ან ხომ არ არის ზღვარი ძალიან მკაცრი. საჭიროების შემთხვევაში სცადეთ IS NOT NULL ფილტრი > 0-ის ნაცვლად."
      : "No rows matched the current filter. Check whether MinOrderAmount is mostly null or whether the threshold is too strict. If needed, try IS NOT NULL instead of > 0.";
    const fallbackSuggestions = lang === "ka"
      ? [
          "აჩვენე იგივე ანგარიში MinOrderAmount IS NOT NULL ფილტრით",
          "აჩვენე იგივე ანგარიში MinOrderAmount ზღვრის გარეშე",
          "მაჩვენე რამდენ ჩანაწერს აქვს MinOrderAmount საერთოდ შევსებული",
        ]
      : [
          "Show the same report with MinOrderAmount IS NOT NULL",
          "Show the same report without MinOrderAmount threshold",
          "Count how many rows have MinOrderAmount configured",
        ];

    return NextResponse.json({
      sql: aiResponse.sql,
      data: processed.data,
      chartConfig: processed.chartConfig
        ? {
            type: processed.chartType,
            xKey: processed.chartConfig.xKey,
            yKeys: processed.chartConfig.yKeys,
            title: processed.chartConfig.title,
            comparison: processed.chartConfig.comparison,
            ...(measureDisplay ? { measureDisplay } : {}),
          }
        : null,
      narrative: isEmpty ? `${narrative}\n\n${emptyNarrative}`.trim() : narrative,
      suggestedQuestions: isEmpty
        ? (aiResponse.suggestedQuestions?.length ? aiResponse.suggestedQuestions : fallbackSuggestions)
        : (aiResponse.suggestedQuestions || []),
      metricIntentKind: metricIntent.kind,
    });
  } catch (error) {
    console.error("Agent API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
