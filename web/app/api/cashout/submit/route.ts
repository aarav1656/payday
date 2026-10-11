import { CashOutRefused, respond, submitCashOut } from "@/lib/cashout";

export const dynamic = "force-dynamic";

// Relays a signature the user's own wallet produced. The server never holds a key.
export async function POST(req: Request) {
  return respond(async () => {
    const b = await req.json().catch(() => null);
    for (const k of ["address", "connected", "symbol", "signature", "quoteId"]) {
      if (typeof b?.[k] !== "string") throw new CashOutRefused(`Send ${k} as a string.`, 400);
    }
    return submitCashOut(b);
  });
}
