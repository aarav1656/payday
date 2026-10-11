import { BadAddress, cashOutDryRun } from "@/lib/payday";

export const dynamic = "force-dynamic";

// Dry run only. This handler has no signing path: it quotes and simulates through the Binance Web3 API.
export async function POST(req: Request) {
  let body: { address?: unknown; symbol?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with address and symbol." }, { status: 400 });
  }
  if (typeof body.address !== "string" || typeof body.symbol !== "string") {
    return Response.json({ error: "address and symbol must be strings." }, { status: 400 });
  }
  try {
    return Response.json(await cashOutDryRun(body.address, body.symbol));
  } catch (e) {
    if (e instanceof BadAddress) return Response.json({ error: e.message }, { status: 422 });
    const message = e instanceof Error ? e.message : "Dry run failed.";
    console.error("cashout route", message);
    return Response.json({ error: message }, { status: 422 });
  }
}
