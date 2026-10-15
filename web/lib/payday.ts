import "server-only";
import path from "node:path";
import { keccak256, parseUnits, type Address } from "viem";
import type { StockVersion } from "../../src/types.ts";
import { accrualMod, multiplierMod, rwa, statementMod, web3api } from "./shared/src";
import { allowanceOf, balancesOf, parseAddress } from "./shared/chain";
import { loadRepoEnv, REPO_DATA_DIR } from "./shared/server-env";

export const PAYDAY_NAME = "Payday";
export const PAYDAY_LINE = "Your stocks have been paying you.";

const MULTIPLIERS_FILE = path.join(REPO_DATA_DIR, "multipliers.jsonl");
const USDT: Address = "0x55d398326f99059fF775485246999027B3197955";

export type LineStatus = "earning" | "waiting" | "split" | "adjusted";

export interface HoldingLine {
  symbol: string;
  ticker: string;
  /** Registered company name from Binance's token metadata, null when that lookup did not answer. */
  company: string | null;
  address: Address;
  tokens: number;
  multiplier: number;
  baseline: number;
  baselineSource: "recorded" | "launch";
  /** When the baseline rate was first recorded here (ms), null when the baseline is the launch rate. */
  baselineAt: number | null;
  status: LineStatus;
  accruedShares: number;
  accruedUsd: number;
  stockUsd: number | null;
  sentence: string;
  payoutTokens: number;
}

export interface Statement {
  address: Address;
  block: number;
  asOf: number;
  scanned: number;
  holdings: HoldingLine[];
  totalUsd: number;
}

const toNumber = (raw: bigint, decimals: number) => Number(raw) / 10 ** decimals;

const META_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/meta/ai";
const companyCache = new Map<string, string>();

/** Registered company name per token (Binance token metadata). Missing names come back null and are logged, never invented. */
async function companyNames(addresses: Address[]): Promise<Map<Address, string | null>> {
  const out = new Map<Address, string | null>();
  await Promise.all(
    addresses.map(async (a) => {
      const hit = companyCache.get(a);
      if (hit) return void out.set(a, hit);
      try {
        const res = await fetch(`${META_URL}?chainId=56&contractAddress=${a}`, {
          headers: { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const name = (await res.json())?.data?.companyInfo?.companyName;
        if (typeof name !== "string" || !name) throw new Error("no companyName in metadata");
        const clean = name.trim().replace(/\.+$/, ""); // "Inc." would print as "Inc.." at the end of a sentence
        companyCache.set(a, clean);
        out.set(a, clean);
      } catch (e) {
        console.error("company name", a, e instanceof Error ? e.message : e);
        out.set(a, null);
      }
    }),
  );
  return out;
}

/** Stub number printed on the statement: the first 8 hex digits of keccak256(address). */
export const slipNumber = (address: Address) => `PD-${keccak256(address).slice(2, 10).toUpperCase()}`;

/** Dividend statement for every Ondo token the address holds on BSC. Reads chain balances; no signing. */
export async function buildStatement(rawAddress: string): Promise<Statement> {
  const address = parseAddress(rawAddress);
  if (!address) throw new BadAddress(rawAddress);

  const { listVersions, priceVersions } = await rwa();
  const { dynamicMultiplier } = await multiplierMod();
  const { accrue, history, payoutTokens, SplitDetected } = await accrualMod();
  const { statement } = await statementMod();

  const ondo = (await listVersions()).filter((v) => v.issuer === "ondo");
  if (ondo.length === 0) throw new Error("Binance returned no Ondo tokens on BSC; cannot read holdings");
  const { balances, block } = await balancesOf(address, ondo.map((v) => v.address));
  const held = balances
    .map((b, i) => ({ version: ondo[i], raw: b.raw }))
    .filter((h) => h.raw > 0n);
  if (held.length === 0) {
    return { address, block: Number(block), asOf: Date.now(), scanned: ondo.length, holdings: [], totalUsd: 0 };
  }

  const [prices, names] = await Promise.all([priceVersions(held.map((h) => h.version)), companyNames(held.map((h) => h.version.address))]);
  const lines: HoldingLine[] = [];
  for (const h of held) {
    // Binance's list can lag the dynamic endpoint; the dynamic multiplier is the one the price uses.
    const multiplier = await dynamicMultiplier(h.version.address);
    const version: StockVersion = { ...h.version, multiplier };
    const price = prices.find((p) => p.version.address === h.version.address);
    const stockUsd = price?.stockUsd ?? (price?.perShareUsd ?? null);
    const tokenCount = toNumber(h.raw, version.decimals);
    const rec = history(version.address, MULTIPLIERS_FILE)[0];
    const baseline = rec?.multiplier ?? 1;
    const base = {
      symbol: version.symbol, ticker: version.ticker, company: names.get(version.address) ?? null, address: version.address, tokens: tokenCount, multiplier, baseline,
      baselineSource: rec ? ("recorded" as const) : ("launch" as const), baselineAt: rec?.at ?? null, stockUsd,
    };

    if (multiplier < 1) {
      lines.push({ ...base, status: "adjusted", accruedShares: 0, accruedUsd: 0, payoutTokens: 0, sentence: `${version.symbol}: the share count was adjusted by a split, so no dividend is counted here.` });
      continue;
    }
    if (stockUsd === null) {
      lines.push({ ...base, status: "waiting", accruedShares: 0, accruedUsd: 0, payoutTokens: 0, sentence: `${version.symbol}: no stock price is available right now.` });
      continue;
    }
    try {
      const a = accrue(version, tokenCount, baseline, stockUsd);
      const sentence = statement([a])[0];
      lines.push({
        ...base,
        status: a.accruedShares > 0 ? "earning" : "waiting",
        accruedShares: a.accruedShares,
        accruedUsd: a.accruedUsd,
        payoutTokens: a.accruedShares > 0 ? payoutTokens(a) : 0,
        sentence,
      });
    } catch (e) {
      if (!(e instanceof SplitDetected)) throw e;
      lines.push({ ...base, status: "split", accruedShares: 0, accruedUsd: 0, payoutTokens: 0, sentence: `${version.symbol}: the token count changed by ${e.ratio.toFixed(0)} to 1, which is a stock split and not a dividend.` });
    }
  }
  lines.sort((a, b) => b.accruedUsd - a.accruedUsd);
  return { address, block: Number(block), asOf: Date.now(), scanned: ondo.length, holdings: lines, totalUsd: lines.reduce((s, l) => s + l.accruedUsd, 0) };
}

export class BadAddress extends Error {
  constructor(raw: string) {
    super(`"${raw.slice(0, 60)}" is not a BSC address. It starts with 0x and has 40 more characters.`);
    this.name = "BadAddress";
  }
}

export interface CashOutQuote {
  symbol: string;
  sellTokens: number;
  expectUsdt: number | null;
  vendor: string | null;
  mode: string | null;
  priceImpactPercent: number | null;
  approval: "not needed" | "needed";
  simulation: { ran: boolean; target: "approval"; ok: boolean | null; detail: string };
  market: { state: string | null; open: boolean; reason: string | null; nextOpenTime: number | null };
  blocked: { kind: string; message: string } | null;
  signed: false;
  at: number;
}

/**
 * Dry run only: quote the accrued part of one Ondo holding into USDT, then simulate the approval
 * the sale would need. Nothing is signed, nothing is broadcast, no private key is involved.
 */
export async function cashOutDryRun(rawAddress: string, symbol: string): Promise<CashOutQuote> {
  const { listVersions, sessionStatus } = await rwa();
  const { createWeb3Client, credsFromEnv, simulateFailure, Web3ApiError, MissingKeyError, BSC } = await web3api();
  const st = await buildStatement(rawAddress);
  const line = st.holdings.find((h) => h.symbol === symbol);
  if (!line) throw new Error(`${symbol} is not in this address's holdings`);
  if (!(line.payoutTokens > 0)) throw new Error(`${symbol} has no accrued dividend to cash out`);

  const version = (await listVersions(line.ticker)).find((v) => v.address === line.address);
  if (!version) throw new Error(`${symbol} disappeared from the Binance list`);
  const market = await sessionStatus(version);
  const marketOut = { state: market.marketStatus, open: market.openState, reason: market.reasonMsg ?? market.reasonCode, nextOpenTime: market.nextOpenTime };

  const floored = (Math.floor(line.payoutTokens * 1e8) / 1e8).toFixed(8);
  const amount = parseUnits(floored, version.decimals).toString();
  const base = { symbol, sellTokens: Number(floored), market: marketOut, signed: false as const, at: Date.now() };

  loadRepoEnv();
  let api;
  try {
    api = createWeb3Client(credsFromEnv());
  } catch (e) {
    if (e instanceof MissingKeyError) throw new Error("The Binance Web3 API key is not configured on the server, so no quote can be fetched.");
    throw e;
  }

  try {
    const routes = await api.rfqQuote({ amount, fromToken: version.address, toToken: USDT, userWalletAddress: st.address, chainId: BSC });
    const best = [...routes].sort((a, b) => (BigInt(b.toTokenAmount) > BigInt(a.toTokenAmount) ? 1 : -1))[0];
    const expectUsdt = Number(best.toTokenAmount) / 1e18; // BSC USDT has 18 decimals
    const [approveTx] = await api.approve({ token: version.address, amount, vendor: best.vendorName });
    if (!approveTx?.data || !approveTx.dexContractAddress) throw new Error("approve-transaction returned no calldata");
    const allowance = await allowanceOf(version.address, st.address, approveTx.dexContractAddress as Address);
    const needsApprove = allowance < BigInt(amount);
    let simulation: CashOutQuote["simulation"];
    if (needsApprove) {
      const reason = simulateFailure(await api.simulate({ from: st.address, to: version.address, data: approveTx.data }));
      simulation = { ran: true, target: "approval", ok: reason === null, detail: reason ?? "The approval would go through." };
    } else {
      simulation = { ran: false, target: "approval", ok: null, detail: "This address already approved enough, so the only step left is signing the order." };
    }
    return {
      ...base,
      expectUsdt,
      vendor: best.vendorName,
      mode: best.executionMode,
      priceImpactPercent: best.priceImpactPercent == null ? null : Number(best.priceImpactPercent),
      approval: needsApprove ? "needed" : "not needed",
      simulation,
      blocked: null,
    };
  } catch (e) {
    const refused = (kind: string, message: string): CashOutQuote => ({
      ...base, expectUsdt: null, vendor: null, mode: null, priceImpactPercent: null, approval: "needed",
      simulation: { ran: false, target: "approval", ok: null, detail: "No quote, so nothing to simulate." },
      blocked: { kind, message },
    });
    if (e instanceof Web3ApiError) return refused(e.kind, e.apiMsg);
    // rfqQuote throws a plain Error when Binance answers with no market-maker route; that is a refused quote, not a crash
    if (e instanceof Error && e.message.startsWith("rfqQuote: no RFQ route")) {
      return refused("NO_ROUTE", `Nobody on Binance is offering a price for this sale right now.`);
    }
    throw e;
  }
}

export interface CarryingRow { symbol: string; ticker: string; company: string | null; multiplier: number; sharesPer100: number }

/** Ondo tokens whose share rate is above 1 right now (from Binance's token list). Split-sized jumps are excluded. */
export async function carryingDividends(limit = 8): Promise<{ rows: CarryingRow[]; total: number; scanned: number; topStockUsd: number | null }> {
  const { listVersions, priceVersions } = await rwa();
  const ondo = (await listVersions()).filter((v) => v.issuer === "ondo");
  const carrying = ondo.filter((v) => v.multiplier > 1.0001 && v.multiplier < 1.5).sort((a, b) => b.multiplier - a.multiplier);
  const top = carrying.slice(0, limit);
  const names = await companyNames(top.map((v) => v.address));
  let topStockUsd: number | null = null;
  if (top[0]) {
    try {
      topStockUsd = (await priceVersions([top[0]]))[0]?.stockUsd ?? null;
    } catch (e) {
      console.error("top price", e instanceof Error ? e.message : e);
    }
  }
  return {
    topStockUsd,
    total: carrying.length,
    scanned: ondo.length,
    rows: top.map((v) => ({ symbol: v.symbol, ticker: v.ticker, company: names.get(v.address) ?? null, multiplier: v.multiplier, sharesPer100: v.multiplier * 100 })),
  };
}

export const EXAMPLE_ADDRESS = "0x8768C8969e177575e37435B8295aFa2DFB231C86";
