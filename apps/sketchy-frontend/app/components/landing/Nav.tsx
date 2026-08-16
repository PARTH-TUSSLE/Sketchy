"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles, ArrowRight, PenTool, LogIn, Layers, Home, ArrowLeft, Sun, Moon, UserRound } from "lucide-react";
import { getUserIdFromToken } from "../../lib/auth";

const links = [
  { href: "/#how", label: "How it works", icon: <Layers size={16} /> },
  { href: "/new-room", label: "Rooms", icon: <Sparkles size={16} /> },
];

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark";
    setDark(isDark);
  }, []);

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    }
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper-card text-inksoft transition-all hover:border-ink hover:bg-paper hover:text-ink active:scale-95 touch-manipulation cursor-pointer"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-inksoft" />}
    </button>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  const isSignin = pathname === "/signin";
  const isSignup = pathname === "/signup";
  const isNewRoom = pathname === "/new-room";

  useEffect(() => {
    setAuthed(Boolean(getUserIdFromToken()));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled || open || isSignin || isSignup || isNewRoom
            ? "border-b border-line bg-paper/90 backdrop-blur-xl shadow-xs py-3.5"
            : "bg-transparent py-5"
        }`}
      >
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-6">
          {/* Logo & Back to Home */}
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-baseline gap-1.5 select-none z-50">
              <span className="font-[var(--font-serif)] text-[26px] sm:text-[27px] font-normal italic leading-none tracking-tight text-ink">
                Sketchy
              </span>
              <span className="h-[7px] w-[7px] translate-y-[-3px] rounded-full bg-marker transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_0_10px_var(--marker)]" />
            </Link>

            {(isSignin || isSignup || isNewRoom) && (
              <Link
                href="/"
                className="hidden sm:flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-inksoft hover:text-ink transition-colors border border-line rounded-lg px-2.5 py-1 bg-paper-card"
              >
                <ArrowLeft size={13} />
                <span>Home</span>
              </Link>
            )}
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-7 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[14px] font-medium text-inksoft transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop Actions + Theme Toggle */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            {authed ? (
              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-paper-card text-ink transition-all hover:border-ink hover:bg-paper active:scale-95 touch-manipulation"
                aria-label="Profile"
                title="Profile"
              >
                <UserRound size={17} />
              </Link>
            ) : isSignin ? (
              <Link href="/signup" className="btn btn-ink !px-4 !py-2 text-sm">
                Create account
              </Link>
            ) : isSignup ? (
              <Link href="/signin" className="btn btn-paper !px-4 !py-2 text-sm border-line">
                Sign in
              </Link>
            ) : (
              <>
                <Link href="/signin" className="btn btn-ghost !px-3.5 !py-2 text-sm">
                  Sign in
                </Link>
                <Link href="/signup" className="btn btn-ink !px-4 !py-2 text-sm">
                  Start drawing
                </Link>
              </>
            )}
          </div>

          {/* Mobile Actions: Theme Toggle + Hamburger Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className={`relative z-50 flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200 active:scale-95 touch-manipulation cursor-pointer ${
                open
                  ? "border-ink bg-ink text-paper shadow-md"
                  : "border-line bg-paper-card text-ink hover:border-ink hover:bg-paper"
              }`}
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? (
                <X size={19} className="animate-in spin-in-90 duration-150" />
              ) : (
                <MenuGlyph />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Backdrop & Clean Nav Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden flex flex-col justify-start pt-20 px-4">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
            onClick={() => setOpen(false)}
          />

          {/* Floating Mobile Nav Drawer Card */}
          <div className="relative z-50 mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper-card p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in slide-in-from-top-4 duration-250">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <span className="font-[var(--font-serif)] text-lg italic text-ink">Sketchy Studio</span>
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 text-xs font-mono text-marker hover:underline"
              >
                <Home size={13} />
                <span>Home</span>
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1 mb-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="group flex items-center justify-between rounded-xl p-3 text-base font-medium text-ink hover:bg-paper transition-all active:scale-[0.99] touch-manipulation"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 border border-line text-inksoft group-hover:text-marker transition-colors">
                    <Home size={16} />
                  </span>
                  <span>Home</span>
                </div>
                <ArrowRight size={16} className="text-inkfaint opacity-0 group-hover:opacity-100 transition-all" />
              </Link>

              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between rounded-xl p-3 text-base font-medium text-ink hover:bg-paper transition-all active:scale-[0.99] touch-manipulation"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-2 border border-line text-inksoft group-hover:text-marker transition-colors">
                      {l.icon}
                    </span>
                    <span>{l.label}</span>
                  </div>
                  <ArrowRight size={16} className="text-inkfaint opacity-0 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-3 border-t border-line">
              <Link
                href={authed ? "/new-room" : "/signup"}
                onClick={() => setOpen(false)}
                className={`btn w-full justify-center !py-3 text-sm font-semibold shadow-md active:scale-98 ${
                  authed ? "btn-ink" : isSignup ? "btn-paper border-line" : "btn-ink"
                }`}
              >
                <PenTool size={16} />
                <span>{authed ? "New room" : "Start drawing"}</span>
              </Link>
              <Link
                href={authed ? "/profile" : "/signin"}
                onClick={() => setOpen(false)}
                className={`btn w-full justify-center !py-3 text-sm font-medium active:scale-98 ${
                  authed ? "btn-paper border-line" : isSignin ? "btn-ink" : "btn-paper border-line"
                }`}
              >
                {authed ? <UserRound size={16} /> : <LogIn size={16} />}
                <span>{authed ? "Profile" : "Sign in"}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuGlyph() {
  return (
    <span className="flex flex-col gap-[4px] items-center">
      <span className="h-[2px] w-4.5 bg-ink rounded-full transition-all" />
      <span className="h-[2px] w-4.5 bg-ink rounded-full transition-all" />
      <span className="h-[2px] w-3 bg-ink rounded-full self-end transition-all" />
    </span>
  );
}