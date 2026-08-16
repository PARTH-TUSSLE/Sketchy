"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { ArrowRight, ImagePlus, Loader2, LogOut, Save, Trash2, UserRound } from "lucide-react";
import { BACKEND_URL } from "../config";
import { ensureFreshToken, scheduleTokenRefresh, clearSession } from "../lib/auth";
import { Nav } from "./landing/Nav";

interface ProfileUser {
  id: string;
  email: string;
  name: string;
  photo: string | null;
}

interface ProfileRoom {
  id: number;
  slug: string;
  backgroundColor: string;
}

const AVATAR_COLORS = ["#e26d5a", "#4a90d9", "#7bbf6a", "#e0a458", "#9b7ede", "#e07abe", "#58b7c4"];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Profile() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [rooms, setRooms] = useState<ProfileRoom[] | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stale = false;
    scheduleTokenRefresh();
    (async () => {
      const token = await ensureFreshToken();
      if (stale) return;
      if (!token) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/me`, {
          headers: { Authorization: token },
        });
        if (stale) return;
        setUser(res.data.user);
        setRooms(res.data.rooms);
        setName(res.data.user?.name ?? "");
      } catch {
        if (!stale) setError("Could not load your profile.");
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  async function save() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const token = await ensureFreshToken();
    if (!token) {
      setError("Session expired — sign in again.");
      setSaving(false);
      return;
    }
    try {
      const res = await axios.patch(
        `${BACKEND_URL}/me`,
        {
          name: name.trim() || undefined,
        },
        { headers: { Authorization: token } }
      );
      setUser(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const responseMsg = axios.isAxiosError(err)
        ? (err.response?.data as { msg?: string })?.msg
        : undefined;
      setError(responseMsg ?? "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be 5 MB or smaller.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setSavingPhoto(true);
    setError(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const token = await ensureFreshToken();
      if (!token) {
        setError("Session expired — sign in again.");
        return;
      }
      const res = await axios.patch(
        `${BACKEND_URL}/me`,
        { photo: dataUrl },
        { headers: { Authorization: token } }
      );
      setUser(res.data.user);
    } catch (err: unknown) {
      const responseMsg = axios.isAxiosError(err)
        ? (err.response?.data as { msg?: string })?.msg
        : undefined;
      setError(responseMsg ?? "Could not upload the photo.");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function removePhoto() {
    if (!user) return;
    setSavingPhoto(true);
    setError(null);
    try {
      const token = await ensureFreshToken();
      if (!token) {
        setError("Session expired — sign in again.");
        return;
      }
      const res = await axios.patch(
        `${BACKEND_URL}/me`,
        { photo: null },
        { headers: { Authorization: token } }
      );
      setUser(res.data.user);
    } catch {
      setError("Could not remove the photo.");
    } finally {
      setSavingPhoto(false);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadPhoto(file);
  }

  function signOut() {
    clearSession();
    router.push("/");
  }

  if (authed === null) {
    return <Skeleton />;
  }

  if (!authed) {
    return <SignInPrompt />;
  }

  const initials = (user?.name?.trim() || user?.email || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-start justify-center overflow-hidden px-4 pt-24 pb-16 sm:px-6 sm:py-28">
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
                href="/new-room"
                className="flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-inksoft hover:text-marker transition-colors"
              >
                <ArrowRight size={13} />
                <span>New room</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Avatar user={user} seed={user?.email ?? ""} initials={initials} />
              <div className="min-w-0">
                <p className="anno mb-1 text-marker font-semibold">your profile</p>
                <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink truncate">
                  {user?.name || "Artist"}
                </h1>
                <p className="mt-1 text-[13.5px] text-inksoft truncate">{user?.email}</p>
              </div>
            </div>

            <div className="hairline-t mt-7 pt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="anno text-[11px]">display name</span>
                <input
                  type="text"
                  placeholder="e.g. Ada"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="rounded-xl border border-line bg-paper-card px-4 py-2.5 text-[15px] text-ink outline-none transition-all placeholder:text-inkfaint focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="anno text-[11px]">avatar</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileSelected}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={savingPhoto}
                    className="btn btn-paper !px-3.5 !py-2 text-xs border-line disabled:opacity-60"
                  >
                    {savingPhoto ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ImagePlus size={14} />
                    )}
                    <span>{user?.photo ? "Change photo" : "Upload photo"}</span>
                  </button>
                  {user?.photo && (
                    <button
                      onClick={removePhoto}
                      disabled={savingPhoto}
                      className="flex items-center gap-1.5 px-1 text-xs font-mono uppercase tracking-wider text-inksoft hover:text-red-500 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <span className="anno text-[10px] text-inkfaint">
                  jpg · png · gif · webp — up to 5 mb
                </span>
              </div>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-2.5 text-xs text-red-600 font-medium">
                  {error}
                </p>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="btn btn-ink w-full group !py-3 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : saved ? (
                  <>
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save changes</span>
                  </>
                )}
              </button>
            </div>

            <div className="hairline-t mt-8 pt-6">
              <p className="anno mb-3 text-[11px]">your rooms</p>
              {rooms === null ? (
                <p className="text-sm text-inkfaint">loading…</p>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-inkfaint">
                  No rooms yet —{" "}
                  <Link href="/new-room" className="text-marker font-semibold hover:text-ink transition-colors">
                    open your first board
                  </Link>
                  .
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {rooms.map((room) => (
                    <li key={room.id}>
                      <Link
                        href={`/canvas/${encodeURIComponent(room.slug)}`}
                        className="group flex items-center justify-between rounded-xl border border-line bg-paper-card px-3.5 py-2.5 text-sm text-ink transition-all hover:border-ink"
                      >
                        <span className="truncate font-medium">{room.slug}</span>
                        <ArrowRight size={15} className="text-inkfaint transition-transform duration-200 group-hover:translate-x-1 group-hover:text-marker" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hairline-t mt-8 pt-6 flex justify-center">
              <button
                onClick={signOut}
                className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-inksoft hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          </div>

          <p className="anno absolute -right-1 -top-4 rotate-1 text-inkfaint/60 hidden sm:block">
            ink &amp; paper
          </p>
        </div>
      </div>
    </>
  );
}

function Avatar({
  user,
  seed,
  initials,
}: {
  user: ProfileUser | null;
  seed: string;
  initials: string;
}) {
  if (user?.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.photo}
        alt={user.name || "Profile"}
        className="h-16 w-16 rounded-2xl border-2 border-line object-cover shadow-md shrink-0"
      />
    );
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-line font-[var(--font-serif)] text-2xl italic text-white shadow-md"
      style={{ backgroundColor: avatarColor(seed) }}
    >
      {initials || <UserRound size={24} />}
    </div>
  );
}

function SignInPrompt() {
  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-center justify-center p-6">
        <div className="corner-marks card w-full max-w-md p-8 sm:p-10 text-center shadow-xl">
          <p className="anno mb-3 text-marker font-semibold">profile access</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Sign in to see your profile
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-inksoft">
            Your profile holds your name, your avatar, and every room you&apos;ve
            opened.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn btn-ink">
              Create an account
            </Link>
            <Link href="/signin?next=/profile" className="btn btn-paper">
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