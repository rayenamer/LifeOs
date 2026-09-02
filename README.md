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

get more detailled insights about the system and the science behind it 
