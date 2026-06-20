# Instant Invoice

A free, **open-source**, 100% frontend invoice generator for **private users and companies**. No backend, no account, no login — just open it in a browser and start invoicing.

## Live demo

| | URL |
|---|-----|
| **Invoice app** | https://christopherwang0129SE.github.io/instant-invoice/ |
| **Marketing site** | https://christopherwang0129SE.github.io/instant-invoice/site/ |
| **Source code** | https://github.com/christopherwang0129SE/instant-invoice |

## Use it locally

Double-click `index.html`, or:

```bash
open index.html        # macOS
# Windows: double-click the file · Linux: xdg-open index.html
```

No install, no build step, no server, no sign-up. Works offline.

## Features

- **Clean Personal/Freelancer layout** that scales up for company invoicing.
- **Parties** — name, address, VAT / Org. nr / Tax ID, email, and phone for both sender and recipient.
- **Line items** — description, quantity, rate, optional per-line discount %, and a live amount.
- **Totals** — subtotal, global discount (% or fixed), tax / VAT, and grand total, all recalculated live.
- **Currency selector** — $, €, £, ¥, CHF, kr, C$, A$.
- **Payment details** — Payment terms (e.g. "Net 14"), Bank / Account name, IBAN, BIC / SWIFT, and account number.
- **OCR number** (Nordic structured payment reference) with an unobtrusive **MOD10 / Luhn checksum** indicator that hints validity without blocking input.
- **Exports (all client-side):**
  - **Download PDF** — print-to-PDF via the browser's native dialog; editing chrome is hidden for a clean one-page invoice.
  - **Download HTML** — a self-contained `.html` snapshot with inline styles and no editing controls.
  - **Save JSON** — export the invoice data to a `.json` file.
  - **Load JSON** — import a previously saved `.json` back into the form.
  - Downloaded files are named after the invoice number.
- **Local autosave** — everything is saved in the browser via `localStorage` and restored on reload. Optional fields left blank are omitted from the printed/exported invoice. The **New** button clears everything.

## Privacy

All data stays **local in your browser** (`localStorage`). There is no backend, no network request, and no tracking. Clearing your browser storage (or clicking **New**) removes the saved invoice.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and structure |
| `styles.css` | Layout, theme, and print styles |
| `app.js` | Line items, totals, OCR validation, autosave, exports |
| `LICENSE` | MIT License |
| `layouts-preview.html` | Static gallery of four layout mockups |
| `site/` | Demo marketing landing page |
| `README.md` | This file |

## Contributing

Contributions are welcome! This is an MIT-licensed open-source project. Open an issue or pull request with bug fixes, layout options, currency/locale improvements, or new export formats. Since it's a dependency-free static site, you can develop by simply editing the files and refreshing the browser.

## License

[MIT](LICENSE) © 2026 Instant Invoice contributors
