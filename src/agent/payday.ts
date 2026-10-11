// Payday: reveal the dividend hidden in a token multiplier, and pay it out by selling exactly those tokens.
// Depends on src/data, src/dividends, src/exec and src/agent/{store,guards} only.
import { listVersions as defaultList, priceVersions as defaultPrice } from "../data/rwa.ts";
import { accrue, payoutTokens, record, SplitDetected } from "../dividends/accrual.ts";
import { dynamicMultiplier } from "../dividends/multiplier.ts";
import { statement } from "../dividends/statement.ts";
import { createBaw } from "../exec/baw.ts";
import { floor8 } from "../exec/execute.ts";
import { BSC } from "../exec/web3api.ts";
import type { DividendAccrual, Decision, Rule, StockVersion, VersionPrice } from "../types.ts";
import { guardedTrade } from "./guards.ts";
import type { TradeDeps, TradeOpts } from "./guards.ts";
import { openStore } from "./store.ts";
import type { Position, Receipt, Store } from "./store.ts";

export const PAYOUT_SLIPPAGE_BPS = 100;

export interface PaydayDeps extends TradeDeps {
  store?: Store;
  listVersions?: (ticker: string) => Promise<StockVersion[]>;
  priceVersions?: (v: StockVersion[]) => Promise<VersionPrice[]>;
  multiplier?: (address: string) => Promise<number>;
  recordMultiplier?: (address: string, multiplier: number) => void;
  wallet?: () => Promise<string>;
  now?: () => number;
}

export interface PaydayReport {
  address: string;
  lines: string[];
  accruals: DividendAccrual[];
  totalUsd: number;
  notes: string[];
}

interface Priced { position: Position; accrual: DividendAccrual; price: VersionPrice }

async function price(position: Position, deps: PaydayDeps): Promise<Priced> {
  const version = (await (deps.listVersions ?? defaultList)(position.ticker)).find((v) => v.address === position.tokenAddress.toLowerCase());
  if (!version) throw new Error(`${position.symbol} (${position.tokenAddress}) is not a BSC token in the stock list`);
  const [p] = await (deps.priceVersions ?? defaultPrice)([version]);
  // The list endpoint disagrees with the dynamic one on multipliers; dynamic is the one that moves with dividends.
  const multiplier = await (deps.multiplier ?? dynamicMultiplier)(version.address);
  (deps.recordMultiplier ?? ((a, m) => void record(a, m, "dynamic")))(version.address, multiplier);
  const stockUsd = p.stockUsd ?? p.perShareUsd;
  if (stockUsd === null) throw new Error(`no stock price for ${position.symbol}`);
  const priced = { ...p, version: { ...version, multiplier } };
  return { position, accrual: accrue(priced.version, position.tokens, position.baselineMultiplier, stockUsd), price: priced };
}

export async function paydayReport(address: string, deps: PaydayDeps = {}): Promise<PaydayReport> {
  const store = deps.store ?? openStore();
  const positions = store.positionsFor(address);
  const accruals: DividendAccrual[] = [];
  const notes: string[] = [];
  if (positions.length === 0) notes.push(`No positions are recorded for ${address}. Add one with: position add ${address} <SYMBOL> <tokens>`);
  for (const pos of positions) {
    try {
      accruals.push((await price(pos, deps)).accrual);
    } catch (e) {
      notes.push(e instanceof SplitDetected ? `${pos.symbol}: ${e.message}` : `${pos.symbol}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { address, lines: statement(accruals), accruals, totalUsd: accruals.reduce((s, a) => s + a.accruedUsd, 0), notes };
}

export interface CashOutResult { receipt: Receipt; sold: number }

/** Sells exactly payoutTokens of the matching position (dry run unless opts.live and PAYDAY_LIVE=yes). */
export async function paydayCashOut(address: string, ticker: string, opts: TradeOpts, deps: PaydayDeps = {}): Promise<CashOutResult> {
  const store = deps.store ?? openStore();
  const now = (deps.now ?? Date.now)();
  const key = ticker.toLowerCase();
  const matches = store.positionsFor(address).filter((p) => p.ticker.toLowerCase() === key || p.symbol.toLowerCase() === key);
  if (matches.length === 0) throw new Error(`no position matching ${ticker} for ${address}`);
  if (matches.length > 1) throw new Error(`${ticker} matches ${matches.map((m) => m.symbol).join(", ")}; pass the token symbol`);
  const { position, accrual, price: priced } = await price(matches[0], deps);
  const version = accrual.version;
  const payout = payoutTokens(accrual);
  const tokenUsd = priced.tokenUsd;

  const base: Receipt = {
    at: now, iso: new Date(now).toISOString(), kind: "payday", ruleId: `payday-${position.symbol}-${now}`, ticker: position.ticker,
    mode: "dry", outcome: "skipped", reason: "", lastClose: null, lastCloseSource: null,
    observed: [{ symbol: version.symbol, issuer: version.issuer, tokenUsd, perShareUsd: priced.perShareUsd }],
    version: { symbol: version.symbol, issuer: version.issuer, address: version.address }, side: "sell", usd: null, quote: null,
    simulate: "not run", txHash: null, orderId: null, execLog: [],
  };
  const finish = (r: Receipt): CashOutResult => { store.appendReceipt(r); return { receipt: r, sold: 0 }; };
  if (!(payout >= 1e-8) || !tokenUsd) return finish({ ...base, reason: `${version.symbol} has not earned a dividend to cash out yet.` });

  // usd chosen so execute's floor8(usd / tokenUsd) lands on floor8(payout) despite float rounding.
  let usd = payout * tokenUsd;
  for (let i = 0; i < 8 && floor8(usd / tokenUsd) !== floor8(payout); i++) usd *= 1 + 4 * Number.EPSILON;
  const rule: Rule = {
    id: base.ruleId, ticker: position.ticker,
    trigger: { kind: "move_pct", direction: "up", pct: 0, from: "last_close" },
    action: { side: "sell", usd }, window: { startMs: now, endMs: now }, maxSlippageBps: PAYOUT_SLIPPAGE_BPS,
  };
  const decision: Decision = {
    ruleId: rule.id, fire: true, version,
    reason: `Payday: selling the ${floor8(payout)} ${version.symbol} that carry the dividend, about $${(payout * tokenUsd).toFixed(2)}.`,
    observed: [priced],
  };

  const signer = await (deps.wallet ?? (() => createBaw().address(BSC)))();
  if (signer.toLowerCase() !== address.toLowerCase()) {
    return finish({ ...base, usd, reason: `${decision.reason} Refused: the signing wallet is ${signer}, not ${address}.` });
  }
  const t = await guardedTrade(decision, rule, usd, opts, deps);
  const receipt: Receipt = {
    ...base, mode: t.live ? "live" : "dry", outcome: t.outcome, usd: t.usd, quote: t.quote, simulate: t.simulate,
    txHash: t.fill?.txHash ?? null, orderId: t.fill?.orderId ?? null, execLog: t.execLog, reason: `${decision.reason} ${t.reason}`,
  };
  store.appendReceipt(receipt);
  if (t.outcome !== "filled") return { receipt, sold: 0 };
  // The dividend is paid out: what remains is re-baselined so it does not accrue the same shares twice.
  const sold = Number(floor8(payout));
  store.setPosition(address, { ...position, tokens: position.tokens - sold, baselineMultiplier: version.multiplier });
  return { receipt, sold };
}
