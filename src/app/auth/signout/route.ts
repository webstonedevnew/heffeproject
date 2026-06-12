import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const error = new URL(request.url).searchParams.get("error");
  const dest = error ? `/login?error=${encodeURIComponent(error)}` : "/login";
  return NextResponse.redirect(new URL(dest, request.url));
}

export const POST = GET;
