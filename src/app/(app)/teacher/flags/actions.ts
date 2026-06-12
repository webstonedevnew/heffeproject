"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function resolveFlag(flagId: string) {
  const teacher = await requireTeacher();
  const supabase = await createClient();
  await supabase
    .from("flags")
    .update({ resolved_at: new Date().toISOString(), resolved_by: teacher.id })
    .eq("id", flagId);
  revalidatePath("/teacher/flags");
}
