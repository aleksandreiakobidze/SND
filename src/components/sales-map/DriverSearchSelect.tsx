"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Driver = { id: number; displayName: string };

type Props = {
  drivers: Driver[];
  value: string;
  onValueChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  id?: string;
  className?: string;
};

export function DriverSearchSelect({
  drivers,
  value,
  onValueChange,
  disabled,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  id,
  className,
}: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    return drivers.find((d) => d.id === n) ?? null;
  }, [drivers, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        d.displayName.toLowerCase().includes(q) || String(d.id).includes(q),
    );
  }, [drivers, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative min-w-[220px]", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 text-left text-sm shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.displayName : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full z-[1000] mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b border-border p-2">
            <Input
              type="search"
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9"
              aria-label={searchPlaceholder}
            />
          </div>
          <ScrollArea className="h-[min(240px,40vh)]">
            <div className="p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">{noResultsLabel}</p>
              ) : (
                filtered.map((d) => {
                  const isSel = value === String(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm",
                        "hover:bg-accent hover:text-accent-foreground",
                        isSel && "bg-accent/60",
                      )}
                      onClick={() => {
                        onValueChange(String(d.id));
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("h-4 w-4 shrink-0", isSel ? "opacity-100" : "opacity-0")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{d.displayName}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {d.id}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
