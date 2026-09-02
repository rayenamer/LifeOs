# LifeOS

A personal **behavioral feedback system**. Not a task manager, habit tracker, or
gamified productivity app.

> You don't control the outcome. You control what you do today.

LifeOS translates long-term direction into controllable daily processes, measures
execution as **feedback — not reward**, and adapts every week:

```
Life Areas → Monthly Goals → Daily Processes → Daily Score
          → Streak & Consistency → Weekly Reflection → System Improvement
```

The daily score is information. **Data, not judgment. Consistency > perfection.**
A missed day never erases history.

## Stack

- **Angular 19**, standalone components, signals, Angular Router, Reactive Forms
- **SQLite in the browser** via `sql.js` (WebAssembly). The whole database is
  serialised to a byte array and written to **IndexedDB** after every mutation,
  so a refresh or restart never loses data. No server — deployable as a static site.
- **Chart.js + ng2-charts** for trend/bar charts; custom SVG for the calendar
  heatmap and the month-detail radial constellation.
- Clean repository / service architecture — all business rules
  (`ScoringService`, `StreakService`, `ConsistencyService`, `GoalService`, …)
  live outside the UI components and are unit-tested.

## Run

```bash
npm install
npm start            # http://localhost:4200
```

On first launch the app seeds ~3 months of demo data (4 life areas, monthly
goals, daily execution history, one weekly reflection). It is flagged as demo
data and can be removed from **Settings → Data → Delete demo data**.

## Build

```bash
npm run build        # production bundle in dist/lifeos/
```

The `sql-wasm.wasm` binary is copied to the deploy root automatically
(`angular.json` assets).

## Test

```bash
npm test             # Karma + Jasmine (requires a local Chrome)
```

`ScoringService` and `StreakService` have full spec coverage of the scoring and
streak rules.

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

## Structure

```
src/app/
  core/
    database/     sqlite.service, schema, seed.service
    repositories/ pure CRUD, one per entity
    services/     scoring, streak, consistency, analytics, execution, goal, week, views, settings
    models/       entities + view-models
  shared/
    components/   score-dial, weight-bar, process-row, streak-badge, radial-constellation,
                  calendar-heatmap, trend-chart, bars-chart, empty-state, confirm-dialog
    pipes/        scoreColor, monthName, ordinalDate, weekRange
  shell/          app-shell (sidebar / tablet drawer / mobile bottom nav)
  features/       entrance, home (months), month-detail, goal-detail, today,
                  weekly-review, insights, monthly-review, goal-wizard, settings
```
