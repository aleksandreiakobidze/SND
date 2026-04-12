"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown, X, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = "Search...",
  maxDisplay = 2,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const toggle = useCallback(
    (value: string) => {
      const next = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      onChange(next);
    },
    [selected, onChange]
  );

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  const unique = options.filter(
    (o, i, arr) => arr.findIndex((a) => a.value === o.value) === i
  );

  const filtered = search
    ? unique.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : unique;

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length <= maxDisplay
        ? selected.join(", ")
        : `${selected.slice(0, maxDisplay).join(", ")} +${selected.length - maxDisplay}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 h-9 min-w-[150px] max-w-[240px] rounded-md border px-2.5 py-1 text-sm shadow-sm transition-colors cursor-pointer ${
          selected.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-input bg-transparent text-muted-foreground"
        } hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20`}
      >
        <span className="truncate flex-1 text-left text-xs">{displayText}</span>
        {selected.length > 0 ? (
          <X
            className="h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
            onClick={clearAll}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[260px] rounded-lg border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <X
                className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => setSearch("")}
              />
            )}
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No results
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear {selected.length} selected
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
