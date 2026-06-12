import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";

/** Current user's profile, or null. Cached per request. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  // Deactivated users get signed out via a route handler (server components
  // cannot clear cookies), which then lands them on /login with an error.
  if (profile.status !== "active") redirect("/auth/signout?error=deactivated");
  return profile;
}

export async function requireTeacher(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "teacher") redirect("/");
  return profile;
}
