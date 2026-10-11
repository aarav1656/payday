import { tokens } from "@/lib/shared/format";

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
}: {
  company: string | null;
  symbol: string;
  ticker: string;
  multiplier: number;
  baseline: number;
}) {
  const sliver = multiplier - baseline;
  const baseShare = (baseline / multiplier) * 100;
  const sliverShare = (sliver / multiplier) * 100;
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
        <div className="cert-bar" style={{ gridTemplateColumns: `${baseShare}fr minmax(3px, ${sliverShare}fr)` }} role="img" aria-label={`${tokens(baseline)} baseline share plus ${tokens(sliver)} of a share from dividends`}>
          <span className="cert-base" />
          <span className="cert-sliver" />
        </div>
        <div className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1 font-mono text-[0.8125rem]">
          <span className="text-ink-2">{tokens(baseline)} the share it always was</span>
          <span className="font-bold text-ochre">+{sliver.toFixed(5)} from dividends</span>
        </div>
      </div>
      <figcaption className="mt-5 text-[0.8125rem] text-ink-3">Drawn to scale from the live share rate.</figcaption>
    </figure>
  );
}
