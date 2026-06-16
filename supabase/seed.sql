-- TOK Forum — no-Node bootstrap
-- Paste this into the Supabase SQL editor AFTER running migrations 0001–0004.
-- It replaces `npm run seed` for people who don't want Node installed locally.
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Cohorts (also seeded by 0004_cohorts.sql; repeated here so this file
--    stands alone). Add more grades here if you ever need them.
-- ---------------------------------------------------------------------------
insert into public.cohorts (key, name, position) values
  ('g11', 'Grade 11', 11),
  ('g12', 'Grade 12', 12)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The ten TOK groups (themes). Slugs match scripts/seed.ts.
-- ---------------------------------------------------------------------------
insert into public.groups (slug, name, position) values
  ('knowledge-and-the-knower',        'Knowledge and the Knower',        1),
  ('history',                         'History',                         2),
  ('the-natural-and-human-sciences',  'The Natural and Human Sciences',  3),
  ('the-arts',                        'The Arts',                        4),
  ('knowledge-and-religion',          'Knowledge and Religion',          5),
  ('knowledge-and-politics',          'Knowledge and Politics',          6),
  ('knowledge-and-technology',        'Knowledge and Technology',        7),
  ('knowledge-and-language',          'Knowledge and Language',          8),
  ('assessment-preparation',          'Assessment Preparation',          9),
  ('coffee-corner',                   'Coffee Corner',                   10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. The teacher account.
--    FIRST create the auth user in the dashboard:
--      Authentication → Users → Add user → enter the teacher's email and tick
--      "Auto Confirm User". (No password needed; they sign in by magic link.)
--    THEN edit the two values below and run this statement. It promotes that
--    user to a teacher profile (the teacher is in no cohort, so sees all grades).
-- ---------------------------------------------------------------------------
insert into public.profiles (id, role, name, email, status, cohort_id)
select u.id, 'teacher', 'CHANGE ME — Teacher name', u.email, 'active', null
from auth.users u
where u.email = 'teacher@yourschool.eu'   -- ← change to the teacher's email
on conflict (id) do update
  set role = 'teacher', status = 'active', name = excluded.name;
