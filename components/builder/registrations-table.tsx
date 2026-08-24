"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";

type RegistrationRow = {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  guestCount: number;
  status: "CONFIRMED" | "WAITLISTED" | "CANCELLED";
  createdAt: string | Date;
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function RegistrationsTable({
  siteId,
  eventId,
  registrations,
}: {
  siteId: string;
  eventId: string;
  registrations: RegistrationRow[];
}) {
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter(
      (r) =>
        r.attendeeName.toLowerCase().includes(q) ||
        r.attendeeEmail.toLowerCase().includes(q)
    );
  }, [registrations, query]);

  async function onExport() {
    setExporting(true);
    try {
      const csv = await utils.content.exportRegistrations.fetch({ siteId, eventId });
      downloadCsv("registrations.csv", csv);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={registrations.length === 0 ? "No registrations yet" : "No matches"}
          description={
            registrations.length === 0
              ? "Registrations will show up here as visitors RSVP."
              : "Try a different search."
          }
          compact
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Guests</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-medium">{r.attendeeName}</td>
                  <td className="px-4 py-2.5 text-muted">{r.attendeeEmail}</td>
                  <td className="px-4 py-2.5 text-muted">{r.attendeePhone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted">{r.guestCount}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        r.status === "CONFIRMED"
                          ? "success"
                          : r.status === "WAITLISTED"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
