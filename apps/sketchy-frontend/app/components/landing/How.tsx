import { Reveal } from "./Reveal";
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
    <section id="how" className="hairline-t relative bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <Reveal>
          <p className="anno mb-4">the three-stroke rule</p>
          <h2 className="max-w-2xl text-[clamp(2rem,4.5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
            A room is three things,
            <br />
            <span className="font-[var(--font-serif)] italic font-normal">
              drawn
            </span>{" "}
            in order
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.n} delay={i * 90} className="h-full">
                <div className="group flex h-full flex-col justify-between gap-10 bg-paper p-8 transition-colors duration-300 hover:bg-paper-2">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-paper text-ink transition-all duration-300 group-hover:border-marker group-hover:text-marker">
                      <Icon size={19} strokeWidth={1.6} />
                    </div>
                    <span className="font-[var(--font-serif)] text-xl italic text-inkfaint">
                      {s.n}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-inksoft">
                      {s.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}