import { describe, it, expect } from "vitest";
import { tallyPoll, parsePollOptions } from "@/lib/polls";

const OPTIONS = [
  { id: "o1", label: "Yes" },
  { id: "o2", label: "No" },
  { id: "o3", label: "Unsure" },
];

describe("tallyPoll", () => {
  it("handles an empty poll", () => {
    const { results, totalVotes, myOptionId } = tallyPoll(OPTIONS, [], "me");
    expect(totalVotes).toBe(0);
    expect(myOptionId).toBeNull();
    expect(results.map((r) => r.count)).toEqual([0, 0, 0]);
    expect(results.map((r) => r.percent)).toEqual([0, 0, 0]);
  });

  it("counts one vote per user and computes percentages", () => {
    const votes = [
      { optionId: "o1", userId: "a" },
      { optionId: "o1", userId: "b" },
      { optionId: "o2", userId: "c" },
      { optionId: "o1", userId: "d" },
    ];
    const { results, totalVotes } = tallyPoll(OPTIONS, votes, "c");
    expect(totalVotes).toBe(4);
    expect(results.find((r) => r.optionId === "o1")!.count).toBe(3);
    expect(results.find((r) => r.optionId === "o1")!.percent).toBe(75);
    expect(results.find((r) => r.optionId === "o2")!.percent).toBe(25);
  });

  it("marks the current user's choice", () => {
    const { results, myOptionId } = tallyPoll(
      OPTIONS,
      [{ optionId: "o2", userId: "me" }],
      "me"
    );
    expect(myOptionId).toBe("o2");
    expect(results.find((r) => r.optionId === "o2")!.mine).toBe(true);
    expect(results.find((r) => r.optionId === "o1")!.mine).toBe(false);
  });

  it("ignores votes for unknown options", () => {
    const { totalVotes } = tallyPoll(
      OPTIONS,
      [{ optionId: "deleted-option", userId: "a" }],
      "me"
    );
    expect(totalVotes).toBe(0);
  });
});

describe("parsePollOptions", () => {
  it("splits lines, trims, drops empties and duplicates", () => {
    expect(parsePollOptions("Yes\n  No \n\nyes\nMaybe")).toEqual([
      "Yes",
      "No",
      "Maybe",
    ]);
  });

  it("caps at 10 options", () => {
    const raw = Array.from({ length: 15 }, (_, i) => `Option ${i}`).join("\n");
    expect(parsePollOptions(raw)).toHaveLength(10);
  });
});
