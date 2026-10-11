import type { Metadata } from "next";
import { Courier_Prime, Hanken_Grotesk, Young_Serif } from "next/font/google";
import { Footer, Header } from "@/components/payday/chrome";
import "./globals.css";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken", display: "swap" });
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-young", display: "swap" });
const mono = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  title: "Payday: the dividends your tokenized stocks have earned",
  description:
    "Ondo tokenized stocks on BNB Chain fold dividends into a share multiplier. Payday reads them back as a plain-English statement in dollars and quotes the cash-out.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
