"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, Loader2, LogIn, ArrowLeft } from "lucide-react";
import { BACKEND_URL } from "../config";
import { ensureFreshToken, scheduleTokenRefresh } from "../lib/auth";
import { Nav } from "./landing/Nav";

export function NewRoom() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let stale = false;
    scheduleTokenRefresh();
    (async () => {
      const token = await ensureFreshToken();
      if (!stale) setAuthed(Boolean(token));
    })();
    return () => {
      stale = true;
    };
  }, []);

  if (authed === null) {
    return <Skeleton />;
  }

  if (!authed) {
    return <SignInPrompt />;
  }

  return <CreateRoomFlow routerPush={router.push} />;
}

function CreateRoomFlow({
  routerPush,
}: {
  routerPush: (href: string) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [joinSlug, setJoinSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "create" | "join">(null);

  async function create() {
    const slug = name.trim();
    if (slug.length < 3 || slug.length > 30) {
      setError("Room names are 3–30 characters.");
      return;
    }

    const token = await ensureFreshToken();
    if (!token) {
      setError("You need to sign in first.");
      return;
    }

    setError(null);
    setBusy("create");

    try {
      await axios.post(
        `${BACKEND_URL}/room`,
        { name: slug },
        { headers: { Authorization: token } }
      );
      routerPush(`/canvas/${encodeURIComponent(name.trim())}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError(
          "That room already exists — join it with the same name below, or pick a new one."
        );
      } else {
        setError("Could not create the room. Try again in a moment.");
      }
      setBusy(null);
    }
  }

  async function joinRoom() {
    const slug = joinSlug.trim();
    if (!slug) {
      setError("Type a room name or ID to join.");
      return;
    }
    setError(null);
    setBusy("join");
    routerPush(`/canvas/${encodeURIComponent(slug)}`);
  }

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

          <p className="anno mb-2.5 text-marker font-semibold">the studio door</p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink">
            Name the room.
            <br />
            <span className="font-[var(--font-serif)] italic font-normal text-ink/90">
              Invite the board.
            </span>
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-inksoft">
            Give it a short name. Anyone who knows it can draw there — everyone
            sees the same strokes, live.
          </p>

          <div className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="anno text-[11px]">room name</span>
              <div className="flex gap-2">
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="e.g. tuesday"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  maxLength={30}
                  autoFocus
                  className="w-full rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
                />
                <button
                  onClick={create}
                  disabled={busy === "create"}
                  className="btn btn-ink shrink-0 !px-4 disabled:opacity-60"
                >
                  {busy === "create" ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center gap-3 my-1">
              <span className="h-px flex-1 bg-line" />
              <span className="anno text-[10px] text-inkfaint">or join one</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="anno text-[11px]">name or id</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="existing room"
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  className="w-full rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
                />
                <button
                  onClick={joinRoom}
                  disabled={busy === "join"}
                  className="btn btn-paper shrink-0 !px-4 disabled:opacity-60"
                >
                  {busy === "join" ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <LogIn size={17} />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-xl border border-line bg-paper-2 px-4 py-2.5 text-[13.5px] leading-relaxed text-inksoft font-medium">
                {error}
              </p>
            )}
          </div>

          <div className="hairline-t mt-8 pt-6">
            <p className="anno text-center text-[11px]">
              backing out?{" "}
              <Link href="/" className="text-marker font-semibold hover:text-ink transition-colors">
                back to home
              </Link>
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

function SignInPrompt() {
  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-center justify-center p-6">
        <div className="corner-marks card w-full max-w-md p-8 sm:p-10 text-center shadow-xl">
          <p className="anno mb-3 text-marker font-semibold">room access</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Sign in to open the door
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-inksoft">
            Rooms are locked behind an account, so only the people you invite can
            join your board.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn btn-ink">
              Create an account
            </Link>
            <Link href="/signin" className="btn btn-paper">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-center justify-center p-6">
        <div className="card w-full max-w-md p-10 flex items-center justify-center">
          <span className="live-dot h-3 w-3 rounded-full bg-marker" />
        </div>
      </div>
    </>
  );
}