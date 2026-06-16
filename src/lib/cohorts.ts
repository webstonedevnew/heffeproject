/**
 * Cohorts (year groups). The teacher belongs to no cohort and sees every one;
 * each student belongs to exactly one; each post targets one cohort or — when
 * cohort_id is null — is shared with all of them.
 *
 * The pure helpers below decide cohort scope on the app side; Postgres RLS
 * enforces the same separation at the database (see 0004_cohorts.sql).
 */
import type { Cohort } from "@/types/db";

export interface HasCohort {
  cohortId: string | null;
}

/**
 * Students that a given post concerns: everyone for a shared (null) post,
 * otherwise just the members of the post's cohort.
 */
export function studentsInCohort<T extends HasCohort>(
  students: T[],
  postCohortId: string | null
): T[] {
  if (postCohortId === null) return students;
  return students.filter((s) => s.cohortId === postCohortId);
}

/** Whether a viewer may see a post of the given cohort (mirrors RLS). */
export function canSeeCohort(
  viewer: { role: "teacher" | "student"; cohortId: string | null },
  postCohortId: string | null
): boolean {
  if (viewer.role === "teacher") return true;
  if (postCohortId === null) return true; // shared with every cohort
  return viewer.cohortId === postCohortId;
}

/** Human label for a cohort id (e.g. "Grade 11"), or a fallback for null. */
export function cohortName(
  cohorts: Cohort[],
  cohortId: string | null,
  allLabel: string
): string {
  if (cohortId === null) return allLabel;
  return cohorts.find((c) => c.id === cohortId)?.name ?? allLabel;
}
