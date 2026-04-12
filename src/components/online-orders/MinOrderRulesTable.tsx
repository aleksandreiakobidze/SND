"use client";

import { useLocale } from "@/lib/locale-context";
import { getMinOrderRulesRows } from "@/lib/online-transfer-rules";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MinOrderRulesTable() {
  const { t } = useLocale();
  const rows = getMinOrderRulesRows();

  return (
    <div className="rounded-lg border border-border overflow-hidden max-w-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("minOrderRulesTableOrgT")}</TableHead>
            <TableHead className="text-right w-28">{t("minOrderRulesTableMinLari")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.orgT}>
              <TableCell className="font-medium">{r.orgT}</TableCell>
              <TableCell className="text-right tabular-nums">{r.minLari}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
