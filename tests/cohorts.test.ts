import { describe, it, expect } from "vitest";
import { studentsInCohort, canSeeCohort, cohortName } from "@/lib/cohorts";
import type { Cohort } from "@/types/db";

const g11 = "c-11";
const g12 = "c-12";

const students = [
  { id: "s1", name: "Anna", cohortId: g11 },
  { id: "s2", name: "Béla", cohortId: g11 },
  { id: "s3", name: "Csilla", cohortId: g12 },
  { id: "s4", name: "Dóra", cohortId: null },
];

describe("studentsInCohort", () => {
  it("returns only the members of a cohort", () => {
    expect(studentsInCohort(students, g11).map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(studentsInCohort(students, g12).map((s) => s.id)).toEqual(["s3"]);
  });

  it("a shared post (null cohort) concerns every student", () => {
    expect(studentsInCohort(students, null).map((s) => s.id)).toEqual([
      "s1",
      "s2",
      "s3",
      "s4",
    ]);
  });
});

describe("canSeeCohort", () => {
  const teacher = { role: "teacher" as const, cohortId: null };
  const eleven = { role: "student" as const, cohortId: g11 };
  const twelve = { role: "student" as const, cohortId: g12 };

  it("the teacher sees every cohort", () => {
    expect(canSeeCohort(teacher, g11)).toBe(true);
    expect(canSeeCohort(teacher, g12)).toBe(true);
    expect(canSeeCohort(teacher, null)).toBe(true);
  });

  it("a student sees only their own cohort", () => {
    expect(canSeeCohort(eleven, g11)).toBe(true);
    expect(canSeeCohort(eleven, g12)).toBe(false);
    expect(canSeeCohort(twelve, g11)).toBe(false);
  });

  it("everyone sees shared (null) posts", () => {
    expect(canSeeCohort(eleven, null)).toBe(true);
    expect(canSeeCohort(twelve, null)).toBe(true);
  });
});

describe("cohortName", () => {
  const cohorts: Cohort[] = [
    { id: g11, key: "g11", name: "Grade 11", position: 11, created_at: "" },
    { id: g12, key: "g12", name: "Grade 12", position: 12, created_at: "" },
  ];

  it("resolves a known cohort label", () => {
    expect(cohortName(cohorts, g11, "All grades")).toBe("Grade 11");
  });

  it("falls back to the all-grades label for null or unknown", () => {
    expect(cohortName(cohorts, null, "All grades")).toBe("All grades");
    expect(cohortName(cohorts, "nope", "All grades")).toBe("All grades");
  });
});
