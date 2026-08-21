import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { buildRoleLlm, resolveGateway } from "@/lib/ai/agents/model-config";
import { toOpenAiJsonSchema } from "@/lib/ai/agents/specialists";
import {
  blockAdditionSchema,
  blockPatchSchema,
  describeBlocks,
  type BlockAddition,
  type BlockPatch,
} from "@/lib/site/blocks/patch";
import type { PageBlocks } from "@/lib/site/blocks/types";

/** One turn of the site chatbot's conversation, as fed back into a prompt. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * The in-editor AI prompt, rebuilt against the block tree.
 *
 * The previous version spoke `SectionInstance[]` and wrote `sectionConfig` — a
 * column the renderer stopped reading once a site had been AI-built, which is
 * why edits from the builder did nothing visible. This one reads the same
 * `blocks` the page renders and returns patches against them.
 *
 * Asking for patches rather than a new tree is the other half of the fix: a
 * request to shorten a headline should not be able to redesign the page, and
 * a model that returns twelve bands when asked for one edit is the normal
 * failure mode, not an exotic one.
 */

const improvementActionSchema = z.enum([
  "upload_hero_photo",
  "add_welcome_video",
  "connect_youtube",
  "add_event_photos",
  "upload_logo",
  "add_sermon_video",
  "fix_mobile_hero",
  "fix_mobile_nav",
  "tighten_mobile_type",
]);

const feedbackAreaSchema = z.enum([
  "mobile",
  "typography",
  "media",
  "contrast",
  "layout",
  "content",
]);

const feedbackSchema = z.object({
  title: z.string().min(4).max(72),
  detail: z.string().min(12).max(200),
  area: feedbackAreaSchema,
});

/** What we ASK for. Every bound here is a real instruction to the model. */
const blockPromptSchema = z.object({
  summary: z.string().min(8).max(200),
  /** Which page these edits apply to. Defaults to the one being viewed. */
  page: z.string().optional(),
  patches: z.array(blockPatchSchema).max(24),
  additions: z.array(blockAdditionSchema).max(8),
  improvements: z
    .array(
      z.object({
        title: z.string().min(4).max(72),
        detail: z.string().min(12).max(180),
        action: improvementActionSchema,
      })
    )
    .min(2)
    .max(7),
  designFeedback: z.array(feedbackSchema).min(1).max(5),
  mobileFeedback: z.array(feedbackSchema).min(1).max(5),
});

/**
 * How the reply is READ.
 *
 * Same reasoning as `pageComposerResponseSchema` in `lib/ai/agents/schemas.ts`:
 * the patch array contains optional fields, so this chain runs non-strict,
 * where `required` and `minLength` are guidance rather than guarantees.
 * Failing an otherwise-good edit because the model skipped a feedback note
 * would be throwing away the thing the church actually asked for.
 */
const blockPromptResponseSchema = z.unknown().transform((raw) => {
  const reply = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const patches: BlockPatch[] = Array.isArray(reply.patches)
    ? reply.patches
        .map((item) => blockPatchSchema.safeParse(item))
        .filter((parsed) => parsed.success)
        .map((parsed) => (parsed as { data: BlockPatch }).data)
    : [];

  const additions: BlockAddition[] = Array.isArray(reply.additions)
    ? reply.additions
        .map((item) => blockAdditionSchema.safeParse(item))
        .filter((parsed) => parsed.success)
        .map((parsed) => (parsed as { data: BlockAddition }).data)
    : [];

  const list = <T,>(value: unknown, schema: z.ZodType<T>): T[] =>
    Array.isArray(value)
      ? value
          .map((item) => schema.safeParse(item))
          .filter((parsed) => parsed.success)
          .map((parsed) => (parsed as { data: T }).data)
      : [];

  return {
    summary:
      typeof reply.summary === "string" && reply.summary.trim()
        ? reply.summary.trim().slice(0, 200)
        : "",
    patches,
    additions,
    page: typeof reply.page === "string" ? reply.page.trim() : "",
    improvements: list(
      reply.improvements,
      z.object({
        title: z.string().min(1).max(72),
        detail: z.string().min(1).max(180),
        action: improvementActionSchema,
      })
    ),
    designFeedback: list(reply.designFeedback, feedbackSchema),
    mobileFeedback: list(reply.mobileFeedback, feedbackSchema),
  };
});

export type BlockPromptResult = z.infer<typeof blockPromptResponseSchema>;

const SYSTEM = [
  "You are an in-editor AI for a church website builder. The homepage is a tree of layout ",
  "BLOCKS, and you edit it by returning PATCHES — never a new page. ",
  "Each patch names one existing block `id` from the listing you are given and sets only the ",
  "fields you want changed. Any id not in that listing is invalid and will be discarded, so ",
  "never invent one. Return the SMALLEST set of patches that satisfies the request: a request ",
  "about the headline should produce one patch, not twelve. ",
  "Editable fields by block type — text/heading/eyebrow: `text`; heading AND text also take ",
  "`scale` (display/h1/h2/h3/body/small), which is how you change a font size: it is one ",
  "vocabulary for both, read as a heading size on a heading and a paragraph size on a text ",
  "block, so `body` is normal body copy, `small` is fine print, and h3/h2/h1 step up from a ",
  "lead paragraph to a pull quote. Change `scale` when asked to make something bigger or ",
  "smaller — never rewrite the words to fake it. eyebrow also `accent` ",
  "(none/line/bordered/numbered); button: `label`, `href` (internal paths like /contact ",
  "/about /events /sermons /giving), `emphasis` (primary/secondary/outline); image: ",
  "`treatment`, `aspect`, and `src`/`videoSrc`/`alt` under the IMAGES rule below; ",
  "sermonCollection/eventCollection: ",
  "`layout`, `limit`; ministryCollection: `items` (name + description); row: `columns` (1-4). ",
  "Any block may take `style`: padding/gap (none, xs, sm, md, lg, xl, 2xl), align ",
  "(left/center/right), width (narrow/normal/wide/full), background (transparent, surface, ",
  "primary, accent, inverted), textTone (default/muted/inverted/accent). `style` is merged, so ",
  "set only the keys you are changing. ",
  "Never fill a band with the church's primary or secondary colour at full strength — `surface`, ",
  "`primary` and `accent` all render as a wash of the brand at 5-10% opacity over the page ",
  "background, which is what you want. If the request asks for a coloured section, that wash IS the ",
  "answer; only use `inverted` when they explicitly ask for a dark band. Never set a band's padding ",
  "below `lg`, or its gap to `none` or `xs`. ",
  "Set `remove: true` to delete a block; the nav and footer bands cannot be removed. ",
  "TO ADD SOMETHING NEW, return an `additions` entry — do NOT reply that a new section is ",
  // Braces are DOUBLED on purpose: ChatPromptTemplate uses f-string
  // templating, so a literal `{ ... }` here is parsed as an input variable
  // and every invoke() throws "Missing value for input variable" before the
  // provider is ever called.
  "impossible. Each entry is `{{ after: <existing id>, block: <a complete block> }}`. `after` may ",
  "name a top-level band (the new block becomes the next band) or a nested block (it becomes the ",
  "next sibling inside that band), which is how you add both a whole section and a single button. ",
  "Use `at: \"start\"` or `at: \"end\"` when nothing sensible to anchor to exists. A new section ",
  "is a `section` block whose children you compose from the same vocabulary — e.g. an image ",
  "gallery is a section containing a heading and a `row` with `columns` set and one `image` per ",
  "photo. Give every new block a short descriptive id. ",
  "IMAGES AND VIDEO: set an `image` block's `src` (or `videoSrc` for a YouTube link) ONLY to a URL ",
  "the church has given you in this conversation. Never invent, guess, or recall an image URL, and ",
  "never use a stock-photo URL you happen to know — a wrong photo on a church's homepage is worse ",
  "than an empty slot. Only https URLs are accepted; anything else is discarded. Set `alt` to a ",
  "short description of what the photo shows. If they ask for images but give no URLs, add the ",
  "blocks with empty `src` and ask for the links in your summary. ",
  "Collections (sermons, events, contact, giving, social links) render real church data — you ",
  "control their presentation, never their content, and you must never invent sermon titles, ",
  "event dates or contact details. ",
  "If a conversation history is included, use it to resolve what 'that', 'it' or 'the last ",
  "change' refers to — but act only on the CURRENT request. ",
  "PAGES: you are shown one page at a time. If the request is clearly about a DIFFERENT page ",
  "(\"change the subtitle on the about page\"), set `page` to that page's path from the list you ",
  "are given and return no patches — the correct page will be reloaded and your instruction ",
  "re-run against it. Only set `page` when the request names another page explicitly. ",
  "Only if a request is genuinely impossible with this vocabulary should you return no patches ",
  "and no additions, saying plainly why in `summary`. ",
  "Always refresh improvements and design/mobile feedback covering photos, content and mobile.",
].join("");

const HUMAN = [
  "Church: {churchName}",
  "Features: {features}",
  "",
  "Editing page: {page}",
  "Other pages you may retarget: {pages}",
  "",
  "{history}Request:",
  "{prompt}",
  "",
  "Current page blocks (id | type | content | style):",
  "{blocks}",
].join("\n");

export async function applyBlockAiPrompt(args: {
  churchName: string;
  prompt: string;
  blocks: PageBlocks;
  features: Record<string, unknown>;
  /** The page being edited, e.g. "/" or "/about". */
  page: string;
  /** Every page this church may edit, so the model can retarget. */
  editablePages: Array<{ href: string; label: string }>;
  history?: ChatTurn[];
}): Promise<BlockPromptResult> {
  const gateway = resolveGateway();
  if (!gateway) {
    throw new Error("No AI provider is configured (set OPENAI_API_KEY).");
  }

  const llm = buildRoleLlm(gateway, "editor", 0.45);

  /**
   * Non-strict, with a hand-sanitized JSON Schema, for the same two reasons
   * the page composer is: OpenAI's strict mode requires every property in
   * `required`, which a patch (all-optional by design) cannot satisfy, and
   * `toOpenAiJsonSchema` fixes what zod emits.
   */
  const jsonSchema = toOpenAiJsonSchema(toJsonSchema(blockPromptSchema)) as Record<
    string,
    unknown
  >;
  const structured = llm.withStructuredOutput(jsonSchema, {
    name: "editor_block_patch",
    strict: false,
  });

  const chain = RunnableSequence.from([
    ChatPromptTemplate.fromMessages([
      ["system", SYSTEM],
      ["human", HUMAN],
    ]),
    structured,
    (raw: unknown) => blockPromptResponseSchema.parse(raw),
  ]);

  const historyBlock = args.history?.length
    ? `Recent conversation:\n${args.history
        .map((turn) => `${turn.role === "user" ? "Pastor/admin" : "Assistant"}: ${turn.content}`)
        .join("\n")}\n\n`
    : "";

  return (await chain.invoke({
    churchName: args.churchName,
    features: JSON.stringify(args.features),
    history: historyBlock,
    prompt: args.prompt.slice(0, 1200),
    page: args.page,
    pages: args.editablePages
      .filter((p) => p.href !== args.page)
      .map((p) => `${p.href} (${p.label})`)
      .join(", ") || "(none)",
    blocks: describeBlocks(args.blocks),
  })) as BlockPromptResult;
}
