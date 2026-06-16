/**
 * Shown automatically by the App Router while an (app) page's server data
 * loads — so navigation always feels responsive. A thin sweeping bar at the
 * very top plus a gentle skeleton of the content area.
 */
export default function Loading() {
  return (
    <>
      <TopLoadingBar />
      <div className="animate-fade-in" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="h-7 w-48 rounded bg-paper-deep animate-pulse mb-5" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-card border border-line rounded-lg p-4 sm:p-5"
            >
              <div className="h-3 w-24 rounded bg-paper-deep animate-pulse" />
              <div className="h-5 w-2/3 rounded bg-paper-deep animate-pulse mt-3" />
              <div className="h-3 w-full rounded bg-paper-deep animate-pulse mt-3" />
              <div className="h-3 w-5/6 rounded bg-paper-deep animate-pulse mt-2" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** A reusable indeterminate bar pinned to the top of the viewport. */
export function TopLoadingBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent">
      <div className="loading-bar h-full w-full origin-left bg-accent" />
    </div>
  );
}
