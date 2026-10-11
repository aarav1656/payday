# DESIGN.md

Hallmark catalog theme: **Atelier** (warm paper, high-contrast roman serif, one ink accent, hairlines instead of cards).

Genre: editorial. Macrostructure: Remittance slip. The product is a payslip, so the page is a payslip: a perforated pay stub on a desk, a share certificate that shows the multiplier as a filling bar, and a cheque that prints when the holder asks for a cash-out quote. Nav archetype: N9 edge-aligned minimal. Footer archetype: Ft6 letter close.

Audience: income investors outside the US who hold Ondo tokenized stocks on BNB Chain and want dividend income shown the way a broker or employer shows it. Use: say whose payslip, read each earning line, ask for a cash-out cheque. Tone: a pay slip read at a kitchen table. Plain, warm, exact.

Product name lives in one constant: `lib/payday.ts` `PAYDAY_NAME`.

## Tokens

| Token | Value | Role |
|---|---|---|
| desk | oklch(90.3% 0.031 86) / #E8DEC8 | page, the surface the paper lies on |
| sheet | oklch(97.6% 0.016 92) / #FBF7EB | pay stub paper |
| cheque | oklch(93.3% 0.031 95) / #EFE9D2 | cheque paper, certificate wash |
| rule | oklch(79.7% 0.046 84) / #CBBB9C | hairlines, dot leaders (decorative only) |
| rule-strong | oklch(64.0% 0.055 84) / #9C8A66 | cheque border, certificate frame |
| ink | oklch(23.7% 0.021 70) / #251D14 | text, input underline |
| ink-2 | oklch(37.3% 0.027 69) / #4A3E31 | secondary text |
| ink-3 | oklch(46.6% 0.035 73) / #665744 | stub field labels (6.5:1 on sheet) |
| ochre | oklch(48.5% 0.109 61) / #8A4E08 | the one accent: the dividend sliver, primary action, links, focus ring |
| ochre-ink | oklch(97.1% 0.018 86) / #FBF5E8 | text on ochre (6.1:1) |
| stop | oklch(45.5% 0.143 31) / #962D1E | error and VOID text, always with a glyph or word |
| warn | oklch(45.3% 0.093 90) / #6A5300 | caution text with a glyph |
| ok | oklch(43.2% 0.074 153) / #2D5C3C | passed text with a glyph |

## Type

- Display and amounts: Young Serif, roman, single weight 400. Headline, company names, the net pay figure, the certificate share count.
- Stub fields and labels: Courier Prime, the typewriter that fills in a pay stub. Uppercase labels, tracked.
- Prose: Hanken Grotesk.
- Scale (rem): 0.75 field label, 0.875 small, 1 body, 1.25 sentence, 1.75 section, 3 to 4 display. Measure 62ch max.

## Space, shape, motion

- 4pt scale. Page column 1120px, 20px gutter at 375, 32px from md. Desktop: left column (headline and the "Whose payslip?" entry), right column (the stub).
- Radius 2px. Sheets (stub, cheque) have scalloped perforation edges and one soft drop shadow because they are paper lying on a desk. Nothing else has a shadow.
- Motion: opacity and transform only. One entrance (stub lines rise 6px, 180ms) and one signature move: the dividend sliver on the certificate fills once, 900ms ease-out. Press is scale 0.97. `prefers-reduced-motion` removes all of it.
- Focus: 2px ochre ring, offset 2px, shown instantly.

## Voice

Plain English, no filler adjectives. Every figure carries its block and time on the stub header. Times are UTC. No em dashes. Honest states: a closed market prints a VOID cheque with the reason Binance gave.
