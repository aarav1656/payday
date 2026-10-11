import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DividendAccrual, StockVersion } from "../types.ts";

export class SplitDetected extends Error {
  readonly ratio: number;
  readonly baseline: number;
  readonly multiplier: number;
  constructor(baseline: number, multiplier: number) {
    super(`multiplier ${multiplier} is ${(multiplier / baseline).toFixed(4)}x baseline ${baseline}: a split, not a dividend. Re-baseline.`);
    this.name = "SplitDetected";
    this.baseline = baseline;
    this.multiplier = multiplier;
    this.ratio = multiplier / baseline;
  }
}

function isSplit(ratio: number): boolean {
  const n = Math.round(ratio);
  return n >= 2 && Math.abs(ratio - n) / n <= 0.005;
}

/** Accrued dividend for a position. Throws SplitDetected when the multiplier jump is an integer split. */
export function accrue(version: StockVersion, tokens: number, baselineMultiplier: number, stockUsd: number): DividendAccrual {
  if (!(baselineMultiplier > 0)) throw new Error(`bad baseline ${baselineMultiplier}`);
  if (isSplit(version.multiplier / baselineMultiplier)) throw new SplitDetected(baselineMultiplier, version.multiplier);
  const accruedShares = tokens * (version.multiplier - baselineMultiplier);
  return { version, tokens, accruedShares, accruedUsd: accruedShares * stockUsd, baselineMultiplier };
}

/** Tokens to sell to cash out exactly the accrued dividend. */
export function payoutTokens(a: DividendAccrual): number {
  return a.tokens * (1 - a.baselineMultiplier / a.version.multiplier);
}

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/multipliers.jsonl");

export interface MultiplierRecord { address: string; multiplier: number; source: string; at: number }

export function record(address: string, multiplier: number, source: string, at = Date.now(), file = FILE): MultiplierRecord {
  const rec = { address: address.toLowerCase(), multiplier, source, at };
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(rec) + "\n");
  return rec;
}

export function history(address: string, file = FILE): MultiplierRecord[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as MultiplierRecord)
    .filter((r) => r.address === address.toLowerCase());
}
