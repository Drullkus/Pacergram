# Pacergram

Pacergram is a Claude Code mod for the Claude desktop app. It shows a band above the prompt that compares your usage to an even pace through each rate-limit window.

## What it shows

- One bar for the weekly window and one bar for the 5-hour window.
- The pace is the share of the window that has passed. At 3 days into a 7-day week, the pace is 42.9%.
- The pace never reads lower than the first checkpoint: one day for the weekly window, one hour for the 5-hour window.
- The right end of each bar is the current pace. The fill is your usage as a fraction of pace.
- The fill is green under 90% of pace, yellow from 90% to 100%, and red over pace.
- Tick marks show each checkpoint that has passed: each day for the weekly window, each hour for the 5-hour window.
- The text next to each bar reads usage / pace, such as `38.2 / 42.9%`.
- Hover on a bar to see the usage and the pace.
- Click the usage / pace text to show or hide the details: headroom, reset time and countdown.
- An age label shows when the usage reading is older than 5 minutes.

Usage readings come from the rate-limit data in Claude's replies. The band needs a Claude subscription and draws in the desktop app only.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install pacergram --marketplace Drullkus/Pacergram
```

From a shell:

```bash
claude plugin install pacergram --marketplace Drullkus/Pacergram
```

In the Claude desktop app, click + next to the prompt box. Then choose Plugins, Add marketplace with `Drullkus/Pacergram`, then Add plugin.
