import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Overview", key: "overview" },
  { href: "/admin/publish", label: "Publish", key: "publish" },
  { href: "/admin/results", label: "Results", key: "results" },
  { href: "/admin/members", label: "Roster", key: "roster" },
] as const;

export type AdminTab = (typeof TABS)[number]["key"];

export default function AdminNav({ current }: { current: AdminTab }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">
          Commissioner
        </span>
        <Link
          href="/"
          className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200"
        >
          Back to league
        </Link>
      </div>

      <nav className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === current ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-2 text-center font-medium transition-colors ${
              tab.key === current
                ? "bg-amber-500/15 text-amber-300"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
