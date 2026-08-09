import { ReactNode } from "react";

export function IconButton({
  icon,
  label,
  onClick,
  activated,
  tone = "light",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  activated: boolean;
  tone?: "light" | "dark";
}) {
  const activeStyle =
    "border-marker bg-marker text-white shadow-[0_6px_16px_-6px_rgba(58,63,242,0.7)]";
  const idleStyle =
    tone === "dark"
      ? "border-white/10 bg-white/5 text-paper/70 hover:bg-white/10 hover:text-paper"
      : "border-transparent bg-ink/5 text-ink hover:bg-ink/10";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={activated}
      title={label}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border p-2.5 transition-all duration-150 ${
        activated ? activeStyle : idleStyle
      }`}
    >
      {icon}
    </button>
  );
}