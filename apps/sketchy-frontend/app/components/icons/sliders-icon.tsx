"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const SlidersIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        ".slider-top",
        { x: [0, 4, 0] },
        { duration: 0.35, ease: "easeInOut" }
      );
      animate(
        ".slider-bot",
        { x: [0, -4, 0] },
        { duration: 0.35, ease: "easeInOut" }
      );
    }, [animate]);

    const stop = useCallback(async () => {
      animate(".slider-top, .slider-bot", { x: 0 }, { duration: 0.2, ease: "easeOut" });
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
        <motion.line x1="21" y1="4" x2="14" y2="4" />
        <motion.line x1="10" y1="4" x2="3" y2="4" />
        <motion.line x1="21" y1="12" x2="12" y2="12" />
        <motion.line x1="8" y1="12" x2="3" y2="12" />
        <motion.line x1="21" y1="20" x2="16" y2="20" />
        <motion.line x1="12" y1="20" x2="3" y2="20" />
        <motion.line x1="14" y1="2" x2="14" y2="6" className="slider-top" />
        <motion.line x1="8" y1="10" x2="8" y2="14" className="slider-bot" />
        <motion.line x1="16" y1="18" x2="16" y2="22" className="slider-top" />
      </motion.svg>
    );
  }
);

SlidersIcon.displayName = "SlidersIcon";
export default SlidersIcon;
