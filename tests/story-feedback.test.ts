import { describe, expect, it } from "vitest";
import { withStoryFeedback } from "@/lib/site/story";

/**
 * Writing AI feedback back into `storyConfig` must not eat the rest of it.
 *
 * Both edit paths used to write `{ ...parseChurchStory(col), improvements, … }`.
 * `parseChurchStory` projects to exactly the six `ChurchStory` strings, so
 * every other key the column carries was dropped on every edit — including
 * `styleName`, which `runCrewBuild` reads to keep a church's chosen visual
 * style across rebuilds. One chat edit reset it, silently.
 *
 * Undo is built on top of this: a snapshot that restores three keys is only
 * correct if the write it reverses touched three keys.
 */
describe("withStoryFeedback", () => {
  const stored = {
    city: "Austin",
    pastorName: "Sam Reyes",
    styleName: "Quiet Modern",
    agentLog: [{ agent: "art-director", role: "style", summary: "picked a palette" }],
    improvements: [{ title: "old", detail: "d", action: "a" }],
  };

  it("keeps every key the column already held", () => {
    const next = withStoryFeedback(stored, {
      improvements: [],
      designFeedback: [],
      mobileFeedback: [],
    });

    expect(next.styleName).toBe("Quiet Modern");
    expect(next.agentLog).toEqual(stored.agentLog);
    expect(next.city).toBe("Austin");
    expect(next.pastorName).toBe("Sam Reyes");
  });

  it("replaces the three feedback keys rather than merging them", () => {
    const next = withStoryFeedback(stored, {
      improvements: [{ title: "new", detail: "d", action: "a" }],
      designFeedback: [{ title: "d", detail: "d", area: "hero" }],
      mobileFeedback: [],
    });

    // Stale advice about a version of the page that no longer exists is worse
    // than none.
    expect(next.improvements).toEqual([{ title: "new", detail: "d", action: "a" }]);
    expect(next.designFeedback).toEqual([{ title: "d", detail: "d", area: "hero" }]);
    expect(next.mobileFeedback).toEqual([]);
  });

  it("writes all three keys even when the model offered nothing", () => {
    const next = withStoryFeedback(stored, {});

    expect(next).toMatchObject({ improvements: [], designFeedback: [], mobileFeedback: [] });
  });

  it("tolerates a column that is missing, null, or not an object", () => {
    for (const value of [undefined, null, "wat", 42, ["a"]]) {
      expect(withStoryFeedback(value, {})).toEqual({
        improvements: [],
        designFeedback: [],
        mobileFeedback: [],
      });
    }
  });
});
