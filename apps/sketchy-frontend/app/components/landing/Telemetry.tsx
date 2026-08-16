"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const ROOMS = [
  "/ink-sprint",
  "/tuple",
  "/25-stroke",
  "/oh-eh",
  "/board-ride",
  "/moving-bigger",
  "/late-night",
  "/red-herring",
];
const NAMES = ["aahana", "riley", "tomo", "neve", "jules", "miko"];

let strokeSeq = 2480;
let idSeq = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

type Row = { id: number; text: ReactNode };

function makeRow(): Row {
  idSeq += 1;
  const t = stamp();
  const roll = Math.random();
  if (roll < 0.5) {
    strokeSeq += 1;
    return {
      id: idSeq,
      text: (
        <>
          {t} · stroke <span className="t-stroke">#{strokeSeq}</span> · room{" "}
          <span className="t-room">{pick(ROOMS)}</span> ·{" "}
          {Math.floor(28 + Math.random() * 28)} ms
        </>
      ),
    };
  }
  if (roll < 0.75) {
    return {
      id: idSeq,
      text: (
        <>
          {t} · <span className="t-name">@{pick(NAMES)}</span> joined room{" "}
          <span className="t-room">{pick(ROOMS)}</span>
        </>
      ),
    };
  }
  return {
    id: idSeq,
    text: (
      <>
        {t} · room <span className="t-room">{pick(ROOMS)}</span> opened
      </>
    ),
  };
}

export function Telemetry() {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 3 }, makeRow)
  );
  const idRef = useRef(idSeq);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      idRef.current += 1;
      setRows((prev) => [makeRow(), prev[0], prev[1]].slice(0, 3));
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="telemetry mx-auto mb-10 max-w-xl text-left">
      <div className="telemetry-head">
        <span className="live-dot h-[6px] w-[6px] rounded-full bg-marker" />
        <span>live board activity</span>
      </div>
      <div className="flex flex-col">
        {rows.map((r, idx) => (
          <div key={r.id} className="telemetry-row" style={{ animationDelay: `${idx * 50}ms` }}>
            {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}