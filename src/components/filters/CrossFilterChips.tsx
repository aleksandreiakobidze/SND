"use client";

import { X, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import type { CrossFilter } from "@/lib/useFilters";
import type { FilterField } from "@/lib/filters";
import type { TranslationKey } from "@/lib/i18n";

const FIELD_LABEL_KEYS: Record<FilterField, TranslationKey> = {
  region: "region",
  category: "category",
  salesCategory: "salesCategory",
  manager: "manager",
  network: "network",
  brand: "brand",
  customerCategory: "customer",
  product: "product",
};

interface CrossFilterChipsProps {
  crossFilters: CrossFilter[];
  onRemove: (field: FilterField) => void;
  onClearAll: () => void;
}

export function CrossFilterChips({
  crossFilters,
  onRemove,
  onClearAll,
}: CrossFilterChipsProps) {
  const { t } = useLocale();
  if (crossFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
        <Sparkles className="h-3 w-3" />
        <span className="font-medium">{t("filters")}:</span>
      </div>
      {crossFilters.map((cf) => (
        <button
          key={cf.field}
          onClick={() => onRemove(cf.field)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-colors group"
        >
          <span className="text-primary/60">{t(FIELD_LABEL_KEYS[cf.field])}:</span>
          <span>{cf.value}</span>
          <X className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
      {crossFilters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 transition-colors"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
