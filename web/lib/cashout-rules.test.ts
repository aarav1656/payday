import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_CASHOUT_USD, refuseCashOut, withDomainType } from "./cashout-rules.ts";

const A = "0x8768C8969e177575e37435B8295aFa2DFB231C86";
const B = "0x000000000000000000000000000000000000dEaD";

test("refuses a different wallet, in any letter case", () => {
  assert.match(refuseCashOut({ statementAddress: A, connected: B, notionalUsd: 10 }) ?? "", /Connect the wallet that holds these tokens/);
  assert.equal(refuseCashOut({ statementAddress: A, connected: A.toLowerCase(), notionalUsd: 10 }), null);
});

test("cap is $25: 25 passes, 25.01 is refused", () => {
  assert.equal(refuseCashOut({ statementAddress: A, connected: A, notionalUsd: MAX_CASHOUT_USD }), null);
  assert.match(refuseCashOut({ statementAddress: A, connected: A, notionalUsd: 25.01 }) ?? "", /above \$25/);
});

test("floor is $5 and a non-number never passes", () => {
  assert.match(refuseCashOut({ statementAddress: A, connected: A, notionalUsd: 4.99 }) ?? "", /Below the \$5 minimum/);
  assert.equal(refuseCashOut({ statementAddress: A, connected: A, notionalUsd: 5 }), null);
  assert.notEqual(refuseCashOut({ statementAddress: A, connected: A, notionalUsd: NaN }), null);
});

test("withDomainType adds the domain type once and keeps the rest", () => {
  const raw = JSON.stringify({ domain: { name: "X", version: "1", chainId: 56, verifyingContract: A }, types: { Order: [{ name: "a", type: "uint256" }] }, primaryType: "Order", message: { a: 1 } });
  const out = JSON.parse(withDomainType(raw));
  assert.deepEqual(out.types.EIP712Domain.map((f: { name: string }) => f.name), ["name", "version", "chainId", "verifyingContract"]);
  assert.deepEqual(out.types.Order, [{ name: "a", type: "uint256" }]);
  assert.equal(withDomainType(JSON.stringify(out)), JSON.stringify(out));
});
