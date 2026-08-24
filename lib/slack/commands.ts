/**
 * What `/regroup …` was asking for.
 *
 * Pure: no I/O, no database, no Slack calls. It runs inside the three-second
 * window Slack gives a slash command to acknowledge, and it is the only place
 * that decides whether a message costs an LLM call at all — `help` and
 * `status` answer for free, so getting this wrong is the difference between a
 * typo and a charge.
 */

/** Matches `ai.editorPrompt`'s zod schema, which the same text reaches. */
export const MIN_PROMPT_LENGTH = 4;
export const MAX_PROMPT_LENGTH = 600;

export type SlackCommand =
  | { kind: "help" }
  | { kind: "status" }
  | { kind: "undo" }
  | { kind: "prompt"; prompt: string }
  | { kind: "invalid"; message: string };

/**
 * Sub-commands match the WHOLE message, not just its first word.
 *
 * "undo" is an instruction; "undo the change you made to the hero and make it
 * blue instead" is a prompt that happens to start with the same word. Keying
 * on the first token alone would silently throw the rest of that sentence
 * away and revert something the church did not ask to revert — the one
 * command here with destructive consequences, triggered by a prefix match.
 */
const SUBCOMMANDS = new Set(["help", "status", "undo"]);

export function parseCommand(text: string): SlackCommand {
  const trimmed = text.trim();

  // `/regroup` on its own is someone finding out what this does.
  if (!trimmed) return { kind: "help" };

  const lowered = trimmed.toLowerCase();
  if (SUBCOMMANDS.has(lowered)) {
    return { kind: lowered as "help" | "status" | "undo" };
  }

  const prompt = cleanPrompt(trimmed);

  if (prompt.length < MIN_PROMPT_LENGTH) {
    return {
      kind: "invalid",
      message:
        "Tell me what to change — for example: `/regroup make the welcome message warmer`.",
    };
  }

  return { kind: "prompt", prompt: prompt.slice(0, MAX_PROMPT_LENGTH) };
}

/**
 * Turns what Slack sends into what a person actually typed.
 *
 * Slack rewrites a message before it reaches us: mentions, channels and links
 * arrive as angle-bracket markup, and `&`, `<`, `>` arrive HTML-escaped. Left
 * alone, `<@U123>` reaches the model as noise it may faithfully copy into a
 * church's homepage.
 *
 * Order is load-bearing. Markup is unwrapped FIRST, while the only literal
 * angle brackets in the string are Slack's own; unescaping first would turn a
 * user's typed `&lt;` into a bracket that then parses as markup.
 */
function cleanPrompt(text: string): string {
  return (
    text
      // <@U123> / <@U123|name> — a user id means nothing to the model.
      .replace(/<@[UW][A-Z0-9]*(\|[^>]*)?>/g, "")
      // <#C123|general> → #general. The name is the part with meaning.
      .replace(/<#C[A-Z0-9]*\|([^>]*)>/g, "#$1")
      .replace(/<#C[A-Z0-9]*>/g, "")
      // <!here> / <!channel> / <!subteam^S123|@team>
      .replace(/<!([^>|]+)(\|[^>]*)?>/g, "")
      // <https://x|label> → label, <https://x> → https://x. A church pasting
      // a giving URL means the URL, so it is kept when there is no label.
      .replace(/<((?:https?|mailto):[^>|]*)\|([^>]*)>/g, "$2")
      .replace(/<((?:https?|mailto):[^>]*)>/g, "$1")
      // Slack escapes exactly these three, and only these three.
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}
