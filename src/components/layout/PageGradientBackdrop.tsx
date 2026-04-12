"use client";

import { cn } from "@/lib/utils";

type PageGradientBackdropProps = {
  className?: string;
};

/**
 * Soft aurora mesh behind page content (fixed, theme-aware) — 2026-style ambient depth.
 */
export function PageGradientBackdrop({ className }: PageGradientBackdropProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 -z-10 h-[min(85vh,900px)] overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent dark:from-primary/[0.12]" />
      <div className="absolute -left-[12%] top-[-8%] h-[50%] w-[58%] rounded-full bg-chart-2/[0.2] blur-[120px] dark:bg-chart-2/[0.14]" />
      <div className="absolute -right-[10%] top-[2%] h-[48%] w-[52%] rounded-full bg-chart-4/[0.16] blur-[110px] dark:bg-chart-4/[0.11]" />
      <div className="absolute left-[18%] top-[28%] h-[35%] w-[40%] rounded-full bg-primary/[0.08] blur-[90px] dark:bg-primary/[0.1]" />
      <div className="absolute left-1/2 top-[18%] h-[min(320px,38vh)] w-[min(92%,920px)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-chart-1/[0.08] to-transparent blur-3xl dark:via-chart-1/[0.12]" />
    </div>
  );
}

/** Glass-style sticky filter bar (use with StickyFilterBlock). */
export const stickyFilterGlassClass =
  "rounded-b-3xl border border-border/50 border-t-0 bg-background/82 shadow-[0_12px_40px_-24px_oklch(0_0_0/25%)] backdrop-blur-xl dark:bg-background/72 dark:shadow-[0_16px_48px_-28px_oklch(0_0_0/55%)]";
