export const usd = (n: number, d = 2) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const tokens = (n: number) => Number(n.toFixed(6)).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** "12 Oct, 14:05" in UTC. Callers append the zone name. */
export const utcTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/** "11 Oct 2026" in UTC. */
export const utcDate = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** "+0.52% more shares since launch": growth of the share rate over the baseline rate. */
export const moreShares = (multiplier: number, baseline: number) => `+${((multiplier / baseline - 1) * 100).toFixed(2)}%`;
