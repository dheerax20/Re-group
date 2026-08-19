"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import type { ChatMessageView } from "@/lib/chat/service";
import { trpc } from "@/lib/trpc/client";
import type { DesignFeedback, SiteImprovement } from "@/lib/site/story";
import type { SectionInstance } from "@/lib/site/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** The single in-flight optimistic bubble. */
const OPTIMISTIC_ID = "pending-user-message";

const PROMPT_EXAMPLES = [
  "Make the hero warmer for first-time visitors",
  "What does my hero section say right now?",
  "Shorten headlines for mobile",
];

type AppliedResult = {
  sections: SectionInstance[];
  improvements: SiteImprovement[];
  designFeedback: DesignFeedback[];
  mobileFeedback: DesignFeedback[];
  summary: string;
};

/**
 * The site chatbot, in the editor.
 *
 * Replaces what used to be a one-shot "type a prompt, get one result" box —
 * this remembers the conversation (via `lib/chat/actions.ts` /
 * `ChatMessage`), can answer a question without touching the site at all,
 * and only calls `onApplied` on turns that actually changed something,
 * which the server tells us via `appliedSummary` / `sections` being present.
 */
export function SiteChatPanel({
  siteId,
  onApplied,
}: {
  siteId: string;
  onApplied: (result: AppliedResult) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const historyQuery = trpc.ai.chatHistory.useQuery({ siteId });
  const budgetQuery = trpc.ai.chatBudget.useQuery({ siteId });
  const sendMessage = trpc.ai.chatSend.useMutation();

  /**
   * The thread is the server's list plus whatever this session has optimistically
   * added, rather than a copy of the server's list held in state.
   *
   * Mirroring a query into state with an effect means two sources of truth that
   * drift the moment a refetch lands mid-send, and it is the cascading-render
   * pattern React now warns about. Deriving instead means the optimistic bubble
   * is the ONLY local state, and it disappears by itself the moment the real
   * message arrives in the query data.
   */
  const [optimistic, setOptimistic] = useState<ChatMessageView[]>([]);
  const messages = useMemo(
    () => (historyQuery.data ? [...historyQuery.data, ...optimistic] : null),
    [historyQuery.data, optimistic]
  );
  const budget = budgetQuery.data
    ? { remaining: budgetQuery.data.remaining, limit: budgetQuery.data.limit }
    : null;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending]);

  function send(text?: string) {
    const value = (text ?? draft).trim();
    if (value.length < 2) return;
    setError(null);
    setDraft("");
    const sentAt = new Date().toISOString();

    // Optimistic bubble so the thread never looks like the message vanished
    // during the round trip.
    setOptimistic([
      {
        // Fixed id, not a timestamp: only one message is ever in flight (the
        // composer is disabled while pending), and a clock read during render
        // is exactly the impurity the rules-of-React lint is pointing at.
        id: OPTIMISTIC_ID,
        role: "user",
        content: value,
        appliedSummary: null,
        createdAt: sentAt,
      },
    ]);

    startTransition(async () => {
      try {
        const result = await sendMessage.mutateAsync({ siteId, content: value });

        // Write both real rows straight into the cache rather than refetching:
        // the mutation already returned them, and a round trip here would make
        // the reply visibly land late.
        utils.ai.chatHistory.setData({ siteId }, (current) => [
          ...(current ?? []),
          result.userMessage,
          result.assistantMessage,
        ]);
        setOptimistic([]);
        void utils.ai.chatBudget.invalidate({ siteId });
        if (result.sections) {
          onApplied({
            sections: result.sections,
            improvements: result.improvements ?? [],
            designFeedback: result.designFeedback ?? [],
            mobileFeedback: result.mobileFeedback ?? [],
            summary: result.assistantMessage.appliedSummary ?? result.assistantMessage.content,
          });
        }
      } catch (err) {
        setOptimistic([]);
        setError(err instanceof Error ? err.message : "Could not send that message");
      }
    });
  }

  const outOfBudget = budget !== null && budget.remaining <= 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-editor-border p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Chat with your site
        </p>
        <p className="mt-1 text-xs text-white/55">
          Ask a question, or tell it what to change — it edits copy and layout, you add the photos.
        </p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages === null ? (
          <p className="text-xs text-white/40">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-white/50">
              <Sparkles className="size-3.5 text-accent" />
              Try one of these:
            </p>
            {PROMPT_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => send(example)}
                disabled={pending}
                className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/70 hover:border-accent/40 hover:text-accent"
              >
                {example}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  message.role === "user" ? "bg-white/10 text-white/60" : "bg-accent/20 text-accent"
                )}
              >
                {message.role === "user" ? (
                  <User className="size-3.5" />
                ) : (
                  <Bot className="size-3.5" />
                )}
              </span>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug",
                  message.role === "user"
                    ? "bg-accent text-editor-shell"
                    : "border border-white/10 bg-white/5 text-white/85"
                )}
              >
                {message.content}
                {message.appliedSummary ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-success">
                    <Sparkles className="size-2.5" />
                    Applied to your site
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
        {pending ? (
          <div className="flex items-center gap-2 pl-8 text-xs text-white/40">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Thinking…
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-editor-border p-3">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {outOfBudget ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            You&rsquo;ve used all {budget?.limit} chat messages this month.
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask or tell it what to change…"
            disabled={pending || outOfBudget}
            className="min-h-11 flex-1 resize-none border-white/15 bg-white/5 text-sm text-white placeholder:text-white/35"
            maxLength={1000}
          />
          <Button
            type="button"
            size="icon"
            disabled={pending || outOfBudget || draft.trim().length < 2}
            onClick={() => send()}
            className="size-11 shrink-0 bg-accent text-editor-shell hover:bg-accent/90"
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
        {budget && !outOfBudget ? (
          <p className="text-right text-[10px] text-white/35">
            {budget.remaining} of {budget.limit} messages left this month
          </p>
        ) : null}
      </div>
    </div>
  );
}
