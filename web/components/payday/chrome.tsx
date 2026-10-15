import Link from "next/link";
import { EXAMPLE_ADDRESS, PAYDAY_NAME } from "@/lib/payday";

export function Header() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="inline-flex min-h-14 items-center font-serif text-[1.625rem] font-medium leading-none tracking-[-0.01em]">
          {PAYDAY_NAME}
        </Link>
        <div className="flex items-center gap-5">
        <span className="live-chip fig inline-flex items-center gap-2 rounded-full border border-rule-strong px-3 py-1 text-[0.75rem] text-ink-2">
          <span aria-hidden className="size-1.5 rounded-full bg-ok" />
          <span className="sm:hidden">Live</span><span className="max-sm:hidden">BNB Chain, read live</span>
        </span>
        <Link
          href={`/?address=${EXAMPLE_ADDRESS}`}
          className="inline-flex min-h-14 items-center whitespace-nowrap font-mono text-[0.875rem] font-bold text-ochre underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          Read a sample
        </Link>
        </div>
      </div>
    </header>
  );
}

export const NOTES = [
  {
    term: "How a dividend is counted",
    text: "An Ondo token grows the number of shares it stands for. Tokens held, times the growth since the baseline rate, priced at the stock's current price.",
  },
  {
    term: "Where the figures come from",
    text: "Balances are read with Multicall3 on BNB Chain at the block printed above each statement. Share rate, stock price and the token list come from the Binance Web3 public RWA endpoints when the page loads. Times are UTC.",
  },
  {
    term: "What cash-out does",
    text: "It asks the Binance Web3 API for a quote, simulates the transactions for your address, and hands them to your own wallet. The page holds no key that can sign.",
  },
];

export function Footer() {
  return (
    <footer className="mt-28 border-t border-ink">
      <div className="mx-auto max-w-[1120px] px-5 py-12 md:px-8">
        <p className="max-w-[34ch] font-serif text-[1.5rem] font-normal leading-snug">
          The dividend was always yours. Now it has a line on the page.
        </p>
      </div>
    </footer>
  );
}
