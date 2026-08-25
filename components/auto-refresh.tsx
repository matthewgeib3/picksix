"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the page when you come back to the tab.
 *
 * Deliberately not a polling loop. For six people there's nothing worth
 * fetching every minute -- results only move when a game ends, and people
 * are happy to refresh. But a phone that's been in a pocket since kickoff
 * shows stale data on the way back, and that's the case worth covering.
 *
 * router.refresh() re-runs the server components and swaps in new markup
 * without a full page load: no white flash, no losing scroll position.
 */
export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
