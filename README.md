# TOK Journal — private classroom forum

A communal digital Theory of Knowledge journal for one teacher and ~20 students.
Replaces a Wix Groups site: the teacher posts weekly assignment threads into
themed groups, students respond and reply to at least two classmates by a
deadline, and the teacher tracks participation per assignment.

Built with **Next.js (App Router, TypeScript) · Supabase (EU region: Postgres,
Auth, Storage) · Tailwind CSS · Resend**. No trackers, no analytics, no
third-party assets — GDPR-first for minors' data.

---

## Features

- **Closed registration** — the teacher invites by email (single or bulk
  paste); students join via invite link. Magic-link login is primary,
  password optional. Each invite (and student) is assigned a **year group**.
- **Cohorts (year groups)** — one deployment serves several grades on a single
  domain (seeded with **Grade 11** and **Grade 12**). A student only ever sees
  their own grade's assignments, responses and search results; an 11th-grader
  can't see 12th-grade content and vice versa. The teacher sees and manages
  every cohort, picks a target grade per assignment (or "All grades" to share
  one), and can filter the feed by grade. Separation is enforced in Postgres
  RLS, so it holds even against a direct API call.
- **Groups** — seeded with the ten TOK themes (Knowledge and the Knower …
  Coffee Corner). Teacher can create / rename / archive. Everyone is a member
  of every group; the *content* inside a group is still split by cohort.
- **Assignment threads** — teacher-only top-level posts: rich text (headings,
  bold, links, embedded images), attachments, a target cohort, optional
  deadline pair (own response due Friday, peer replies due Sunday), reactions,
  unique view counts.
- **Responses & replies** — students respond with rich text (one level of
  threading), can attach a recorded **voice reply** and **pictures/files**,
  edit their own posts for 30 minutes, and flag content for the teacher.
- **Participation dashboard** (teacher-only) — per assignment: who posted
  their own response (and when, with late flags) and who replied to ≥2
  classmates. CSV export. Students only ever see their own status
  ("✓ posted · 1/2 replies done").
- **Notifications** — in-app + email (Resend): new assignment, reply to you,
  and a 24-hours-before reminder to students who haven't finished a step.
  Per-user email preferences.
- **Moderation** — teacher can edit / hide / delete anything; flag queue.
- **Search** — Postgres full-text search across posts and comments.
- **GDPR erasure** — one action permanently deletes a student's account and
  every comment, reaction, flag, notification and uploaded file.
- **i18n** — all UI strings live in `messages/en.json` and `messages/hu.json`;
  each user picks their language in Settings (English default).

## Modelling decisions (worth knowing)

- A student's **own response** = their *earliest top-level comment* on an
  assignment post. A **peer reply** = a nested comment on a *classmate's*
  response. "≥2 classmates" counts **distinct** classmates — replying twice
  to the same person counts once; replies to the teacher don't count.
- "Late" is decided by the timestamp of the response (or of the reply that
  completed the requirement) versus the deadline. Posts without deadlines
  (e.g. Coffee Corner) never show late flags or appear incomplete.
- Hidden content never counts toward participation.
- Files live in **private** Storage buckets and are served through an
  authenticated proxy (`/api/files/...`) — no public URLs, no expiring links.
- The whole site sends `X-Robots-Tag: noindex` and sits behind login;
  only `/login`, `/invite/<token>` and the auth callbacks are reachable
  signed-out.

---

## Setup

### 1. Supabase project (EU)

1. Create a project at [supabase.com](https://supabase.com) — **choose an EU
   region** (e.g. `eu-central-1`, Frankfurt).
2. Run the migrations, either with the CLI:

   ```sh
   supabase link --project-ref <your-ref>
   supabase db push
   ```

   …or by pasting the files in `supabase/migrations/` into the SQL editor **in
   order** — `0001_schema.sql`, `0002_rls.sql`, `0003_polls_and_search.sql`,
   then `0004_cohorts.sql`. This also creates the private `attachments` and
   `audio` buckets and seeds the Grade 11 / Grade 12 cohorts.
3. **Auth settings** (Dashboard → Authentication):
   - *Sign In / Up*: disable **"Allow new users to sign up"** (registration is
     closed; the app provisions accounts via invites).
   - *URL Configuration*: set the Site URL to your deployed URL and add
     `http://localhost:3000/**` to the redirect allow-list for development.
   - *Email templates* → **Magic Link**: point the link at the SSR confirm
     route:

     ```html
     <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a>
     ```
   - *SMTP* (recommended): configure **Resend SMTP**
     (`smtp.resend.com`, user `resend`, password = your API key) so magic-link
     emails also go out through Resend from your domain.

### 2. Resend

Create an API key at [resend.com](https://resend.com) and verify your sending
domain. Resend is used for invite emails and all notification emails. Without
`RESEND_API_KEY` the app still runs — emails are logged to the console
instead (handy in development).

### 3. Environment

```sh
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — server only; used for invites, provisioning, notifications, GDPR erasure |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL used in emails and auth redirects |
| `CRON_SECRET` | Bearer token required by `/api/cron/reminders` |
| `RESEND_API_KEY` | Resend API key (optional in dev) |
| `EMAIL_FROM` | Verified sender, e.g. `TOK Journal <forum@school.eu>` |
| `SEED_TEACHER_EMAIL` / `SEED_TEACHER_NAME` | Used by the seed script |
| `SEED_DEMO_DATA` | `true` → seed demo students + a demo assignment |

### 4. Seed

```sh
npm install
npm run seed
```

Creates the teacher account, the ten TOK groups and — when
`SEED_DEMO_DATA=true` — three fictional demo students plus a demo assignment
with responses and replies (so the participation dashboard has something to
show). No real names anywhere.

### 5. Run

```sh
npm run dev      # http://localhost:3000
npm test         # vitest: participation, permissions, invites, CSV
npm run build    # production build
```

Sign in with a magic link as the seeded teacher (the email lands in your
Resend logs or, without SMTP config, in the Supabase Auth logs / console).

### 6. Deadline reminders (cron)

Point any hourly scheduler at the reminder endpoint:

```
GET https://<your-app>/api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

- **Vercel**: add to `vercel.json`
  `{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }] }`
  (Vercel sends the `Authorization` header automatically when `CRON_SECRET`
  is set).
- Anything else (GitHub Actions, cron + curl, pg_cron + `http`) works the
  same. Duplicate sends are impossible — each post/deadline pair is recorded
  in `reminders_sent` after processing.

### 7. Deploying in the EU

The app is a standard Next.js app. For full EU residency:

- Supabase project in an EU region (data + files + auth).
- Host the app on an EU region too (e.g. Vercel with `fra1` as the function
  region, or any EU VPS/container host with `npm run build && npm start`).
- Resend supports EU sending domains; transactional email content is minimal
  (names, post titles).
- There are no third-party scripts, fonts, or analytics anywhere in the app.

---

## Architecture notes

```
src/
├── middleware.ts                  # session refresh + login wall + noindex
├── app/
│   ├── (auth)/login/              # magic link + optional password
│   ├── invite/[token]/            # invite acceptance (name, optional password)
│   ├── auth/{confirm,callback,signout}/  # Supabase auth plumbing
│   ├── (app)/                     # everything behind login
│   │   ├── page.tsx               # home feed (paginated)
│   │   ├── groups/, posts/        # groups, threads, responses & replies
│   │   ├── search/, notifications/, settings/, privacy/
│   │   └── teacher/               # participation, students+invites+erasure, flags, new post
│   └── api/
│       ├── files/[...path]/       # auth-gated streaming proxy for private buckets
│       └── cron/reminders/        # 24h deadline reminders
├── components/                    # editor (Tiptap), composer, audio recorder, …
├── lib/
│   ├── participation.ts           # ★ pure participation logic (unit-tested)
│   ├── permissions.ts             # pure permission rules (unit-tested)
│   ├── invites.ts, csv.ts         # pure helpers (unit-tested)
│   ├── notify.ts, email.ts        # notification fan-out + Resend
│   └── supabase/{server,client,admin}.ts
├── messages/{en,hu}.json          # every UI string, per locale
└── supabase/migrations/           # schema + RLS (the real permission system)
```

- **Permissions are enforced twice**: pure functions drive the UI and server
  actions, while Postgres RLS enforces the same rules at the database, so even
  a direct API call with the anon key can't overstep. Column-level grants stop
  students from touching `role`, `status` or `hidden_at`.
- **Server components by default**; client components only where interaction
  demands it (editor, composer, reactions, audio recorder).
- **The service role key** is used only in: invite management, account
  provisioning, notification fan-out, moderation of `hidden_at`, the reminder
  cron and GDPR erasure — each behind an explicit teacher/secret check.

## Known limitations (deliberate MVP cuts)

- Post-level attachments can be added when creating a post, not when editing
  one. (Responses and replies can attach pictures/files at any time they're
  written.)
- A post's target cohort is chosen at creation and isn't re-assignable from the
  edit screen (moving an assignment between grades after students have replied
  would orphan those replies).
- Uploaded files live behind an authenticated proxy with unguessable paths but
  the storage bucket itself is readable by any signed-in member, so cross-cohort
  isolation of the *raw files* relies on those paths never being shared (the
  cohort-gated `attachments` rows are what stop a student discovering them). The
  same model already governs voice replies.
- Deactivating a student blocks them at the next request (sessions aren't
  force-revoked server-side; they expire naturally).
- Search uses the `simple` text-search configuration so Hungarian and English
  both work without stemming; matching is word-prefix-exact, not fuzzy.
- Reactions are a fixed set of five emoji.
