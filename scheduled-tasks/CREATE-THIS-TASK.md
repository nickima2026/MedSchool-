# PGR PCH Weekly Capture — Scheduled Task

## How to create this task

In a **new Cowork session** (not triggered by a scheduled task), say:

> "Create a scheduled task called pgr-pch-weekly-capture that runs every Thursday at noon to auto-capture Primary Children's Pediatric Grand Rounds from YouTube"

Or just say: "Create the PGR PCH scheduled task" — Claude has the details in memory.

## Task Details

- **Task ID:** `pgr-pch-weekly-capture`
- **Cron:** `0 12 * * 4` (Every Thursday at 12:00 PM local time)
- **Description:** Auto-capture Primary Children's Pediatric Grand Rounds from YouTube every Thursday at noon MT

The full prompt is saved in `pgr-pch-weekly-capture.json` in this directory.
