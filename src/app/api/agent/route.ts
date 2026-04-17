import { NextRequest, NextResponse } from "next/server";
import { APIError } from "openai";
import { executeReadOnlyQuery } from "@/lib/db";
import { formatOwnerHintsForSystemPrompt, listOwnerAgentHints } from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";
import { detectComparisonIntent } from "@/lib/agent-comparison-intent";
import { postprocessAgentComparison } from "@/lib/agent-comparison-postprocess";
import { detectMetricIntent, metricIntentToMeasureDisplay } from "@/lib/agent-metric-intent";
import {
  extractAliasMapFromHints,
  normalizeQuestionWithAliases,
} from "@/lib/agent-alias-normalize";
import { parseMinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";
import { orchestrate, PermissionDeniedError } from "@/lib/orchestrator/orchestrator";
import { getCrossDomainSuggestions } from "@/lib/orchestrator/cross-domain-suggestions";
import { ValidationError } from "@/lib/agents/sales/sales-agent";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error: "OpenAI is not configured",
          details:
            "Set OPENAI_API_KEY in your environment (e.g. .env.local) and restart the dev server.",
        },
        { status: 503 },
      );
    }

    const { question, history, locale } = await req.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    let hints: Awaited<ReturnType<typeof listOwnerAgentHints>> = [];
    try {
      hints = await listOwnerAgentHints(auth.ctx.user.id);
    } catch (hintErr) {
      console.warn(
        "Owner agent hints unavailable (continuing without):",
        hintErr instanceof Error ? hintErr.message : hintErr,
      );
    }
    const ownerHintsBlock = formatOwnerHintsForSystemPrompt(hints);
    const aliasMap = extractAliasMapFromHints(hints);
    const aliasContext = normalizeQuestionWithAliases(question, aliasMap);
    const normalizedQuestion = aliasContext.normalizedQuestion;

    const lang = locale === "ka" ? "ka" : "en";
    const comparisonIntent = detectComparisonIntent(normalizedQuestion);
    const metricIntent = detectMetricIntent(normalizedQuestion);
    const minOrderAmountIntent = parseMinOrderAmountIntent(normalizedQuestion);

    const { merged, domain } = await orchestrate({
      question,
      normalizedQuestion,
      history: history || [],
      locale: lang,
      userId: auth.ctx.user.id,
      permissions: auth.ctx.permissions,
      ownerHintsBlock: ownerHintsBlock || undefined,
      comparisonIntent,
      metricIntent,
      aliasContext,
      minOrderAmountIntent,
    });

    const aiResponse = merged.response;

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

    const baseSuggestions = isEmpty
      ? (aiResponse.suggestedQuestions?.length ? aiResponse.suggestedQuestions : fallbackSuggestions)
      : (aiResponse.suggestedQuestions || []);
    const crossSuggestions = getCrossDomainSuggestions(domain, lang, 2);
    const allSuggestions = [...baseSuggestions, ...crossSuggestions].slice(0, 6);

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
      suggestedQuestions: allSuggestions,
      metricIntentKind: metricIntent.kind,
      domain,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          error: "Agent response failed metric validation",
          details: error.reasons.join(" "),
        },
        { status: 422 }
      );
    }
    if (error instanceof PermissionDeniedError) {
      return NextResponse.json(
        { error: `Access denied for ${error.domain} domain` },
        { status: 403 }
      );
    }
    if (error instanceof APIError) {
      console.error("Agent API OpenAI error:", error.status, error.message);
      return NextResponse.json(
        {
          error: "OpenAI request failed",
          details: error.message,
          ...(error.status != null ? { openaiHttpStatus: error.status } : {}),
        },
        { status: 502 },
      );
    }
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
