import { orderState, respond } from "@/lib/cashout";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return respond(() => orderState({ orderId: q.get("orderId") ?? undefined, txHash: q.get("txHash") ?? undefined }));
}
