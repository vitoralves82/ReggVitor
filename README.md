# Activity Log — dashboard v2.1

> Versão em português: [LEIA-ME.md](LEIA-ME.md)

A local Chrome extension to log activity, understand patterns and drive a
progressive reduction down to zero. Everything stays in `chrome.storage.local`;
nothing leaves the browser.

## Install

1. Download or clone this folder.
2. `chrome://extensions` → reload the extension.
3. Your data is already there: the dashboard reads the same `registros` key from
   `chrome.storage.local`. Nothing to import.
   (To move the base to another profile: Backup → Import (merge).)

## Core concepts

| Before | Now |
|---|---|
| Monthly rankings and trophies (reset every month) | All-time records that never reset |
| Logical day started at midnight (late-night entries jumped to the next day) | **The logical day starts at 04:00** |
| Global averages (2 g on a Tuesday and 12 g on a Saturday in the same bucket) | Everything compared against the **median of the same day type** (home office / office / day off) |
| Import replaced the whole base | Import **merges** and deduplicates; nothing is deleted |

## Data model

Entry: `{ data, hora, quantidade, timestamp, gatilho, nota }` — `gatilho` and
`nota` are optional. Extra storage keys:

- `tiposDia` — `{ "2026-07-25": "off", ... }`, only the days you corrected by
  hand. The default comes from the weekday (Sat/Sun = off, Tue/Thu = office,
  the rest = home office).
- `config` — window, monthly target and theme.

## Reading the dashboard

1. Compare the 7-day average with the previous week and with the target path.
2. Find where the volume concentrates: day type, time of day and trigger.
3. Test a single lever for 7 days and check whether the average responded.

The **Reduction route** uses the first complete week as its baseline and shows
the 10%, 25%, 50%, 75% and zero-week milestones. It indicates direction, not a
clinical diagnosis.

## Quick log (popup)

The popup shows today's total, the last 7 days and the time since the last
entry. The message under the cards always proposes one simple direction:
protect or stretch the next interval, with no abrupt compensation.

Below the cards, the bar and the sentence compare the day against the **line of
the same day type**, not against a single average of every day. A Saturday is
compared with the median of your days off, a Tuesday at the office with the
median of your office days. Mixing different populations produces an alert that
guides nothing: almost every day off would read as "above average" and almost
every working day as "below".

Comparison rules:

- The reference is the **median** of complete days of that type, not the mean:
  a single outlier day does not move tomorrow's ruler.
- Today never feeds its own reference, because the day is still open.
- Days with no entries count as 0 g. Those are the days that pull the line down.
- With fewer than 3 complete days of that type the sample is still noise: the
  sentence falls back to the overall daily average and says so.

The three "Hoje é" buttons classify the day straight from the popup (home
office, office, day off) and the comparison is recomputed immediately. This
matters because the default comes from the weekday alone and gets it wrong on
holidays, a day off mid-week, or office time outside the usual days. The choice
is stored under `tiposDia`, the same key the dashboard uses, and the dashboard
refreshes itself when open.

The theme selected on the full page also applies to the popup.

## Files

| File | Role |
|---|---|
| `dia.js` | Logical day (04h), day type and the line (median) of each type. Shared by the dashboard and the popup so both screens use the same ruler. |
| `script.js` | Full dashboard: aggregation, charts, calendar and reduction route. |
| `popup.js` | Quick log: entry, daily cards and comparison against the day-type line. |
| `mensagens.js` | Bank of direction sentences, picked from the state of the day. |

## Outside the extension

Opening `index.html` directly in the browser swaps `chrome.storage` for a
`localStorage` mirror — useful for testing without installing.
