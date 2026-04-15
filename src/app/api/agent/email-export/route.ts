import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";
import {
  buildExcelBufferFromRows,
  buildExcelBufferMultiSheet,
} from "@/lib/excel-workbook-from-rows";
import {
  buildChartViewExcelSheetParts,
  buildFlatTableEmailExportRows,
  buildMatrixEmailExportRows,
} from "@/lib/agent-email-export-rows";
import {
  extractExplicitEmailBodyText,
  extractSummaryUserNote,
  isValidEmailFormat,
  type EmailBodyMode,
} from "@/lib/agent-email-delivery-intent";
import { validateChartPngBuffer } from "@/lib/png-chart-validate";
import {
  composeAgentEmailBody,
  type AgentEmailDeliveryExcelKind,
} from "@/lib/agent-email-body-compose";
import {
  isEmailConfigured,
  logEmailDeliveryAttempt,
  sendReportEmail,
  type EmailAttachment,
} from "@/lib/email-delivery";
import type { ChartConfig } from "@/types";
import type { MetricIntentKind } from "@/lib/agent-metric-intent";
import { translations } from "@/lib/i18n";
import type { AgentReportView } from "@/lib/agent-report-view";

function safeReportFileBase(title: string | undefined): string {
  const raw = (title || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return raw || "report";
}

function isoDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ~6.5MB binary as base64 */
const MAX_CHART_BASE64_CHARS = 9_000_000;

function emailSubject(title: string | undefined, locale: "en" | "ka"): string {
  const t = translations[locale];
  const suffix = title?.trim() ? title.trim().slice(0, 120) : t.agentEmailSubjectFallback;
  return `${t.agentEmailSubjectPrefix}${suffix}`;
}

function parseActiveReportView(v: unknown): AgentReportView {
  if (v === "matrix" || v === "chart") return v;
  return "flat";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canUseAgent(auth.ctx.permissions)) return forbidden();

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "EMAIL_NOT_CONFIGURED", message: "Server email (SMTP) is not configured." },
      { status: 503 },
    );
  }

  let body: {
    sql?: string;
    chartConfig?: ChartConfig | null;
    chartType?: ChartConfig["type"];
    metricIntentKind?: MetricIntentKind;
    recipientEmail?: string;
    useSignedInEmail?: boolean;
    locale?: "en" | "ka";
    includeChartImageRequested?: boolean;
    chartImagePngBase64?: string;
    /** Exact email body when user quoted text (client sends from parseEmailDeliveryIntent). */
    customEmailBodyText?: string;
    /** Full user message — server re-runs extractExplicitEmailBodyText (authoritative). */
    userMessageForIntent?: string;
    emailBodyMode?: EmailBodyMode;
    /** Current report tab: drives flat vs matrix vs chart-bundle Excel. */
    activeReportView?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  if (!sql) {
    return NextResponse.json({ error: "sql is required" }, { status: 400 });
  }

  const locale = body.locale === "ka" ? "ka" : "en";
  let recipient = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  if (body.useSignedInEmail) {
    recipient = auth.ctx.user.email;
  }
  if (!recipient) {
    return NextResponse.json(
      { error: "RECIPIENT_REQUIRED", message: "Recipient email is required." },
      { status: 400 },
    );
  }
  if (!isValidEmailFormat(recipient)) {
    return NextResponse.json(
      { error: "INVALID_EMAIL", message: "Invalid email address." },
      { status: 400 },
    );
  }

  const chartConfig = (body.chartConfig ?? null) as ChartConfig | null;
  const chartType = body.chartType ?? chartConfig?.type ?? "table";
  const metricIntentKind = body.metricIntentKind;
  const activeReportView = parseActiveReportView(body.activeReportView);
  const subject = emailSubject(chartConfig?.title, locale);

  let rawRows: Record<string, unknown>[] = [];
  try {
    rawRows = await executeReadOnlyQuery(sql);
  } catch (e) {
    logEmailDeliveryAttempt({
      userId: auth.ctx.user.id,
      recipient,
      subject: emailSubject(chartConfig?.title, locale),
      rowCount: 0,
      ok: false,
      error: e instanceof Error ? e.message : "sql_error",
    });
    return NextResponse.json(
      {
        error: "SQL_EXECUTION_FAILED",
        message: e instanceof Error ? e.message : "Query failed",
      },
      { status: 422 },
    );
  }

  if (rawRows.length === 0) {
    logEmailDeliveryAttempt({
      userId: auth.ctx.user.id,
      recipient,
      subject: emailSubject(chartConfig?.title, locale),
      rowCount: 0,
      ok: false,
      error: "empty_dataset",
    });
    return NextResponse.json(
      { error: "EMPTY_DATASET", message: "No rows to export." },
      { status: 400 },
    );
  }

  const exportArgs = {
    rawRows,
    chartConfig,
    chartType,
    metricIntentKind,
  };

  const base = safeReportFileBase(chartConfig?.title);
  const dateStamp = isoDateStamp();

  let buffer: Buffer;
  let excelDeliveryKind: AgentEmailDeliveryExcelKind;
  let excelFilename: string;

  try {
    if (activeReportView === "flat") {
      const { rows, columnOrder } = buildFlatTableEmailExportRows(exportArgs);
      if (!rows.length) {
        return NextResponse.json(
          { error: "EMPTY_EXPORT", message: "Export produced no rows." },
          { status: 400 },
        );
      }
      buffer = await buildExcelBufferFromRows(rows, {
        sheetName: "Flat table",
        columnOrder,
      });
      excelDeliveryKind = "flat";
      excelFilename = `${base}_flat_table_${dateStamp}.xlsx`;
    } else if (activeReportView === "matrix") {
      const matrix = buildMatrixEmailExportRows(exportArgs);
      if (!matrix?.rows.length) {
        return NextResponse.json(
          {
            error: "MATRIX_EXPORT_UNAVAILABLE",
            message:
              locale === "ka"
                ? "ამ შედეგისთვის მატრიცის ექსპორტი ვერ მზადდება."
                : "This result cannot be exported in matrix layout.",
          },
          { status: 422 },
        );
      }
      buffer = await buildExcelBufferFromRows(matrix.rows, {
        sheetName: "Matrix",
        columnOrder: matrix.columnOrder,
      });
      excelDeliveryKind = "matrix";
      excelFilename = `${base}_matrix_${dateStamp}.xlsx`;
    } else {
      const parts = buildChartViewExcelSheetParts(exportArgs, locale);
      buffer = await buildExcelBufferMultiSheet(parts);
      excelDeliveryKind = "chart_bundle";
      excelFilename = `${base}_data_${dateStamp}.xlsx`;
    }
  } catch (e) {
    logEmailDeliveryAttempt({
      userId: auth.ctx.user.id,
      recipient,
      subject: emailSubject(chartConfig?.title, locale),
      rowCount: rawRows.length,
      ok: false,
      error: e instanceof Error ? e.message : "excel_error",
    });
    return NextResponse.json(
      {
        error: "EXPORT_FAILED",
        message: e instanceof Error ? e.message : "Could not build Excel file",
      },
      { status: 500 },
    );
  }

  const includeChartImageRequested = body.includeChartImageRequested === true;
  const rawB64 =
    typeof body.chartImagePngBase64 === "string" ? body.chartImagePngBase64.trim() : "";
  let chartAttachment: EmailAttachment | null = null;
  if (includeChartImageRequested && rawB64.length > 0 && rawB64.length <= MAX_CHART_BASE64_CHARS) {
    try {
      const chartBuf = Buffer.from(rawB64, "base64");
      const pngOk = validateChartPngBuffer(chartBuf);
      if (pngOk.ok) {
        chartAttachment = {
          filename: `${base}_chart_${dateStamp}.png`,
          content: chartBuf,
          contentType: "image/png",
        };
      }
    } catch {
      chartAttachment = null;
    }
  }

  const sentChartImage = Boolean(chartAttachment);
  let chartImageSkippedReason: string | undefined;
  if (includeChartImageRequested && !sentChartImage) {
    if (rawB64.length === 0) chartImageSkippedReason = "not_provided";
    else if (rawB64.length > MAX_CHART_BASE64_CHARS) chartImageSkippedReason = "too_large";
    else {
      try {
        const chartBuf = Buffer.from(rawB64, "base64");
        const v = validateChartPngBuffer(chartBuf);
        chartImageSkippedReason = v.ok ? "invalid_png" : v.reason;
      } catch {
        chartImageSkippedReason = "invalid_png";
      }
    }
  }

  const attachments: EmailAttachment[] = [
    {
      filename: excelFilename,
      content: buffer,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  ];
  if (chartAttachment) attachments.push(chartAttachment);

  const userMessageForIntent =
    typeof body.userMessageForIntent === "string" ? body.userMessageForIntent : "";
  const serverExtracted = userMessageForIntent
    ? extractExplicitEmailBodyText(userMessageForIntent)
    : null;
  const fromClient =
    typeof body.customEmailBodyText === "string" ? body.customEmailBodyText : undefined;
  const resolvedCustomText =
    serverExtracted != null && serverExtracted.trim().length > 0
      ? serverExtracted
      : fromClient !== undefined && fromClient.length > 0
        ? fromClient
        : null;

  let emailBodyModeNorm: EmailBodyMode = "generic";
  if (resolvedCustomText) {
    emailBodyModeNorm = "custom";
  } else if (body.emailBodyMode === "summary" || body.emailBodyMode === "detailed") {
    emailBodyModeNorm = body.emailBodyMode;
  }

  const summaryUserNote =
    resolvedCustomText == null && userMessageForIntent
      ? extractSummaryUserNote(userMessageForIntent)
      : null;

  const emailTextResult = composeAgentEmailBody({
    locale,
    emailBodyMode: emailBodyModeNorm,
    customEmailBodyText: resolvedCustomText,
    summaryUserNote,
    deliveryExcelKind: excelDeliveryKind,
    chartImageActuallyAttached: sentChartImage,
    chartConfig,
    metricIntentKind,
    rawRows,
  });

  try {
    await sendReportEmail({
      to: recipient,
      subject,
      text: emailTextResult.text,
      attachments,
    });
  } catch (e) {
    logEmailDeliveryAttempt({
      userId: auth.ctx.user.id,
      recipient,
      subject,
      rowCount: rawRows.length,
      ok: false,
      error: e instanceof Error ? e.message : "smtp_error",
      chartAttached: false,
    });
    return NextResponse.json(
      {
        error: "EMAIL_SEND_FAILED",
        message: e instanceof Error ? e.message : "Failed to send email",
      },
      { status: 502 },
    );
  }

  logEmailDeliveryAttempt({
    userId: auth.ctx.user.id,
    recipient,
    subject,
    rowCount: rawRows.length,
    ok: true,
    chartAttached: sentChartImage,
  });

  return NextResponse.json({
    ok: true,
    recipient,
    rowCount: rawRows.length,
    subject,
    sentExcel: true,
    excelDeliveryKind,
    sentChartImage,
    chartImageSkippedReason,
    emailBodyModeSent: emailTextResult.emailBodyModeSent,
    bodyContentIncluded: emailTextResult.bodyContentIncluded,
    bodyContentFallback: emailTextResult.bodyContentFallback,
  });
}
