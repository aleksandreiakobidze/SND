export type MinOrderFilterOperator =
  | "is_null"
  | "is_not_null"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "neq";

export type MinOrderFilterIntent = {
  operator: MinOrderFilterOperator;
  value?: number;
};

export type MinOrderAmountIntent = {
  mentioned: boolean;
  requestedInOutput: boolean;
  filter: MinOrderFilterIntent | null;
};

const FIELD_RE =
  /\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b/i;

const OUTPUT_RE =
  /\b(add|show|include|display)\b[\s\S]{0,80}\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b/i;

const EXISTS_RE =
  /\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b[\s\S]{0,60}\b(exists?|filled|configured|not\s+empty|not\s+null|has)\b|\bonly\s+(?:rows|records|organizations?|customers?)\b[\s\S]{0,60}\bwith\b[\s\S]{0,40}\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b/i;

const MISSING_RE =
  /\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b[\s\S]{0,60}\b(is\s+empty|is\s+null|null|missing|without)\b|\b(without|no)\b[\s\S]{0,60}\b(min(?:imum)?\s*order\s*amount|minorderamount|configured\s+minimum|minimum\s+amount)\b/i;

function parseThresholdNearField(question: string): MinOrderFilterIntent | null {
  const q = question.toLowerCase();
  if (!FIELD_RE.test(q)) return null;

  const symbol = /\bmin(?:imum)?\s*order\s*amount\b[\s\S]{0,40}?(>=|<=|!=|>|<|=)\s*(\d+(?:\.\d+)?)/i.exec(
    question,
  );
  if (symbol) {
    const op = symbol[1];
    const num = Number(symbol[2]);
    if (!Number.isFinite(num)) return null;
    const operator: MinOrderFilterOperator =
      op === ">"
        ? "gt"
        : op === ">="
          ? "gte"
          : op === "<"
            ? "lt"
            : op === "<="
              ? "lte"
              : op === "!="
                ? "neq"
                : "eq";
    return { operator, value: num };
  }

  const phrase = /\b(min(?:imum)?\s*order\s*amount|minorderamount)\b[\s\S]{0,50}\b(above|over|more than|greater than|at least|below|under|less than|at most)\b[\s\S]{0,10}(\d+(?:\.\d+)?)/i.exec(
    question,
  );
  if (phrase) {
    const kind = phrase[2].toLowerCase();
    const num = Number(phrase[3]);
    if (!Number.isFinite(num)) return null;
    if (kind === "above" || kind === "over" || kind === "more than" || kind === "greater than") {
      return { operator: "gt", value: num };
    }
    if (kind === "at least") return { operator: "gte", value: num };
    if (kind === "below" || kind === "under" || kind === "less than") {
      return { operator: "lt", value: num };
    }
    if (kind === "at most") return { operator: "lte", value: num };
  }

  return null;
}

export function parseMinOrderAmountIntent(question: string): MinOrderAmountIntent {
  const mentioned = FIELD_RE.test(question);
  const requestedInOutput = OUTPUT_RE.test(question);
  const threshold = parseThresholdNearField(question);
  if (threshold) {
    return { mentioned, requestedInOutput, filter: threshold };
  }
  if (EXISTS_RE.test(question)) {
    return { mentioned, requestedInOutput, filter: { operator: "is_not_null" } };
  }
  if (MISSING_RE.test(question)) {
    return { mentioned, requestedInOutput, filter: { operator: "is_null" } };
  }
  return { mentioned, requestedInOutput, filter: null };
}
