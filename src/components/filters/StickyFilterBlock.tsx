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
        "sticky top-0 z-10 -mx-6 px-6 py-4 space-y-4",
        "bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85",
        "border-b border-border/50 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
