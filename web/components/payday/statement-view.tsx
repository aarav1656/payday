import Link from "next/link";
import { getAddress } from "viem";
import { BadAddress, buildStatement, EXAMPLE_ADDRESS, type HoldingLine } from "@/lib/payday";
import { MIN_CASHOUT_USD } from "@/lib/cashout-rules";
import { tokens, usd, utcDate, utcTime } from "@/lib/shared/format";
import { Note } from "./bits";
import { Certificate } from "./certificate";
import { CashOut } from "./cash-out";

const DUST_USD = 1;

export async function StatementView({ address }: { address: string }) {
  let st;
  try {
    st = await buildStatement(address);
  } catch (e) {
    if (e instanceof BadAddress) return <Note tone="stop">{e.message}</Note>;
    console.error("statement", e);
    return <Note tone="stop">The chain or Binance&apos;s token list did not answer. Reload in a moment; nothing was changed.</Note>;
  }

  const payTo = getAddress(st.address);
  const lineCount = `${st.holdings.length} ${st.holdings.length === 1 ? "line" : "lines"}`;
  const header = (
    <header>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-serif text-[1.75rem] font-medium leading-none">Payday</p>
        <p className="label">Earnings statement</p>
      </div>
      <dl className="fig mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-[0.875rem]">
        <Field term="Read at" value={`${utcTime(st.asOf)} UTC`} />
        <Field term="Block" value={st.block.toLocaleString("en-US")} />
        <Field term="Tokens checked" value={`${st.scanned} Ondo`} />
        <div>
          <dt className="label">Address</dt>
          <dd>
            <a href={`https://bscscan.com/address/${payTo}`} target="_blank" rel="noreferrer" title={payTo} className="font-bold underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
              {payTo.slice(0, 6)}…{payTo.slice(-4)}
            </a>
          </dd>
        </div>
      </dl>
      <div className="mt-7 border-t-2 border-ink pt-5">
        <p className="label text-ink">Dividends earned, not yet cashed</p>
        <p className="amount mt-1 text-[3.5rem] font-medium leading-none md:text-[4rem]">{usd(st.totalUsd)}</p>
        <p className="mt-3 text-[0.8125rem] text-ink-3">
          At today&apos;s stock prices{st.holdings.length > 0 ? `, across ${lineCount}` : ""}.
        </p>
      </div>
    </header>
  );

  if (st.holdings.length === 0) {
    return (
      <article className="panel" aria-labelledby="empty">
        <div className="px-6 py-8 md:px-9">
          {header}
          <div className="mt-8 border-t border-ink pt-8">
            <h2 id="empty" className="max-w-[20ch] text-[2rem] font-normal leading-tight">
              Nothing was paid to this address.
            </h2>
            <p className="mt-3 max-w-[52ch] text-ink-2">
              Payday checked all {st.scanned} Ondo tokens on BNB Chain and this address holds none of them. Dividends accrue only to Ondo
              tokens, whose symbols end in <span className="fig">on</span>, like <span className="fig">KOon</span>. Paste the address
              that holds yours, or open a live statement to see how one reads.
            </p>
            <Link href={`/?address=${EXAMPLE_ADDRESS}`} className="mt-3 inline-flex min-h-11 items-center font-bold text-ochre underline underline-offset-4">
              Open the FXIon pool&apos;s statement
            </Link>
          </div>
        </div>
      </article>
    );
  }

  const top = st.holdings[0];
  const shown = st.holdings.filter((h) => h.accruedUsd >= DUST_USD);
  const rest = st.holdings.filter((h) => h.accruedUsd < DUST_USD);
  const restTotal = rest.reduce((sum, h) => sum + h.accruedUsd, 0);

  return (
    <article className="panel" aria-labelledby="stmt">
      <div className="px-6 py-8 md:px-9">
        {header}
        <h2 id="stmt" className="sr-only">Earnings</h2>

        {top.status === "earning" && (
          <div className="mt-8">
            <Certificate company={top.company} symbol={top.symbol} ticker={top.ticker} multiplier={top.multiplier} baseline={top.baseline} stockUsd={top.stockUsd} since={sinceOf(top)} />
          </div>
        )}

<p className="label mt-8 border-b border-ink pb-2">Earnings</p>

        <div className="border-b-2 border-ink">
        <ol className="divide-y divide-rule">
          {shown.map((h) => (
            <Line key={h.address} h={h} address={payTo} asOf={st.asOf} />
          ))}
        </ol>
        {rest.length > 0 && (
          <details className="group border-t border-rule">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 [&::-webkit-details-marker]:hidden">
              <span className="font-mono text-[0.875rem] font-bold text-ochre underline underline-offset-4">
                {rest.length} smaller {rest.length === 1 ? "line" : "lines"} under {usd(DUST_USD, 0)}
              </span>
              <span className="fig text-[0.9375rem] font-bold">{usd(restTotal)}</span>
            </summary>
            <ol className="divide-y divide-rule">
              {rest.map((h) => (
                <Line key={h.address} h={h} address={payTo} asOf={st.asOf} />
              ))}
            </ol>
          </details>
        )}
        </div>

      </div>
    </article>
  );
}

function Field({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="label">{term}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

const sinceOf = (h: HoldingLine) => (h.baselineSource === "launch" || h.baselineAt === null ? "launch" : utcDate(h.baselineAt));

function period(h: HoldingLine, asOf: number) {
  return `${sinceOf(h) === "launch" ? "launch" : sinceOf(h)} to ${utcDate(asOf)}`;
}

function sentence(h: HoldingLine) {
  if (h.status !== "earning") return h.sentence;
  const who = h.company ?? h.ticker;
  return `${tokens(h.tokens)} ${h.symbol} now stand for ${tokens(h.tokens * h.multiplier)} shares of ${who}. ${tokens(h.accruedShares)} of those shares arrived as dividends over the pay period, worth ${usd(h.accruedUsd)} at ${h.stockUsd === null ? "today's price" : usd(h.stockUsd) + " a share"}.`;
}

function Line({ h, address, asOf }: { h: HoldingLine; address: string; asOf: number }) {
  return (
    <li className="py-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-serif text-[1.25rem] font-medium leading-tight">{h.company ?? h.ticker}</span>
        <StatusChip status={h.status} />
      </p>
      <p className="fig mt-1 text-[0.8125rem] text-ink-3">
        {h.symbol} · {tokens(h.tokens)} held
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-x-4">
        <Cell term="Shares earned" value={tokens(h.accruedShares)} />
        <Cell term="Price per share" value={h.stockUsd === null ? "n/a" : usd(h.stockUsd)} />
        <Cell term="Amount" value={usd(h.accruedUsd)} strong />
      </dl>
      <p className="mt-3 max-w-[52ch] text-[0.9375rem] text-ink-2">{sentence(h)}</p>
      <p className="fig mt-2 text-[0.75rem] text-ink-3">Pay period: {period(h, asOf)}</p>
      {h.status === "earning" && h.payoutTokens > 0 && h.accruedUsd < MIN_CASHOUT_USD && (
        <p className="mt-4 text-[0.875rem] text-ink-3">Below the {usd(MIN_CASHOUT_USD, 0)} minimum. It keeps accruing.</p>
      )}
      {h.status === "earning" && h.payoutTokens > 0 && h.accruedUsd >= MIN_CASHOUT_USD && (
        <CashOut address={address} symbol={h.symbol} sellTokens={h.payoutTokens} accruedUsd={h.accruedUsd} accruedShares={h.accruedShares} multiplier={h.multiplier} />
      )}
    </li>
  );
}

const CHIP: Record<HoldingLine["status"], { text: string; cls: string }> = {
  earning: { text: "Earning", cls: "border-ok/60 text-ok" },
  waiting: { text: "Waiting", cls: "border-rule-strong text-ink-3" },
  adjusted: { text: "Adjusted", cls: "border-warn/60 text-warn" },
  split: { text: "Split", cls: "border-warn/60 text-warn" },
};

function StatusChip({ status }: { status: HoldingLine["status"] }) {
  const c = CHIP[status];
  return <span className={`fig inline-flex h-6 items-center rounded-full border px-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${c.cls}`}>{c.text}</span>;
}

function Cell({ term, value, strong = false }: { term: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "text-right" : undefined}>
      <dt className="label">{term}</dt>
      <dd className={`fig mt-1 ${strong ? "amount text-[1.375rem] leading-none" : "text-[0.9375rem]"}`}>{value}</dd>
    </div>
  );
}
