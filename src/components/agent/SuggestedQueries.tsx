"use client";

import { Sparkles } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import type { TranslationKey } from "@/lib/i18n";

const DEFAULT_SUGGESTIONS_EN = [
  "Show me total revenue by region",
  "What are the top 10 best selling products?",
  "Compare manager performance by revenue",
  "Revenue by sales rep / preseller (Gvari)",
  "Show daily sales trend for last 2 weeks",
  "Which product categories generate the most revenue?",
  "Top 20 customers by total purchases",
  "Revenue by payment type (cash vs credit)",
  "Show sales by warehouse",
  "Which drivers have the highest delivery values?",
];

const DEFAULT_SUGGESTIONS_KA = [
  "აჩვენე ჯამური შემოსავალი რეგიონების მიხედვით",
  "რომელია ტოპ 10 ყველაზე გაყიდვადი პროდუქტი?",
  "შეადარე მენეჯერების ეფექტურობა შემოსავლით",
  "შემოსავალი გამყიდველების / პრისეილერების (გვარი) მიხედვით",
  "აჩვენე ბოლო 2 კვირის დღიური გაყიდვების ტრენდი",
  "რომელი პროდუქტის კატეგორია გამოიმუშავებს ყველაზე მეტ შემოსავალს?",
  "ტოპ 20 მომხმარებელი ჯამური შესყიდვების მიხედვით",
  "შემოსავალი გადახდის ტიპის მიხედვით (ნაღდი vs კრედიტი)",
  "აჩვენე გაყიდვები საწყობების მიხედვით",
  "რომელ მძღოლებს აქვთ ყველაზე მაღალი მიწოდების ღირებულება?",
];

interface Props {
  suggestions?: string[];
  onSelect: (query: string) => void;
  /** Section heading (default: suggestedQuestions) */
  headingKey?: TranslationKey;
}

export function SuggestedQueries({ suggestions, onSelect, headingKey }: Props) {
  const { t, locale } = useLocale();
  const defaults = locale === "ka" ? DEFAULT_SUGGESTIONS_KA : DEFAULT_SUGGESTIONS_EN;
  const items = suggestions && suggestions.length > 0 ? suggestions : defaults;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>{t(headingKey ?? "suggestedQuestions")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
