-- TOK Forum — row-level security
-- Server actions use the user's session client, so these policies are the
-- real permission system. The service-role key (admin client) bypasses RLS
-- and is used only for invites, account provisioning and GDPR erasure.

-- Helper predicates. SECURITY DEFINER so they can read profiles without
-- recursing into the profiles policies themselves.
create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher' and status = 'active'
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.groups enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.reactions enable row level security;
alter table public.post_views enable row level security;
alter table public.flags enable row level security;
alter table public.notifications enable row level security;
alter table public.reminders_sent enable row level security;

-- profiles: everyone logged in can see names (it's a 20-person classroom);
-- users edit only their own row; the teacher manages all rows.
create policy "profiles_select" on public.profiles
  for select to authenticated using (public.is_active_member());
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active_member())
  with check (id = auth.uid());
-- Column-level hardening: users may only change their display fields —
-- never role/status/email. (Teacher status changes go through the service
-- role, which has its own grants.)
revoke update on public.profiles from authenticated;
grant update (name, locale, notification_prefs) on public.profiles to authenticated;

-- invites: service-role only (no policies on purpose).

-- groups: readable by members; writable by the teacher.
create policy "groups_select" on public.groups
  for select to authenticated using (public.is_active_member());
create policy "groups_teacher_all" on public.groups
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());

-- posts: hidden posts are teacher-only; only the teacher creates/edits/deletes.
create policy "posts_select" on public.posts
  for select to authenticated
  using (public.is_active_member() and (hidden_at is null or public.is_teacher()));
create policy "posts_teacher_insert" on public.posts
  for insert to authenticated with check (public.is_teacher() and author_id = auth.uid());
create policy "posts_teacher_update" on public.posts
  for update to authenticated using (public.is_teacher());
create policy "posts_teacher_delete" on public.posts
  for delete to authenticated using (public.is_teacher());

-- comments: members read non-hidden (authors still see their own hidden ones);
-- authors may edit/delete within 30 minutes; the teacher always can.
create policy "comments_select" on public.comments
  for select to authenticated
  using (public.is_active_member()
         and (hidden_at is null or author_id = auth.uid() or public.is_teacher()));
create policy "comments_insert" on public.comments
  for insert to authenticated
  with check (public.is_active_member() and author_id = auth.uid());
create policy "comments_update_own" on public.comments
  for update to authenticated
  using (author_id = auth.uid() and now() - created_at < interval '30 minutes')
  with check (author_id = auth.uid());
create policy "comments_teacher_update" on public.comments
  for update to authenticated using (public.is_teacher());
create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (author_id = auth.uid() and now() - created_at < interval '30 minutes');
create policy "comments_teacher_delete" on public.comments
  for delete to authenticated using (public.is_teacher());
-- Column-level hardening: authors edit only the body/audio. Moderation
-- (hidden_at) happens via the service role so a student can never unhide
-- their own comment within the edit window.
revoke update on public.comments from authenticated;
grant update (body_html, body_text, audio_path) on public.comments to authenticated;

-- attachments
create policy "attachments_select" on public.attachments
  for select to authenticated using (public.is_active_member());
create policy "attachments_insert" on public.attachments
  for insert to authenticated
  with check (public.is_active_member() and uploader_id = auth.uid());
create policy "attachments_delete" on public.attachments
  for delete to authenticated
  using (uploader_id = auth.uid() or public.is_teacher());

-- reactions: add/remove your own; everyone reads.
create policy "reactions_select" on public.reactions
  for select to authenticated using (public.is_active_member());
create policy "reactions_insert" on public.reactions
  for insert to authenticated
  with check (public.is_active_member() and user_id = auth.uid());
create policy "reactions_delete" on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- post views: record your own; counts are visible to everyone.
create policy "post_views_select" on public.post_views
  for select to authenticated using (public.is_active_member());
create policy "post_views_insert" on public.post_views
  for insert to authenticated
  with check (public.is_active_member() and user_id = auth.uid());

-- flags: any member can flag; only the teacher sees/resolves them.
create policy "flags_insert" on public.flags
  for insert to authenticated
  with check (public.is_active_member() and flagged_by = auth.uid());
create policy "flags_teacher_select" on public.flags
  for select to authenticated using (public.is_teacher());
create policy "flags_teacher_update" on public.flags
  for update to authenticated using (public.is_teacher());

-- notifications: read/mark-read your own. Inserts happen via service role.
create policy "notifications_select" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reminders_sent: service-role only (no policies).

-- ---------------------------------------------------------------------------
-- Storage policies: private buckets, files namespaced by uploader id
-- (path convention: <user_id>/<uuid>-filename). GDPR erasure deletes the
-- whole <user_id>/ folder.
-- ---------------------------------------------------------------------------
create policy "storage_read_members" on storage.objects
  for select to authenticated
  using (bucket_id in ('attachments', 'audio') and public.is_active_member());
create policy "storage_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('attachments', 'audio')
    and public.is_active_member()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "storage_delete_own_or_teacher" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('attachments', 'audio')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_teacher())
  );
