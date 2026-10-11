import { BadAddress, buildStatement } from "@/lib/payday";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  try {
    return Response.json(await buildStatement(address));
  } catch (e) {
    if (e instanceof BadAddress) return Response.json({ error: e.message }, { status: 422 });
    console.error("statement route", e);
    return Response.json({ error: "The chain or the Binance list did not answer. Try again in a moment." }, { status: 502 });
  }
}
