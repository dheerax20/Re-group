"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Download the attendee list as a CSV.
 *
 * The file is built on the server (`content.exportRegistrations`) and turned
 * into a download here with an object URL — the export has to reflect every
 * registration, not just the page of rows currently on screen, which is why it
 * refetches rather than serialising the table's own state.
 */
export function ExportButton({
  siteId,
  eventId,
  filename,
}: {
  siteId: string;
  eventId: string;
  filename: string;
}) {
  const utils = trpc.useUtils();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    setExporting(true);
    try {
      const csv = await utils.content.exportRegistrations.fetch({ siteId, eventId });
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Could not export",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button disabled={exporting} onClick={onExport} size="sm" variant="outline">
      {exporting ? <Loader2 className="animate-spin" /> : <Download />}
      Export CSV
    </Button>
  );
}
