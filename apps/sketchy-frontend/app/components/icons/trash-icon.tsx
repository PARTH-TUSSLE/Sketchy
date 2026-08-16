"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const TrashIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        ".trash-lid",
        { y: -3, rotate: -15 },
        { duration: 0.25, ease: "easeOut" }
      );
    }, [animate]);

    const stop = useCallback(async () => {
      animate(
        ".trash-lid",
        { y: 0, rotate: 0 },
        { duration: 0.2, ease: "easeInOut" }
      );
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
        <motion.path d="M3 6h18" className="trash-lid" />
        <motion.path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <motion.path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" className="trash-lid" />
        <motion.line x1="10" y1="11" x2="10" y2="17" />
        <motion.line x1="14" y1="11" x2="14" y2="17" />
      </motion.svg>
    );
  }
);

TrashIcon.displayName = "TrashIcon";
export default TrashIcon;
