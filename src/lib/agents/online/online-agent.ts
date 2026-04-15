/**
 * Online / Field Operations Agent — mobile orders, visits, staging on OnlineRealViewAgent.
 */

import { generateSQLFromQuestion } from "@/lib/openai";
import {
  validateAgentResponse,
  formatValidationFeedbackForRetry,
} from "@/lib/agent-response-validate";
import { ValidationError } from "@/lib/agents/sales/sales-agent";
import type {
  DomainAgent,
  AgentContext,
  AgentResult,
} from "@/lib/agents/agent-base";

export const onlineAgent: DomainAgent = {
  domain: "online",
  label: "Field Operations",
  labelKa: "საველე ოპერაციები",
  requiredPermission: "use_agent",
  allowedViews: ["OnlineRealViewAgent"],

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

    return { domain: "online", response: aiResponse };
  },
};
