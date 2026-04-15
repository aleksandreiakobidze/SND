import { describe, expect, it } from "vitest";
import { formatTableCellDisplay, shouldRenderAsText } from "@/lib/coordinate-format";
import { recentTxDisplayMetaForRowKey } from "@/lib/recent-transactions-columns";

describe("identifier formatting", () => {
  it("renders organization-like identifiers as raw text", () => {
    expect(formatTableCellDisplay(10556, "OrganizationID")).toBe("10556");
    expect(formatTableCellDisplay(10631, "IdOrg")).toBe("10631");
    expect(formatTableCellDisplay(10556, "CustomerCode")).toBe("10556");
    expect(formatTableCellDisplay(10556, "ItemCode")).toBe("10556");
    expect(formatTableCellDisplay(10556, "OrderNo")).toBe("10556");
    expect(formatTableCellDisplay(10556, "InvoiceNo")).toBe("10556");
  });

  it("uses explicit recent-transactions metadata for identifier fields", () => {
    const idOrgMeta = recentTxDisplayMetaForRowKey("IdOrg");
    const documentNoMeta = recentTxDisplayMetaForRowKey("DocumentNo");

    expect(shouldRenderAsText("IdOrg", idOrgMeta)).toBe(true);
    expect(shouldRenderAsText("DocumentNo", documentNoMeta)).toBe(true);
    expect(formatTableCellDisplay(10556, "IdOrg", idOrgMeta)).toBe("10556");
    expect(formatTableCellDisplay(10556, "DocumentNo", documentNoMeta)).toBe("10556");
  });

  it("keeps measure formatting behavior for non-identifier columns", () => {
    const formatted = formatTableCellDisplay(10556, "Amount");
    expect(formatted).not.toBe("10556");
  });
});
