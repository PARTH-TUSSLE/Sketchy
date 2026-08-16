const rooms = [
  { slug: "/ink-sprint", n: 3 },
  { slug: "/tuple", n: 2 },
  { slug: "/25-stroke", n: 5 },
  { slug: "/oh-eh", n: 2 },
  { slug: "/board-ride", n: 4 },
  { slug: "/moving-bigger", n: 1 },
  { slug: "/late-night", n: 6 },
  { slug: "/red-herring", n: 2 },
];

function Row() {
  return (
    <>
      {rooms.map((r, i) => (
        <span key={`${r.slug}-${i}`} className="flex shrink-0 items-center gap-6 sm:gap-8">
          <span className="group flex items-center gap-2.5 transition-colors hover:text-marker">
            <span className="live-dot h-[5px] w-[5px] rounded-full bg-marker/70" />
            <span className="font-[var(--font-serif)] text-xl italic text-ink/75 transition-colors group-hover:text-marker sm:text-2xl">
              {r.slug}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-inkfaint transition-colors group-hover:text-inksoft">
              · {r.n} online
            </span>
          </span>
          <span className="h-[5px] w-[5px] rounded-full bg-marker/25" />
        </span>
      ))}
    </>
  );
}

export function Marquee() {
  return (
    <div className="marquee hairline-b hairline-t relative overflow-hidden border-line bg-paper py-5 select-none">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 pb-2.5">
        <span className="anno text-[10px] text-inkfaint">rooms open right now</span>
        <span className="anno hidden text-[10px] text-inkfaint sm:block">flowing left → right</span>
      </div>
      <div className="marquee-track flex w-max items-center gap-6 sm:gap-8">
        <Row />
        <Row />
      </div>
    </div>
  );
}