"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin top progress bar that appears the instant you click an in-app link and
 * grows while the next page loads — so it's always clear that a navigation is
 * under way. It clears when the route commits (pathname changes) or after a
 * safety timeout. Pairs with loading.tsx (which covers slow server data).
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timer = useRef<number | null>(null);

  // Route committed → done.
  useEffect(() => {
    setActive(false);
    if (timer.current) window.clearTimeout(timer.current);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Only show for an actual page change (the pathname effect clears it).
        // Same-path query/hash navigations are fast and would otherwise linger.
        if (url.pathname === window.location.pathname) return;
        setActive(true);
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setActive(false), 12000);
      } catch {
        /* ignore malformed hrefs */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden="true">
      <div className="nav-progress-bar h-full bg-accent" />
    </div>
  );
}
