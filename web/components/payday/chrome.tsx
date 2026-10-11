import Link from "next/link";
import { EXAMPLE_ADDRESS, PAYDAY_NAME } from "@/lib/payday";

export function Header() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 md:px-8">
        <Link href="/" className="inline-flex min-h-14 items-center font-serif text-[1.625rem] font-medium leading-none tracking-[-0.01em]">
          {PAYDAY_NAME}
        </Link>
        <Link
          href={`/?address=${EXAMPLE_ADDRESS}`}
          className="inline-flex min-h-14 items-center whitespace-nowrap font-mono text-[0.875rem] font-bold text-ochre underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          Read a sample
        </Link>
      </div>
    </header>
  );
}

const NOTES = [
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
    text: "It asks the Binance Web3 API for a quote and simulates the approval. The page holds no key that can sign, so the order is always signed in your own wallet.",
  },
];

export function Footer() {
  return (
    <footer className="mt-28 border-t border-ink">
      <div className="mx-auto max-w-[1120px] px-5 py-12 md:px-8">
        <p className="max-w-[34ch] font-serif text-[1.5rem] font-normal leading-snug">
          The dividend was always yours. Now it has a line on the page.
        </p>
        <dl className="mt-10 grid gap-x-12 gap-y-6 text-[0.875rem] leading-relaxed text-ink-2 md:grid-cols-3">
          {NOTES.map((n) => (
            <div key={n.term}>
              <dt className="label mb-1.5">{n.term}</dt>
              <dd>{n.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </footer>
  );
}
