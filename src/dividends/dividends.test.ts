import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StockVersion } from "../types.ts";
import { dynamicMultiplier, listBsc, reconcile } from "./multiplier.ts";
import { accrue, history, payoutTokens, record, SplitDetected } from "./accrual.ts";
import { statement } from "./statement.ts";

const ver = (multiplier: number, symbol = "VZon", ticker = "VZ"): StockVersion =>
  ({ ticker, issuer: "ondo", symbol, address: "0x0000000000000000000000000000000000000001", decimals: 18, multiplier, route: "RFQ" });

test("live: VZon and KOon accrue, TSLAon does not, AAPLx reconciles", async () => {
  const rows = await listBsc();
  assert.ok(rows.length > 50, `list rows ${rows.length}`);
  const addr = (s: string) => {
    const r = rows.find((x) => x.symbol === s);
    assert.ok(r, `${s} not on BSC list`);
    return r.address;
  };
  const at = new Date().toISOString();
  const [vz, ko, tsla] = await Promise.all(["VZon", "KOon", "TSLAon"].map((s) => dynamicMultiplier(addr(s))));
  const rec = await reconcile(addr("AAPLx"));
  console.log(`LIVE ${at} VZon=${vz} KOon=${ko} TSLAon=${tsla} AAPLx list=${rec.list} dynamic=${rec.dynamic} agree=${rec.agree}`);
  assert.ok(vz > 1.02, `VZon ${vz}`);
  assert.ok(ko > 1.02, `KOon ${ko}`);
  assert.equal(tsla, 1);
  assert.equal(typeof rec.agree, "boolean");
});

test("payoutTokens = tokens * (1 - baseline/multiplier)", () => {
  const a = accrue(ver(1.0465), 100, 1, 40);
  assert.ok(Math.abs(payoutTokens(a) - 100 * (1 - 1 / 1.0465)) < 1e-9);
  assert.ok(Math.abs(a.accruedShares - 4.65) < 1e-9);
  assert.ok(Math.abs(a.accruedUsd - 186) < 1e-6);
  // selling payoutTokens at multiplier*price yields exactly the accrued shares worth
  assert.ok(Math.abs(payoutTokens(a) * 1.0465 - a.accruedShares) < 1e-9);
});

test("10x jump throws SplitDetected; 2x too; 3% dividend does not", () => {
  assert.throws(() => accrue(ver(10, "NFLXon", "NFLX"), 5, 1, 70), SplitDetected);
  assert.throws(() => accrue(ver(2.004), 5, 1, 70), SplitDetected);
  assert.doesNotThrow(() => accrue(ver(1.03), 5, 1, 70));
  assert.doesNotThrow(() => accrue(ver(1.5), 5, 1, 70));
});

test("history is append-only per address", () => {
  const f = join(mkdtempSync(join(tmpdir(), "mult-")), "sub", "m.jsonl");
  assert.deepEqual(history("0xAB", f), []);
  record("0xAB", 1, "dynamic", 1, f);
  record("0xCD", 2, "list", 2, f);
  record("0xab", 1.01, "dynamic", 3, f);
  const h = history("0xAB", f);
  assert.equal(h.length, 2);
  assert.deepEqual(h.map((r) => r.multiplier), [1, 1.01]);
});

test("statement is plain English", () => {
  const lines = statement([accrue(ver(1.0465), 10, 1, 39.57), accrue(ver(1, "KOon", "KO"), 3, 1, 70)]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "Verizon (VZon): 10 tokens have earned 0.465 extra shares, worth $18.40 at today's price.");
  for (const l of lines) assert.ok(!/multiplier/i.test(l));
  assert.match(lines[1], /not earned/);
});
