import Link from "next/link";
import { carryingDividends, EXAMPLE_ADDRESS } from "@/lib/payday";
import { Note } from "./bits";
import { Certificate } from "./certificate";

export async function IdleView() {
  let data;
  try {
    data = await carryingDividends(8);
  } catch (e) {
    console.error("carrying", e);
    return <Note tone="stop">Binance&apos;s token list did not answer. Reload in a moment.</Note>;
  }
  const top = data.rows[0];
  return (
    <section aria-labelledby="carrying">
      <h2 id="carrying" className="max-w-[26ch] text-[1.75rem] font-normal leading-tight md:text-[2rem]">
        {data.total} of {data.scanned} Ondo tokens are carrying a dividend right now.
      </h2>
      <p className="mt-3 max-w-[56ch] text-ink-2">
        Each one stands for more than one share. The highest today, drawn as the certificate it behaves like:
      </p>
      {top && (
        <div className="mt-6 max-w-[40rem]">
          <Certificate company={top.company} symbol={top.symbol} ticker={top.ticker} multiplier={top.multiplier} baseline={1} />
        </div>
      )}
      <table className="mt-8 w-full max-w-[40rem] border-y border-rule-strong text-left">
        <caption className="sr-only">Ondo tokens with the highest share rate</caption>
        <thead>
          <tr className="label border-b border-rule-strong">
            <th scope="col" className="py-2.5 font-bold">Employer</th>
            <th scope="col" className="py-2.5 text-right font-bold">Share rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {data.rows.map((r) => (
            <tr key={r.symbol}>
              <th scope="row" className="py-3 pr-3 font-normal">
                <span className="font-serif text-[1.0625rem] font-medium">{r.company ?? r.ticker}</span>
                <span className="fig ml-2 text-[0.8125rem] text-ink-3">{r.symbol}</span>
              </th>
              <td className="fig py-3 text-right">{r.multiplier.toFixed(5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 max-w-[56ch] text-ink-2">
        No address to hand?{" "}
        <Link href={`/?address=${EXAMPLE_ADDRESS}`} className="inline-flex min-h-11 items-center font-bold text-ochre underline underline-offset-4">
          Open the FXIon pool&apos;s payslip
        </Link>
        , a live address that holds Ondo tokens.
      </p>
    </section>
  );
}
