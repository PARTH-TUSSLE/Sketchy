"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, Loader2 } from "lucide-react";
import { BACKEND_URL } from "../config";
import { setToken } from "../lib/auth";

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
        setToken(signinRes.data.token);
      } else {
        setToken(res.data.token);
      }

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
    <div className="board-grid relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24">
      <div className="relative w-full max-w-md">
        <div className="corner-marks card bg-paper/90 p-8 shadow-2xl shadow-ink/5 backdrop-blur-sm sm:p-10">
          <Link
            href="/"
            className="mb-10 flex items-baseline gap-1.5 self-start"
          >
            <span className="font-[var(--font-serif)] text-2xl italic text-ink">
              Sketchy
            </span>
            <span className="h-[6px] w-[6px] translate-y-[-2px] rounded-full bg-marker" />
          </Link>

          <p className="anno mb-3">{isSignin ? "welcome back" : "new room"}</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-inksoft">
            {subtitle}
          </p>

          <form onSubmit={onSubmit} className="mt-9 flex flex-col gap-5">
            {!isSignin && (
              <label className="flex flex-col gap-2">
                <span className="anno">your name</span>
                <input
                  type="text"
                  placeholder="e.g. Ada"
                  value={form.name}
                  onChange={onChange("name")}
                  required
                  className="rounded-lg border border-line bg-paper px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-inkfaint focus:border-ink"
                />
              </label>
            )}

            <label className="flex flex-col gap-2">
              <span className="anno">email</span>
              <input
                type="email"
                placeholder="you@crossing.com"
                value={form.email}
                onChange={onChange("email")}
                required
                className="rounded-lg border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-inkfaint focus:border-ink"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="anno">password</span>
              <input
                type="password"
                placeholder={isSignin ? "your key" : "8+ characters"}
                value={form.password}
                onChange={onChange("password")}
                minLength={8}
                required
                className="rounded-lg border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-inkfaint focus:border-ink"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-ink mt-1 w-full disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isSignin ? "Sign in" : "Create my room"}
                  <ArrowRight size={17} className="group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="hairline-t mt-8 pt-6">
            <p className="anno text-center">
              {isSignin ? (
                <>
                  new to the board?{" "}
                  <Link href={hrefFor("/signup")} className="text-marker hover:text-ink">
                    create an account
                  </Link>
                </>
              ) : (
                <>
                  already drawing?{" "}
                  <Link href={hrefFor("/signin")} className="text-marker underline-offset-2 hover:text-ink">
                    sign in
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="anno absolute -right-1 -top-4 rotate-1 text-inkfaint">
          x 0 · y 0
        </p>
      </div>
    </div>
  );
}