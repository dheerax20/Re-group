import { describe, expect, it } from "vitest";
import {
  editResultMessage,
  failureMessage,
  helpMessage,
  revertedMessage,
  statusMessage,
  UNDO_ACTION_ID,
} from "@/lib/slack/blocks";

/**
 * What Regroup says in a church's channel.
 *
 * Three things are asserted rather than eyeballed:
 *
 * 1. Every message carries `text`. Slack uses it for the notification and for
 *    clients that cannot render blocks — a message without it arrives blank.
 * 2. A failure block describes the problem and nothing else. These are read
 *    by whoever ran the command, who is often not the church admin, and a
 *    refusal has no business describing someone else's site.
 * 3. Interpolated church text cannot reformat the message. Slack renders
 *    `*bold*` from mrkdwn, so a church called "Grace *Chapel*" would
 *    otherwise rewrite the layout around it.
 */
const RESULT = {
  summary: "Warmed up the welcome message.",
  pageLabel: "Home",
  path: "/",
  improvementCount: 2,
  editorUrl: "https://app.regroup.test/dashboard/builder",
};

function textOf(blocks: unknown): string {
  return JSON.stringify(blocks);
}

describe("editResultMessage", () => {
  it("names the page that changed, because the model may have retargeted", () => {
    const message = editResultMessage({ ...RESULT, pageLabel: "About", path: "/about" });

    expect(message.text).toBe(RESULT.summary);
    expect(textOf(message.blocks)).toContain("About");
    expect(textOf(message.blocks)).toContain("/about");
  });

  it("offers Undo only while there is something to undo", () => {
    const withUndo = editResultMessage({ ...RESULT, undoJobId: "job-1" });
    const without = editResultMessage(RESULT);

    expect(textOf(withUndo.blocks)).toContain(UNDO_ACTION_ID);
    expect(textOf(without.blocks)).not.toContain(UNDO_ACTION_ID);
  });

  it("puts the job id on the button, so the click reverts THAT edit", () => {
    const message = editResultMessage({ ...RESULT, undoJobId: "job-42" });
    const actions = message.blocks.at(-1) as {
      elements: Array<{ action_id?: string; value?: string; confirm?: unknown }>;
    };
    const undo = actions.elements.find((el) => el.action_id === UNDO_ACTION_ID);

    expect(undo?.value).toBe("job-42");
    // Destructive and one click away from anyone who can see the channel.
    expect(undo?.confirm).toBeTruthy();
  });

  it("only offers View site once there is a published site to view", () => {
    const draft = editResultMessage(RESULT);
    const live = editResultMessage({ ...RESULT, publicUrl: "https://grace.regroup.test" });

    expect(textOf(draft.blocks)).not.toContain("View site");
    expect(textOf(live.blocks)).toContain("View site");
  });

  it("counts suggestions in the singular when there is one", () => {
    expect(textOf(editResultMessage({ ...RESULT, improvementCount: 1 }).blocks)).toContain(
      "1 suggestion waiting"
    );
    expect(textOf(editResultMessage({ ...RESULT, improvementCount: 0 }).blocks)).not.toContain(
      "suggestion"
    );
  });

  it("neutralises mrkdwn in text that came from the church", () => {
    const message = editResultMessage({ ...RESULT, summary: "Changed *the* _hero_ `block`" });

    expect(textOf(message.blocks)).toContain("Changed the hero block");
  });
});

describe("failureMessage", () => {
  it("says what went wrong and carries it as the notification text", () => {
    const message = failureMessage("Regroup isn't set up for this channel.");

    expect(message.text).toBe("Regroup isn't set up for this channel.");
    expect(textOf(message.blocks)).toContain("isn't set up for this channel");
  });

  it("contains nothing but the message it was given", () => {
    // The regression this guards: someone adding "…for Grace Chapel" or a
    // site link to make a refusal friendlier, and publishing the church's
    // setup to whoever tripped it.
    const message = failureMessage("Only the Regroup account that connected this can edit.");
    const serialized = textOf(message.blocks);

    for (const leak of [
      "Grace Chapel",
      "regroup.test",
      "dashboard",
      "U_OWNER",
      "site-1",
      "#website",
    ]) {
      expect(serialized).not.toContain(leak);
    }
  });
});

describe("statusMessage", () => {
  const status = {
    published: true,
    publicUrl: "https://grace.regroup.test",
    editsRemaining: 148,
    editsLimit: 150,
    resetsOn: "September 1",
    channelName: "#website",
  };

  it("reports the allowance and where Regroup listens", () => {
    const message = statusMessage(status);
    const serialized = textOf(message.blocks);

    expect(serialized).toContain("148 of 150");
    expect(serialized).toContain("September 1");
    expect(serialized).toContain("#website");
  });

  it("says plainly that a draft is not visible yet", () => {
    const message = statusMessage({ ...status, published: false, publicUrl: undefined });

    expect(textOf(message.blocks)).toContain("not visible to visitors");
    expect(textOf(message.blocks)).not.toContain("View site");
  });
});

describe("helpMessage", () => {
  it("lists the commands and states undo's limits", () => {
    const serialized = textOf(helpMessage("#website").blocks);

    for (const expected of ["/regroup status", "/regroup undo", "/regroup help", "#website"]) {
      expect(serialized).toContain(expected);
    }
    // All three are things a church would otherwise discover by being
    // surprised by them.
    expect(serialized).toContain("one edit");
    expect(serialized).toContain("15 minutes");
    expect(serialized).toContain("does not refund");
  });
});

describe("revertedMessage", () => {
  it("warns when undo discarded more than the edit it reversed", () => {
    expect(textOf(revertedMessage("Home", true).blocks)).toContain("also discarded");
    expect(textOf(revertedMessage("Home", false).blocks)).not.toContain("also discarded");
  });
});
