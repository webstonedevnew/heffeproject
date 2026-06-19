"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scrolls to and briefly highlights the comment named in the URL hash
 * (e.g. /posts/abc#comment-xyz), used when a teacher opens a flagged comment or
 * a student follows a "reply to you" notification.
 *
 * Done in JS rather than relying on the CSS :target pseudo-class, because that
 * doesn't fire reliably on Safari after a client-side (pushState) navigation.
 */
export function ScrollToHash() {
  const pathname = usePathname();

  useEffect(() => {
    const run = () => {
      const hash = window.location.hash;
      if (!hash.startsWith("#comment-")) return;
      const id = decodeURIComponent(hash.slice(1));

      let attempts = 0;
      const tryFocus = () => {
        const el = document.getElementById(id);
        if (!el) {
          if (attempts++ < 15) window.setTimeout(tryFocus, 100);
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("comment-flash");
        // reflow so the animation can re-trigger if the same hash is reused
        void el.offsetWidth;
        el.classList.add("comment-flash");
        window.setTimeout(() => el.classList.remove("comment-flash"), 2600);
      };
      tryFocus();
    };

    run();
    window.addEventListener("hashchange", run);
    return () => window.removeEventListener("hashchange", run);
  }, [pathname]);

  return null;
}
