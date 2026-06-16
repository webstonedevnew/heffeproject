-- TOK Forum — cohorts (year groups)
-- One deployment, two (or more) separated year groups: an 11th-grade student
-- never sees 12th-grade content and vice versa. Separation is enforced here,
-- in RLS, so it holds even against a direct API call with the anon key.
--
-- Run this in the Supabase SQL editor (after 0001–0003).

-- ---------------------------------------------------------------------------
-- Cohorts. Seeded with grade 11 and grade 12; the teacher can add more.
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,            -- stable handle, e.g. 'g11'
  name text not null,                  -- display label, e.g. 'Grade 11'
  position int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.cohorts (key, name, position) values
  ('g11', 'Grade 11', 11),
  ('g12', 'Grade 12', 12)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Cohort membership / targeting.
--   profiles.cohort_id  — a student's year group. NULL for the teacher, who
--                         sees and manages every cohort.
--   invites.cohort_id   — the year group a pending invite will join.
--   posts.cohort_id     — the year group an assignment is for. NULL means the
--                         post is shared with every cohort (e.g. Coffee Corner).
-- Existing rows keep NULL: existing posts stay visible to everyone (shared),
-- which is the safe default — nothing disappears on upgrade.
-- ---------------------------------------------------------------------------
alter table public.profiles add column cohort_id uuid references public.cohorts (id);
alter table public.invites  add column cohort_id uuid references public.cohorts (id);
alter table public.posts    add column cohort_id uuid references public.cohorts (id);

create index profiles_cohort_idx on public.profiles (cohort_id);
create index posts_cohort_idx    on public.posts (cohort_id);

-- A student may only change their display fields — never their cohort. The
-- teacher moves students between cohorts through the service role.
-- (name/locale/notification_prefs were already the only granted columns; this
--  comment is a reminder that cohort_id is deliberately absent from that grant.)

-- ---------------------------------------------------------------------------
-- Helper: the calling user's cohort. SECURITY DEFINER so it reads profiles
-- without recursing through the profiles policies (mirrors is_teacher()).
-- ---------------------------------------------------------------------------
create or replace function public.my_cohort_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select cohort_id from public.profiles where id = auth.uid();
$$;

-- Visible to a student when the post targets every cohort (NULL) or theirs.
-- The teacher (is_teacher()) bypasses the cohort check entirely.
create or replace function public.post_in_my_cohort(post_cohort uuid)
returns boolean
language sql stable
as $$
  select public.is_teacher()
      or post_cohort is null
      or post_cohort = public.my_cohort_id();
$$;

-- ---------------------------------------------------------------------------
-- Re-scope the content policies to respect cohorts.
-- ---------------------------------------------------------------------------

-- posts: same as before, plus the cohort gate.
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts
  for select to authenticated
  using (
    public.is_active_member()
    and (hidden_at is null or public.is_teacher())
    and public.post_in_my_cohort(cohort_id)
  );

-- comments: a comment is visible only if its parent post is in the viewer's
-- cohort. (Search runs with invoker rights, so this automatically scopes it.)
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select to authenticated
  using (
    public.is_active_member()
    and (hidden_at is null or author_id = auth.uid() or public.is_teacher())
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and public.post_in_my_cohort(p.cohort_id)
    )
  );

-- attachments: gate on the cohort of the post (directly, or via the comment
-- the attachment hangs off). Closes cross-cohort reads of uploaded images.
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
  for select to authenticated
  using (
    public.is_active_member()
    and (
      public.is_teacher()
      or exists (
        select 1 from public.posts p
        where p.id = attachments.post_id
          and public.post_in_my_cohort(p.cohort_id)
      )
      or exists (
        select 1 from public.comments c
        join public.posts p on p.id = c.post_id
        where c.id = attachments.comment_id
          and public.post_in_my_cohort(p.cohort_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- cohorts table RLS: any member may read (to label things); teacher manages.
-- ---------------------------------------------------------------------------
alter table public.cohorts enable row level security;
create policy "cohorts_select" on public.cohorts
  for select to authenticated using (public.is_active_member());
create policy "cohorts_teacher_all" on public.cohorts
  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
