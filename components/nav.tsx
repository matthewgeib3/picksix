import Link from "next/link";

const TABS = [
  { href: "/picks", label: "Picks", key: "picks" },
  { href: "/grid", label: "Grid", key: "grid" },
  { href: "/standings", label: "Standings", key: "standings" },
] as const;

export default function Nav({
  current,
}: {
  current: "picks" | "grid" | "standings";
}) {
  return (
    <nav className="mb-5 flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? "page" : undefined}
          className={`flex-1 rounded-md px-3 py-2 text-center font-medium transition-colors ${
            tab.key === current
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
