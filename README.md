# Tailor Measure BD

Offline, bilingual (English / Bangla) measurement and order tracker for Bangladeshi
tailoring shops. Keep customer measurements, track each order from Pending to
Delivered, watch overdue deliveries, and print a measurement card — all in the
browser, with no account and no network calls.

## Features

- **Customer records** — name, Bangladeshi mobile, garment type (Panjabi, Shirt,
  Pant, Salwar Kameez, Sherwani, Suit, Other), optional note.
- **Measurements in inches** — Length, Chest, Waist, Hip, Shoulder, Sleeve, Neck,
  Bottom, each validated against a sensible range; at least one is required.
- **Order pipeline** — Pending → Cutting → Stitching → Ready → Delivered, with
  one-click stage moves.
- **Money in integer paisa** — total price, advance paid, and due amount computed
  without float error.
- **Delivery watch** — dashboard counts for customers, active orders, overdue
  deliveries, due-today deliveries, and total due; overdue / due-today / due-soon
  badges on each card, overdue cards sorted first.
- **Search & filter** — live search by name, mobile, or garment, plus status
  filter chips.
- **Printable measurement card** — one click prints a clean card (measurements,
  price / paid / due, delivery date) for the cutting table.
- **Data tools** — JSON export, strict JSON import (wrong app, version, or
  malformed customer rejected with data intact), and typed-DELETE erase-all.
- **Bilingual UI** — English / Bangla toggle, persisted across reloads, with
  Bengali digits in Bangla mode; all data persists in `localStorage`.
- **Mobile-friendly** — verified at 390 px width with no horizontal overflow.

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no network
requests. Business logic lives in `logic.js` (DOM-free, shared with the tests);
strings live in `i18n.js`; rendering in `app.js`.

## Run locally

Open `index.html` in any modern browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Tests

```sh
node tests/test_logic.js   # 39 unit tests for logic.js
node tests/smoke.js        # 20 headless-Chrome checks (raw CDP, no deps)
```

The smoke test needs a Chromium binary at `/opt/meta-chromium/chrome` (the
factory VM path); adapt the `CHROME` constant for other machines.

## File layout

```
index.html        Page structure
style.css         Styling + print CSS for the measurement card
app.js            UI, persistence, export/import, printing
logic.js          DOM-free rules: validation, money, badges, stats, import
i18n.js           English/Bangla strings
tests/test_logic.js  Node unit tests
tests/smoke.js    Headless-Chrome smoke tests
TEST_RESULTS.md   Real test results for this build
```

## Limitations

- Data lives in this browser's `localStorage` only — no sync, no multi-device
  access. Export JSON regularly as a backup.
- Measurements are stored as entered; the app validates ranges but cannot verify
  a measurement was taken correctly. Re-check measurements before cutting cloth.
- The delivery-date badges use the device clock; a wrong device date gives
  wrong badges.
- This is a personal shop tool, not accounting software and not a substitute
  for a paper measurement book.

## Status

MVP, complete and tested (see `TEST_RESULTS.md`). Ships empty — no demo
customers, no fabricated data.
