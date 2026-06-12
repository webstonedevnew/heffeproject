import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a file/blob into the caller's own folder in a private bucket
 * (storage RLS requires the first path segment to be the user's id).
 * Returns the storage path; files are served via /api/files/<bucket>/<path>.
 */
export async function uploadToBucket(
  bucket: "attachments" | "audio",
  file: Blob,
  filename: string
): Promise<{ path: string; size: number; mime: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(error.message);
  return { path, size: file.size, mime: file.type };
}

export function fileUrl(bucket: "attachments" | "audio", path: string): string {
  return `/api/files/${bucket}/${path}`;
}
