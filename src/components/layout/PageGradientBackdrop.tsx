"use client";

import { cn } from "@/lib/utils";

type PageGradientBackdropProps = {
  className?: string;
};

/**
 * Shared soft mesh gradient behind page content (fixed, theme-aware).
 * Place inside a `relative min-h-full` wrapper as the first child.
 */
export function PageGradientBackdrop({ className }: PageGradientBackdropProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 -z-10 h-[min(70vh,720px)]",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.09] via-chart-3/[0.06] to-transparent dark:from-primary/[0.14]" />
      <div className="absolute -left-[10%] top-0 h-[45%] w-[55%] rounded-full bg-chart-2/[0.18] blur-[100px] dark:bg-chart-2/[0.12]" />
      <div className="absolute -right-[8%] top-[5%] h-[40%] w-[50%] rounded-full bg-chart-4/[0.14] blur-[90px] dark:bg-chart-4/[0.1]" />
      <div className="absolute left-1/2 top-[20%] h-[min(280px,35vh)] w-[min(90%,900px)] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent blur-2xl dark:via-primary/[0.1]" />
    </div>
  );
}

/** Glass-style sticky filter bar (use with StickyFilterBlock). */
export const stickyFilterGlassClass =
  "rounded-b-2xl border border-border/40 border-t-0 bg-background/88 shadow-sm backdrop-blur-md dark:bg-background/80";
