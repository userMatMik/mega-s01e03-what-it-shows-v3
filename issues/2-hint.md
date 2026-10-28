# booking-v3 form hint says MM/DD/YYYY but the form reads day first (33 reports)

Split from #4471 ("dates parse mm/dd in eu locales"), which the desk merged by subject line and marked known.

**Covers 33 reports**: the desk's `hint` row for #4471, as exported. The desk's table marks this row "not this ticket — no ticket of its own"; this is that ticket.

## What happens

booking-v3 prints `MM/DD/YYYY` under its date field. On a day-first tenant, people type the month first as the hint tells them, and the form reads the date the tenant's way, day first. It comes in only through the booking-v3 form, and it has its own cause: `DATE_HINT['booking-v3']` in `causes.ts` against a day-first tenant locale. The parser fix in #1 does not touch it.

- R-41241 (alder.physio, form, 2026-04-21): "We had two people show up on 8 June. They were booked for 6 August."
- R-41305 (copper.studio, form, 2026-05-27): "Booked for 9 August. The invite says 8 September."

| | |
|---|---|
| Tenants (3) | `alder.physio`, `copper.studio`, `pale.harbour` |
| Channels | form ×33 |
| Received | 2026-04-17 → 2026-09-22 |
| Intake tagged them as | hint ×18 · parser ×15 (intake guesses from the browser; the tenant decides the cause) |

## Fix

Print the tenant's own date order under the field (or use a date picker), and read the field in that same order.

<details><summary>All 33 report ids</summary>

R-41230, R-41241, R-41251, R-41259, R-41262, R-41275, R-41294, R-41305, R-41308, R-41366, R-41372, R-41384, R-41387, R-41396, R-41400, R-41406, R-41415, R-41416, R-41418, R-41428, R-41439, R-41441, R-41449, R-41453, R-41456, R-41460, R-41472, R-41485, R-41493, R-41539, R-41572, R-41582, R-41584

</details>

---
Counted the desk's way, from the kb export of 2026-10-04: 427 rows, 412 reports once each id is counted once (15 were exported twice), every one merged into #4471, each in the desk row `groupByCause` in `src/lib/kb/causes.ts` files it under. Computed by `src/lib/kb/split.ts` (`node tools/analyze.ts`); page: `src/routes/kb/incidents/4471-split/+page.svx`, as the desk sees it: `rendered/kb/incidents/4471-split.html`.
