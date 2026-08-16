"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { BACKEND_URL } from "../config";
import { setSession, scheduleTokenRefresh } from "../lib/auth";
import { Nav } from "./landing/Nav";

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isSignin ? "/signin" : "/signup";
      const payload = isSignin
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const res = await axios.post(`${BACKEND_URL}${endpoint}`, payload);

      if (!isSignin) {
        const signinRes = await axios.post(`${BACKEND_URL}/signin`, {
          email: form.email,
          password: form.password,
        });
        setSession({
          token: signinRes.data.token,
          refreshToken: signinRes.data.refreshToken,
        });
      } else {
        setSession({
          token: res.data.token,
          refreshToken: res.data.refreshToken,
        });
      }

      scheduleTokenRefresh();
      router.push(next ?? "/new-room");
    } catch (err: unknown) {
      const responseMsg = axios.isAxiosError(err)
        ? (err.response?.data as { msg?: string })?.msg
        : undefined;
      setError(responseMsg ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const title = isSignin ? "Pick up your pen again." : "First stroke, then the room.";
  const subtitle = isSignin
    ? "Welcome back to the board. Your rooms are still waiting."
    : "Make an account so your sketches get a room that remembers them.";

  const hrefFor = (path: string) =>
    next ? `${path}?next=${encodeURIComponent(next)}` : path;

  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 pt-24 pb-16 sm:px-6 sm:py-24">
        <div className="relative w-full max-w-md">
          <div className="corner-marks card bg-paper/95 p-7 shadow-2xl shadow-ink/8 backdrop-blur-md sm:p-10 border-line">
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="flex items-baseline gap-1.5 select-none group"
              >
                <span className="font-[var(--font-serif)] text-2xl italic text-ink">
                  Sketchy
                </span>
                <span className="h-[6px] w-[6px] translate-y-[-2px] rounded-full bg-marker transition-all duration-300 group-hover:scale-125" />
              </Link>
              <Link
                href="/"
                className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-inksoft hover:text-marker transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Home</span>
              </Link>
            </div>

          <p className="anno mb-2.5 text-marker font-semibold">{isSignin ? "welcome back" : "new room"}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-inksoft">
            {subtitle}
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4.5">
            {!isSignin && (
              <label className="flex flex-col gap-1.5">
                <span className="anno text-[11px]">your name</span>
                <input
                  type="text"
                  placeholder="e.g. Ada"
                  value={form.name}
                  onChange={onChange("name")}
                  required
                  className="rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="anno text-[11px]">email</span>
              <input
                type="email"
                placeholder="you@crossing.com"
                value={form.email}
                onChange={onChange("email")}
                required
                className="rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="anno text-[11px]">password</span>
              <input
                type="password"
                placeholder={isSignin ? "your key" : "8+ characters"}
                value={form.password}
                onChange={onChange("password")}
                minLength={8}
                required
                className="rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-xs text-red-600 font-medium">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-ink mt-2 w-full group !py-3 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <span>{isSignin ? "Sign in" : "Create my room"}</span>
                  <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="hairline-t mt-8 pt-6">
            <p className="anno text-center text-[11px]">
              {isSignin ? (
                <>
                  new to the board?{" "}
                  <Link href={hrefFor("/signup")} className="text-marker font-semibold hover:text-ink transition-colors">
                    create an account
                  </Link>
                </>
              ) : (
                <>
                  already drawing?{" "}
                  <Link href={hrefFor("/signin")} className="text-marker font-semibold hover:text-ink transition-colors">
                    sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="anno absolute -right-1 -top-4 rotate-1 text-inkfaint/60 hidden sm:block">
          x 0 · y 0
        </p>
      </div>
    </div>
    </>
  );
}