import { ReactNode } from "react";

export function IconButton ( {
  icon, onClick, activated
}: {
  icon: ReactNode,
  onClick: () => void,
  activated: boolean
} ) {
  return (
    
      <button className={`pointer rounded-xl p-2 text-white hover:bg-neutral-700 ${activated? "bg-neutral-700": ""} `} onClick={onClick}>
        {icon}
      </button>
    
  );
}