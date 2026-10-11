// CLI handlers for dividend statements and cash-outs.
import { listVersions } from "../data/rwa.ts";
import { dynamicMultiplier } from "../dividends/multiplier.ts";
import { numberFlag, parseArgs } from "./args.ts";
import { banner, DEFAULT_MAX_USD_PER_TRADE } from "./guards.ts";
import { paydayCashOut, paydayReport } from "./payday.ts";
import type { PaydayDeps } from "./payday.ts";
import { openStore } from "./store.ts";
import type { Address } from "../types.ts";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function paydayCommand(argv: string[], deps: PaydayDeps = {}, out: (s: string) => void = console.log): Promise<void> {
  const a = parseArgs(argv, { "--cash-out": 1, "--live": 0, "--max-usd": 1 });
  const address = a.pos[0];
  if (!address || !ADDR.test(address)) throw new Error("usage: payday statement <0xaddress> [--cash-out <TICKER|SYMBOL>] [--live] [--max-usd N]");
  const cashOut = a.flags.get("--cash-out")?.[0];
  if (!cashOut) {
    const r = await paydayReport(address, deps);
    out(`Payday statement for ${address}`);
    for (const l of r.lines) out(l);
    for (const n of r.notes) out(`note: ${n}`);
    if (r.lines.length > 0) out(`Total dividend earned: $${r.totalUsd.toFixed(2)}`);
    return;
  }
  const opts = { live: a.flags.has("--live"), maxUsdPerTrade: numberFlag(a, "--max-usd", DEFAULT_MAX_USD_PER_TRADE) };
  out(banner(opts, deps.env));
  const { receipt, sold } = await paydayCashOut(address, cashOut, opts, deps);
  out(`${receipt.outcome}: ${receipt.reason}`);
  if (sold > 0) out(`Sold ${sold} tokens; the position was re-baselined.`);
}

export async function positionCommand(argv: string[], out: (s: string) => void = console.log): Promise<void> {
  const [sub, ...rest] = argv;
  const a = parseArgs(rest, { "--baseline": 1, "--opened": 1 });
  const store = openStore();
  if (sub === "list") {
    const address = a.pos[0];
    if (!address || !ADDR.test(address)) throw new Error("usage: payday position list <0xaddress>");
    const list = store.positionsFor(address);
    if (list.length === 0) out(`no positions recorded for ${address}`);
    for (const p of list) out(`${p.symbol}  ${p.tokens} tokens  baseline ${p.baselineMultiplier}  opened ${new Date(p.openedAt).toISOString()}`);
    return;
  }
  if (sub !== "add") throw new Error("usage: payday position add <0xaddress> <SYMBOL> <tokens> [--baseline M] [--opened ISO] | position list <0xaddress>");
  const [address, symbol, tokensRaw] = a.pos;
  const tokens = Number(tokensRaw);
  if (!address || !ADDR.test(address) || !symbol || !(tokens > 0)) throw new Error("usage: payday position add <0xaddress> <SYMBOL> <tokens> [--baseline M] [--opened ISO]");
  const version = (await listVersions()).find((v) => v.symbol.toLowerCase() === symbol.toLowerCase());
  if (!version) throw new Error(`${symbol} is not a BSC token in the stock list`);
  const baseline = a.flags.has("--baseline") ? numberFlag(a, "--baseline", 1) : await dynamicMultiplier(version.address);
  const opened = a.flags.get("--opened")?.[0];
  const openedAt = opened ? Date.parse(opened) : Date.now();
  if (Number.isNaN(openedAt)) throw new Error(`--opened "${opened}" is not an ISO date`);
  const p = store.addPosition(address, { ticker: version.ticker, symbol: version.symbol, tokenAddress: version.address as Address, tokens, baselineMultiplier: baseline, openedAt });
  out(`${address}: ${p.symbol} ${p.tokens} tokens, baseline multiplier ${p.baselineMultiplier}`);
}
