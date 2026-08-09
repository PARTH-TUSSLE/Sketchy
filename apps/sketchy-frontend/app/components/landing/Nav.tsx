"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const links = [
  { href: "#board", label: "The board" },
  { href: "#how", label: "How it works" },
  { href: "#rooms", label: "Rooms" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-paper/85 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-baseline gap-1.5">
          <span className="font-[var(--font-serif)] text-[26px] font-normal italic leading-none tracking-tight">
            Sketchy
          </span>
          <span className="h-[7px] w-[7px] translate-y-[-3px] rounded-full bg-marker transition-transform duration-300 group-hover:scale-150" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-inksoft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/signin" className="btn btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-ink">
            Start drawing
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={18} /> : <MenuGlyph />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-paper px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-ink"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link href="/signin" className="btn btn-ghost flex-1">
                Sign in
              </Link>
              <Link href="/signup" className="btn btn-ink flex-1">
                Start drawing
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuGlyph() {
  return (
    <span className="flex flex-col gap-[3px]">
      <span className="h-[1.5px] w-4 bg-ink" />
      <span className="h-[1.5px] w-4 bg-ink" />
      <span className="h-[1.5px] w-4 bg-ink" />
    </span>
  );
}