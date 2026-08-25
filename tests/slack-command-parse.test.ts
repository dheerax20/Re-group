import { describe, expect, it } from "vitest";
import { MAX_PROMPT_LENGTH, parseCommand } from "@/lib/slack/commands";

/**
 * Reading `/regroup …`.
 *
 * Two things here have consequences beyond tidiness. Routing decides whether
 * a message costs an LLM call — `help` and `status` are free — and the
 * whole-message rule for sub-commands is what stops "undo the hero change and
 * make it blue" from being read as a bare `undo`, which would revert
 * something nobody asked to revert and throw the rest of the sentence away.
 *
 * The cleaning tests exist because Slack does not send what the user typed:
 * mentions, channels and links arrive as markup, and `&`, `<`, `>` arrive
 * escaped. Anything left in reaches the model, and the model may faithfully
 * copy it onto a church's homepage.
 */
describe("parseCommand", () => {
  it("treats a bare command as a request for help", () => {
    expect(parseCommand("")).toEqual({ kind: "help" });
    expect(parseCommand("   ")).toEqual({ kind: "help" });
  });

  it.each(["help", "status", "undo", "HELP", "Status", " UnDo "])(
    "routes %o to its sub-command",
    (text) => {
      expect(parseCommand(text).kind).toBe(text.trim().toLowerCase());
    }
  );

  it.each([
    "undo the hero change and make it blue instead",
    "help me write a warmer welcome message",
    "status of the giving page needs to be clearer",
  ])("treats %o as a prompt, not a sub-command", (text) => {
    expect(parseCommand(text).kind).toBe("prompt");
  });

  it("strips user mentions, which mean nothing to the model", () => {
    const parsed = parseCommand("<@U123456> please make the hero warmer");

    expect(parsed).toEqual({ kind: "prompt", prompt: "please make the hero warmer" });
  });

  it("keeps a channel's name but drops its id", () => {
    const parsed = parseCommand("mention <#C123|welcome-team> on the about page");

    expect(parsed).toMatchObject({ prompt: "mention #welcome-team on the about page" });
  });

  it("keeps a pasted URL, and prefers a link's label when it has one", () => {
    expect(parseCommand("add a giving button to <https://give.example.org>")).toMatchObject({
      prompt: "add a giving button to https://give.example.org",
    });
    expect(parseCommand("link the words <https://x.org|Give now> in the hero")).toMatchObject({
      prompt: "link the words Give now in the hero",
    });
  });

  it("drops @here and @channel markup", () => {
    expect(parseCommand("<!here> make the hero warmer")).toMatchObject({
      prompt: "make the hero warmer",
    });
  });

  it("unescapes the three entities Slack escapes", () => {
    const parsed = parseCommand("change it to &quot;Bread &amp; Wine&quot; &lt;small&gt;");

    // &amp; &lt; &gt; are unescaped; &quot; is not one Slack sends, so it is
    // left exactly as typed rather than guessed at.
    expect(parsed).toMatchObject({
      prompt: 'change it to &quot;Bread & Wine&quot; <small>',
    });
  });

  it("does not let an escaped bracket become markup", () => {
    // Unescaping before unwrapping would turn this into a user mention and
    // delete the text the church actually typed.
    expect(parseCommand("write &lt;@U123&gt; literally in the footer")).toMatchObject({
      prompt: "write <@U123> literally in the footer",
    });
  });

  it("collapses the whitespace left behind by stripped markup", () => {
    expect(parseCommand("make    the\n\nhero   warmer")).toMatchObject({
      prompt: "make the hero warmer",
    });
  });

  it("clamps to the same ceiling the web path enforces", () => {
    const parsed = parseCommand("a".repeat(MAX_PROMPT_LENGTH + 200));

    expect(parsed.kind).toBe("prompt");
    if (parsed.kind === "prompt") expect(parsed.prompt).toHaveLength(MAX_PROMPT_LENGTH);
  });

  it("asks for a real instruction when nothing usable is left", () => {
    // A message that was only a mention cleans down to nothing.
    const parsed = parseCommand("<@U123456>");

    expect(parsed.kind).toBe("invalid");
    if (parsed.kind === "invalid") expect(parsed.message).toContain("/regroup");
  });

  it("rejects a prompt too short to act on", () => {
    expect(parseCommand("hi").kind).toBe("invalid");
  });
});
