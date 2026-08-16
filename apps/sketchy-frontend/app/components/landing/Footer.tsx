import Link from "next/link";
import { Github, Linkedin, Heart } from "lucide-react";

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const sections = [
  {
    label: "Product",
    items: [
      { label: "How it works", href: "/#how" },
      { label: "Rooms", href: "/new-room" },
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

const socials = [
  {
    label: "GitHub",
    href: "https://github.com/PARTH-TUSSLE",
    icon: <Github size={15} />,
  },
  {
    label: "X",
    href: "https://x.com/parthgartan",
    icon: <XIcon size={14} />,
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/parthgartan",
    icon: <Linkedin size={15} />,
  },
];

export function Footer() {
  return (
    <footer className="hairline-t relative bg-paper border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-14 lg:flex-row lg:items-start lg:justify-between">
        {/* Brand & Developer Info Column */}
        <div className="flex flex-col gap-4 max-w-sm">
          <Link href="/" className="flex items-baseline gap-1.5 group select-none self-start">
            <span className="font-[var(--font-serif)] text-2xl italic text-ink">
              Sketchy
            </span>
            <span className="h-[6px] w-[6px] translate-y-[-2px] rounded-full bg-marker transition-all duration-300 group-hover:scale-125" />
          </Link>
          
          <p className="text-[14.5px] leading-relaxed text-inksoft">
            A real-time collaborative whiteboard. Every stroke, on every screen, the same second.
          </p>

          {/* Single Unified Developer & Socials Block */}
          <div className="mt-2 flex flex-col gap-2.5 pt-4 border-t border-line-soft">
            <p className="anno text-[11px] text-inkfaint flex items-center gap-1.5">
              <span>Developed with</span>
              <Heart size={12} className="text-red-500 fill-red-500 inline" />
              <span>by</span>
              <span className="font-semibold text-ink">Parth Gartan</span>
            </p>

            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={`Parth Gartan on ${s.label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-paper-card text-inksoft transition-all hover:border-ink hover:bg-paper hover:text-ink hover:scale-105 active:scale-95 touch-manipulation"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Product & Account Navigation Columns */}
        <div className="grid grid-cols-2 gap-12 sm:gap-20">
          {sections.map((c) => (
            <div key={c.label}>
              <p className="anno mb-3 text-[11px] text-inkfaint font-semibold">{c.label}</p>
              <ul className="flex flex-col gap-2.5">
                {c.items.map((i) => (
                  <li key={i.label}>
                    <Link
                      href={i.href}
                      className="text-sm font-medium text-inksoft transition-colors hover:text-ink"
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

      {/* Clean Bottom Copyright Bar */}
      <div className="hairline-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between text-[11px]">
          <p className="anno text-inksoft">© {new Date().getFullYear()} Sketchy. All rights reserved.</p>
          <p className="anno text-inkfaint/70">Real-time Collaborative Engine</p>
        </div>
      </div>
    </footer>
  );
}