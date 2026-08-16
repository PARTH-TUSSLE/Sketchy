"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const LaserIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        scope.current,
        { rotate: 90 },
        { duration: 0.35, ease: "easeInOut" }
      );
    }, [animate, scope]);

    const stop = useCallback(async () => {
      animate(
        scope.current,
        { rotate: 0 },
        { duration: 0.25, ease: "easeInOut" }
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
        <motion.circle cx="12" cy="12" r="10" />
        <motion.line x1="22" y1="12" x2="18" y2="12" />
        <motion.line x1="6" y1="12" x2="2" y2="12" />
        <motion.line x1="12" y1="6" x2="12" y2="2" />
        <motion.line x1="12" y1="22" x2="12" y2="18" />
      </motion.svg>
    );
  }
);

LaserIcon.displayName = "LaserIcon";
export default LaserIcon;
