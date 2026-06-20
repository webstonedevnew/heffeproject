import { Spinner } from "@/components/Spinner";

/**
 * Scoped to the teacher content area (below the tab bar), so switching tabs
 * shows a gentle loader without the persistent tab bar flickering.
 */
export default function Loading() {
  return (
    <div
      className="flex justify-center pt-16 text-ink-faint opacity-0"
      style={{ animation: "fade-in 0.3s ease 0.15s forwards" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <Spinner className="text-2xl" />
    </div>
  );
}
