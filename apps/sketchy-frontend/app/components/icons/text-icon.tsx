"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const TextIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        ".text-bar",
        { scaleY: [1, 1.25, 1] },
        { duration: 0.3, ease: "easeInOut" }
      );
    }, [animate]);

    const stop = useCallback(async () => {
      animate(".text-bar", { scaleY: 1 }, { duration: 0.2, ease: "easeOut" });
    }, [animate]);

    useImperativeHandle(ref, () => ({
      startAnimation: start,
      stopAnimation: stop,
    }));

    return (
      <motion.svg
        ref={scope}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cursor-pointer ${className}`}
        onHoverStart={start}
        onHoverEnd={stop}
      >
        <motion.polyline points="4 7 4 4 20 4 20 7" />
        <motion.line x1="9" y1="20" x2="15" y2="20" />
        <motion.line x1="12" y1="4" x2="12" y2="20" className="text-bar" />
      </motion.svg>
    );
  }
);

TextIcon.displayName = "TextIcon";
export default TextIcon;
