export const usd = (n: number, d = 2) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const tokens = (n: number) => Number(n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** "12 Oct, 14:05" in UTC. Callers append the zone name. */
export const utcTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
