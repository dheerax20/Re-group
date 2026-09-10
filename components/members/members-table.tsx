"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS = [
  { value: "VISITOR", label: "First-time visitor" },
  { value: "REGULAR", label: "Regular attender" },
  { value: "MEMBER", label: "Member" },
] as const;

type MemberStatus = (typeof STATUS_OPTIONS)[number]["value"];
type SyncStatus = "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";

/** The row shape the server page passes down — a Prisma `Member`. */
export type MemberRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  notes: string | null;
  ghlContactId: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncedAt: Date | null;
  createdAt: Date;
};

const STATUS_BADGE: Record<MemberStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  VISITOR: "info",
  REGULAR: "secondary",
  MEMBER: "success",
};

function statusLabel(status: MemberStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function initials(firstName: string, lastName: string | null) {
  return (
    `${firstName.trim()[0] ?? ""}${(lastName ?? "").trim()[0] ?? ""}`.toUpperCase() || "?"
  );
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  status: "VISITOR" as MemberStatus,
  notes: "",
};

/**
 * What the last column says, per sync state.
 *
 * SKIPPED is not styled as a failure — it is what a member with no email or
 * phone gets, and the copy asks for the missing detail rather than implying
 * something broke. Only FAILED offers the retry, because it is the only state
 * a retry can change.
 */
function SyncCell({
  member,
  onResync,
  busy,
}: {
  member: MemberRecord;
  onResync: () => void;
  busy: boolean;
}) {
  if (busy) {
    return (
      <Badge className="gap-1" variant="outline">
        <Loader2 className="size-3 animate-spin" />
        Syncing…
      </Badge>
    );
  }

  switch (member.syncStatus) {
    case "SYNCED":
      return (
        <Badge className="gap-1" variant="success">
          <Check className="size-3" />
          In contacts
        </Badge>
      );
    case "FAILED":
      return (
        <div className="flex items-center gap-2">
          <Badge className="gap-1" title={member.syncError ?? undefined} variant="destructive">
            <AlertCircle className="size-3" />
            Sync failed
          </Badge>
          <Button onClick={onResync} size="sm" variant="ghost">
            <RefreshCw className="size-3" />
            Retry
          </Button>
        </div>
      );
    case "SKIPPED":
      // Several things land here — no email or phone, sync switched off for
      // the deployment — so the recorded reason is the copy.
      return (
        <span className="text-[13px] text-muted">
          {member.syncError ?? "Not synced"}
        </span>
      );
    default:
      return (
        <Badge className="gap-1" variant="outline">
          <Loader2 className="size-3 animate-spin" />
          Syncing…
        </Badge>
      );
  }
}

export function MembersTable({
  siteId,
  members,
  syncEnabled,
}: {
  siteId: string;
  members: MemberRecord[];
  /** False when the deployment has no GoHighLevel configured — hides the column. */
  syncEnabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<MemberRecord | null>(null);

  const createMember = trpc.members.create.useMutation();
  const resyncMember = trpc.members.resync.useMutation();
  const removeMember = trpc.members.remove.useMutation();

  const columnCount = syncEnabled ? 7 : 6;

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) =>
      [member.firstName, member.lastName ?? "", member.email ?? "", member.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, query]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.firstName.trim()) return;

    try {
      await createMember.mutateAsync({ siteId, data: form });
      setForm(EMPTY_FORM);
      setOpen(false);
      toast({
        title: "Member added",
        description: syncEnabled
          ? `${form.firstName} was added and sent to your contacts.`
          : `${form.firstName} was added to your directory.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not add member",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    }
  }

  async function handleResync(member: MemberRecord) {
    setBusyId(member.id);
    try {
      await resyncMember.mutateAsync({ siteId, memberId: member.id });
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not sync",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    const member = confirmDelete;
    if (!member) return;
    setBusyId(member.id);
    try {
      await removeMember.mutateAsync({ siteId, memberId: member.id });
      setConfirmDelete(null);
      toast({
        title: "Member removed",
        description: syncEnabled
          ? "They were removed from your directory. Their contact in GoHighLevel is left as it is."
          : "They were removed from your directory.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Could not remove",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search members…"
            value={query}
          />
        </div>

        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Create member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Create member</DialogTitle>
                <DialogDescription>
                  {syncEnabled
                    ? "Add a household or visitor to your directory. They are added to your contacts automatically."
                    : "Add a household or visitor to your directory."}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="member-first-name">First name</Label>
                  <Input
                    id="member-first-name"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    required
                    value={form.firstName}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-last-name">Last name</Label>
                  <Input
                    id="member-last-name"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    value={form.lastName}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="member-email">Email</Label>
                  <Input
                    id="member-email"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    type="email"
                    value={form.email}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-phone">Phone</Label>
                  <Input
                    id="member-phone"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    type="tel"
                    value={form.phone}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="member-status">Status</Label>
                  <NativeSelect
                    id="member-status"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        status: event.target.value as MemberStatus,
                      }))
                    }
                    value={form.status}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="member-notes">Notes</Label>
                  <Textarea
                    id="member-notes"
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    placeholder="Optional — how you met them, follow-up context…"
                    value={form.notes}
                  />
                </div>
              </div>

              <DialogFooter className="mt-5">
                <Button onClick={() => setOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button disabled={createMember.isPending} type="submit">
                  {createMember.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Create member"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-[var(--shadow-soft)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              {syncEnabled ? <TableHead>Contacts sync</TableHead> : null}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className="py-10 text-center text-[13px] text-muted"
                  colSpan={columnCount}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface-muted text-muted">
                      <Users className="size-4" />
                    </span>
                    {members.length === 0
                      ? "No members yet. Add your first visitor or member above."
                      : "No members match your search."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-muted">
                        {initials(member.firstName, member.lastName)}
                      </span>
                      <span className="font-medium text-foreground">
                        {member.firstName} {member.lastName ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted">{member.email || "—"}</TableCell>
                  <TableCell className="text-muted">{member.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[member.status]}>
                      {statusLabel(member.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted">
                    {member.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  {syncEnabled ? (
                    <TableCell>
                      <SyncCell
                        busy={busyId === member.id && resyncMember.isPending}
                        member={member}
                        onResync={() => handleResync(member)}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Button
                      aria-label={`Remove ${member.firstName}`}
                      onClick={() => setConfirmDelete(member)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        onOpenChange={(next) => !next && setConfirmDelete(null)}
        open={Boolean(confirmDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `${confirmDelete.firstName} ${confirmDelete.lastName ?? ""} will be removed from your directory.`
                : ""}
              {syncEnabled
                ? " Their contact in GoHighLevel is left as it is — it may hold conversations and course history this app did not create."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5">
            <Button onClick={() => setConfirmDelete(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={removeMember.isPending}
              onClick={handleDelete}
              variant="destructive"
            >
              {removeMember.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
