"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/locale-context";
import type { WorkspaceTree } from "@/lib/workspace-db";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceTree | null;
  reportTitle: string;
  initialSectionId: string;
  onConfirm: (sectionId: string) => Promise<void>;
};

export function MoveReportDialog({
  open,
  onOpenChange,
  workspace,
  reportTitle,
  initialSectionId,
  onConfirm,
}: Props) {
  const { t } = useLocale();
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setSectionId(initialSectionId);
  }, [open, initialSectionId]);

  const sections = workspace?.sections ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setSectionId(initialSectionId);
      }}
    >
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("workspaceMoveReportTitle")}</SheetTitle>
          <SheetDescription>
            {t("workspaceMoveReportDesc")} — <span className="font-medium text-foreground">{reportTitle}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Select
            value={sectionId}
            onValueChange={(v) => setSectionId(v ?? initialSectionId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SheetFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("workspaceCancel")}
          </Button>
          <Button
            type="button"
            disabled={loading || !sectionId}
            onClick={() => {
              setLoading(true);
              void onConfirm(sectionId)
                .then(() => onOpenChange(false))
                .finally(() => setLoading(false));
            }}
          >
            {loading ? t("loading") : t("workspaceConfirm")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
