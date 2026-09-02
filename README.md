# LifeOS

A personal **behavioral feedback system**. 

LifeOS translates lyour goals into controllable daily processes, measures
execution  and adapts every week:

```
Monthly Goals → Daily Processes → Daily Score → Streak & Consistency → Weekly Reflection → System Improvement
```


## Stack

- **Angular 19**, standalone components, signals, Angular Router, Reactive Forms
- **SQLite in the browser** via `sql.js` (WebAssembly) — the real SQLite engine
  running in the tab. The whole database is serialised to a byte array and
  written to **IndexedDB** after every mutation, so a refresh or restart never
  loses data. No server — deployable as a static site.
- **Data vault** (Settings → Data vault): link the database to a real
  `lifeos.sqlite` file on your disk (File System Access API, Chromium/Brave) and
  every change is written there too — a portable, user-owned copy to back up or
  sync. Plus manual **Export / Import** in any browser.

## Run

```bash
npm install
npm start            # http://localhost:4200
```

The app starts empty. Create your first life area and monthly goal from the
Goal Wizard (**+ NEW GOAL**).

Your data lives in this browser by default. For a copy you own, open
**Settings → Data vault** and either **Save my data to a file…** (Brave / Chrome —
keeps `lifeos.sqlite` on disk in sync automatically) or **Export** it manually.
Wipe everything from **Settings → Data → Reset system**.


## Key concepts

| Rule | Where |
| --- | --- |
| Process weights must total exactly **100** per goal (save is blocked otherwise) | `GoalService.checkWeights`, Goal Wizard, Goal Detail editor |
| Goal weights must total **100** per month — each goal is a share of the month, like a process is a share of its goal | Goal Wizard (month-weight step), Month Detail "Rebalance" panel |
| Daily score 0–100 = Σ (goal day score × goal month-weight ÷ 100); goals with no weight (legacy data) are averaged equally | `ScoringService.dailyScore` |
| Goal day score 0–100 = Σ (process weight × completion ratio) | `ScoringService.goalDayScore` |
| Active day = score ≥ minimum viable day **or** a freeze day | `StreakService.isActiveDay` |
| A missed day resets the current streak but never the longest or the history | `StreakService.compute` |
| Freeze days protect consistency without faking completion (visibly distinct) | `ConsistencyService`, calendar heatmap |
| Minimum viable day threshold is configurable (default 30) | Settings |
