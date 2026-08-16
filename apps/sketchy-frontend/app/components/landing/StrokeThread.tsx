"use client";

import { useEffect, useRef, useState } from "react";

export function StrokeThread() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            setOn(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-[3.4rem] hidden md:block"
    >
      <div className={`stroke-thread-line ${on ? "is-on" : ""}`}>
        <span className="stroke-thread-dot" />
      </div>
    </div>
  );
}