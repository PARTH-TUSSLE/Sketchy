"use client";
import { forwardRef, useImperativeHandle, useCallback } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "./types";
import { motion, useAnimate } from "motion/react";

const ImageIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  (
    { size = 20, color = "currentColor", strokeWidth = 2, className = "" },
    ref,
  ) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      animate(
        ".sun",
        { y: -1.5, scale: 1.2 },
        { duration: 0.3, ease: "easeOut" }
      );
    }, [animate]);

    const stop = useCallback(async () => {
      animate(
        ".sun",
        { y: 0, scale: 1 },
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
        <motion.rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <motion.circle cx="8.5" cy="8.5" r="1.5" className="sun" />
        <motion.polyline points="21 15 16 10 5 21" />
      </motion.svg>
    );
  }
);

ImageIcon.displayName = "ImageIcon";
export default ImageIcon;
