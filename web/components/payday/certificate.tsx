import { tokens, usd } from "@/lib/shared/format";

/** Round seal: 36 ticks and the ticker. Generated, not drawn. */
function Seal({ ticker }: { ticker: string }) {
  const ticks = Array.from({ length: 36 }, (_, i) => {
    const a = (i * 10 * Math.PI) / 180;
    const [x1, y1, x2, y2] = [50 + 40 * Math.sin(a), 50 - 40 * Math.cos(a), 50 + 46 * Math.sin(a), 50 - 46 * Math.cos(a)];
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <svg viewBox="0 0 100 100" aria-hidden className="size-16 shrink-0 text-ochre md:size-20" fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="50" cy="50" r="38" />
      <circle cx="50" cy="50" r="31" strokeWidth="0.6" />
      {ticks}
      <text x="50" y="54" textAnchor="middle" fontSize="13" fontWeight="700" stroke="none" fill="currentColor" className="font-mono">
        {ticker.slice(0, 5)}
      </text>
    </svg>
  );
}

/**
 * One token drawn as the share certificate it behaves like. The bar is the share count, to scale:
 * the hatched block is the baseline share, the ochre sliver is the dividend folded into the multiplier.
 */
export function Certificate({
  company,
  symbol,
  ticker,
  multiplier,
  baseline,
  stockUsd,
}: {
  company: string | null;
  symbol: string;
  ticker: string;
  multiplier: number;
  baseline: number;
  /** Price of one share, so the sliver can be labelled in dollars. Null leaves the dollar label off. */
  stockUsd: number | null;
}) {
  const sliver = multiplier - baseline;
  const baseShare = (baseline / multiplier) * 100;
  const sliverShare = (sliver / multiplier) * 100;
  // A sliver under ~8% of the bar is hard to see, so the last few percent are drawn again, magnified.
  const zoom = sliverShare < 8 ? Number(Math.min(25, Math.max(0.5, sliverShare * 4)).toPrecision(2)) : null;
  return (
    <figure className="cert p-6 md:p-8" aria-label={`One ${symbol} token stands for ${multiplier.toFixed(5)} shares`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Share certificate</p>
          <p className="mt-3 text-[0.9375rem] text-ink-2">One {symbol} token stands for</p>
          <p className="amount mt-1 text-[2.75rem] font-normal leading-none tracking-[-0.02em] md:text-[3.5rem]">{multiplier.toFixed(5)}</p>
          <p className="mt-2 font-serif text-[1.125rem] leading-snug md:text-[1.25rem]">shares of {company ?? ticker}</p>
        </div>
        <Seal ticker={ticker} />
      </div>

      <div className="mt-7">
        <div className="relative">
          <div className="cert-bar" style={{ gridTemplateColumns: `${baseShare}fr minmax(3px, ${sliverShare}fr)` }} role="img" aria-label={`${tokens(baseline)} baseline share plus ${tokens(sliver)} of a share from dividends`}>
            <span className="cert-base" />
            <span className="cert-sliver" />
          </div>
          {zoom !== null && <span aria-hidden className="absolute -inset-y-1 right-0 border-2 border-ochre" style={{ width: `max(${zoom}%, 6px)` }} />}
        </div>
        <div className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-[0.8125rem]">
          <span className="text-ink-2">{tokens(baseline)} the share it always was</span>
          <span className="font-bold text-ochre">
            +{sliver.toFixed(5)} from dividends{stockUsd !== null && `, worth ${usd(sliver * stockUsd)} per token`}
          </span>
        </div>
        {zoom !== null && (
          <div className="mt-4 ml-auto w-full max-w-[17rem]">
            <p className="font-mono text-[0.75rem] text-ink-2">
              Inset: the last {zoom}% of the bar, magnified {Math.round(100 / zoom)} times
            </p>
            <div
              className="cert-bar mt-1.5 border-2 border-ochre"
              style={{ gridTemplateColumns: `${Math.max(zoom - sliverShare, 0)}fr ${Math.min(sliverShare, zoom)}fr` }}
              role="img"
              aria-label={`Magnified view of the last ${zoom} percent of the bar, where the dividend sliver sits`}
            >
              <span className="cert-base" />
              <span className="cert-sliver" />
            </div>
          </div>
        )}
      </div>
      <figcaption className="mt-5 text-[0.8125rem] text-ink-3">
        Drawn to scale from the live share rate.{zoom !== null && " Only the inset is magnified."}
      </figcaption>
    </figure>
  );
}
