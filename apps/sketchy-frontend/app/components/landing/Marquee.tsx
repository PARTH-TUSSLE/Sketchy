const items = [
  "room /board-ride",
  "room /ink-sprint",
  "room /tuple",
  "room /25-stroke",
  "room /moving-bigger",
  "room /oh-eh",
];

function Row() {
  return (
    <>
      {items.map((i) => (
        <span key={i} className="flex shrink-0 items-center gap-10">
          <span className="font-[var(--font-serif)] text-2xl italic text-ink/80">
            {i}
          </span>
          <span className="h-[7px] w-[7px] rounded-full border border-ink/30" />
        </span>
      ))}
    </>
  );
}

export function Marquee() {
  return (
    <div className="marquee hairline-b hairline-t relative overflow-hidden border-line bg-paper py-6">
      <div className="marquee-track flex w-max items-center gap-10">
        <Row />
        <Row />
      </div>
    </div>
  );
}