import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cohort } from "@/types/db";

/** All cohorts, ordered for display. Works with the session or admin client. */
export async function getCohorts(supabase: SupabaseClient): Promise<Cohort[]> {
  const { data } = await supabase
    .from("cohorts")
    .select("*")
    .order("position");
  return (data ?? []) as Cohort[];
}

/** Validates a cohort id (or null = "all grades") against the known cohorts. */
export function normalizeCohortId(
  cohorts: Cohort[],
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return cohorts.some((c) => c.id === value) ? value : null;
}
