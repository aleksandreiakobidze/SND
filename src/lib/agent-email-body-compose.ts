import type { ChartConfig, ChartMeasureDisplay } from "@/types";
import {
  metricIntentToMeasureDisplay,
  resolveMeasureDisplay,
  type MetricIntentKind,
} from "@/lib/agent-metric-intent";
import { firstNonTechnicalColumnKey, numericMeasureKeys } from "@/lib/technical-columns";
import {
  formatCurrencyCompact,
  formatLitersCompact,
  formatNumberCompact,
} from "@/lib/chart-number-format";
import { translations } from "@/lib/i18n";
import type { EmailBodyMode } from "@/lib/agent-email-delivery-intent";

/** Matches server Excel attachment shape for agent email. */
export type AgentEmailDeliveryExcelKind = "flat" | "matrix" | "chart_bundle";

export type ComposeAgentEmailBodyParams = {
  locale: "en" | "ka";
  emailBodyMode: EmailBodyMode;
  /** Exact user-provided body when `emailBodyMode === "custom"` (no rewrite). */
  customEmailBodyText?: string | null;
  /** Unquoted line after `with summary:` / `with content:` — prepended inside the Summary block. */
  summaryUserNote?: string | null;
  /** How the Excel attachment was built (flat / matrix / two-sheet chart bundle). */
  deliveryExcelKind: AgentEmailDeliveryExcelKind;
  /** Whether a chart PNG was actually attached (chart view, or explicit chart request). */
  chartImageActuallyAttached: boolean;
  chartConfig: ChartConfig | null;
  metricIntentKind?: MetricIntentKind;
  rawRows: Record<string, unknown>[];
};

export type ComposeAgentEmailBodyResult = {
  text: string;
  bodyContentIncluded: boolean;
  bodyContentFallback: boolean;
  emailBodyModeSent: EmailBodyMode;
};

function pickAttachmentIntro(
  locale: "en" | "ka",
  deliveryExcelKind: AgentEmailDeliveryExcelKind,
  chartImageActuallyAttached: boolean,
): string {
  const t = translations[locale];
  if (deliveryExcelKind === "flat") return t.agentEmailBodyMainFlatTable;
  if (deliveryExcelKind === "matrix") return t.agentEmailBodyMainMatrix;
  return chartImageActuallyAttached
    ? t.agentEmailBodyMainChartBundleWithImage
    : t.agentEmailBodyMainChartBundleExcelOnly;
}

function genericTemplate(params: ComposeAgentEmailBodyParams): string {
  const { locale, deliveryExcelKind, chartImageActuallyAttached } = params;
  const t = translations[locale];
  const main = pickAttachmentIntro(locale, deliveryExcelKind, chartImageActuallyAttached);
  return `${t.agentEmailBodyGreeting}\n\n${main}\n\n${t.agentEmailBodyClosing}\n${t.agentEmailBodySignature}`;
}

function measureDisplayFromIntent(
  chartConfig: ChartConfig | null,
  rawRows: Record<string, unknown>[],
  metricIntentKind?: MetricIntentKind,
): ChartMeasureDisplay {
  const fromConfig = chartConfig?.measureDisplay;
  if (fromConfig === "liters" || fromConfig === "money" || fromConfig === "quantity" || fromConfig === "mixed") {
    return resolveMeasureDisplay(chartConfig, rawRows);
  }
  if (metricIntentKind) {
    const md = metricIntentToMeasureDisplay(metricIntentKind);
    if (md) {
      const synthetic: ChartConfig = {
        type: chartConfig?.type ?? "bar",
        measureDisplay: md,
        ...(chartConfig ?? {}),
      };
      return resolveMeasureDisplay(synthetic, rawRows);
    }
  }
  return resolveMeasureDisplay(chartConfig, rawRows);
}

function formatValue(v: number, md: ChartMeasureDisplay): string {
  if (md === "liters") return formatLitersCompact(v);
  if (md === "quantity") return formatNumberCompact(v);
  if (md === "money") return formatCurrencyCompact(v);
  return formatNumberCompact(v);
}

function metricLabel(locale: "en" | "ka", md: ChartMeasureDisplay): string {
  const t = translations[locale];
  if (md === "liters") return t.agentEmailMetricLiters;
  if (md === "quantity") return t.agentEmailMetricQuantity;
  if (md === "money") return t.agentEmailMetricRevenue;
  return t.agentEmailMetricMixed;
}

function buildInsightsBlock(
  locale: "en" | "ka",
  rawRows: Record<string, unknown>[],
  chartConfig: ChartConfig | null,
  metricIntentKind: MetricIntentKind | undefined,
): string[] {
  const t = translations[locale];
  if (!rawRows.length) return [];
  const row0 = rawRows[0];
  const xKey =
    chartConfig?.xKey && row0[chartConfig.xKey] !== undefined
      ? chartConfig.xKey
      : firstNonTechnicalColumnKey(row0);
  const yKeys =
    chartConfig?.yKeys?.length && chartConfig.yKeys.some((k) => row0[k] !== undefined)
      ? chartConfig.yKeys
      : numericMeasureKeys(row0, xKey);
  const measureKey = yKeys[0];
  const bullets: string[] = [];
  bullets.push(t.agentEmailBulletRowCount.replace("{n}", String(rawRows.length)));

  if (!measureKey || typeof row0[measureKey] !== "number") {
    return bullets;
  }

  const md = measureDisplayFromIntent(chartConfig, rawRows, metricIntentKind);
  const labelWord = metricLabel(locale, md);

  let bestIdx = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < rawRows.length; i++) {
    const v = Number(rawRows[i][measureKey]);
    if (Number.isFinite(v) && v > bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  if (Number.isFinite(bestVal) && bestVal > -Infinity) {
    const topLabel = String(rawRows[bestIdx][xKey] ?? "");
    const formatted = formatValue(bestVal, md);
    bullets.push(
      t.agentEmailBulletTopRow.replace("{metric}", labelWord).replace("{category}", topLabel).replace("{value}", formatted),
    );
  }

  return bullets;
}

/** Short deterministic summary (2–4 lines), no assistant narrative. */
function buildShortGeneratedBody(params: ComposeAgentEmailBodyParams): string {
  const {
    locale,
    deliveryExcelKind,
    chartImageActuallyAttached,
    chartConfig,
    metricIntentKind,
    rawRows,
    summaryUserNote,
  } = params;
  const t = translations[locale];
  const intro = pickAttachmentIntro(locale, deliveryExcelKind, chartImageActuallyAttached);

  const lines: string[] = [];
  const reportTitle = chartConfig?.title?.trim();
  if (reportTitle) {
    lines.push(locale === "ka" ? `რეპორტი: ${reportTitle}` : `Report: ${reportTitle}`);
  }

  const note = typeof summaryUserNote === "string" ? summaryUserNote.trim() : "";
  if (note) {
    lines.push(note);
  }

  const bullets = buildInsightsBlock(locale, rawRows, chartConfig, metricIntentKind);
  for (const b of bullets) {
    if (lines.length >= 4) break;
    lines.push(b);
  }

  const summaryBlock = lines.join("\n").trim();

  const parts: string[] = [t.agentEmailBodyGreeting, "", intro];
  if (summaryBlock) {
    parts.push("", t.agentEmailSectionSummary, "", summaryBlock);
  }
  parts.push("", t.agentEmailBodyClosing, t.agentEmailBodySignature);
  return parts.join("\n");
}

/**
 * Plain-text email body: exact user text (custom), short generated summary, or generic template.
 */
export function composeAgentEmailBody(params: ComposeAgentEmailBodyParams): ComposeAgentEmailBodyResult {
  const { emailBodyMode, locale } = params;

  if (emailBodyMode === "custom") {
    const raw = params.customEmailBodyText;
    if (typeof raw === "string" && raw.length > 0) {
      return {
        text: raw,
        bodyContentIncluded: true,
        bodyContentFallback: false,
        emailBodyModeSent: "custom",
      };
    }
    const generic = genericTemplate(params);
    return {
      text: generic,
      bodyContentIncluded: false,
      bodyContentFallback: true,
      emailBodyModeSent: "generic",
    };
  }

  const generic = genericTemplate(params);

  if (emailBodyMode === "generic") {
    return {
      text: generic,
      bodyContentIncluded: false,
      bodyContentFallback: false,
      emailBodyModeSent: "generic",
    };
  }

  try {
    const short = buildShortGeneratedBody(params);
    if (short) {
      return {
        text: short,
        bodyContentIncluded: true,
        bodyContentFallback: false,
        emailBodyModeSent: emailBodyMode,
      };
    }
  } catch {
    /* fall through */
  }

  return {
    text: generic,
    bodyContentIncluded: false,
    bodyContentFallback: true,
    emailBodyModeSent: "generic",
  };
}
