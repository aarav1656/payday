const BASE = "https://www.binance.com/bapi/defi";
const HEADERS = { "Accept-Encoding": "identity", "User-Agent": "binance-web3/1.1 (Skill)" };

export interface ListRow { symbol: string; ticker: string; address: string; multiplier: number }

async function get(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`HTTP ${res.status} ${url}: ${body.slice(0, 200)}`);
  const json = JSON.parse(body);
  if (json?.success === false) throw new Error(`Binance API error code=${json.code} message=${json.message}`);
  return json.data;
}

/** All BSC rows of the stock list (types 1 ondo, 2 xstocks, 3 bstocks), addresses lowercased. */
export async function listBsc(): Promise<ListRow[]> {
  const pages = await Promise.all([1, 2, 3].map((t) => get(`${BASE}/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=${t}`)));
  return (pages.flat() as any[])
    .filter((r) => r.chainId === "56")
    .map((r) => ({ symbol: r.symbol, ticker: r.ticker, address: String(r.contractAddress).toLowerCase(), multiplier: Number(r.multiplier) }));
}

/** Multiplier from the list endpoint (known to disagree with dynamic for xStocks). */
export async function listMultiplier(address: string): Promise<number> {
  const row = (await listBsc()).find((r) => r.address === address.toLowerCase());
  if (!row || !Number.isFinite(row.multiplier)) throw new Error(`no list multiplier for ${address} on BSC`);
  return row.multiplier;
}

/** Multiplier from the dynamic endpoint (tokenInfo.sharesMultiplier). */
export async function dynamicMultiplier(address: string): Promise<number> {
  const d = await get(`${BASE}/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai?chainId=56&contractAddress=${address}`);
  const m = Number(d?.tokenInfo?.sharesMultiplier);
  if (!Number.isFinite(m) || m <= 0) throw new Error(`no dynamic multiplier for ${address}`);
  return m;
}

export async function reconcile(address: string): Promise<{ list: number; dynamic: number; agree: boolean }> {
  const [list, dynamic] = await Promise.all([listMultiplier(address), dynamicMultiplier(address)]);
  return { list, dynamic, agree: Math.abs(list - dynamic) <= 1e-9 * Math.max(list, dynamic) };
}
