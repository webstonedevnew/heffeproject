"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateSettings(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const locale = formData.get("locale") === "hu" ? "hu" : "en";
  const prefs = {
    email_new_assignment: formData.get("pref_new_assignment") === "on",
    email_reply: formData.get("pref_reply") === "on",
    email_reminder: formData.get("pref_reminder") === "on",
  };

  if (name.length >= 2) {
    await supabase
      .from("profiles")
      .update({ name, locale, notification_prefs: prefs })
      .eq("id", profile.id);
  }
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export async function updateAvatar(path: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
  revalidatePath("/", "layout");
}

export async function removeAvatar() {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ avatar_path: null }).eq("id", profile.id);
  revalidatePath("/", "layout");
}

export async function setPassword(formData: FormData) {
  await requireProfile();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/settings?error=password");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/settings?error=password");
  redirect("/settings?password=1");
}
