import "server-only";
import { randomUUID } from "node:crypto";
import { parseUnits, type Address } from "viem";
import { executeMod, rwa, web3api } from "./shared/src";
import { allowanceOf, bscClient, parseAddress } from "./shared/chain";
import { loadRepoEnv } from "./shared/server-env";
import { BadAddress, buildStatement } from "./payday";
import { refuseCashOut, refuseWrongWallet, withDomainType } from "./cashout-rules";

const USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
const SLIPPAGE_PERCENT = "1";
const ISSUED_TTL_MS = 10 * 60_000;

/** A refusal with a plain sentence and an HTTP status. Nothing was sent anywhere when this is thrown. */
export class CashOutRefused extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "CashOutRefused";
  }
}

export interface WalletTx { from: Address; to: string; data: string; value: string }
export type BuildStep =
  | { step: "approve"; tx: WalletTx; simulation: string }
  | { step: "swap"; tx: WalletTx; expectUsdt: number; simulation: string }
  | { step: "sign"; typedData: string; quoteId: string; vendor: string; signingScheme: string | null; expectUsdt: number; simulation: string };

// Quotes this server handed out, so /submit only relays an order for a quote that passed every check here.
// ponytail: process memory, one server instance. Use a shared store if this ever runs on more than one.
const issued = new Map<string, { connected: string; symbol: string; vendor: string; signingScheme: string | undefined; exp: number }>();

const hex = (n: string | undefined) => "0x" + BigInt(n || "0").toString(16);

async function client() {
  const { createWeb3Client, credsFromEnv, MissingKeyError } = await web3api();
  loadRepoEnv();
  try {
    return createWeb3Client(credsFromEnv());
  } catch (e) {
    if (e instanceof MissingKeyError) throw new CashOutRefused("The Binance Web3 API key is not configured on the server, so no order can be built.", 503);
    throw e;
  }
}

function addresses(statementRaw: string, connectedRaw: string) {
  const statement = parseAddress(statementRaw);
  const connected = parseAddress(connectedRaw);
  if (!statement) throw new BadAddress(statementRaw);
  if (!connected) throw new BadAddress(connectedRaw);
  return { statement, connected };
}

/**
 * The next step of a cash-out for the CONNECTED wallet: approve, swap, or typed data to sign. Every transaction handed back
 * has passed the Transaction API simulate for that address. The server signs and broadcasts nothing.
 */
export async function buildCashOut(statementRaw: string, connectedRaw: string, symbol: string): Promise<BuildStep> {
  const { statement, connected } = addresses(statementRaw, connectedRaw);
  const wrong = refuseWrongWallet(statement, connected);
  if (wrong) throw new CashOutRefused(wrong, 403);

  const st = await buildStatement(statement);
  const line = st.holdings.find((h) => h.symbol === symbol);
  if (!line) throw new CashOutRefused(`${symbol} is not in this address's holdings.`);
  if (!(line.payoutTokens > 0)) throw new CashOutRefused(`${symbol} has no accrued dividend to cash out.`);
  const sizeRefusal = refuseCashOut({ statementAddress: statement, connected, notionalUsd: line.accruedUsd });
  if (sizeRefusal) throw new CashOutRefused(sizeRefusal, 403);

  const { listVersions, sessionStatus } = await rwa();
  const { Web3ApiError, simulateFailure } = await web3api();
  const { pickRoute, typedDataJson } = await executeMod();
  const version = (await listVersions(line.ticker)).find((v) => v.address === line.address);
  if (!version) throw new CashOutRefused(`${symbol} disappeared from the Binance list.`);
  const market = await sessionStatus(version);
  if (!market.openState) {
    throw new CashOutRefused(`The ${line.ticker} market is ${market.marketStatus ?? "closed"}${market.reasonMsg ? ` (${market.reasonMsg})` : ""}. Binance will not quote until it opens.`, 409);
  }

  const qty = (Math.floor(line.payoutTokens * 1e8) / 1e8).toFixed(8);
  const amount = parseUnits(qty, version.decimals).toString();
  const rfq = version.route === "RFQ";
  const api = await client();

  try {
    let route = pickRoute(await api.quote({ amount, fromToken: version.address, toToken: USDT, userWalletAddress: connected }), rfq ? "RFQ" : "SWAP");
    const expectUsdt = Number(BigInt(route.toTokenAmount)) / 1e18; // BSC USDT has 18 decimals
    const quoteRefusal = refuseCashOut({ statementAddress: statement, connected, notionalUsd: Math.max(line.accruedUsd, expectUsdt) });
    if (quoteRefusal) throw new CashOutRefused(quoteRefusal, 403);

    const [approveTx] = await api.approve({ token: version.address, amount, vendor: rfq ? route.vendorName : undefined });
    if (!approveTx?.data || !approveTx.dexContractAddress) throw new CashOutRefused("Binance returned no approval transaction.", 502);
    const allowance = await allowanceOf(version.address, connected, approveTx.dexContractAddress as Address);
    if (allowance < BigInt(amount)) {
      const reason = simulateFailure(await api.simulate({ from: connected, to: version.address, data: approveTx.data }));
      if (reason) throw new CashOutRefused(`The approval would not go through, so it was not sent to your wallet. ${reason}`, 409);
      return { step: "approve", tx: { from: connected, to: version.address, data: approveTx.data, value: "0x0" }, simulation: "Approval simulated and passed." };
    }

    const buildOnce = () => api.swap({ amount, fromToken: version.address, toToken: USDT, userWalletAddress: connected, quoteId: route.quoteId, slippagePercent: SLIPPAGE_PERCENT });
    let build;
    try {
      build = await buildOnce();
    } catch (e) {
      if (!(e instanceof Web3ApiError && e.kind === "QUOTE_EXPIRED")) throw e;
      route = pickRoute(await api.quote({ amount, fromToken: version.address, toToken: USDT, userWalletAddress: connected }), rfq ? "RFQ" : "SWAP");
      build = await buildOnce();
    }

    if (build.tx?.to && build.tx.data) {
      if (build.tx.from && build.tx.from.toLowerCase() !== connected) throw new CashOutRefused("Binance built the swap for a different address, so it was not sent to your wallet.", 502);
      const tx: WalletTx = { from: connected, to: build.tx.to, data: build.tx.data, value: hex(build.tx.value) };
      const reason = simulateFailure(await api.simulate({ from: connected, to: tx.to, data: tx.data, value: build.tx.value }));
      if (reason) throw new CashOutRefused(`The swap would not go through, so it was not sent to your wallet. ${reason}`, 409);
      return { step: "swap", tx, expectUsdt, simulation: "Swap simulated and passed." };
    }
    if (rfq && build.rfq?.typedDataToSign) {
      const quoteId = build.rfq.orderId ?? route.quoteId;
      const now = Date.now();
      for (const [k, v] of issued) if (v.exp < now) issued.delete(k);
      issued.set(quoteId, { connected, symbol, vendor: build.rfq.vendor, signingScheme: build.rfq.signingScheme, exp: now + ISSUED_TTL_MS });
      return {
        step: "sign",
        typedData: withDomainType(typedDataJson(build.rfq.typedDataToSign)),
        quoteId,
        vendor: build.rfq.vendor,
        signingScheme: build.rfq.signingScheme ?? null,
        expectUsdt,
        simulation: "An RFQ order is signed as typed data, not sent as a transaction, so there is nothing to simulate. Binance checks the signature and settles it.",
      };
    }
    throw new CashOutRefused("Binance returned neither a transaction nor an order to sign.", 502);
  } catch (e) {
    if (e instanceof Web3ApiError) throw new CashOutRefused(e.apiMsg, 409);
    throw e;
  }
}

/** Relays the wallet's typed-data signature to Binance order/submit. Only for a quote this server issued to this wallet. */
export async function submitCashOut(p: { address: string; connected: string; symbol: string; signature: string; quoteId: string }): Promise<{ orderId: string }> {
  const { statement, connected } = addresses(p.address, p.connected);
  const wrong = refuseWrongWallet(statement, connected);
  if (wrong) throw new CashOutRefused(wrong, 403);
  const rec = issued.get(p.quoteId);
  if (!rec || rec.exp < Date.now() || rec.connected !== connected || rec.symbol !== p.symbol) {
    throw new CashOutRefused("This order was not built here for this wallet, or it expired. Start the cash-out again for a fresh quote.", 409);
  }
  const { composeSignature } = await executeMod();
  const { Web3ApiError } = await web3api();
  let userSignature;
  try {
    userSignature = composeSignature(p.signature, null);
  } catch (e) {
    throw new CashOutRefused(e instanceof Error ? e.message : "The signature is malformed.", 400);
  }
  issued.delete(p.quoteId);
  const api = await client();
  try {
    const sub = await api.rfqSubmit({ requestId: randomUUID(), userSignature, vendor: rec.vendor, quoteId: p.quoteId, signingScheme: rec.signingScheme });
    if (!sub.orderId) throw new CashOutRefused("Binance accepted the request but returned no order id.", 502);
    return { orderId: sub.orderId };
  } catch (e) {
    if (e instanceof Web3ApiError) throw new CashOutRefused(e.apiMsg, 409);
    throw e;
  }
}

export interface OrderState { lifecycle: "pending" | "filled" | "failed" | "expired"; status: string | null; txHash: string | null }

const HASH = /^0x[0-9a-fA-F]{64}$/;

/** One look at a Binance RFQ order, or at a transaction receipt on BSC. The browser polls this to a terminal state. */
export async function orderState(q: { orderId?: string; txHash?: string }): Promise<OrderState> {
  if (q.txHash) {
    if (!HASH.test(q.txHash)) throw new CashOutRefused("That is not a transaction hash.", 400);
    try {
      const r = await bscClient.getTransactionReceipt({ hash: q.txHash as `0x${string}` });
      return { lifecycle: r.status === "success" ? "filled" : "failed", status: r.status, txHash: q.txHash };
    } catch (e) {
      if (e instanceof Error && e.name === "TransactionReceiptNotFoundError") return { lifecycle: "pending", status: null, txHash: q.txHash };
      throw e;
    }
  }
  if (!q.orderId || !/^[\w-]{1,80}$/.test(q.orderId)) throw new CashOutRefused("Send orderId or txHash.", 400);
  const { rfqLifecycle, Web3ApiError } = await web3api();
  try {
    const o = await (await client()).rfqOrder(q.orderId);
    return { lifecycle: rfqLifecycle(o.status), status: o.status ?? null, txHash: o.txHash && HASH.test(o.txHash) ? o.txHash : null };
  } catch (e) {
    if (e instanceof Web3ApiError) throw new CashOutRefused(e.apiMsg, 502);
    throw e;
  }
}

/** Shared by the route handlers: success as JSON, refusals with their sentence, anything else logged and generic. */
export async function respond(run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await run());
  } catch (e) {
    if (e instanceof CashOutRefused) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof BadAddress) return Response.json({ error: e.message }, { status: 422 });
    console.error("cashout", e instanceof Error ? e.message : e);
    return Response.json({ error: "The cash-out service hit an error. Nothing was sent." }, { status: 502 });
  }
}
