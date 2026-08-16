import { ReactNode } from "react";

export function IconButton({
  icon,
  label,
  onClick,
  activated,
  tone = "light",
  badge,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  activated: boolean;
  tone?: "light" | "dark";
  badge?: ReactNode;
}) {
  const activeStyle =
    "border-indigo-500/70 bg-indigo-600/90 text-white shadow-[0_4px_20px_-2px_rgba(79,70,229,0.65)] scale-[1.03] ring-1 ring-indigo-400/50";
  const idleStyle =
    tone === "dark"
      ? "border-white/10 bg-white/5 text-white/75 hover:bg-white/12 hover:border-white/25 hover:text-white active:scale-95"
      : "border-transparent bg-black/5 text-slate-800 hover:bg-black/10 active:scale-95";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={activated}
      title={label}
      onClick={onClick}
      className={`relative flex items-center justify-center shrink-0 cursor-pointer rounded-xl border min-w-[42px] min-h-[42px] p-2 sm:p-2.5 transition-all duration-150 ease-out select-none touch-manipulation ${
        activated ? activeStyle : idleStyle
      }`}
    >
      {icon}
      {badge}
    </button>
  );
}