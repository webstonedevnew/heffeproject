import { Spinner } from "@/components/Spinner";

/**
 * Shown by the App Router while an (app) page's server data loads. Kept light
 * on purpose: a thin sweeping bar appears immediately, and a centred spinner
 * only fades in after ~250ms — so quick navigations don't flash anything and
 * feel instant, while genuinely slow loads still get clear feedback.
 */
export default function Loading() {
  return (
    <div
      className="flex justify-center pt-24 text-ink-faint opacity-0"
      style={{ animation: "fade-in 0.3s ease 0.2s forwards" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <Spinner className="text-2xl" />
    </div>
  );
}
