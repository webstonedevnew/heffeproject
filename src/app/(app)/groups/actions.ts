"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "group"
  );
}

export async function createGroup(formData: FormData) {
  await requireTeacher();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return;

  const base = slugify(name);
  const { data: existing } = await supabase
    .from("groups")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((g) => g.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const { count } = await supabase
    .from("groups")
    .select("id", { count: "exact", head: true });

  await supabase.from("groups").insert({
    name,
    slug,
    description,
    position: (count ?? 0) + 1,
  });
  revalidatePath("/groups");
}

export async function renameGroup(formData: FormData) {
  await requireTeacher();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!id || !name) return;
  await supabase.from("groups").update({ name, description }).eq("id", id);
  revalidatePath("/groups");
}

export async function setGroupArchived(id: string, archived: boolean) {
  await requireTeacher();
  const supabase = await createClient();
  await supabase
    .from("groups")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/groups");
}
