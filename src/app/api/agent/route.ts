import { NextRequest, NextResponse } from "next/server";
import { generateSQLFromQuestion } from "@/lib/openai";
import { executeReadOnlyQuery } from "@/lib/db";
import { formatOwnerHintsForSystemPrompt, listOwnerAgentHints } from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";

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
    const aiResponse = await generateSQLFromQuestion(question, history || [], lang, {
      ownerHintsBlock: ownerHintsBlock || undefined,
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

    return NextResponse.json({
      sql: aiResponse.sql,
      data,
      chartConfig: aiResponse.chartConfig
        ? {
            type: aiResponse.chartType,
            xKey: aiResponse.chartConfig.xKey,
            yKeys: aiResponse.chartConfig.yKeys,
            title: aiResponse.chartConfig.title,
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
