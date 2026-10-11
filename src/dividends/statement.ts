import type { DividendAccrual } from "../types.ts";

const NAMES: Record<string, string> = {
  VZ: "Verizon", KO: "Coca-Cola", PEP: "PepsiCo", T: "AT&T", PG: "Procter & Gamble", JNJ: "Johnson & Johnson",
  JPM: "JPMorgan", XOM: "Exxon Mobil", AAPL: "Apple", SPY: "S&P 500 fund", TSLA: "Tesla",
};

const fmt = (n: number, d: number) => String(Number(n.toFixed(d)));

export function statement(accruals: DividendAccrual[]): string[] {
  return accruals.map((a) => {
    const name = NAMES[a.version.ticker] ?? a.version.ticker;
    const label = `${name} (${a.version.symbol})`;
    if (!(a.accruedShares > 0)) return `${label}: ${fmt(a.tokens, 4)} tokens have not earned a dividend yet.`;
    return `${label}: ${fmt(a.tokens, 4)} tokens have earned ${fmt(a.accruedShares, 4)} extra shares, worth $${a.accruedUsd.toFixed(2)} at today's price.`;
  });
}
