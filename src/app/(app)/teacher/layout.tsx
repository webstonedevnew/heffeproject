import { requireTeacher } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n";
import { TeacherTabs } from "@/components/TeacherTabs";

/**
 * Wraps every teacher page with the tab bar. Because it's a layout, the bar
 * stays mounted across tab switches — only the page below it swaps — so the
 * teacher hub feels like one tabbed surface rather than separate pages.
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireTeacher();
  const t = getT(profile.locale);
  const supabase = await createClient();

  const { count } = await supabase
    .from("flags")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  return (
    <div>
      <TeacherTabs
        openFlags={count ?? 0}
        labels={{
          overview: t("dashboard.tabOverview"),
          students: t("dashboard.tabStudents"),
          participation: t("dashboard.tabParticipation"),
          flags: t("dashboard.tabFlags"),
        }}
      />
      {children}
    </div>
  );
}
