# LifeOS
![alt text](image.png)

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

For a detailed explanation of the scientific foundations, research findings, and design rationale behind the system, see [`research.md`](./reaseach.md).


## Data model

Nine SQLite tables (`src/db/schema.ts`, schema v3). Solid lines are real foreign keys, all `ON DELETE CASCADE`: deleting a goal removes its processes and their check-ins. Dotted lines are derived: those rows are recomputed from others, not referenced by id.

```mermaid
erDiagram
    LIFE_AREA ||--o{ MONTHLY_GOAL : "one goal per month"
    MONTHLY_GOAL ||--|{ PROCESS : "broken into"
    PROCESS ||--o{ DAILY_EXECUTION : "logged per day"
    DAILY_EXECUTION }o..|| DAILY_SCORE : "rolled up by date"
    DAILY_SCORE }o..|| STREAK : "recomputed into"
    WEEKLY_REFLECTION ||--o{ ACTION_ITEM : "commits to"

    LIFE_AREA {
        TEXT id PK
        TEXT name
        TEXT description
        TEXT icon "icon name, e.g. dumbbell"
        INTEGER position "sort order, picks the colour"
        INTEGER is_demo
        TEXT created_at
        TEXT updated_at
    }
    MONTHLY_GOAL {
        TEXT id PK
        TEXT life_area_id FK "UNIQUE with year + month"
        INTEGER year
        INTEGER month "1..12"
        TEXT title
        TEXT description
        INTEGER weight "share of the month; goals sum to 100"
        INTEGER is_demo
        TEXT created_at
        TEXT updated_at
    }
    PROCESS {
        TEXT id PK
        TEXT monthly_goal_id FK
        TEXT name
        TEXT description
        TEXT link "optional tool URL"
        INTEGER weight "points in its goal; sum to 100"
        REAL target_value "1 = done/not done, >1 = amount"
        TEXT unit
        INTEGER position
        INTEGER active
        TEXT created_at
        TEXT updated_at
    }
    DAILY_EXECUTION {
        TEXT id PK
        TEXT process_id FK "UNIQUE with date"
        TEXT date "YYYY-MM-DD"
        INTEGER completed
        REAL actual_value "quantitative only"
        REAL score "points earned, 0..weight"
        TEXT note
        TEXT created_at
        TEXT updated_at
    }
    DAILY_SCORE {
        TEXT id PK
        TEXT date UK
        REAL score "0..100"
        INTEGER is_minimum_viable_day
        INTEGER is_freeze_day
        TEXT created_at
        TEXT updated_at
    }
    STREAK {
        INTEGER id PK "always 1 (single row)"
        INTEGER current_streak
        INTEGER longest_streak
        TEXT last_active_date
        INTEGER freeze_days_used
        INTEGER freeze_days_available
        TEXT updated_at
    }
    WEEKLY_REFLECTION {
        TEXT id PK
        TEXT week_start UK "Monday"
        TEXT week_end "Sunday"
        TEXT what_went_well
        TEXT what_didnt_go_well
        TEXT what_to_change
        INTEGER previous_action_items_reviewed
        TEXT created_at
        TEXT updated_at
    }
    ACTION_ITEM {
        TEXT id PK
        TEXT reflection_id FK
        TEXT text
        TEXT status "open | done | carried"
        INTEGER position
        TEXT created_at
        TEXT updated_at
    }
    SETTING {
        TEXT key PK "accent, theme, minimumViableDay, freezeDaysAvailable"
        TEXT value
    }
    SCHEMA_VERSION {
        INTEGER version "applied migrations"
    }
```

### How a check-in becomes a streak

```mermaid
flowchart LR
    E["DailyExecution<br/>done, or actual / target"] -->|"× process weight"| C["Process contribution<br/>0..weight"]
    C -->|"sum per goal"| G["Goal day score<br/>0..100"]
    G -->|"weighted by goal share of the month"| D["DailyScore<br/>0..100"]
    D -->|"≥ minimum viable day, or freeze"| A{"Active day?"}
    A -->|yes| S["Streak +1"]
    A -->|no, day ended| R["current streak resets<br/>longest is kept"]
```

### TypeScript entities

Repositories (`src/core/repos.ts`) map snake_case columns to camelCase interfaces in `src/core/models.ts`. Booleans are stored as `0/1` and dates as `YYYY-MM-DD` text.

| Table | Interface | Notes |
|---|---|---|
| `life_area` | `LifeArea` | |
| `monthly_goal` | `MonthlyGoal` | `weight` is its share of the month |
| `process` | `Process` | `targetValue > 1` makes it quantitative |
| `daily_execution` | `DailyExecution` | one row per process per day |
| `daily_score` | `DailyScore` | one row per day, recomputed after every check-in |
| `streak` | `Streak` | single row, recomputed from `daily_score` |
| `weekly_reflection` + `action_item` | `WeeklyReflectionWithItems` | items are saved together with their reflection |
| `setting` | `AppSettings` | key/value pairs, read with defaults |

Screens don't read tables directly. They use view models built by `src/core/analytics.ts`, such as `TodayView`, `GoalDetailView`, `MonthSummary`, `InsightsView`, `MonthlyReviewView` and `ScoreSeries`.

