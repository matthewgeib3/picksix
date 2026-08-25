"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Quietly re-renders the page on a timer.
 *
 * router.refresh() re-runs the server components and swaps in the new markup
 * without a full page load -- no white flash, no losing your scroll position,
 * no dropping form state. That matters on the grid, where people will leave
 * a tab open all Sunday.
 */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);

    // Catch up immediately when someone comes back to the tab, rather than
    // making them wait out the rest of the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  return null;
}
