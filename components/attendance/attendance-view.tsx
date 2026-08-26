"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, RotateCcw, Users } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import type { RegistrationRow } from "@/lib/trpc/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/layout/empty-state";
import { PAGE_SIZES, Paginate, pageParam, paginate } from "@/components/layout/paginate";
import { CheckedInBadge, StatusBadge } from "@/components/layout/status-badge";

function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Attendance — a reporting screen, not a card gallery.
 *
 * Rows are compared down columns here (who registered, who arrived, when), so
 * this is one of the few places in the product that genuinely wants a table.
 * Below `md` the same rows render as attendee cards instead: a seven-column
 * table on a phone is either unreadable or a sideways scroll puzzle, and this
 * screen is used on a phone constantly.
 *
 * Filtering and paging read the URL, so a link to page 3 of the checked-in
 * attendees is a real link. The rows themselves come from a live tRPC query, so
 * a check-in happening at the door updates this table without a refresh.
 */
export function AttendanceView({
  siteId,
  eventId,
  registrations,
}: {
  siteId: string;
  eventId: string;
  registrations: RegistrationRow[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [busyId, setBusyId] = useState<string | null>(null);

  const live = trpc.content.listRegistrations.useQuery(
    { siteId, eventId },
    { initialData: registrations, staleTime: 10_000 }
  );
  const rows = live.data ?? registrations;

  const checkInManually = trpc.content.checkInManually.useMutation();
  const undoCheckIn = trpc.content.undoCheckIn.useMutation();

  const query = (searchParams.get("q") ?? "").trim().toLowerCase();
  const status = searchParams.get("status") ?? "";

  const filtered = useMemo(() => {
    let visible = rows;

    if (status === "checked_in") visible = visible.filter((row) => row.checkedInAt);
    else if (status === "not_arrived") visible = visible.filter((row) => !row.checkedInAt);
    else if (status) visible = visible.filter((row) => row.status === status);

    if (query) {
      visible = visible.filter(
        (row) =>
          row.attendeeName.toLowerCase().includes(query) ||
          row.attendeeEmail.toLowerCase().includes(query) ||
          (row.attendeePhone ?? "").toLowerCase().includes(query)
      );
    }
    return visible;
  }, [rows, query, status]);

  const paged = paginate(
    filtered,
    pageParam(searchParams.get("page") ?? undefined),
    PAGE_SIZES.attendance
  );

  const checkedInCount = rows.filter((row) => row.checkedInAt).length;

  /**
   * The same mutation the scanning station calls, so an attendee checked in
   * here is indistinguishable from one scanned at the door apart from
   * `checkedInVia`.
   */
  async function onToggle(row: RegistrationRow) {
    setBusyId(row.id);
    try {
      if (row.checkedInAt) {
        await undoCheckIn.mutateAsync({ siteId, registrationId: row.id });
      } else {
        await checkInManually.mutateAsync({ siteId, registrationId: row.id });
      }
      await Promise.all([
        utils.content.listRegistrations.invalidate({ siteId, eventId }),
        utils.content.eventAttendance.invalidate({ siteId, eventId }),
      ]);
    } catch (error) {
      toast({
        title: "Could not update check-in",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  function ToggleButton({ row }: { row: RegistrationRow }) {
    const checkedIn = Boolean(row.checkedInAt);
    return (
      <Button
        disabled={busyId === row.id || row.status === "CANCELLED"}
        onClick={() => void onToggle(row)}
        size="sm"
        variant={checkedIn ? "ghost" : "default"}
      >
        {checkedIn ? <RotateCcw /> : <Check />}
        {checkedIn ? "Undo" : "Check in"}
      </Button>
    );
  }

  const params = Object.fromEntries(searchParams.entries());

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        <span className="tabular font-medium text-foreground">{checkedInCount}</span>
        {" checked in / "}
        <span className="tabular font-medium text-foreground">{rows.length}</span>
        {" registered"}
      </p>

      {paged.items.length === 0 ? (
        <EmptyState
          compact
          description={
            rows.length === 0
              ? "Registrations will show up here as visitors RSVP."
              : "No attendee matches the filters you've set."
          }
          icon={Users}
          title={rows.length === 0 ? "No registrations yet" : "No matching attendees"}
        />
      ) : (
        <>
          {/* Phones: one card per attendee. */}
          <ul className="divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface md:hidden">
            {paged.items.map((row) => (
              <li className="space-y-2.5 px-3.5 py-3" key={row.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {row.attendeeName}
                      {row.guestCount > 0 ? (
                        <span className="ml-1.5 text-[13px] text-muted">
                          +{row.guestCount}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[13px] text-muted">{row.attendeeEmail}</p>
                    {row.attendeePhone ? (
                      <p className="truncate text-[13px] text-muted">{row.attendeePhone}</p>
                    ) : null}
                  </div>
                  <StatusBadge kind="registration" status={row.status} />
                </div>

                <dl className="grid grid-cols-2 gap-2 text-[13px]">
                  <div>
                    <dt className="text-muted">Registered</dt>
                    <dd className="tabular mt-0.5 text-foreground">
                      {formatDateTime(row.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Checked in</dt>
                    <dd className="tabular mt-0.5 text-foreground">
                      {row.checkedInAt ? formatTime(row.checkedInAt) : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center justify-between gap-2">
                  <CheckedInBadge checkedIn={Boolean(row.checkedInAt)} />
                  <ToggleButton row={row} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: the real table. */}
          <div className="hidden overflow-hidden rounded-panel border border-border bg-surface md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-foreground">
                      {row.attendeeName}
                    </TableCell>
                    <TableCell className="text-muted">{row.attendeeEmail}</TableCell>
                    <TableCell className="text-muted">
                      {row.attendeePhone ?? "—"}
                    </TableCell>
                    <TableCell className="tabular text-muted">{row.guestCount}</TableCell>
                    <TableCell>
                      <StatusBadge kind="registration" status={row.status} />
                    </TableCell>
                    <TableCell className="tabular text-muted">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      {row.checkedInAt ? (
                        <span className="tabular text-success">
                          {formatTime(row.checkedInAt)}
                          {row.checkedInVia === "MANUAL" ? " · manual" : ""}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ToggleButton row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Paginate
        basePath={pathname}
        label="attendees"
        paged={paged}
        searchParams={params}
      />
    </div>
  );
}
