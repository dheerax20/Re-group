"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { demoMembers } from "@/lib/demo/mock-data";
import { fadeUp, staggerContainer } from "@/lib/motion/variants";

export default function MembersPage() {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const filtered = useMemo(() => {
    return demoMembers.filter((member) => {
      const matchesQuery =
        member.name.toLowerCase().includes(query.toLowerCase()) ||
        member.email.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "All" || member.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          title="Members"
          description="A simple CRM view of your congregation."
          actions={
            <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
              Add member
            </Button>
          }
        />
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <Input
          placeholder="Search members..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {["All", "Active", "Pending", "Inactive"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                status === item
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-background text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Groups</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={member.initials} />
                      <span className="font-medium">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{member.email}</td>
                  <td className="px-4 py-3 text-muted">{member.groups.join(", ")}</td>
                  <td className="px-4 py-3 text-muted">{member.joined}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        member.status === "Active"
                          ? "default"
                          : member.status === "Pending"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {member.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
