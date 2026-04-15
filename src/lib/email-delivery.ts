import nodemailer from "nodemailer";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type SendReportEmailParams = {
  to: string;
  subject: string;
  text: string;
  attachments: EmailAttachment[];
};

function getTransport(): nodemailer.Transporter {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim() || "587";
  const port = Number.parseInt(portRaw, 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass || !Number.isFinite(port)) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM in the server environment.",
    );
  }
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    /** Required for many providers (e.g. Gmail / Google Workspace on 587). */
    requireTLS: !secure && port === 587,
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  try {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const from = process.env.MAIL_FROM?.trim();
    return Boolean(host && user && pass && from);
  } catch {
    return false;
  }
}

/**
 * Sends email via SMTP (e.g. Gmail app password) with one or more attachments.
 */
export async function sendReportEmail(params: SendReportEmailParams): Promise<void> {
  const from = process.env.MAIL_FROM?.trim();
  if (!from) {
    throw new Error("MAIL_FROM is not set.");
  }
  if (!params.attachments.length) {
    throw new Error("sendReportEmail: at least one attachment is required.");
  }
  const transport = getTransport();
  await transport.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: params.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}

export function logEmailDeliveryAttempt(info: {
  userId: string;
  recipient: string;
  subject: string;
  rowCount: number;
  ok: boolean;
  error?: string;
  chartAttached?: boolean;
}): void {
  const payload = {
    kind: "agent_email_export",
    userId: info.userId,
    recipient: info.recipient,
    subject: info.subject,
    rowCount: info.rowCount,
    ok: info.ok,
    error: info.error,
    chartAttached: info.chartAttached,
    at: new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));
}
