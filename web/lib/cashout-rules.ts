import { getTypesForEIP712Domain } from "viem";

export const MAX_CASHOUT_USD = 25;
export const MIN_CASHOUT_USD = 5;
export const BSC_CHAIN_ID = 56;

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function refuseWrongWallet(statementAddress: string, connected: string): string | null {
  if (connected.toLowerCase() === statementAddress.toLowerCase()) return null;
  return `This wallet is ${shortAddress(connected)}, but the payslip is for ${shortAddress(statementAddress)}. Connect the wallet that holds these tokens.`;
}

/** The one place the cash-out limits live. Returns a plain sentence when the cash-out must be refused, otherwise null. */
export function refuseCashOut(p: { statementAddress: string; connected: string; notionalUsd: number }): string | null {
  const wrong = refuseWrongWallet(p.statementAddress, p.connected);
  if (wrong) return wrong;
  if (!Number.isFinite(p.notionalUsd)) return "The value of this cash-out could not be worked out, so it was not sent.";
  if (p.notionalUsd > MAX_CASHOUT_USD) {
    return `Cash-outs above $${MAX_CASHOUT_USD} are refused here. This one is worth $${p.notionalUsd.toFixed(2)}. Nothing was sent.`;
  }
  if (p.notionalUsd < MIN_CASHOUT_USD) {
    return `Below the $${MIN_CASHOUT_USD} minimum. It keeps accruing.`;
  }
  return null;
}

/** Wallets hash typed data with the EIP712Domain type; some reject a payload that does not list it. Adding it from the domain fields does not change the signed hash. */
export function withDomainType(typedDataJson: string): string {
  const td = JSON.parse(typedDataJson) as { domain?: Record<string, unknown>; types?: Record<string, unknown> };
  if (!td.domain || !td.types || td.types.EIP712Domain) return typedDataJson;
  return JSON.stringify({ ...td, types: { EIP712Domain: getTypesForEIP712Domain({ domain: td.domain }), ...td.types } });
}
