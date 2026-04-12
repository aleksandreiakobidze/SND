import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type AnalyticsCoachResult = {
  reply: string;
  suggestions: string[];
};

export async function generateAnalyticsCoachReply(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[],
  locale: "en" | "ka",
  dataContext: string | null,
): Promise<AnalyticsCoachResult> {
  const lang = locale === "ka" ? "Georgian" : "English";

  const snapshotBlock = dataContext
    ? `\n---\n**Aggregated snapshot (current filters)**\n${dataContext}\n---\n`
    : "\n(No dashboard snapshot — give general analytics and process advice.)\n";

  const systemPrompt = `You are **SND Analytics Coach** — a senior advisor for beverage distribution and field sales analytics. Users work with **SND Analytics** (sales from RealViewAgent: regions, product categories, customers, managers, channels, etc.).

**Measures:** revenue = **Tanxa**; quantity (units) = **Raod**; **liters / volume** = **TevadobaTotal** (SUM for aggregates). If the user asks about **ლიტრები** or liters, the relevant column is **TevadobaTotal**, not Raod.

**Your job**
- Help users **interpret** KPIs and reports in plain language.
- Identify likely **problem areas**: weak regions, category mix, customer concentration, execution gaps — and **what to improve** (focus, follow-up, assortment, coverage), without naming or blaming specific people unless the user does.
- When the snapshot includes **Products MoM** (RevPrevMonth, RevMonthBeforePrev, DeltaMoM), use it to answer questions about **which SKUs/products declined** or grew vs the prior month — cite **IdProd** / **Product** and the direction of change from the numbers given (do not invent SKUs).
- Give **prioritized, practical** recommendations: what to check next on which report, which questions to ask the team, how to validate assumptions.
- If a **snapshot** is provided, tie advice to relative performance (shares, concentration, product deltas). If not, stay general and say what to measure.

**Rules**
- Do **not** output SQL, code, or claim you ran queries; you only see optional snapshot text from the server.
- Do **not** invent exact numbers; refer to the snapshot or say "on your dashboard".
- Reply entirely in **${lang}**.
- Respond with **valid JSON only**:
  {"reply": "<markdown string>", "suggestions": ["<short follow-up 1>", "..."] }
- Put **2–4** items in suggestions; same language as reply. Empty array if none.
${snapshotBlock}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.35,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const parsed = JSON.parse(content) as { reply?: unknown; suggestions?: unknown };
  if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    throw new Error("Invalid coach response");
  }

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.filter((s): s is string => typeof s === "string").slice(0, 5)
    : [];

  return { reply: parsed.reply.trim(), suggestions };
}
