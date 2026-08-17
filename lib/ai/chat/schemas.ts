import { z } from "zod";

/**
 * Routes a message before spending a full generation call on it. Kept to
 * exactly this one enum field, on the cheapest configured model
 * (`AI_MODEL_CHAT_CLASSIFIER`) — this call happens on every single message,
 * so it is the one place in the chat agent where cost scales with usage
 * fastest, and the one place a small model is least likely to cost quality.
 */
export const classifyResultSchema = z.object({
  intent: z.enum(["edit", "question"]),
});

export type ClassifyResult = z.infer<typeof classifyResultSchema>;

/** A read-only reply — never a section diff. */
export const chatAnswerSchema = z.object({
  reply: z.string().min(1).max(600),
});

export type ChatAnswerResult = z.infer<typeof chatAnswerSchema>;
