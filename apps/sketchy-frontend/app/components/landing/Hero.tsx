"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DoodlePad } from "./DoodlePad";
import { MarkText } from "./MarkText";
import { Reveal } from "./Reveal";
import { ArrowRight, PenTool } from "lucide-react";

function LiveCounter({ base = 12840 }: { base?: number }) {
  const [n, setN] = useState(base);

  useEffect(() => {
    let v = base;
    const id = setInterval(() => {
      v += 1 + Math.floor(Math.random() * 3);
      setN(v);
    }, 2400);
    return () => clearInterval(id);
  }, [base]);

  return <>{n.toLocaleString("en-US")}</>;
}

export function Hero() {
  return (
    <section id="board" className="board-grid relative overflow-hidden">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-24 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:pt-40 lg:pb-32">
        <div>
          <Reveal>
            <div className="anno mb-6 inline-flex items-center gap-2.5 rounded-full border border-line bg-paper-card px-3.5 py-1.5 shadow-xs">
              <span className="live-dot h-2 w-2 rounded-full bg-marker" />
              <span className="font-mono text-[11px] font-medium normal-case tracking-normal text-inksoft">
                room /sketchy-home
              </span>
              <span className="text-inkfaint">·</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-marker">
                live
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-[clamp(2.5rem,6.5vw,4.8rem)] font-semibold leading-[1.03] tracking-[-0.035em] text-ink">
              Every stroke, on every
              <br className="hidden sm:block" /> screen —{" "}
              <span className="font-[var(--font-serif)] font-normal italic tracking-[-0.01em] text-ink/90">
                the exact
              </span>{" "}
              <span className="relative inline-block">
                <MarkText>same second</MarkText>
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-inksoft font-normal">
              Sketchy is a plain whiteboard that syncs itself. Draw a stroke and
              it lands on every screen in the room the moment you lift your pen.
              No refresh. No merge. No conference call.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/new-room" className="btn btn-ink group !px-5 !py-3">
                <span>Open a room</span>
                <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <a href="#how" className="btn btn-paper !px-5 !py-3">
                See how it draws
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-12 flex flex-wrap items-baseline gap-x-8 gap-y-4 pt-6 hairline-t max-w-lg">
              {[
                ["3", "shapes, pencil to circle"],
                ["≈ 40 ms", "stroke to screen"],
                ["∞", "rooms, persistent"],
              ].map(([n, l]) => (
                <div key={l} className="flex items-baseline gap-2">
                  <span className="font-[var(--font-serif)] text-2xl italic font-normal text-ink">
                    {n}
                  </span>
                  <span className="anno text-[11px]">{l}</span>
                </div>
              ))}
              <div className="flex items-baseline gap-2">
                <span className="font-[var(--font-serif)] text-2xl italic font-normal text-marker">
                  <LiveCounter />
                </span>
                <span className="anno text-[11px]">strokes in the last hour</span>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="corner-marks card relative overflow-hidden border-line shadow-2xl shadow-ink/8">
            {/* Window chrome */}
            <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-card px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="live-dot h-[7px] w-[7px] rounded-full bg-marker" />
                <span className="truncate font-mono text-[11px] font-medium text-ink">
                  room /sketchy-home
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-inksoft">
                <PenTool size={11} />
                <span className="text-marker">4 online</span>
              </span>
            </div>

            <div className="relative aspect-[4/4.1] w-full overflow-hidden">
              <DoodlePad />
            </div>

            <div className="flex items-center justify-between border-t border-line bg-paper-card px-4 py-2">
              <span className="anno text-[10px] text-inkfaint">interactive preview</span>
              <span className="font-mono text-[10px] text-inksoft">
                you + 3 drawing right now
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}