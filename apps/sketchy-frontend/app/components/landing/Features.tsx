import { Reveal } from "./Reveal";
import { Monitor, KeyRound, MemoryStick, Gauge } from "lucide-react";

const features = [
  {
    icon: Monitor,
    tag: "shared-plane",
    title: "A canvas you don't own",
    body: "There's no 'my board'. A room is a shared plane — anyone in it can draw, and everyone sees the same page.",
  },
  {
    icon: Gauge,
    tag: "instant-wire",
    title: "Real-time, genuinely",
    body: "WebSocket under the hood. Shapes broadcast the moment they're drawn, so a pen stroke reads like it's happening now — because it is.",
  },
  {
    icon: MemoryStick,
    tag: "persistent",
    title: "Boards that remember",
    body: "Shapes persist with the room. Close the tab, come back tomorrow, and the sketch is still there waiting for you.",
  },
  {
    icon: KeyRound,
    tag: "private-door",
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
              <p className="anno mb-3">spec sheet</p>
              <h2 className="text-[clamp(2.2rem,4.5vw,3.5rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
                Built like the
                <br />
                tool it{" "}
                <span className="font-[var(--font-serif)] italic font-normal text-ink/90">
                  replaces
                </span>
              </h2>
              <p className="mt-6 max-w-sm text-[16.5px] leading-relaxed text-inksoft">
                A whiteboard has one job: let everyone think out loud in front
                of each other. Sketchy does that and refuses to get in the way.
              </p>
              <p className="anno mt-8 text-[10px] text-inkfaint">
                04 specs · 01 whiteboard · ∞ rooms
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 70}>
                  <article className="group card flex h-full flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/40 hover:shadow-lg hover:shadow-ink/4">
                    <div className="flex items-center justify-between">
                      <span className="anno text-[10px] text-inkfaint">
                        ref {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-inkfaint/70 transition-colors group-hover:text-marker">
                        {f.tag}
                      </span>
                    </div>
                    <div className="mt-6 mb-7 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-paper text-ink transition-all duration-300 group-hover:border-marker group-hover:bg-marker group-hover:text-white shadow-xs">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-ink">
                      {f.title}
                    </h3>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed text-inksoft">
                      {f.body}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}