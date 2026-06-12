import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Authenticated streaming proxy for the private storage buckets, so embedded
 * images, attachments and audio have stable URLs that still require login.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [bucket, ...rest] = path;
  if ((bucket !== "attachments" && bucket !== "audio") || rest.length === 0) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // The user-session client enforces storage RLS (members only).
  const objectPath = rest.map(decodeURIComponent).join("/");
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
