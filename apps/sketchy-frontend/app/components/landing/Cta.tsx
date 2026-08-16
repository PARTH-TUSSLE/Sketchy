import Link from "next/link";
import { Reveal } from "./Reveal";
import { Telemetry } from "./Telemetry";
import { SketchRing } from "./SketchRing";

export function Cta() {
  return (
    <section className="hairline-t relative overflow-hidden cta-inverted-section border-line">
      {/* Drafting grid background */}
      <div className="cta-grid absolute inset-0 opacity-40" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 text-center lg:py-32">
        <Reveal>
          <Telemetry />
        </Reveal>

        <Reveal delay={80}>
          <div className="anno cta-badge mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-wider">
            <span className="live-dot h-2 w-2 rounded-full bg-marker" />
            <span>the board is open</span>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="relative inline-block px-4">
            <SketchRing />
            <h2 className="cta-title relative z-10 mx-auto max-w-3xl text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Make the first stroke.
              <br />
              <span className="cta-title-italic font-[var(--font-serif)] italic font-normal">
                The room will follow.
              </span>
            </h2>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <p className="cta-subtitle mx-auto mt-6 max-w-md text-base leading-relaxed">
            Create an account, open a room, and hand the link to whoever draws
            with you. That&apos;s the whole tutorial.
          </p>
        </Reveal>

        <Reveal delay={320}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/new-room" className="btn btn-marker !px-6 !py-3">
              Name a room
            </Link>
            <Link
              href="/signin"
              className="btn cta-btn-secondary !px-6 !py-3 border font-semibold transition-all"
            >
              I have a room
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}