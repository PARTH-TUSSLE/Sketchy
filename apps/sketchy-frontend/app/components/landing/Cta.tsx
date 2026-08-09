import Link from "next/link";
import { Reveal } from "./Reveal";

export function Cta() {
  return (
    <section className="hairline-t relative overflow-hidden bg-ink text-paper">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(var(--paper) 1px, transparent 1px), linear-gradient(90deg, var(--paper) 1px, transparent 1px)",
          backgroundSize: "clamp(3rem,8vw,6rem) clamp(3rem,8vw,6rem)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-28 text-center lg:py-36">
        <Reveal>
          <p className="anno mb-6 inline-flex items-center gap-2 text-paper/60">
            <span className="live-dot h-2 w-2 rounded-full bg-marker" />
            the board is open
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mx-auto max-w-3xl text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            Make the first stroke.
            <br />
            <span className="font-[var(--font-serif)] italic font-normal text-paper/90">
              The room will follow.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-paper/60">
            Create an account, open a room, and hand the link to whoever draws
            with you. That&apos;s the whole tutorial.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/new-room" className="btn btn-marker">
              Name a room
            </Link>
            <Link href="/signin" className="btn btn-paper !border-paper/25 !text-paper hover:!border-paper/60">
              I have a room
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}