"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";
import { REPORT_PAGE_SIZE_OPTIONS } from "@/lib/report-pagination-presets";

type Props = {
  /** Total rows in the full dataset (before paging), e.g. filtered count. */
  totalRowCount: number;
  pageSize: number;
  pageIndex: number;
  pageCount: number;
  onPageSizeChange: (size: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  t: (k: TranslationKey) => string;
};

export function ReportPaginationBar({
  totalRowCount,
  pageSize,
  pageIndex,
  pageCount,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
  canPreviousPage,
  canNextPage,
  t,
}: Props) {
  const sizeStr = String(pageSize);

  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        {totalRowCount} {t("rows")}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground whitespace-nowrap">{t("rowsLabel")}</label>
          <Select
            value={REPORT_PAGE_SIZE_OPTIONS.includes(pageSize as (typeof REPORT_PAGE_SIZE_OPTIONS)[number]) ? sizeStr : String(REPORT_PAGE_SIZE_OPTIONS[0])}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger size="sm" className="h-8 w-[4.25rem] rounded-lg text-xs [&_svg]:size-3.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {REPORT_PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onPreviousPage}
            disabled={!canPreviousPage}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {pageIndex + 1} / {Math.max(1, pageCount)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={onNextPage}
            disabled={!canNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
