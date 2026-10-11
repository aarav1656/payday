import { buildCashOut, CashOutRefused, respond } from "@/lib/cashout";

export const dynamic = "force-dynamic";

// Builds the next wallet step for the connected address. It signs and broadcasts nothing.
export async function POST(req: Request) {
  return respond(async () => {
    const b = await req.json().catch(() => null);
    if (typeof b?.address !== "string" || typeof b?.connected !== "string" || typeof b?.symbol !== "string") {
      throw new CashOutRefused("Send address, connected and symbol as strings.", 400);
    }
    return buildCashOut(b.address, b.connected, b.symbol);
  });
}
