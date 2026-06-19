-- TOK Forum — customizable profile pictures
-- An optional avatar per user. The image file lives in the private
-- `attachments` bucket (served through the authenticated /api/files proxy like
-- every other upload); only the storage path is kept on the profile row.
-- Run in the SQL editor after 0005.

alter table public.profiles add column avatar_path text;

-- Let users set/clear their own avatar. RLS already restricts updates to your
-- own row; this column grant adds avatar_path to the short list of fields a
-- student may change (still never role / status / cohort / email).
grant update (avatar_path) on public.profiles to authenticated;
