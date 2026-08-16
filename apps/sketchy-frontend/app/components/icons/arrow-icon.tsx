"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const ArrowIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        scope.current,
        { x: [0, 2, 0], y: [0, -2, 0] },
        { duration: 0.35, ease: "easeInOut" }
      );
    }, [animate, scope]);

    const stop = useCallback(async () => {
      animate(
        scope.current,
        { x: 0, y: 0 },
        { duration: 0.2, ease: "easeOut" }
      );
    }, [animate, scope]);

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
        <motion.line x1="7" y1="17" x2="17" y2="7" />
        <motion.polyline points="7 7 17 7 17 17" />
      </motion.svg>
    );
  }
);

ArrowIcon.displayName = "ArrowIcon";
export default ArrowIcon;
