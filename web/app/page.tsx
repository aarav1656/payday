import { Suspense } from "react";
import { Page, Skeleton } from "@/components/payday/bits";
import { IdleView } from "@/components/payday/idle-view";
import { StatementView } from "@/components/payday/statement-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYDAY_LINE } from "@/lib/payday";
import { NOTES } from "@/components/payday/chrome";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const raw = (await searchParams).address;
  const address = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <Page className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-8">
        <h1 className="text-[2.25rem] font-normal leading-[1.05] tracking-[-0.015em] md:text-[2.875rem]">{PAYDAY_LINE}</h1>
        <p className="mt-5 max-w-[40ch] text-[1.0625rem] text-ink-2">
          Ondo tokens fold dividends into a share multiplier, so the income never shows up as cash. Payday reads it back as income, token by token, and cashes it out to USDT.
        </p>

        <form action="/" method="get" className="mt-10">
          <label htmlFor="address" className="amount block text-[1.5rem] leading-tight">Whose dividends?</label>
          <p id="address-help" className="mt-1 text-[0.875rem] text-ink-3">Paste any BNB Chain address. Reading it needs no wallet.</p>
          <Input
            id="address"
            name="address"
            defaultValue={address}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            required
            aria-describedby="address-help"
            className="fig mt-3 text-[0.8125rem] sm:text-[0.9375rem]"
          />
          <Button type="submit" className="mt-4 w-full sm:w-auto">Read dividends</Button>
        </form>

        <Notes className="mt-12 max-lg:hidden" />
      </div>

      <div className="min-w-0">
        {address ? (
          <Suspense key={address} fallback={<Skeleton rows={4} />}>
            <StatementView address={address} />
          </Suspense>
        ) : (
          <Suspense fallback={<Skeleton rows={4} />}>
            <IdleView />
          </Suspense>
        )}
        <Notes className="mt-12 lg:hidden" />
      </div>
    </Page>
  );
}

function Notes({ className }: { className: string }) {
  return (
    <dl className={`divide-y divide-rule border-y border-rule text-[0.875rem] leading-relaxed text-ink-2 ${className}`}>
      {NOTES.map((n) => (
        <div key={n.term} className="py-4">
          <dt className="label mb-1">{n.term}</dt>
          <dd>{n.text}</dd>
        </div>
      ))}
    </dl>
  );
}
