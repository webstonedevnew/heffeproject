import { describe, it, expect } from "vitest";
import {
  computeParticipation,
  type ParticipationComment,
} from "@/lib/participation";

const TEACHER = "teacher-1";
const [ANNA, BEN, CILA] = ["student-a", "student-b", "student-c"];
const STUDENTS = [ANNA, BEN, CILA];

const POST = {
  dueAtResponse: "2026-06-12T17:00:00.000Z", // Friday
  dueAtReplies: "2026-06-14T20:00:00.000Z", // Sunday
};

let seq = 0;
function comment(
  author: string,
  createdAt: string,
  parent: string | null = null,
  extra: Partial<ParticipationComment> = {}
): ParticipationComment {
  return {
    id: extra.id ?? `c-${++seq}`,
    parentCommentId: parent,
    authorId: author,
    createdAt,
    ...extra,
  };
}

describe("computeParticipation — own response", () => {
  it("reports not-responded when the student has no top-level comment", () => {
    const result = computeParticipation(POST, [], STUDENTS);
    expect(result.get(ANNA)!.responded).toBe(false);
    expect(result.get(ANNA)!.respondedAt).toBeNull();
    expect(result.get(ANNA)!.responseLate).toBe(false);
  });

  it("counts an on-time top-level comment as the response", () => {
    const result = computeParticipation(
      POST,
      [comment(ANNA, "2026-06-11T10:00:00.000Z")],
      STUDENTS
    );
    const p = result.get(ANNA)!;
    expect(p.responded).toBe(true);
    expect(p.respondedAt).toBe("2026-06-11T10:00:00.000Z");
    expect(p.responseLate).toBe(false);
  });

  it("flags a response after the deadline as late", () => {
    const result = computeParticipation(
      POST,
      [comment(ANNA, "2026-06-13T09:00:00.000Z")],
      STUDENTS
    );
    expect(result.get(ANNA)!.responded).toBe(true);
    expect(result.get(ANNA)!.responseLate).toBe(true);
  });

  it("uses the earliest top-level comment when a student posts several", () => {
    const result = computeParticipation(
      POST,
      [
        comment(ANNA, "2026-06-13T09:00:00.000Z"),
        comment(ANNA, "2026-06-11T08:00:00.000Z"),
      ],
      STUDENTS
    );
    expect(result.get(ANNA)!.respondedAt).toBe("2026-06-11T08:00:00.000Z");
    expect(result.get(ANNA)!.responseLate).toBe(false);
  });

  it("ignores hidden responses", () => {
    const result = computeParticipation(
      POST,
      [comment(ANNA, "2026-06-11T10:00:00.000Z", null, { hidden: true })],
      STUDENTS
    );
    expect(result.get(ANNA)!.responded).toBe(false);
  });

  it("never marks late when the post has no response deadline", () => {
    const result = computeParticipation(
      { dueAtResponse: null, dueAtReplies: null },
      [comment(ANNA, "2099-01-01T00:00:00.000Z")],
      STUDENTS
    );
    expect(result.get(ANNA)!.responded).toBe(true);
    expect(result.get(ANNA)!.responseLate).toBe(false);
  });
});

describe("computeParticipation — peer replies", () => {
  function thread(): ParticipationComment[] {
    return [
      comment(ANNA, "2026-06-11T10:00:00.000Z", null, { id: "top-anna" }),
      comment(BEN, "2026-06-11T11:00:00.000Z", null, { id: "top-ben" }),
      comment(CILA, "2026-06-11T12:00:00.000Z", null, { id: "top-cila" }),
      comment(TEACHER, "2026-06-11T13:00:00.000Z", null, { id: "top-teacher" }),
    ];
  }

  it("requires replies to two distinct classmates", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-ben"),
      comment(ANNA, "2026-06-12T11:00:00.000Z", "top-ben"), // same classmate again
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.classmatesRepliedTo).toBe(1);
    expect(p.repliesDone).toBe(false);
  });

  it("marks done once two distinct classmates are replied to, on time", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-ben"),
      comment(ANNA, "2026-06-13T10:00:00.000Z", "top-cila"),
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.classmatesRepliedTo).toBe(2);
    expect(p.repliesDone).toBe(true);
    expect(p.repliesDoneAt).toBe("2026-06-13T10:00:00.000Z");
    expect(p.repliesLate).toBe(false);
  });

  it("flags late completion by the time of the second distinct reply", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-ben"),
      comment(ANNA, "2026-06-15T10:00:00.000Z", "top-cila"), // after Sunday
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.repliesDone).toBe(true);
    expect(p.repliesLate).toBe(true);
  });

  it("does not count replies to the teacher", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-teacher"),
      comment(ANNA, "2026-06-12T11:00:00.000Z", "top-ben"),
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.classmatesRepliedTo).toBe(1);
  });

  it("does not count replies to your own response", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-anna"),
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.classmatesRepliedTo).toBe(0);
  });

  it("ignores hidden replies and replies whose parent is hidden", () => {
    const comments = [
      ...thread(),
      comment(BEN, "2026-06-11T09:00:00.000Z", null, { id: "top-ben-hidden", hidden: true }),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-ben-hidden"),
      comment(ANNA, "2026-06-12T11:00:00.000Z", "top-cila", { hidden: true }),
    ];
    const p = computeParticipation(POST, comments, STUDENTS).get(ANNA)!;
    expect(p.classmatesRepliedTo).toBe(0);
  });

  it("teacher's comments never appear as student rows", () => {
    const result = computeParticipation(POST, thread(), STUDENTS);
    expect(result.has(TEACHER)).toBe(false);
    expect(result.size).toBe(3);
  });

  it("supports a custom required-replies threshold", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2026-06-12T10:00:00.000Z", "top-ben"),
    ];
    const p = computeParticipation(POST, comments, STUDENTS, 1).get(ANNA)!;
    expect(p.repliesDone).toBe(true);
    expect(p.repliesRequired).toBe(1);
  });

  it("no replies deadline → done but never late", () => {
    const comments = [
      ...thread(),
      comment(ANNA, "2099-06-12T10:00:00.000Z", "top-ben"),
      comment(ANNA, "2099-06-13T10:00:00.000Z", "top-cila"),
    ];
    const p = computeParticipation(
      { ...POST, dueAtReplies: null },
      comments,
      STUDENTS
    ).get(ANNA)!;
    expect(p.repliesDone).toBe(true);
    expect(p.repliesLate).toBe(false);
  });
});

describe("computeParticipation — full weekly scenario", () => {
  it("computes the dashboard for a realistic week", () => {
    const comments = [
      // Anna: on time, both replies on time → fully complete.
      comment(ANNA, "2026-06-11T10:00:00.000Z", null, { id: "r-anna" }),
      // Ben: late response, one reply → incomplete replies.
      comment(BEN, "2026-06-13T08:00:00.000Z", null, { id: "r-ben" }),
      // Cila: never responded but did reply to two classmates late.
      comment(ANNA, "2026-06-12T09:00:00.000Z", "r-ben"),
      comment(ANNA, "2026-06-12T09:30:00.000Z", "r-cila-missing"), // dangling parent
      comment(CILA, "2026-06-15T10:00:00.000Z", "r-anna"),
      comment(CILA, "2026-06-15T11:00:00.000Z", "r-ben"),
      comment(BEN, "2026-06-13T09:00:00.000Z", "r-anna"),
      // Anna's second distinct classmate reply, on time:
      comment(ANNA, "2026-06-14T10:00:00.000Z", "r-anna2-placeholder"), // dangling
    ];
    // Give Anna a real second reply target: Cila has no top-level comment,
    // so Anna can only reach 1 distinct classmate (Ben).
    const result = computeParticipation(POST, comments, STUDENTS);

    const anna = result.get(ANNA)!;
    expect(anna.responded).toBe(true);
    expect(anna.responseLate).toBe(false);
    expect(anna.classmatesRepliedTo).toBe(1); // only Ben has a visible response
    expect(anna.repliesDone).toBe(false);

    const ben = result.get(BEN)!;
    expect(ben.responded).toBe(true);
    expect(ben.responseLate).toBe(true);
    expect(ben.classmatesRepliedTo).toBe(1);

    const cila = result.get(CILA)!;
    expect(cila.responded).toBe(false);
    expect(cila.classmatesRepliedTo).toBe(2);
    expect(cila.repliesDone).toBe(true);
    expect(cila.repliesLate).toBe(true);
  });
});
