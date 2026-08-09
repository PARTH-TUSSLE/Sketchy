import Link from "next/link";
import { DoodlePad } from "./DoodlePad";
import { MarkText } from "./MarkText";
import { Reveal } from "./Reveal";

export function Hero() {
  return (
    <section id="board" className="board-grid relative overflow-hidden">
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-20 pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:pt-44">
        <div>
          <Reveal>
            <p className="anno mb-6 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-marker" />
              realtime <span className="text-inkfaint">·</span> multi-player
              <span className="text-inkfaint">·</span> a board
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-[clamp(2.6rem,7vw,4.9rem)] font-semibold leading-[1.01] tracking-[-0.035em] text-ink">
              Every stroke, on every
              <br className="hidden sm:block" /> screen —{" "}
              <span className="font-[var(--font-serif)] font-normal italic tracking-[-0.01em]">
                the exact
              </span>{" "}
              <span className="relative inline-block">
                <MarkText>same second</MarkText>
              </span>
              .
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-inksoft">
              Sketchy is a plain whiteboard that syncs itself. Draw a stroke and
              it lands on every screen in the room the moment you lift your pen.
              No refresh. No merge. No conference call.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/new-room" className="btn btn-ink">
                Open a room
                <span aria-hidden className="translate-x-0 transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <a href="#how" className="btn btn-paper">
                See how it draws
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
              {[
                ["3", "shapes, pencil to circle"],
                ["≈ 40 ms", "stroke to screen"],
                ["∞", "rooms, no wipe"],
              ].map(([n, l]) => (
                <div key={l} className="flex items-baseline gap-2">
                  <span className="font-[var(--font-serif)] text-2xl italic">
                    {n}
                  </span>
                  <span className="anno">{l}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="corner-marks card relative aspect-[4/4.2] w-full overflow-hidden p-0 shadow-2xl shadow-ink/5">
            <div className="absolute inset-0">
              <DoodlePad />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}