"use client";

import { useEffect, useRef, useState } from "react";

export function SketchRing() {
  const ref = useRef<SVGSVGElement>(null);
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
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className={`sketch-ring ${on ? "is-on" : ""}`}
      viewBox="0 0 100 60"
      fill="none"
      preserveAspectRatio="none"
    >
      <path d="M 8 30 C 10 15, 30 8, 50 9 C 72 10, 92 18, 92 30 C 92 44, 72 52, 50 51 C 28 50, 11 42, 9 34" />
    </svg>
  );
}