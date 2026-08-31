"use client";

import * as React from "react";
import { Plus, Search, UserRound, Users } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "visitor", label: "First-time visitor" },
  { value: "regular", label: "Regular attender" },
  { value: "member", label: "Member" },
] as const;

type MemberStatus = (typeof STATUS_OPTIONS)[number]["value"];

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: MemberStatus;
  notes: string;
  addedAt: Date;
};

const STATUS_BADGE: Record<MemberStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  visitor: "info",
  regular: "secondary",
  member: "success",
};

function statusLabel(status: MemberStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function initials(firstName: string, lastName: string) {
  return `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase() || "?";
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  status: "visitor" as MemberStatus,
  notes: "",
};

/**
 * Create-member form and the directory table.
 *
 * Every row added here is local UI state only — nothing is persisted, and
 * nothing syncs anywhere yet. The "Not synced" badge is a placeholder for
 * the eventual contacts push, not a working sync — wiring that up is a
 * separate change.
 */
export function MembersTable() {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) =>
      [member.firstName, member.lastName, member.email, member.phone]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, query]);

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.email.trim()) return;

    setMembers((prev) => [
      {
        id: crypto.randomUUID(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        status: form.status,
        notes: form.notes.trim(),
        addedAt: new Date(),
      },
      ...prev,
    ]);
    setForm(EMPTY_FORM);
    setOpen(false);
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
                  Add a household or visitor to your directory. Contacts sync is
                  coming soon — nothing is sent anywhere yet.
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
                    required
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
                <Button
                  onClick={() => setOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit">Create member</Button>
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
              <TableHead>Contacts sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-10 text-center text-[13px] text-muted" colSpan={6}>
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
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted">{member.email}</TableCell>
                  <TableCell className="text-muted">{member.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[member.status]}>
                      {statusLabel(member.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted">
                    {member.addedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn("gap-1")}
                      variant="outline"
                    >
                      <UserRound className="size-3" />
                      Not synced
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
