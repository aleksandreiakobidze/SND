/**
 * Sales Agent — revenue analytics, sales performance, customer insights on RealViewAgent.
 * Extends the original SND Agent for the sales domain.
 */

import { generateSQLFromQuestion } from "@/lib/openai";
import {
  validateAgentResponse,
  formatValidationFeedbackForRetry,
} from "@/lib/agent-response-validate";
import type {
  DomainAgent,
  AgentContext,
  AgentResult,
} from "@/lib/agents/agent-base";

export const salesAgent: DomainAgent = {
  domain: "sales",
  label: "Sales",
  labelKa: "გაყიდვები",
  requiredPermission: "use_agent",
  allowedViews: ["RealViewAgent"],

  async generate(ctx: AgentContext): Promise<AgentResult> {
    const genOpts = {
      ownerHintsBlock: ctx.ownerHintsBlock,
      comparisonIntent: ctx.comparisonIntent,
      metricIntent: ctx.metricIntent,
      aliasContext: ctx.aliasContext,
      minOrderAmountIntent: ctx.minOrderAmountIntent,
      validationFeedback: ctx.validationFeedback,
    };

    let aiResponse = await generateSQLFromQuestion(
      ctx.normalizedQuestion,
      ctx.history,
      ctx.locale,
      genOpts,
    );

    let validation = validateAgentResponse(
      aiResponse,
      ctx.metricIntent,
      ctx.aliasContext,
      ctx.minOrderAmountIntent,
    );

    if (!validation.ok) {
      aiResponse = await generateSQLFromQuestion(
        ctx.normalizedQuestion,
        ctx.history,
        ctx.locale,
        {
          ...genOpts,
          validationFeedback: formatValidationFeedbackForRetry(validation.reasons),
        },
      );
      validation = validateAgentResponse(
        aiResponse,
        ctx.metricIntent,
        ctx.aliasContext,
        ctx.minOrderAmountIntent,
      );
      if (!validation.ok) {
        throw new ValidationError(validation.reasons);
      }
    }

    return { domain: "sales", response: aiResponse };
  },
};

export class ValidationError extends Error {
  public readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`Agent response failed validation: ${reasons.join(" ")}`);
    this.name = "ValidationError";
    this.reasons = reasons;
  }
}
