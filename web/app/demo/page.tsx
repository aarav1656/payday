import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/payday/bits";
import { EXAMPLE_ADDRESS } from "@/lib/payday";

export const metadata: Metadata = {
  title: "Payday: the demo film",
  description: "Two minutes on how Payday reads the dividend hidden in an Ondo token and cashes out only that slice.",
};

export default function Demo() {
  return (
    <Page>
      <h1 className="max-w-[22ch] text-[2.25rem] font-normal leading-[1.05] tracking-[-0.015em] md:text-[2.875rem]">
        The dividend your token never paid out, in two minutes.
      </h1>
      <div className="panel mt-10 overflow-hidden p-2 md:p-3">
        <video
          src="/demo.mp4"
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-md bg-ink"
          aria-label="Payday demo film, with burned-in captions"
        />
      </div>
      <p className="mt-6 max-w-[60ch] text-ink-2">
        Every figure in the film is read live from BNB Chain and the Binance Web3 API.{" "}
        <Link href={`/?address=${EXAMPLE_ADDRESS}`} className="inline-flex min-h-11 items-center font-bold text-ochre underline underline-offset-4">
          Open the statement from the film
        </Link>
      </p>
    </Page>
  );
}
