"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const SelectIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        scope.current,
        { scale: 1.15, x: 2, y: -2 },
        { duration: 0.2, ease: "easeOut" }
      );
    }, [animate, scope]);

    const stop = useCallback(async () => {
      animate(
        scope.current,
        { scale: 1, x: 0, y: 0 },
        { duration: 0.2, ease: "easeInOut" }
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
        <motion.path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <motion.path d="M13 13l6 6" />
      </motion.svg>
    );
  }
);

SelectIcon.displayName = "SelectIcon";
export default SelectIcon;
