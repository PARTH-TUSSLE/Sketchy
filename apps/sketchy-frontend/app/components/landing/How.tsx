import { Reveal } from "./Reveal";
import { StrokeThread } from "./StrokeThread";
import { Pencil, MousePointerClick, Users } from "lucide-react";

const steps = [
  {
    icon: Pencil,
    n: "01",
    title: "Pick up a tool",
    body: "Pencil, rectangle, circle — a handful of honest shapes. That's the whole palette, on purpose.",
  },
  {
    icon: MousePointerClick,
    n: "02",
    title: "Sketch on the same plane",
    body: "You draw on a canvas that isn't yours. It's the room's. Coordinates, not layers — everyone's strokes live in the same place.",
  },
  {
    icon: Users,
    n: "03",
    title: "Everyone watching, instantly",
    body: "A stroke is as seen by the room, sent, and painted on every other screen. The latency is a blink of an eye.",
  },
];

export function How() {
  return (
    <section id="how" className="hairline-t relative bg-paper py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="anno mb-3">the three-stroke rule</p>
          <h2 className="max-w-2xl text-[clamp(2.2rem,4.5vw,3.5rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
            A room is three things,
            <br />
            <span className="font-[var(--font-serif)] italic font-normal text-ink/90">
              drawn
            </span>{" "}
            in order
          </h2>
        </Reveal>

        <div className="relative mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StrokeThread />
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.n} delay={i * 90} className="h-full">
                <article className="group flex h-full flex-col rounded-2xl border border-line bg-paper-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-ink/40 hover:shadow-lg hover:shadow-ink/4">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper text-ink transition-all duration-300 group-hover:border-marker group-hover:bg-marker group-hover:text-white shadow-xs">
                      <Icon size={19} strokeWidth={1.75} />
                    </div>
                    <span className="font-[var(--font-serif)] text-2xl italic text-inkfaint transition-colors group-hover:text-marker">
                      {s.n}
                    </span>
                  </div>
                  <div className="mt-9">
                    <h3 className="text-xl font-semibold tracking-tight text-ink">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-[14.5px] leading-relaxed text-inksoft">
                      {s.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}