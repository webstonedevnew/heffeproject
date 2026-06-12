import { describe, it, expect } from "vitest";
import { inviteProblem, parseEmailList, isValidEmail } from "@/lib/invites";

const NOW = new Date("2026-06-10T12:00:00.000Z");

describe("inviteProblem", () => {
  it("accepts a fresh, unused invite", () => {
    expect(
      inviteProblem({ acceptedAt: null, expiresAt: "2026-06-20T00:00:00.000Z" }, NOW)
    ).toBeNull();
  });

  it("rejects an already-accepted invite", () => {
    expect(
      inviteProblem(
        { acceptedAt: "2026-06-01T00:00:00.000Z", expiresAt: "2026-06-20T00:00:00.000Z" },
        NOW
      )
    ).toBe("accepted");
  });

  it("rejects an expired invite", () => {
    expect(
      inviteProblem({ acceptedAt: null, expiresAt: "2026-06-09T00:00:00.000Z" }, NOW)
    ).toBe("expired");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(
      inviteProblem({ acceptedAt: null, expiresAt: NOW.toISOString() }, NOW)
    ).toBe("expired");
  });

  it("accepted takes precedence over expired", () => {
    expect(
      inviteProblem(
        { acceptedAt: "2026-06-01T00:00:00.000Z", expiresAt: "2026-06-02T00:00:00.000Z" },
        NOW
      )
    ).toBe("accepted");
  });
});

describe("parseEmailList (bulk invite paste)", () => {
  it("splits on commas, semicolons, spaces and newlines", () => {
    const { valid, invalid } = parseEmailList(
      "a@school.eu, b@school.eu;c@school.eu\nd@school.eu e@school.eu"
    );
    expect(valid).toEqual([
      "a@school.eu",
      "b@school.eu",
      "c@school.eu",
      "d@school.eu",
      "e@school.eu",
    ]);
    expect(invalid).toEqual([]);
  });

  it("lowercases and dedupes", () => {
    const { valid } = parseEmailList("Anna@School.EU\nanna@school.eu");
    expect(valid).toEqual(["anna@school.eu"]);
  });

  it("handles 'Name <email>' shapes", () => {
    const { valid } = parseEmailList("<anna@school.eu>");
    expect(valid).toEqual(["anna@school.eu"]);
  });

  it("collects invalid entries instead of dropping them silently", () => {
    const { valid, invalid } = parseEmailList("good@school.eu not-an-email another@bad");
    expect(valid).toEqual(["good@school.eu"]);
    expect(invalid).toEqual(["not-an-email", "another@bad"]);
  });

  it("returns empty lists for empty input", () => {
    expect(parseEmailList("  \n ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("isValidEmail", () => {
  it.each(["a@b.co", "first.last@school.example.eu"])("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });
  it.each(["", "a@b", "a b@c.eu", "@school.eu", "a@.eu"])("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});
