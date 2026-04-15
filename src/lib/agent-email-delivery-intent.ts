/**
 * Deterministic detection of "email me this report / result" intent for the SND agent.
 * Does not call the LLM — must be unit-testable.
 */

import type { AgentReportView } from "@/lib/agent-report-view";

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** English + Georgian phrases that imply sending the current result by email. */
const EMAIL_INTENT_PATTERNS: RegExp[] = [
  /\bsend\s+(?:this|the|it)\s+(?:result|report|data)?\s*(?:to\s+)?(?:by\s+)?email/i,
  /\bemail\s+(?:this|the|it|my|me)\b/i,
  /\bmail\s+(?:this|the|it)\s+to\b/i,
  /\bsend\s+me\s+the\s+report\b/i,
  /\bexport\s+and\s+email\b/i,
  /\bsend\s+(?:this|the)\s+report\s+by\s+email\b/i,
  /\bsend\s+(?:the\s+)?(?:full\s+)?result\s+(?:as\s+)?(?:excel\s+)?to\b/i,
  /მეილზე\s+გამომიგზავნე/i,
  /იმეილზე\s+გამომიგზავნე/i,
  /ელფოსტაზე\s+გამომიგზავნე/i,
  /ამ\s+მეილზე\s+გააგზავნე/i,
  /გაუგზავნე\s+ამ\s+მისამართზე/i,
  /ექსელით\s+გამომიგზავნე/i,
  /რეზალტი\s+მეილზე\s+გამომიგზავნე/i,
  /გააგზავნე\s+ამ\s+მეილზე/i,
  /გააგზავნე\s+ეს\s+რეპორტი\s+მეილზე/i,
  /მეილზე\s+მომწერე/i,
  /ამ\s+შედეგს\s+მეილზე/i,
  /ამოღებული\s+შედეგი\s+ექსელით/i,
  /\bsend\s+it\s+on\s+mail\b/i,
  /\bsend\s+(?:this|the)\s+chart\s+on\s+mail\b/i,
  /\bemail\s+this\s+report\b/i,
  /\bsend\s+(?:this|the)\s+report\s+on\s+mail\b/i,
];

/** User wants spreadsheet/data only — no chart image. */
const EXCEL_ONLY_PATTERNS: RegExp[] = [
  /\bonly\s+(?:the\s+)?(?:excel|spreadsheet|data|file|xlsx)\b/i,
  /\b(?:just|only)\s+send\s+(?:the\s+)?(?:excel|spreadsheet|data)\b/i,
  /\bemail\s+only\s+(?:the\s+)?(?:data|excel|spreadsheet)\b/i,
  /\b(send|email)\s+only\s+the\s+spreadsheet\b/i,
  /მხოლოდ\s+(?:ექსელ|ექსცელ|სპრედშიტ)/i,
  /მხოლოდ\s+მონაცემ/i,
  /ექსელიც\s+მხოლოდ/i,
];

/** User explicitly mentioned the chart (attach chart image when rules allow). */
const CHART_EXPLICIT_PATTERNS: RegExp[] = [
  /\b(?:send|email|mail)\s+(?:this|the|my)?\s*chart\b/i,
  /\bchart\s+(?:and|&|,)\s*(?:data|excel|the\s+data|report)\b/i,
  /\b(?:data|excel|report)\s+(?:and|&|,)\s*chart\b/i,
  /\bchart\s+(?:preview|image|png)\b/i,
  /\bcurrent\s+chart\s+view\b/i,
  /ჩარტი.*მეილ/i,
  /მეილ.*ჩარტ/i,
  /ჩარტიც\s+და\s+ექსელ/i,
  /ექსელიც\s+და\s+ჩარტ/i,
  /სრული\s+ექსელ.*ჩარტ/i,
  /ჩარტის\s+(?:გამოსახულებ|სურათ)/i,
];

const MY_EMAIL_PATTERNS: RegExp[] = [
  /\b(?:send|email|mail)\s+(?:this|the\s+result|the\s+report)?\s*to\s+my\s+email\b/i,
  /\bto\s+my\s+email\b/i,
  /ჩემს\s+მეილზე\s+გამომიგზავნე/i,
];

/** Rich analysis / full explanation in email body (evaluated before summary). */
const EMAIL_BODY_DETAILED_PATTERNS: RegExp[] = [
  /\binclude\s+(?:the\s+)?analysis\b/i,
  /\b(?:full|detailed)\s+(?:analysis|explanation|text|description)\b/i,
  /\bexplanation\s+(?:in|into)\s+(?:the\s+)?email/i,
  /\bwrite\s+(?:the\s+)?explanation\s+in\s+(?:the\s+)?email/i,
  /\bwith\s+(?:the\s+)?analysis\s+in\s+(?:the\s+)?email/i,
  /\bsend\s+the\s+report\s+and\s+include\s+the\s+analysis/i,
  /სრული\s+შინაარს/i,
  /დეტალური\s+(?:აღწერ|ანალიზ)/i,
  /სრულად\s+გააგზავნე.*ტექსტ/i,
  /ანალიზიც\s+(?:ჩასვი|ჩაწერე)/i,
  /ტექსტიც\s+დაურთე/i,
];

/** Short summary / content in email body. */
const EMAIL_BODY_SUMMARY_PATTERNS: RegExp[] = [
  /\bwith\s+summary\b/i,
  /\binclude\s+(?:the\s+)?(?:summary|content|description)\b/i,
  /\bshort\s+summary\b/i,
  /\bwrite\s+a\s+short\s+summary\b/i,
  /\band\s+include\s+the\s+summary\b/i,
  /summary-?ც/i,
  /summary\s*ც\s*გაუგზავნე/i,
  /შინაარსიც\s+გააყოლე/i,
  /მოკლე\s+(?:აღწერ|ტექსტ|ანალიზ)(?:იც)?/i,
  /მოკლე\s+ტექსტიც\s+ჩაუწერე/i,
  /ტექსტიც\s+დაურთე/i,
  /მოკლე\s+ანალიზიც\s+ჩასვი/i,
  /description\s+too\b/i,
];

export type EmailBodyMode = "generic" | "summary" | "detailed" | "custom";

function parseEmailBodyMode(q: string): EmailBodyMode {
  if (EMAIL_BODY_DETAILED_PATTERNS.some((re) => re.test(q))) return "detailed";
  if (EMAIL_BODY_SUMMARY_PATTERNS.some((re) => re.test(q))) return "summary";
  return "generic";
}

/**
 * User-provided exact email body (quoted or labeled). Checked before summary/generic modes.
 * Does not trim inner whitespace beyond strip(); preserves intentional spelling.
 */
export function extractExplicitEmailBodyText(question: string): string | null {
  const t = normalizeText(question);
  if (!t) return null;

  const patterns: RegExp[] = [
    /შინაარსი\s+დაწერე\s*[:：]\s*["'«\u201c\u2018]([^"'\u201d\u2019»]+)["'»\u201d\u2019]/u,
    /ტექსტი\s+დაწერე\s*[:：]\s*["'«\u201c\u2018]([^"'\u201d\u2019»]+)["'»\u201d\u2019]/u,
    /შინაარსი\s+მიწერე\s*[:：]\s*["'«\u201c\u2018]([^"'\u201d\u2019»]+)["'»\u201d\u2019]/u,
    /(?:with\s+summary|with\s+content|with\s+(?:a\s+)?(?:message|text))\s*:\s*["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /(?:with\s+summary|with\s+content|with\s+(?:a\s+)?(?:message|text))\s+["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /\bwith\s+summary\s+[\u201c"]([^\u201d"]+)[\u201d"]/i,
    /(?:with\s+summary|with\s+content|with\s+(?:a\s+)?(?:message|text))\s*:\s*["']([^"']*)["']/i,
    /(?:with\s+summary|with\s+content|with\s+(?:a\s+)?(?:message|text))\s+["']([^"']*)["']/i,
    /\bbody\s*:\s*["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /\bbody\s+["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /\bmessage\s*:\s*["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /\bmessage\s+["'\u201c\u2018]([^"'\u201d\u2019]*)["'\u201d\u2019]/i,
    /შინაარსი\s*[:：]\s*["'«\u201c]([^"'\u201d»]+)["'»\u201d]/u,
    /ტექსტი\s*[:：]\s*["'«\u201c]([^"'\u201d»]+)["'»\u201d]/u,
    /შინაარსი\s*[:：]\s*["'«]([^"'»]+)["'»]/,
    /ტექსტი\s*[:：]\s*["'«]([^"'»]+)["'»]/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] !== undefined) {
      const inner = m[1].trim();
      if (inner.length > 0) return m[1];
    }
  }
  return null;
}

/** Unquoted line after `with summary:` / `with content:` for the generated Summary block (not full custom body). */
export function extractSummaryUserNote(question: string): string | null {
  const t = normalizeText(question);
  if (!t) return null;
  if (extractExplicitEmailBodyText(t) !== null) return null;
  const m = t.match(/(?:^|[\s,])(?:with\s+summary|with\s+content)\s*:\s*(.+)$/i);
  if (!m?.[1]) return null;
  const inner = m[1].trim();
  return inner.length > 0 ? inner : null;
}

export type EmailDeliveryIntent = {
  hasEmailIntent: boolean;
  /** First email found in the message (after normalizing mailto:). */
  recipientEmail: string | null;
  /** User asked for "my email" / signed-in address without giving an address. */
  useSignedInEmail: boolean;
  /** Phrasing like "only Excel" / "მხოლოდ ექსელი" — no chart attachment. */
  wantsExcelOnly: boolean;
  /** Phrasing that names the chart — forces chart image when chartable. */
  wantsChartExplicit: boolean;
  /** Whether the user asked for narrative content in the email body. */
  emailBodyMode: EmailBodyMode;
  /** Exact body text when user used quotes / შინაარსი: — only when mode is `custom`. */
  customEmailBodyText: string | null;
};

function normalizeText(s: string): string {
  return s.replace(/\u200b/g, "").trim();
}

/** Extract RFC-ish emails. */
export function extractEmailsFromText(text: string): string[] {
  const t = normalizeText(text);
  const seen = new Set<string>();
  const out: string[] = [];
  const matches = t.match(EMAIL_RE);
  if (!matches) return [];
  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(raw);
  }
  return out;
}

export function isValidEmailFormat(email: string): boolean {
  const e = email.trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function parseEmailDeliveryIntent(question: string): EmailDeliveryIntent {
  const q = normalizeText(question);
  if (!q) {
    return {
      hasEmailIntent: false,
      recipientEmail: null,
      useSignedInEmail: false,
      wantsExcelOnly: false,
      wantsChartExplicit: false,
      emailBodyMode: "generic",
      customEmailBodyText: null,
    };
  }

  const explicitBody = extractExplicitEmailBodyText(q);

  const emails = extractEmailsFromText(q);
  const recipientEmail = emails[0] ?? null;

  const hasPhrase = EMAIL_INTENT_PATTERNS.some((re) => re.test(q));
  const useSignedInEmail = MY_EMAIL_PATTERNS.some((re) => re.test(q)) && !recipientEmail;

  /** Message contains an address + delivery verbs (EN or KA). */
  const emailWithSendContext =
    recipientEmail !== null &&
    (/\b(send|email|mail|forward)\b/i.test(q) || /გააგზავნე|გამომიგზავნე|მეილ|ელფოსტ/i.test(q));

  const hasEmailIntent = hasPhrase || useSignedInEmail || emailWithSendContext;

  const wantsExcelOnly = EXCEL_ONLY_PATTERNS.some((re) => re.test(q));
  const wantsChartExplicit =
    !wantsExcelOnly && CHART_EXPLICIT_PATTERNS.some((re) => re.test(q));

  if (explicitBody !== null) {
    return {
      hasEmailIntent,
      recipientEmail,
      useSignedInEmail,
      wantsExcelOnly,
      wantsChartExplicit,
      emailBodyMode: "custom",
      customEmailBodyText: explicitBody,
    };
  }

  return {
    hasEmailIntent,
    recipientEmail,
    useSignedInEmail,
    wantsExcelOnly,
    wantsChartExplicit,
    emailBodyMode: parseEmailBodyMode(q),
    customEmailBodyText: null,
  };
}

/** Whether to attach a chart PNG (full Excel is always separate server-side). */
export function shouldIncludeChartImageInEmail(opts: {
  hasChartable: boolean;
  activeView: AgentReportView;
  wantsExcelOnly: boolean;
  wantsChartExplicit: boolean;
}): boolean {
  if (!opts.hasChartable || opts.wantsExcelOnly) return false;
  return opts.wantsChartExplicit || opts.activeView === "chart";
}
