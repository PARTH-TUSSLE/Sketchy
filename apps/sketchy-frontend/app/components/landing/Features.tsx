import { Reveal } from "./Reveal";
import { Monitor, KeyRound, MemoryStick, Gauge } from "lucide-react";

const features = [
  {
    icon: Monitor,
    title: "A canvas you don't own",
    body: "There's no 'my board'. A room is a shared plane — anyone in it can draw, and everyone sees the same page.",
  },
  {
    icon: Gauge,
    title: "Real-time, genuinely",
    body: "WebSocket under the hood. Shapes broadcast the moment they're drawn, so a pen stroke reads like it's happening now — because it is.",
  },
  {
    icon: MemoryStick,
    title: "Boards that remember",
    body: "Shapes persist with the room. Close the tab, come back tomorrow, and the sketch is still there waiting for you.",
  },
  {
    icon: KeyRound,
    title: "Rooms behind a sign-in",
    body: "A room is only as open as you want it to be. Sign in, pick a room, and the door stays locked to the list.",
  },
];

export function Features() {
  return (
    <section id="rooms" className="hairline-t relative overflow-hidden bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="anno mb-4">spec sheet</p>
              <h2 className="text-[clamp(2rem,4.5vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
                Built like the
                <br />
                tool it{" "}
                <span className="font-[var(--font-serif)] italic font-normal">
                  replaces
                </span>
              </h2>
              <p className="mt-6 max-w-sm text-[17px] leading-relaxed text-inksoft">
                A whiteboard has one job: let everyone think out loud in front
                of each other. Sketchy does that and refuses to get in the way.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 70}>
                  <div className="group card h-full p-6 transition-all duration-300 hover:border-ink/40">
                    <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink transition-colors duration-300 group-hover:text-marker">
                      <Icon size={18} strokeWidth={1.6} />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed text-inksoft">
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}