# Activity Log

> Versão em português: [LEIA-ME.md](LEIA-ME.md)

A local Chrome extension to log activity, understand patterns and drive a
progressive reduction down to zero. Everything stays in
`chrome.storage.local`; nothing leaves the browser.

## Install

1. Download or clone this folder.
2. `chrome://extensions` → developer mode → load unpacked, or reload the
   extension if it is already installed.
3. Your data stays where it was: the dashboard reads the same `registros`
   key. To move the base to another profile, use Export and Import.

Always replace the files in the **same folder** already loaded. A new folder
becomes a different extension with a different ID, and `chrome.storage.local`
is per ID.

## Core ideas

| Concept | How it works |
|---|---|
| Logical day | Starts at **04:00**: late-night entries belong to the previous day |
| Day type | Home office, office or day off. Defaults from the weekday, correctable by hand |
| Type line | Median of complete days of that type. This is the comparison ruler |
| Day target | The type line multiplied by the reduction-goal factor |
| Records | All-time, with no monthly reset |

Comparing a Saturday against the average of every day mixes different
populations: almost every day off would read as above average and almost
every working day as below. That is why each day is measured against its own
type.

## Data model

Entry: `{ data, hora, quantidade, timestamp, gatilho, nota }`, with `gatilho`
and `nota` optional. Other storage keys:

- `tiposDia` — `{ "2026-09-05": "off", ... }`, only the days corrected by
  hand. The default comes from the weekday: Saturday and Sunday are off,
  Tuesday and Thursday are office, the rest is home office.
- `config` — window, reduction goal, moving averages, theme and message tone.

## Quick log (popup)

The popup shows today's total, the last 7 days and the time since the last
entry. The bar and the sentence below compare the day against the **line of
the same day type**, and the text names which line is in use.

Comparison rules:

- The reference is the **median** of complete days of that type, not the
  mean: a single outlier day does not move tomorrow's ruler.
- Today never feeds its own reference, because the day is still open.
- Days with no entries count as 0 g. Those are the days that pull the line
  down.
- With fewer than 3 complete days of that type the sample is still noise: the
  comparison falls back to the daily average of recent complete days and the
  text says what is missing.
- Hovering the bar shows the sample size and the day target under the
  reduction goal.

The "Hoje é" buttons classify the day straight from the popup and the
comparison is recomputed immediately. This matters because the default comes
from the weekday alone and gets it wrong on holidays, a day off mid-week, or
office time outside the usual days. The choice is stored under `tiposDia`,
the same key the dashboard uses, and the dashboard refreshes itself when
open.

## Files

| File | Role |
|---|---|
| `dia.js` | Logical day, day type, each type's line and the goal factor. Shared by the dashboard and the popup so both screens use the same ruler |
| `script.js` | Full dashboard: aggregation, charts, calendar and reduction route |
| `popup.js` | Quick log: entry, daily cards and comparison against the day-type line |
| `mensagens.js` | Bank of direction sentences, picked from the state of the day |

## Outside the extension

Opening `index.html` directly in the browser swaps `chrome.storage` for a
`localStorage` mirror — useful for testing without installing.
