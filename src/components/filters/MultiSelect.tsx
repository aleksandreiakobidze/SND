"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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

const DROPDOWN_GAP = 4;
const VIEWPORT_PAD = 8;
const PANEL_MAX_H = 280;

type DropCoords = {
  placement: "below" | "above";
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function useDropdownCoords(open: boolean, anchorRef: React.RefObject<HTMLDivElement | null>) {
  const [coords, setCoords] = useState<DropCoords>({
    placement: "below",
    left: 0,
    width: 260,
    maxHeight: PANEL_MAX_H,
    top: 0,
  });

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(260, rect.width);
    let left = rect.left;
    if (left + w > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, window.innerWidth - w - VIEWPORT_PAD);
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const openDown = spaceBelow >= Math.min(160, spaceAbove) || spaceBelow >= spaceAbove;

    const rawMax = openDown
      ? Math.max(120, spaceBelow - DROPDOWN_GAP)
      : Math.max(120, spaceAbove - DROPDOWN_GAP);
    const maxHeight = Math.min(PANEL_MAX_H, rawMax);

    if (openDown) {
      setCoords({
        placement: "below",
        left,
        width: w,
        maxHeight,
        top: rect.bottom + DROPDOWN_GAP,
      });
    } else {
      setCoords({
        placement: "above",
        left,
        width: w,
        maxHeight,
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
      });
    }
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return { coords, update };
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
  const portalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { coords, update } = useDropdownCoords(open, containerRef);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (portalRef.current?.contains(t)) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const toggle = useCallback(
    (value: string) => {
      const next = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value];
      onChange(next);
    },
    [selected, onChange],
  );

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

  const unique = options.filter(
    (o, i, arr) => arr.findIndex((a) => a.value === o.value) === i,
  );

  const filtered = search
    ? unique.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : unique;

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length <= maxDisplay
        ? selected.join(", ")
        : `${selected.slice(0, maxDisplay).join(", ")} +${selected.length - maxDisplay}`;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const panel = open && mounted && (
    <div
      ref={portalRef}
      className="fixed z-[200] flex flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150"
      style={{
        ...(coords.placement === "below"
          ? { top: coords.top, left: coords.left, width: coords.width }
          : {
              bottom: coords.bottom,
              left: coords.left,
              width: coords.width,
            }),
        maxHeight: coords.maxHeight,
      }}
      role="listbox"
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-1.5 border-b px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          {search ? (
            <X
              className="h-3 w-3 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            />
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No results</div>
          ) : (
            filtered.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground/80 hover:bg-muted"
                  }`}
                >
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
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
        {selected.length > 0 ? (
          <div className="shrink-0 border-t px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear {selected.length} selected
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((p) => !p);
          queueMicrotask(() => update());
        }}
        className={`flex h-9 min-w-[150px] max-w-[240px] cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm shadow-sm transition-colors ${
          selected.length > 0
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-input bg-transparent text-muted-foreground"
        } hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20`}
      >
        <span className="flex-1 truncate text-left text-xs">{displayText}</span>
        {selected.length > 0 ? (
          <X
            className="h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
            onClick={clearAll}
          />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
