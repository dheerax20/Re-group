/**
 * How much prompt text an AI edit accepts.
 *
 * A leaf module on purpose: the Slack slash-command route has three seconds to
 * answer and must not pull LangChain into its cold start just to read a number,
 * and `lib/slack/commands.ts` documents itself as pure. Every surface that
 * takes a prompt reads this rather than carrying its own copy.
 *
 * The three used to disagree — the Slack parser truncated at 600 while the
 * model layer accepted 1200 — and the lower cap cut real requests mid-URL,
 * handing the model a fragment like `https://8qsi` that fails `safeMediaUrl`
 * and takes the whole image block with it. Truncation is lossy in a way the
 * person who typed the prompt cannot see, so there is now one number.
 */
export const MAX_PROMPT_CHARS = 1200;

/** Short enough to be a typo rather than an instruction. */
export const MIN_PROMPT_CHARS = 4;
