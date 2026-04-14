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

    const lang = locale === "ka" ? "ka" : "en";
    const comparisonIntent = detectComparisonIntent(question);
    const metricIntent = detectMetricIntent(question);

    const genOpts = {
      ownerHintsBlock: ownerHintsBlock || undefined,
      comparisonIntent,
      metricIntent,
    };

    let aiResponse = await generateSQLFromQuestion(question, history || [], lang, genOpts);

    let validation = validateAgentResponse(aiResponse, metricIntent);
    if (!validation.ok) {
      aiResponse = await generateSQLFromQuestion(question, history || [], lang, {
        ...genOpts,
        validationFeedback: formatValidationFeedbackForRetry(validation.reasons),
      });
      validation = validateAgentResponse(aiResponse, metricIntent);
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
      narrative: aiResponse.narrative,
      suggestedQuestions: aiResponse.suggestedQuestions || [],
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
