"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const HandIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        scope.current,
        { scale: 0.9, y: 1 },
        { duration: 0.2, ease: "easeOut" }
      );
    }, [animate, scope]);

    const stop = useCallback(async () => {
      animate(
        scope.current,
        { scale: 1, y: 0 },
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
        <motion.path d="M18 11V6a2 2 0 0 0-4 0v5" />
        <motion.path d="M14 10V4a2 2 0 0 0-4 0v6" />
        <motion.path d="M10 10.5V6a2 2 0 0 0-4 0v9" />
        <motion.path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </motion.svg>
    );
  }
);

HandIcon.displayName = "HandIcon";
export default HandIcon;
