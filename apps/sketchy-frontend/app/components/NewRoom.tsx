"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, Loader2, LogIn } from "lucide-react";
import { BACKEND_URL } from "../config";
import { getToken } from "../lib/auth";

export function NewRoom() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
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

    const token = getToken();
    if (!token) {
      setError("You need to sign in first.");
      return;
    }

    setError(null);
    setBusy("create");

    try {
      const res = await axios.post(
        `${BACKEND_URL}/room`,
        { name: slug },
        { headers: { Authorization: token } }
      );
      routerPush(`/canvas/${res.data.roomId}`);
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

          <p className="anno mb-3">the studio door</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em]">
            Name the room.
            <br />
            <span className="font-[var(--font-serif)] italic font-normal">
              Invite the board.
            </span>
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-inksoft">
            Give it a short name. Anyone who knows it can draw there — everyone
            sees the same strokes, live.
          </p>

          <div className="mt-9 flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="anno">room name</span>
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
                  className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-inkfaint focus:border-ink"
                />
                <button
                  onClick={create}
                  disabled={busy === "create"}
                  className="btn btn-ink shrink-0 px-4 disabled:opacity-60"
                >
                  {busy === "create" ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                </button>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="anno text-inkfaint">or join one</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <label className="flex flex-col gap-2">
              <span className="anno">name or id</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="existing room"
                  value={joinSlug}
                  onChange={(e) => setJoinSlug(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  className="w-full rounded-lg border border-line bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-inkfaint focus:border-ink"
                />
                <button
                  onClick={joinRoom}
                  disabled={busy === "join"}
                  className="btn btn-paper shrink-0 px-4 disabled:opacity-60"
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
              <p className="rounded-lg border border-line bg-paper-2 px-4 py-3 text-[13.5px] leading-relaxed text-inksoft">
                {error}
              </p>
            )}
          </div>

          <div className="hairline-t mt-8 pt-6">
            <p className="anno text-center">
              backing out?{" "}
              <Link href="/" className="text-marker hover:text-ink">
                back to the landing
              </Link>
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

function SignInPrompt() {
  return (
    <div className="board-grid relative flex min-h-screen items-center justify-center px-6">
      <div className="corner-marks card w-full max-w-md p-10 text-center">
        <p className="anno mb-4">room access</p>
        <h1 className="text-2xl font-semibold tracking-tight">
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
  );
}

function Skeleton() {
  return (
    <div className="board-grid relative flex min-h-screen items-center justify-center px-6">
      <div className="card w-full max-w-md p-10">
        <div className="mx-auto h-2 w-2 animate-pulse rounded-full bg-ink/20" />
      </div>
    </div>
  );
}