/**
 * Seed script — creates the teacher account, the ten TOK groups, and
 * (optionally) demo students plus a demo assignment with responses.
 *
 *   npm run seed
 *
 * Requires .env (or .env.local) with NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, SEED_TEACHER_EMAIL, SEED_TEACHER_NAME.
 * Set SEED_DEMO_DATA=true for demo content (never use on a live class DB).
 *
 * All demo names are fictional; no real student data is created.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const teacherEmail = process.env.SEED_TEACHER_EMAIL ?? "teacher@example.com";
const teacherName = process.env.SEED_TEACHER_NAME ?? "The Teacher";
const withDemo = process.env.SEED_DEMO_DATA === "true";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  // Node < 22 has no native WebSocket; realtime is unused but still
  // initialized by the client, so hand it the ws package.
  realtime: { transport: ws as unknown as typeof WebSocket },
});

const GROUPS = [
  "Knowledge and the Knower",
  "History",
  "The Natural and Human Sciences",
  "The Arts",
  "Knowledge and Religion",
  "Knowledge and Politics",
  "Knowledge and Technology",
  "Knowledge and Language",
  "Assessment Preparation",
  "Coffee Corner",
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function ensureUser(
  email: string,
  name: string,
  role: "teacher" | "student",
  cohortId: string | null = null
) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  let userId = created?.user?.id ?? null;
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw error;
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }
  if (!userId) throw new Error(`Could not create or find user ${email}`);
  const { error: upsertError } = await admin.from("profiles").upsert({
    id: userId,
    role,
    name,
    email: email.toLowerCase(),
    status: "active",
    cohort_id: cohortId,
  });
  if (upsertError) throw upsertError;
  return userId;
}

const COHORTS = [
  { key: "g11", name: "Grade 11", position: 11 },
  { key: "g12", name: "Grade 12", position: 12 },
];

/** Ensures the cohorts exist and returns a key → id map. */
async function ensureCohorts(): Promise<Record<string, string>> {
  for (const c of COHORTS) {
    const { error } = await admin
      .from("cohorts")
      .upsert(c, { onConflict: "key" });
    if (error) throw error;
  }
  const { data } = await admin.from("cohorts").select("id, key");
  const byKey: Record<string, string> = {};
  for (const row of data ?? []) byKey[row.key as string] = row.id as string;
  return byKey;
}

async function main() {
  console.log(`Seeding ${url} ...`);

  // 1. Teacher
  const teacherId = await ensureUser(teacherEmail, teacherName, "teacher");
  console.log(`✓ teacher: ${teacherEmail}`);

  // 2. Groups
  for (let i = 0; i < GROUPS.length; i++) {
    const name = GROUPS[i];
    const { error } = await admin
      .from("groups")
      .upsert(
        { slug: slugify(name), name, position: i + 1 },
        { onConflict: "slug" }
      );
    if (error) throw error;
  }
  console.log(`✓ ${GROUPS.length} groups`);

  // 3. Cohorts (year groups). Also seeded by migration 0004; idempotent here.
  const cohorts = await ensureCohorts();
  console.log(`✓ ${Object.keys(cohorts).length} cohorts`);

  if (!withDemo) {
    console.log("Done (set SEED_DEMO_DATA=true for demo content).");
    return;
  }

  // 4. Demo students — fictional names only. Three in grade 11 (so the
  //    participation demo has responses + replies) and one in grade 12 (so the
  //    11/12 separation is visible).
  const demoStudents = [
    { email: "demo.student1@example.com", name: "Demo Student One", cohort: "g11" },
    { email: "demo.student2@example.com", name: "Demo Student Two", cohort: "g11" },
    { email: "demo.student3@example.com", name: "Demo Student Three", cohort: "g11" },
    { email: "demo.student4@example.com", name: "Demo Student Four", cohort: "g12" },
  ];
  const studentIds: string[] = [];
  for (const s of demoStudents) {
    studentIds.push(await ensureUser(s.email, s.name, "student", cohorts[s.cohort]));
  }
  console.log(`✓ ${studentIds.length} demo students`);

  // 4. Demo assignment in "Knowledge and Technology" with the classic
  //    Friday-response / Sunday-replies deadline pair.
  const { data: group } = await admin
    .from("groups")
    .select("id")
    .eq("slug", slugify("Knowledge and Technology"))
    .single();
  if (!group) throw new Error("Group missing");

  const nextFriday = new Date();
  nextFriday.setDate(nextFriday.getDate() + ((5 - nextFriday.getDay() + 7) % 7 || 7));
  nextFriday.setHours(17, 0, 0, 0);
  const nextSunday = new Date(nextFriday);
  nextSunday.setDate(nextSunday.getDate() + 2);
  nextSunday.setHours(20, 0, 0, 0);

  const bodyHtml =
    "<p>Read the short excerpt on algorithmic recommendation systems, then respond:</p>" +
    "<p><strong>To what extent do the tools we use to acquire knowledge shape the knowledge itself?</strong></p>" +
    "<ul><li>Refer to at least one real example.</li><li>Connect to one TOK concept (evidence, perspective, interpretation…).</li></ul>";

  const { data: existingPost } = await admin
    .from("posts")
    .select("id")
    .eq("title", "Week 1 — Do our tools think for us?")
    .maybeSingle();

  let postId = existingPost?.id as string | undefined;
  if (!postId) {
    const { data: post, error } = await admin
      .from("posts")
      .insert({
        group_id: group.id,
        author_id: teacherId,
        cohort_id: cohorts.g11,
        title: "Week 1 — Do our tools think for us?",
        body_html: bodyHtml,
        body_text: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        due_at_response: nextFriday.toISOString(),
        due_at_replies: nextSunday.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    postId = post.id;

    // 5. Demo responses + peer replies.
    const mkText = (html: string) =>
      html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const responses = [
      {
        author: studentIds[0],
        html: "<p>I think our tools absolutely shape what we know. A telescope doesn't just extend sight — it decides what counts as 'visible'.</p>",
      },
      {
        author: studentIds[1],
        html: "<p>Recommendation algorithms narrow my feed every week. The knowledge I 'find' is mostly knowledge that found me.</p>",
      },
    ];
    const topIds: string[] = [];
    for (const r of responses) {
      const { data: c, error: cErr } = await admin
        .from("comments")
        .insert({
          post_id: postId,
          author_id: r.author,
          body_html: r.html,
          body_text: mkText(r.html),
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      topIds.push(c.id);
    }
    // Student 3 replies to both classmates (requirement complete).
    for (const parent of topIds) {
      const html = "<p>Interesting point — but is the tool shaping the knowledge, or just its availability?</p>";
      const { error: rErr } = await admin.from("comments").insert({
        post_id: postId,
        parent_comment_id: parent,
        author_id: studentIds[2],
        body_html: html,
        body_text: mkText(html),
      });
      if (rErr) throw rErr;
    }
    // Student 1 replies to student 2 only (1 of 2 done).
    const html = "<p>Same here. I tried resetting my recommendations once and the difference was striking.</p>";
    const { error: r2Err } = await admin.from("comments").insert({
      post_id: postId,
      parent_comment_id: topIds[1],
      author_id: studentIds[0],
      body_html: html,
      body_text: mkText(html),
    });
    if (r2Err) throw r2Err;
    console.log("✓ demo assignment, responses and replies");
  } else {
    console.log("✓ demo assignment already present");
  }

  // 6. A separate grade-12 assignment, so the 11/12 split is visible: the
  //    grade-11 students above can't see this one, and student four can't see
  //    the grade-11 thread.
  const g12Title = "Week 1 (Grade 12) — Whose history counts?";
  const { data: existingG12 } = await admin
    .from("posts")
    .select("id")
    .eq("title", g12Title)
    .maybeSingle();
  if (!existingG12) {
    const { data: historyGroup } = await admin
      .from("groups")
      .select("id")
      .eq("slug", slugify("History"))
      .single();
    if (historyGroup) {
      const g12BodyHtml =
        "<p>Read the two contrasting accounts of the same event, then respond:</p>" +
        "<p><strong>How do we decide which historical account to trust when the sources disagree?</strong></p>";
      const { data: g12Post } = await admin
        .from("posts")
        .insert({
          group_id: historyGroup.id,
          author_id: teacherId,
          cohort_id: cohorts.g12,
          title: g12Title,
          body_html: g12BodyHtml,
          body_text: g12BodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          due_at_response: nextFriday.toISOString(),
          due_at_replies: nextSunday.toISOString(),
        })
        .select("id")
        .single();
      if (g12Post) {
        const html =
          "<p>Trust should follow the evidence each source can actually back up — provenance matters more than fluency.</p>";
        await admin.from("comments").insert({
          post_id: g12Post.id,
          author_id: studentIds[3],
          body_html: html,
          body_text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        });
        console.log("✓ grade-12 demo assignment");
      }
    }
  } else {
    console.log("✓ grade-12 demo assignment already present");
  }

  console.log("Done. Sign in with a magic link as " + teacherEmail);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
