import { describe, it, expect } from "vitest";
import {
  canModifyContent,
  canCreatePost,
  canComment,
  canModerate,
  canViewParticipationDashboard,
  EDIT_WINDOW_MINUTES,
  type Actor,
} from "@/lib/permissions";

const teacher: Actor = { id: "t1", role: "teacher", status: "active" };
const student: Actor = { id: "s1", role: "student", status: "active" };
const otherStudent: Actor = { id: "s2", role: "student", status: "active" };
const deactivated: Actor = { id: "s3", role: "student", status: "deactivated" };
const deactivatedTeacher: Actor = { id: "t2", role: "teacher", status: "deactivated" };

const NOW = new Date("2026-06-10T12:00:00.000Z");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

describe("role gates", () => {
  it("only an active teacher can create posts", () => {
    expect(canCreatePost(teacher)).toBe(true);
    expect(canCreatePost(student)).toBe(false);
    expect(canCreatePost(deactivatedTeacher)).toBe(false);
  });

  it("only an active teacher can moderate and see the dashboard", () => {
    expect(canModerate(teacher)).toBe(true);
    expect(canModerate(student)).toBe(false);
    expect(canViewParticipationDashboard(teacher)).toBe(true);
    expect(canViewParticipationDashboard(student)).toBe(false);
  });

  it("deactivated users cannot comment", () => {
    expect(canComment(student)).toBe(true);
    expect(canComment(deactivated)).toBe(false);
  });
});

describe("30-minute edit window", () => {
  const ownFresh = { authorId: "s1", createdAt: minutesAgo(10) };
  const ownStale = { authorId: "s1", createdAt: minutesAgo(EDIT_WINDOW_MINUTES + 1) };
  const ownBoundary = { authorId: "s1", createdAt: minutesAgo(EDIT_WINDOW_MINUTES) };

  it("author can modify within the window", () => {
    expect(canModifyContent(student, ownFresh, NOW)).toBe(true);
  });

  it("author cannot modify after the window", () => {
    expect(canModifyContent(student, ownStale, NOW)).toBe(false);
  });

  it("the window is exclusive at exactly 30 minutes", () => {
    expect(canModifyContent(student, ownBoundary, NOW)).toBe(false);
  });

  it("other students can never modify someone else's content", () => {
    expect(canModifyContent(otherStudent, ownFresh, NOW)).toBe(false);
  });

  it("the teacher can always modify anything", () => {
    expect(canModifyContent(teacher, ownStale, NOW)).toBe(true);
  });

  it("deactivated authors cannot modify even fresh content", () => {
    expect(canModifyContent(deactivated, { authorId: "s3", createdAt: minutesAgo(1) }, NOW)).toBe(false);
  });
});
