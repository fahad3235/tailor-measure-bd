# TEST RESULTS — tailor-measure-bd (2026-10-25, 14:00 slot)

## Unit tests — 39/39 PASS

`node tests/test_logic.js` → `PASS 39 / FAIL 0`

Hand-verified cases include:

- Money: `toPaisa('2500.50') = 250050`; `fmtMoney(250050) = '2,500.50'`;
  due for price 500,000 paisa minus advance 200,000 paisa = 300,000 paisa.
- Phones: `01712345678` valid (also with spaces/dashes); `012…` prefix and
  10-digit numbers rejected.
- Validation: empty name, 81-char name, bad phone, unknown garment, no
  measurements, chest 200 (out of range), advance over price, delivery before
  order, malformed delivery date — each rejected with the expected code.
- Pipeline: `pending → cutting`, `ready → delivered`, `delivered → null`.
- Badges (today 2026-10-25): delivery 2026-10-20 → overdue 5 days;
  2026-10-25 → today; 2026-10-27 → soon 2 days; 2026-11-10 → none; delivered
  order → none.
- Dashboard: 3 customers (1 overdue, 1 due today, 1 delivered) →
  total 3, active 2, overdue 1, dueToday 1, totalDue 400,000 paisa.
- Filter/sort: name filter, status filter, overdue-first / delivered-last sort.
- Import: wrong app, wrong version, duplicate id, bad customer, null —
  all rejected with the expected code.

One test-side fix during the run: the chest-out-of-range case also yields
`noMeasure` (an invalid value does not count as a measurement), so the
expectation was corrected to `['measure:chest', 'noMeasure']`. No app bug.

## Smoke tests — 20/20 PASS

`node tests/smoke.js` (raw CDP, headless Chromium, `file://`) →
`20/20 smoke checks passed`, 0 console/page errors, zero http(s) requests.

Scenario verified in a real browser:

- EN title, empty state, zero stats on first load.
- Empty-form submit shows an inline error and creates no card.
- Valid submit (Rahim Uddin, Panjabi, price 5000, advance 2000, length 42,
  chest 40, delivery 2026-10-30) creates one card showing due 3,000.00;
  stats become customers 1 / active 1.
- Next-stage click moves status Pending → Cutting.
- Search `zzz-no-match` hides the card; clearing restores it.
- Bangla toggle shows the Bangla title and due `৩,০০০.০০`.
- Reload keeps Bangla language and the saved card (localStorage persistence).
- 390 px viewport: no horizontal overflow.

## Source hygiene

All shipped sources are pure ASCII (Bengali as `\uXXXX` escapes in JS,
numeric entities in HTML) — verified with `grep -P '[^\x00-\x7F]'` returning
no matches. Tests were re-run green after escaping.
