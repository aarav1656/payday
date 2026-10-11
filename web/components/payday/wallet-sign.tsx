"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BSC_CHAIN_ID, refuseWrongWallet } from "@/lib/cashout-rules";

export type Settle =
  | { kind: "none" }
  | { kind: "working"; text: string }
  | { kind: "done"; txHash: string | null; orderId: string | null }
  | { kind: "failed"; message: string };

type Eip1193 = { request(a: { method: string; params?: unknown[] }): Promise<unknown> };
type Step =
  | { step: "approve"; tx: Record<string, string>; simulation: string }
  | { step: "swap"; tx: Record<string, string>; simulation: string }
  | { step: "sign"; typedData: string; quoteId: string; simulation: string };
type Lifecycle = { lifecycle: "pending" | "filled" | "failed" | "expired"; status: string | null; txHash: string | null };

const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;
const BSC_HEX = "0x" + BSC_CHAIN_ID.toString(16);

/** Binance Web3 Wallet injects window.binancew3w.ethereum; any other EIP-1193 wallet injects window.ethereum. */
function findWallet(): Eip1193 | null {
  const w = window as unknown as { binancew3w?: { ethereum?: Eip1193 }; ethereum?: Eip1193 };
  return w.binancew3w?.ethereum ?? w.ethereum ?? null;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** Polls /api/cashout/status to a terminal state. Still pending at the deadline counts as failed. */
async function settle(query: string): Promise<Lifecycle> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(`/api/cashout/status?${query}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.lifecycle !== "pending") return json as Lifecycle;
    if (Date.now() >= deadline) throw new Error("Still pending after 2 minutes, so it is counted as failed. Check your wallet before trying again.");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function switchToBsc(eth: Eip1193) {
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_HEX }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: BSC_HEX, chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.bnbchain.org"], blockExplorerUrls: ["https://bscscan.com"] }],
    });
  }
  const now = await eth.request({ method: "eth_chainId" });
  if (now !== BSC_HEX) throw new Error("Your wallet is not on BNB Smart Chain. Switch networks in the wallet and try again.");
}

function plain(e: unknown): string {
  const code = (e as { code?: number })?.code;
  if (code === 4001) return "You declined in the wallet. Nothing was sent.";
  if (code === -32002) return "The wallet already has a request open. Answer it there, then try again.";
  return e instanceof Error ? e.message : "The wallet step failed. Nothing was sent.";
}

/** Connects the user's own wallet, then walks the cash-out: approve if short, then swap or typed-data order. Signing happens only in the wallet. */
export function WalletSign({ address, symbol, onSettle, disabled }: { address: string; symbol: string; onSettle: (s: Settle) => void; disabled: boolean }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    const eth = findWallet();
    if (!eth) {
      onSettle({ kind: "failed", message: "No browser wallet found. Install the Binance Web3 Wallet extension, then reload this page." });
      return;
    }
    setBusy(true);
    const work = (text: string) => onSettle({ kind: "working", text });
    try {
      work("Connecting your wallet");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const connected = accounts[0];
      if (!connected) throw new Error("The wallet returned no account.");
      const wrong = refuseWrongWallet(address, connected);
      if (wrong) throw new Error(wrong);
      work("Switching to BNB Smart Chain");
      await switchToBsc(eth);

      for (let round = 0; round < 3; round++) {
        work("Building the order for your address");
        const next = await post<Step>("/api/cashout/build", { address, connected, symbol });
        if (next.step === "approve") {
          work("Approve the token in your wallet");
          const hash = (await eth.request({ method: "eth_sendTransaction", params: [next.tx] })) as string;
          work("Waiting for the approval to confirm");
          const mined = await settle(`txHash=${hash}`);
          if (mined.lifecycle !== "filled") throw new Error("The approval transaction failed on chain.");
          continue;
        }
        if (next.step === "swap") {
          work("Confirm the swap in your wallet");
          const hash = (await eth.request({ method: "eth_sendTransaction", params: [next.tx] })) as string;
          work("Waiting for the swap to confirm");
          const mined = await settle(`txHash=${hash}`);
          if (mined.lifecycle !== "filled") throw new Error("The swap transaction failed on chain.");
          onSettle({ kind: "done", txHash: hash, orderId: null });
          return;
        }
        work("Sign the order in your wallet");
        const signature = (await eth.request({ method: "eth_signTypedData_v4", params: [connected, next.typedData] })) as string;
        work("Sending your signature to Binance");
        const { orderId } = await post<{ orderId: string }>("/api/cashout/submit", { address, connected, symbol, signature, quoteId: next.quoteId });
        work(`Order ${orderId} placed, waiting for it to fill`);
        const done = await settle(`orderId=${encodeURIComponent(orderId)}`);
        if (done.lifecycle !== "filled") throw new Error(`Order ${orderId} ended ${done.status ?? done.lifecycle}. Nothing was paid out.`);
        onSettle({ kind: "done", txHash: done.txHash, orderId });
        return;
      }
      throw new Error("The approval did not register in time. Try again.");
    } catch (e) {
      onSettle({ kind: "failed", message: plain(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy || disabled} size="sm" className="mt-4">
      {busy ? "Waiting for your wallet" : "Sign in your wallet"}
    </Button>
  );
}
