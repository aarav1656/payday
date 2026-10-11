import { test } from "node:test";
import assert from "node:assert/strict";
import { payoutTokens } from "../dividends/accrual.ts";
import { floor8 } from "../exec/execute.ts";
import { paydayCashOut, paydayReport } from "./payday.ts";
import type { PaydayDeps } from "./payday.ts";
import { priceOf, spyExecute, tmpStore, ver } from "./fixtures.ts";

const WALLET = "0x1111111111111111111111111111111111111111";
const VZon = ver("ondo", "VZon", "VZ", 1); // list multiplier is stale; dynamic says 1.0465
const STOCK = 39.57;

function setup(tokens = 10, over: Partial<PaydayDeps> = {}, v = VZon) {
  const store = tmpStore();
  store.addPosition(WALLET, { ticker: "VZ", symbol: v.symbol, tokenAddress: v.address, tokens, baselineMultiplier: 1, openedAt: 1 });
  const deps: PaydayDeps = {
    store, env: {}, now: () => 1_000,
    listVersions: async () => [v],
    priceVersions: async ([x]) => [{ ...priceOf({ ...x, multiplier: 1.0465 }, STOCK, true), tokenUsd: STOCK * 1.0465, version: x }],
    multiplier: async () => 1.0465,
    recordMultiplier: () => {},
    wallet: async () => WALLET,
    ...over,
  };
  return { store, deps };
}

test("report: the plain-English dividend statement from positions.json", async () => {
  const { deps } = setup();
  const r = await paydayReport(WALLET, deps);
  assert.equal(r.lines.length, 1, "statement must not be empty");
  assert.equal(r.lines[0], "Verizon (VZon): 10 tokens have earned 0.465 extra shares, worth $18.40 at today's price.");
  assert.ok(Math.abs(r.totalUsd - 18.4) < 0.01);
  assert.deepEqual(r.notes, []);
});

test("report: an address with no positions says how to add one instead of printing nothing", async () => {
  const { deps } = setup();
  const r = await paydayReport("0x2222222222222222222222222222222222222222", deps);
  assert.equal(r.lines.length, 0);
  assert.match(r.notes[0], /position add/);
});

test("report: a split is reported as a note, not as a dividend", async () => {
  const { deps } = setup(10, { multiplier: async () => 10 });
  const r = await paydayReport(WALLET, deps);
  assert.equal(r.accruals.length, 0);
  assert.match(r.notes[0], /split, not a dividend/);
});

test("cash-out sells exactly payoutTokens, then re-baselines so the report shows nothing left", async () => {
  const { store, deps } = setup(5);
  const spy = spyExecute("filled", { txHash: `0x${"cd".repeat(32)}` });
  const live = { live: true, maxUsdPerTrade: 20 };
  const { receipt, sold } = await paydayCashOut(WALLET, "VZ", live, { ...deps, execute: spy, env: { PAYDAY_LIVE: "yes" } });
  assert.equal(spy.calls.length, 1);
  const call = spy.calls[0];
  assert.equal(call.rule.action.side, "sell");
  const tokenUsd = STOCK * 1.0465;
  const expected = floor8(5 * (1 - 1 / 1.0465));
  assert.equal(floor8((call.rule.action.usd as number) / tokenUsd), expected, "execute will sell floor8(usd/tokenUsd) tokens; that must be the payout");
  assert.equal(String(sold), expected);
  assert.equal(receipt.kind, "payday");
  assert.equal(receipt.outcome, "filled");
  assert.equal(store.receipts().length, 1);
  const pos = store.positionsFor(WALLET)[0];
  assert.ok(Math.abs(pos.tokens - (5 - sold)) < 1e-12);
  assert.equal(pos.baselineMultiplier, 1.0465);
  const after = await paydayReport(WALLET, deps);
  assert.match(after.lines[0], /have not earned a dividend yet/);
  assert.ok(Math.abs(payoutTokens(after.accruals[0])) < 1e-12);
});

test("cash-out exactness holds across many sizes and prices, including float cases that round one unit short", async () => {
  const VZB = ver("bstocks", "VZB", "VZ"); // bStocks has no $5.01 floor, so tiny payouts reach execute too
  const cases: [number, number, number][] = [[80.9456, 1.024, 159.85664000000003]]; // floor8(pay * p / p) !== floor8(pay) without the nudge
  for (const tokens of [0.37, 1, 2.5, 7.77, 13, 101.123456, 999.99999999]) for (const mult of [1.0003, 1.0465, 1.1, 1.5]) cases.push([tokens, mult, 41.17 * mult]);
  assert.equal(cases.length, 29);
  for (const [tokens, mult, tokenUsd] of cases) {
    const { deps } = setup(tokens, { multiplier: async () => mult, priceVersions: async ([v]) => [{ ...priceOf(v, tokenUsd / mult, true), tokenUsd }] }, VZB);
    const spy = spyExecute();
    await paydayCashOut(WALLET, "VZB", { live: false, maxUsdPerTrade: 1e9 }, { ...deps, execute: spy });
    assert.equal(spy.calls.length, 1, `tokens ${tokens} mult ${mult}`);
    const sells = floor8((spy.calls[0].rule.action.usd as number) / tokenUsd);
    assert.equal(sells, floor8(tokens * (1 - 1 / mult)), `tokens ${tokens} mult ${mult}`);
  }
});

test("cash-out is dry by default and does not touch the position", async () => {
  const { store, deps } = setup(5);
  const spy = spyExecute();
  const { receipt, sold } = await paydayCashOut(WALLET, "VZon", { live: true, maxUsdPerTrade: 20 }, { ...deps, execute: spy });
  assert.equal(spy.calls[0].opts.live, false);
  assert.equal(receipt.outcome, "dry_run");
  assert.equal(sold, 0);
  assert.equal(store.positionsFor(WALLET)[0].tokens, 5);
});

test("cash-out above the cap, below the Ondo minimum, or from the wrong wallet never reaches execute", async () => {
  const spy = spyExecute();
  const big = setup(20); // payout worth about $36.80
  const a = await paydayCashOut(WALLET, "VZon", { live: false, maxUsdPerTrade: 20 }, { ...big.deps, execute: spy });
  assert.equal(a.receipt.outcome, "skipped");
  assert.match(a.receipt.reason, /per-trade cap of \$20/);
  const tiny = setup(1); // payout worth about $1.84, under the Ondo $5.01 minimum
  const b = await paydayCashOut(WALLET, "VZon", { live: false, maxUsdPerTrade: 20 }, { ...tiny.deps, execute: spy });
  assert.equal(b.receipt.outcome, "skipped");
  assert.match(b.receipt.reason, /at least \$5\.01/);
  const other = setup(5, { wallet: async () => "0x3333333333333333333333333333333333333333" });
  const c = await paydayCashOut(WALLET, "VZon", { live: false, maxUsdPerTrade: 20 }, { ...other.deps, execute: spy });
  assert.match(c.receipt.reason, /signing wallet is 0x3333/);
  assert.equal(spy.calls.length, 0);
});

test("cash-out with nothing earned is a receipt, not a trade", async () => {
  const spy = spyExecute();
  const { deps } = setup(5, { multiplier: async () => 1 });
  const { receipt } = await paydayCashOut(WALLET, "VZon", { live: false, maxUsdPerTrade: 20 }, { ...deps, execute: spy });
  assert.equal(spy.calls.length, 0);
  assert.match(receipt.reason, /not earned a dividend/);
});
