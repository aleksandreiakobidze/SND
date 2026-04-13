import { NextRequest, NextResponse } from "next/server";
import { generateSQLFromQuestion } from "@/lib/openai";
import { executeReadOnlyQuery } from "@/lib/db";
import { formatOwnerHintsForSystemPrompt, listOwnerAgentHints } from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";
import { detectComparisonIntent } from "@/lib/agent-comparison-intent";
import { postprocessAgentComparison } from "@/lib/agent-comparison-postprocess";

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
    const aiResponse = await generateSQLFromQuestion(question, history || [], lang, {
      ownerHintsBlock: ownerHintsBlock || undefined,
      comparisonIntent,
    });

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
    });

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
