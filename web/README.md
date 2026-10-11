# Payday

Ondo tokenized stocks on BNB Chain fold dividends into a share `multiplier`, so holders never see the income. Payday reads that multiplier back as a dividend statement in plain English: which tokens an address holds, how many extra shares each has earned, what those shares are worth at today's stock price, and the total.

Each earning line carries a cash-out quote. Payday asks the Binance Web3 API to price selling exactly the dividend portion into USDT, then simulates the approval that sale needs. The web app only quotes and simulates. It holds no key that can sign, so every order is signed in the holder's own wallet.

## Run it

```bash
cd web
npm install && npm run dev
```

Open http://localhost:3000. The server reads `../.env`, which must define `BINANCE_W3_API_KEY` and `BINANCE_W3_API_SECRET`. The keys stay in the Node server process and never reach the browser.

## Routes

| Route | What it does |
|---|---|
| `/` | Address form, the statement for `?address=0x...`, and the live list of Ondo tokens carrying a dividend |
| `GET /api/statement?address=0x...` | The statement as JSON |
| `POST /api/cashout` | Dry-run quote and approval simulation for one token (`{ address, symbol }`) |

## Where the numbers come from

Balances are read with Multicall3 on BNB Chain at the block printed above each statement. Share rate, stock price and the token list come from the Binance Web3 public RWA endpoints when the page loads. The accrual, multiplier and quote logic is the repo's own `../src`, loaded by `lib/shared/src.ts` with Node's native TypeScript loader.

## Design

`DESIGN.md` holds the system: Hallmark Atelier theme, Young Serif, Hanken Grotesk and Courier Prime, ochre on warm paper.
