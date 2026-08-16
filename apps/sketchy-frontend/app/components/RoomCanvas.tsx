"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { TriangleAlert, RefreshCw } from "lucide-react";
import { BACKEND_URL, WS_URL } from "../config";
import Canvas from "../components/Canvas";
import { ensureFreshToken, scheduleTokenRefresh } from "../lib/auth";
import PlugConnectedIcon from "./icons/plug-connected-icon";
import { Nav } from "./landing/Nav";

type ConnState =
  | { status: "connecting" }
  | { status: "joined"; socket: WebSocket }
  | { status: "no-token" }
  | { status: "network" }
  | { status: "missing" };

const MAX_RETRIES = 3;
const RETRY_AFTER_MS = 1500;

function decodeRoomId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function encodeRoomId(roomId: string): string {
  return encodeURIComponent(roomId);
}

const NUMERIC_ID = /^\d+$/;

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const roomKey = decodeRoomId(roomId);
  const [conn, setConn] = useState<ConnState>({ status: "connecting" });
  const [attempt, setAttempt] = useState(0);
  const [roomIdNum, setRoomIdNum] = useState<number | null>(null);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Resolve the slug/name to the numeric room id the socket actually works with.
  // Joining by name bypasses the numeric path, so without this the websocket
  // `join_room` message is silently dropped (toRoomId rejects non-numeric).
  useEffect(() => {
    let disposed = false;

    (async () => {
      if (NUMERIC_ID.test(roomKey)) {
        setRoomIdNum(Number(roomKey));
        return;
      }
      try {
        const res = await axios.get(
          `${BACKEND_URL}/room/${encodeRoomId(roomKey)}`
        );
        const room = res.data?.room;
        if (!disposed && room && NUMERIC_ID.test(String(room.id))) {
          setRoomIdNum(Number(room.id));
        } else if (!disposed) {
          setConn({ status: "missing" });
        }
      } catch {
        if (!disposed) setConn({ status: "missing" });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [roomKey]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    // Keep the session renewed while this page is open, so an idle tab never
    // hits a dead access token on the next reconnect or reload.
    scheduleTokenRefresh();

    const open = async (n: number) => {
      // Refresh the token first — the previous one may have lapsed during a
      // long idle stretch on the board.
      const token = await ensureFreshToken();
      if (!token) {
        if (!disposed) setConn({ status: "no-token" });
        return;
      }
      if (roomIdNum === null) return;

      socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: "join_room", roomId: roomIdNum }));
        if (!disposed && socket) setConn({ status: "joined", socket });
      };

      socket.onclose = (e) => {
        if (disposed) return;
        if (e.code === 4001) {
          setConn({ status: "no-token" });
          return;
        }
        if (n < MAX_RETRIES) {
          setConn({ status: "connecting" });
          const t = setTimeout(() => open(n + 1), RETRY_AFTER_MS);
          timeouts.current.push(t);
        } else {
          setConn({ status: "network" });
        }
      };
    };

    if (roomIdNum !== null) open(0);

    return () => {
      disposed = true;
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      socket?.close();
    };
  }, [roomIdNum, attempt]);

  const retry = () => {
    setConn({ status: "connecting" });
    setAttempt((a) => a + 1);
  };

  if (conn.status === "no-token") {
    return (
      <Shell title="Sign in to open the board">
        <p>
          Rooms are behind a sign-in, so only people you invite can sketch with
          you. Sign in and we&apos;ll bring you straight back here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/signin?next=/canvas/${encodeRoomId(roomKey)}`}
            className="btn btn-ink"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-paper">
            Create account
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "missing") {
    return (
      <Shell title="We couldn&apos;t find that board">
        <p>
          No room matches &quot;{roomKey}&quot;. Double-check the name, or start a new
          one from the home page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/new-room" className="btn btn-ink">
            Name a new room
          </Link>
          <Link href="/" className="btn btn-paper">
            Back to home
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "network") {
    return (
      <Shell title="The room went quiet for a moment">
        <p>
          We couldn&apos;t reach the studio just now, so joining is paused on
          our side. No drawing is lost — everything you sketched is safe and
          will still be on the board when we&apos;re back. Give it another go
          whenever you&apos;re ready.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={retry} className="btn btn-ink">
            <RefreshCw size={16} /> Reconnect
          </button>
          <Link href="/" className="btn btn-paper">
            Back to home
          </Link>
        </div>
      </Shell>
    );
  }

  if (conn.status === "connecting") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0b0f] text-white p-6">
        <div className="relative flex items-center justify-center p-4 rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <PlugConnectedIcon size={32} color="#818cf8" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-[var(--font-plex)] text-xs tracking-[0.2em] uppercase text-white/60 font-medium animate-pulse">
            tracing to the room…
          </p>
          <p className="font-[var(--font-serif)] text-lg italic text-white/40">
            {roomKey}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      roomId={String(roomIdNum ?? "")}
      roomName={roomKey}
      socket={conn.socket}
    />
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <div className="board-grid relative flex min-h-screen items-center justify-center p-6 pt-24">
        <div className="corner-marks card w-full max-w-md p-8 sm:p-10 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper-2 text-ink">
            <TriangleAlert size={20} strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <div className="mt-3 text-[15px] leading-relaxed text-inksoft">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}