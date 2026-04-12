"use client";

import { cn } from "@/lib/utils";

type StickyFilterBlockProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Pins the filter header (title + FilterBar + chips) while the main content scrolls.
 * Expects a parent with horizontal padding (e.g. px-6); uses -mx-6 px-6 so the bar spans the full main column.
 */
export function StickyFilterBlock({ children, className }: StickyFilterBlockProps) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-6 space-y-4 px-6 py-5",
        "border-b border-border/40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75",
        "shadow-[0_1px_0_0_oklch(1_0_0/5%)] dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
