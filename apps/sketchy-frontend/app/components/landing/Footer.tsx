import Link from "next/link";

const sections = [
  {
    label: "Product",
    items: [
      { label: "The board", href: "#board" },
      { label: "How it works", href: "#how" },
      { label: "Rooms", href: "#rooms" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Sign in", href: "/signin" },
      { label: "Create account", href: "/signup" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="hairline-t relative bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xs">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-[var(--font-serif)] text-2xl italic">
              Sketchy
            </span>
            <span className="h-[6px] w-[6px] translate-y-[-2px] rounded-full bg-marker" />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-inksoft">
            A real-time whiteboard. Every stroke, on every screen, the same
            second.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12">
          {sections.map((c) => (
            <div key={c.label}>
              <p className="anno mb-4">{c.label}</p>
              <ul className="flex flex-col gap-3">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link
                      href={i.href}
                      className="text-sm text-inksoft transition-colors hover:text-ink"
                    >
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="hairline-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="anno">© {new Date().getFullYear()} sketchy · drawn mostly by hand</p>
          <p className="anno text-inkfaint">ws · survival · a few spells</p>
        </div>
      </div>
    </footer>
  );
}