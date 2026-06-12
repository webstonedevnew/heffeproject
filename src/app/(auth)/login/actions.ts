"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function siteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // registration is closed — invite only
      emailRedirectTo: siteUrl("/auth/callback"),
    },
  });

  if (error) {
    const noAccount = /signup|not allowed|not found/i.test(error.message);
    redirect(`/login?error=${noAccount ? "noaccount" : "invalid"}`);
  }
  redirect("/login?sent=1");
}

export async function passwordSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid&mode=password");
  redirect("/");
}
