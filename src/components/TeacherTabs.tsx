"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "overview", href: "/teacher/dashboard" },
  { key: "students", href: "/teacher/students" },
  { key: "participation", href: "/teacher/participation" },
  { key: "flags", href: "/teacher/flags" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Segmented tab bar for the teacher hub. Lives in the teacher layout so it stays
 * put while only the content below swaps — the active tab updates instantly from
 * the pathname. Hidden on routes that aren't tabs (e.g. New assignment).
 */
export function TeacherTabs({
  labels,
  openFlags,
}: {
  labels: Record<TabKey, string>;
  openFlags: number;
}) {
  const pathname = usePathname();
  const active = TABS.find((tab) => pathname === tab.href);
  if (!active) return null;

  return (
    <nav
      aria-label="Teacher sections"
      className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-paper-deep/70 border border-line min-w-max">
        {TABS.map((tab) => {
          const isActive = tab.key === active.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-ink text-paper shadow-sm"
                  : "text-ink-soft hover:text-ink hover:bg-card/70"
              }`}
            >
              {labels[tab.key]}
              {tab.key === "flags" && openFlags > 0 && (
                <span
                  className={`attention-pulse inline-flex items-center justify-center min-w-5 h-5 text-xs rounded-full px-1 ${
                    isActive ? "bg-paper text-accent" : "bg-warn text-paper"
                  }`}
                >
                  {openFlags}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
