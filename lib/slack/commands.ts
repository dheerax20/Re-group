import { MAX_PROMPT_CHARS, MIN_PROMPT_CHARS } from "@/lib/ai/prompt-limits";

/**
 * What `/regroup …` was asking for.
 *
 * Pure: no I/O, no database, no Slack calls. It runs inside the three-second
 * window Slack gives a slash command to acknowledge, and it is the only place
 * that decides whether a message costs an LLM call at all — `help` and
 * `status` answer for free, so getting this wrong is the difference between a
 * typo and a charge.
 */

/**
 * Matches `ai.editorPrompt`'s zod schema, which the same text reaches.
 *
 * 1200 rather than 600 because `lib/ai/block-prompt.ts` already accepts that
 * much and the lower cap was silently destroying real requests: a prompt
 * carrying content plus an image URL runs past 600 easily, and `slice` cuts
 * mid-URL, handing the model a truncated `https://8qsi` that fails
 * `safeMediaUrl` and takes its whole block with it. Truncating a prompt is
 * lossy in a way the person cannot see, so the cap belongs where the model's
 * own limit is.
 */
export const MIN_PROMPT_LENGTH = MIN_PROMPT_CHARS;
export const MAX_PROMPT_LENGTH = MAX_PROMPT_CHARS;

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
 * Whether a link's label is just Slack rendering the URL, rather than words
 * somebody chose.
 *
 * The two cases look identical on the wire and need opposite handling. When
 * someone hyperlinks the words "Give now", the label is the request and the
 * URL is the target. When someone PASTES a long URL, Slack labels it with a
 * shortened display form — no scheme, often an ellipsis — and keeping that
 * label hands the model a string that is not a URL at all: it fails
 * `safeMediaUrl`, so the image block built from it is dropped whole and the
 * edit silently does nothing. That is how a pasted photo link turns into "no
 * change was made".
 *
 * So: if the label is a prefix of the URL once the parts Slack drops for
 * display are ignored, it is a rendering of that URL and the URL wins.
 * Anything else is words, and the words win.
 */
function labelIsDisplayFormOf(label: string, url: string): boolean {
  const strip = (value: string) =>
    value
      .trim()
      .replace(/^(?:https?|mailto):(?:\/\/)?/i, "")
      .replace(/^www\./i, "")
      .replace(/[…]+$|\.{3,}$/, "")
      .replace(/\/+$/, "")
      .toLowerCase();

  const shown = strip(label);
  const target = strip(url);
  if (!shown) return true;
  return target === shown || target.startsWith(shown);
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
      // <https://x|label> → whichever of the two the church actually meant.
      .replace(/<((?:https?|mailto):[^>|]*)\|([^>]*)>/g, (_m, url: string, label: string) =>
        labelIsDisplayFormOf(label, url) ? url : label
      )
      // <https://x> → https://x. A church pasting a giving URL means the URL.
      .replace(/<((?:https?|mailto):[^>]*)>/g, "$1")
      // Slack escapes exactly these three, and only these three.
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      /**
       * Slack's own bold/italic/strike/code markers, last.
       *
       * A message composed with any formatting arrives as `*bold*`, and those
       * asterisks are not something anyone typed — they are Slack's wire
       * format. Left in, the model copies them into a church's homepage as
       * literal characters. `lib/slack/blocks.ts` already strips exactly this
       * set on the way out; this is the same rule on the way in.
       *
       * After the unescaping above, so a `&amp;` that became `&` is not
       * re-examined, and after the markup rules, whose angle brackets these
       * characters can appear inside.
       */
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}
