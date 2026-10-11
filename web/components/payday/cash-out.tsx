"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { refuseCashOut } from "@/lib/cashout-rules";
import { tokens, utcTime } from "@/lib/shared/format";
import type { CashOutQuote } from "@/lib/payday";
import { Note } from "./bits";
import { WalletSign, type Settle } from "./wallet-sign";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; quote: CashOutQuote };

/** "Mon 12 Oct, 15:30" in the reader's own time zone. */
const localTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function CashOut({
  address, symbol, sellTokens, stub, accruedUsd, accruedShares, multiplier,
}: { address: string; symbol: string; sellTokens: number; stub: string; accruedUsd: number; accruedShares: number; multiplier: number }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/cashout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, symbol }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setState({ kind: "done", quote: body as CashOutQuote });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "The dry run failed." });
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button onClick={run} disabled={state.kind === "loading"} size="sm" aria-describedby={`dry-${symbol}`}>
          {state.kind === "loading"
            ? "Writing the cheque"
            : state.kind === "done" && state.quote.blocked
              ? state.quote.market.nextOpenTime
                ? `Ask again at ${localTime(state.quote.market.nextOpenTime)}`
                : "Ask again later"
              : state.kind === "done"
                ? "Cash again"
                : "Cash this cheque"}
        </Button>
        <span id={`dry-${symbol}`} className="text-[0.8125rem] text-ink-3">
          Sells only the {tokens(sellTokens)} {symbol} tokens that carry the dividend.
          {tokens(sellTokens) !== tokens(accruedShares) &&
            ` The ${tokens(accruedShares)} shares earned are a bit more than that, because each token stands for ${multiplier.toFixed(5)} shares.`}{" "}
          Nothing is signed until you confirm in your wallet.
        </span>
      </div>
      <div aria-live="polite" className="mt-5 empty:hidden">
        {state.kind === "error" && <Note tone="stop">{state.message}</Note>}
        {state.kind === "done" && <Cheque q={state.quote} address={address} stub={stub} symbol={symbol} accruedUsd={accruedUsd} />}
      </div>
    </div>
  );
}

/** The dry-run quote printed as a cheque. A refused quote prints VOID with the reason Binance gave. */
export function Cheque({ q, address, stub, symbol, accruedUsd }: { q: CashOutQuote; address: string; stub: string; symbol: string; accruedUsd: number }) {
  const [settle, setSettle] = useState<Settle>({ kind: "none" });
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const void_ = q.blocked !== null;
  const sim = q.simulation;
  const refusal = void_ ? null : refuseCashOut({ statementAddress: address, connected: address, notionalUsd: Math.max(accruedUsd, q.expectUsdt ?? 0) });
  return (
    <figure className="cheque relative grid overflow-hidden md:grid-cols-[minmax(0,1fr)_11rem]" aria-label={void_ ? "Void cheque" : "Cheque"}>
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="label">Payday cheque · quote</p>
          <p className="fig text-[0.8125rem] text-ink-2">No. {stub} · {utcTime(q.at)} UTC</p>
        </div>

        <p className="label mt-5">Pay to the order of</p>
        <p className="fig mt-1 break-all text-[0.9375rem] font-bold">{short}</p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="label">Memo</p>
            <p className="fig mt-1 text-[0.8125rem] text-ink-2">Dividend on {tokens(q.sellTokens)} {q.symbol}</p>
          </div>
          {void_ ? (
            <p className="label shrink-0 border-2 border-stop px-3 py-2.5 text-stop">No quote</p>
          ) : (
            <p className="amount shrink-0 border-2 border-ink px-3 py-1.5 text-[1.75rem] leading-none md:text-[2rem]">
              {q.expectUsdt?.toFixed(2)} <span className="fig text-[0.8125rem] font-bold tracking-wide">USDT</span>
            </p>
          )}
        </div>

        {void_ ? (
          <div className="mt-5 flex flex-wrap items-start gap-4">
            <p className="void-mark label px-3 py-1 text-[1rem] tracking-[0.25em]">Void</p>
            <div className="min-w-0 flex-1 basis-56 space-y-1.5 text-[0.875rem] text-ink-2">
              <p className="font-medium text-ink">{q.blocked!.message}</p>
              <p>
                Market is {q.market.state ?? "closed"}
                {q.market.reason ? ` (${q.market.reason})` : ""}.
                {q.market.nextOpenTime ? ` Next open ${utcTime(q.market.nextOpenTime)} UTC.` : ""} Ask again then. No transaction was signed.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 border-t border-rule-strong pt-3 text-[0.875rem] text-ink-2">
            <p className="flex gap-2">
              <span className="label shrink-0 pt-0.5">Simulation</span>
              <span className={sim.ok === false ? "text-stop" : sim.ok === true ? "text-ok" : undefined}>
                {sim.ok === true ? "Passed. " : sim.ok === false ? "Failed. " : ""}
                {sim.detail}
              </span>
            </p>
            {refusal ? (
              <div className="mt-3">
                <Note tone="stop">{refusal}</Note>
              </div>
            ) : (
              <>
                <WalletSign address={address} symbol={symbol} onSettle={setSettle} disabled={settle.kind === "done" || sim.ok === false} />
                <div aria-live="polite" className="mt-3 empty:hidden">
                  {settle.kind === "working" && <Note tone="plain">{settle.text}</Note>}
                  {settle.kind === "failed" && <Note tone="stop">{settle.message}</Note>}
                  {settle.kind === "done" && (
                    <Note tone="ok">
                      Paid. {settle.orderId ? `Order ${settle.orderId} filled. ` : ""}
                      {settle.txHash ? (
                        <a className="fig break-all font-bold underline underline-offset-4" href={`https://bscscan.com/tx/${settle.txHash}`} target="_blank" rel="noreferrer">
                          {settle.txHash.slice(0, 10)}…{settle.txHash.slice(-6)} on BscScan
                        </a>
                      ) : (
                        "Binance has not published the transaction hash yet."
                      )}
                    </Note>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <dl className="fig grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-dashed border-rule-strong p-5 text-[0.8125rem] md:block md:space-y-3 md:border-l-2 md:border-t-0 md:p-6">
        <div>
          <dt className="label">Route</dt>
          <dd>{q.vendor ? `${q.vendor} (${q.mode})` : "none"}</dd>
        </div>
        <div>
          <dt className="label">Impact</dt>
          <dd>{q.priceImpactPercent !== null ? `${q.priceImpactPercent}%` : "none"}</dd>
        </div>
        <div>
          <dt className="label">Approval</dt>
          <dd>{void_ ? "not reached" : q.approval === "needed" ? "needed once" : "in place"}</dd>
        </div>
        <div>
          <dt className="label">Signed</dt>
          <dd>{settle.kind === "done" ? "yes" : settle.kind === "working" ? "in progress" : "no"}</dd>
        </div>
      </dl>
    </figure>
  );
}
