#!/usr/bin/env -S node --env-file-if-exists=.env
// Payday CLI. Dry run everywhere unless --live is passed AND PAYDAY_LIVE=yes is set.
import { numberFlag, parseArgs } from "../src/agent/args.ts";
import type { Receipt } from "../src/agent/store.ts";

const USAGE = `usage:
  payday statement <0xaddress> [--cash-out <TICKER|SYMBOL>] [--live] [--max-usd N]
  payday position add <0xaddress> <SYMBOL> <tokens> [--baseline M] [--opened ISO] | position list <0xaddress>
  payday quote <TICKER> <usd> [--wallet <0xaddress>]
  payday receipts [--last N]`;

const line = (r: Receipt) => `${r.iso} ${r.mode.padEnd(4)} ${r.outcome.padEnd(8)} ${r.ticker.padEnd(6)} ${r.reason}`;

async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;

  if (cmd === "statement") {
    const { paydayCommand } = await import("../src/agent/payday-cmd.ts");
    return paydayCommand(rest);
  }
  if (cmd === "position") {
    const { positionCommand } = await import("../src/agent/payday-cmd.ts");
    return positionCommand(rest);
  }

  if (cmd === "quote") {
    const qa = parseArgs(rest, { "--wallet": 1 });
    const [ticker, usdRaw] = qa.pos;
    const usd = Number(usdRaw);
    if (!ticker || !(usd > 0)) throw new Error(USAGE);
    const { quoteTicker, formatQuoteTable } = await import("../src/agent/quote.ts");
    let wallet: string | undefined = qa.flags.get("--wallet")?.[0];
    if (!wallet) try {
      const { createBaw } = await import("../src/exec/baw.ts");
      wallet = await createBaw().address("56");
    } catch (e) {
      console.log(`note: no signed-in baw wallet (${e instanceof Error ? e.message.slice(0, 80) : "unknown"}); xStocks and Ondo quotes need one`);
    }
    console.log(formatQuoteTable(ticker.toUpperCase(), usd, await quoteTicker(ticker.toUpperCase(), usd, { wallet })));
    return;
  }

  if (cmd === "receipts") {
    const a = parseArgs(rest, { "--last": 1 });
    const { openStore } = await import("../src/agent/store.ts");
    const all = openStore().receipts();
    if (all.length === 0) console.log("no receipts yet. They are written by statement --cash-out.");
    for (const r of all.slice(-numberFlag(a, "--last", 20))) console.log(line(r));
    return;
  }

  console.log(USAGE);
  if (cmd !== undefined && cmd !== "help") process.exitCode = 2;
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
