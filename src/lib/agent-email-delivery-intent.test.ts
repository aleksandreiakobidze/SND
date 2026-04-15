import { describe, expect, it } from "vitest";
import {
  extractEmailsFromText,
  extractExplicitEmailBodyText,
  extractSummaryUserNote,
  isValidEmailFormat,
  parseEmailDeliveryIntent,
  shouldIncludeChartImageInEmail,
} from "@/lib/agent-email-delivery-intent";

describe("parseEmailDeliveryIntent", () => {
  it("detects English send-by-email phrases", () => {
    expect(parseEmailDeliveryIntent("send this by email to test@company.com").hasEmailIntent).toBe(true);
    expect(parseEmailDeliveryIntent("email this result to finance@company.com").recipientEmail).toBe(
      "finance@company.com",
    );
  });

  it("detects Georgian phrases", () => {
    expect(parseEmailDeliveryIntent("ამ შედეგს მეილზე გამომიგზავნე").hasEmailIntent).toBe(true);
    expect(parseEmailDeliveryIntent("ექსელით გამომიგზავნე").hasEmailIntent).toBe(true);
  });

  it("extracts mailto-style addresses", () => {
    const p = parseEmailDeliveryIntent("send to aleksandre.iakobidze@bsc.ge today");
    expect(p.recipientEmail).toBe("aleksandre.iakobidze@bsc.ge");
  });

  it("sets useSignedInEmail for my email phrasing", () => {
    const p = parseEmailDeliveryIntent("send this report to my email");
    expect(p.useSignedInEmail).toBe(true);
    expect(p.recipientEmail).toBeNull();
  });

  it("does not treat random chat as email intent", () => {
    expect(parseEmailDeliveryIntent("show sales by region").hasEmailIntent).toBe(false);
  });

  it("detects send it on mail / email this report phrasing", () => {
    expect(parseEmailDeliveryIntent("send it on mail to a@b.co").hasEmailIntent).toBe(true);
    expect(parseEmailDeliveryIntent("email this report to a@b.co").hasEmailIntent).toBe(true);
  });

  it("sets wantsExcelOnly for spreadsheet-only phrasing", () => {
    const p = parseEmailDeliveryIntent("send only the Excel to me@x.com");
    expect(p.wantsExcelOnly).toBe(true);
    expect(p.wantsChartExplicit).toBe(false);
  });

  it("sets wantsChartExplicit for chart phrasing", () => {
    const p = parseEmailDeliveryIntent("send this chart by email to me@x.com");
    expect(p.wantsChartExplicit).toBe(true);
    expect(p.wantsExcelOnly).toBe(false);
  });

  it("Georgian chart explicit", () => {
    const p = parseEmailDeliveryIntent("ეს ჩარტი მეილზე გამომიგზავნე");
    expect(p.wantsChartExplicit).toBe(true);
  });

  it("defaults emailBodyMode to generic for attachment-only", () => {
    expect(parseEmailDeliveryIntent("send this by email to a@b.co").emailBodyMode).toBe("generic");
  });

  it("detects summary body mode", () => {
    expect(
      parseEmailDeliveryIntent("send this by email with summary to a@b.co").emailBodyMode,
    ).toBe("summary");
    expect(
      parseEmailDeliveryIntent("ამ შედეგს მეილზე გამომიგზავნე და შინაარსიც გააყოლე").emailBodyMode,
    ).toBe("summary");
  });

  it("detects detailed body mode (priority over summary)", () => {
    const p = parseEmailDeliveryIntent(
      "send the report and include the analysis in the email to a@b.co",
    );
    expect(p.emailBodyMode).toBe("detailed");
  });

  it("prioritizes exact quoted body over summary mode", () => {
    const p = parseEmailDeliveryIntent('send to a@b.com with summary "make thiiiiis"');
    expect(p.emailBodyMode).toBe("custom");
    expect(p.customEmailBodyText).toBe("make thiiiiis");
  });

  it("extracts body \"hello\" and body: \"hello\" patterns", () => {
    expect(extractExplicitEmailBodyText('email x@y.com body "hello"')).toBe("hello");
    expect(extractExplicitEmailBodyText('send to a@b.com body: \'hi there\'')).toBe("hi there");
  });

  it("extractSummaryUserNote: unquoted text after with summary:", () => {
    const q =
      "send me on mail aleksandre.iakobidze@bsc.ge with summary: yeeeeeeeeeeeeeeeeeeeeeeeeee";
    expect(extractSummaryUserNote(q)).toBe("yeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(extractExplicitEmailBodyText(q)).toBeNull();
  });

  it("extractSummaryUserNote: defers to quoted explicit body", () => {
    expect(extractSummaryUserNote('send to a@b.com with summary "only this"')).toBeNull();
    expect(extractExplicitEmailBodyText('send to a@b.com with summary "only this"')).toBe("only this");
  });

  it("extracts labeled Georgian body text", () => {
    expect(extractExplicitEmailBodyText('შინაარსი: "გამარჯობა"')).toBe("გამარჯობა");
    expect(extractExplicitEmailBodyText('ტექსტი: «სალამი»')).toBe("სალამი");
  });

  it("extracts Georgian 'შინაარსი დაწერე : …' (natural phrasing)", () => {
    const msg =
      "გამომიგზავნე მეილზე aleksandre.iakobidze@gmail.com და შინაარსი დაწერე : 'ნახეეეეე'";
    expect(extractExplicitEmailBodyText(msg)).toBe("ნახეეეეე");
    expect(parseEmailDeliveryIntent(msg).emailBodyMode).toBe("custom");
    expect(parseEmailDeliveryIntent(msg).customEmailBodyText).toBe("ნახეეეეე");
  });

  it("extracts long Georgian body with punctuation", () => {
    const inner = "გადახედეთ და მომწერეთ რა აზრის ხართ!!!!!";
    expect(
      extractExplicitEmailBodyText(`შინაარსი: "${inner}"`),
    ).toBe(inner);
  });
});

describe("shouldIncludeChartImageInEmail", () => {
  it("includes when chart tab and chartable", () => {
    expect(
      shouldIncludeChartImageInEmail({
        hasChartable: true,
        activeView: "chart",
        wantsExcelOnly: false,
        wantsChartExplicit: false,
      }),
    ).toBe(true);
  });

  it("excludes when matrix tab without explicit chart", () => {
    expect(
      shouldIncludeChartImageInEmail({
        hasChartable: true,
        activeView: "matrix",
        wantsExcelOnly: false,
        wantsChartExplicit: false,
      }),
    ).toBe(false);
  });

  it("includes matrix tab when explicit chart", () => {
    expect(
      shouldIncludeChartImageInEmail({
        hasChartable: true,
        activeView: "matrix",
        wantsExcelOnly: false,
        wantsChartExplicit: true,
      }),
    ).toBe(true);
  });

  it("excludes when excel only", () => {
    expect(
      shouldIncludeChartImageInEmail({
        hasChartable: true,
        activeView: "chart",
        wantsExcelOnly: true,
        wantsChartExplicit: true,
      }),
    ).toBe(false);
  });
});

describe("extractEmailsFromText / isValidEmailFormat", () => {
  it("extracts multiple unique emails", () => {
    expect(extractEmailsFromText("a@b.co and c@d.co")).toEqual(["a@b.co", "c@d.co"]);
  });

  it("validates email shape", () => {
    expect(isValidEmailFormat("x@y.com")).toBe(true);
    expect(isValidEmailFormat("not-an-email")).toBe(false);
  });
});
