# LifeOS Desktop Launcher Setup Guide

## Overview

This README documents the complete setup process for creating a desktop icon that launches LifeOS with Node.js, Angular server, and automatic browser opening.

**Goal**
1. Created a startup script that manages Node.js versions
2. Set up automatic Angular server detection
3. Configured a desktop icon that runs everything with one click
4. Automated browser launch when the app is ready

---

## File Structure

```
~/.start-lifeos.sh                 (Hidden startup script - does the heavy lifting)
~/Desktop/LifeOS.desktop           (Desktop launcher icon - what you double-click)
~/Desktop/LifeOs/                  (Your actual LifeOS project folder)
```

---

## Implementation

### 1. The Startup Script: `~/.start-lifeos.sh`

**Location:** `/home/{userName}/.start-lifeos.sh` 

**Purpose:** This script handles everything:
- Loads the correct Node.js version (v24.6.0) using NVM
- Starts the Angular development server
- Waits until the server is ready (port 4200)
- Opens Brave browser automatically
- Keeps the server running

**Full Source Code:**

```bash
#!/bin/bash

export PATH="/home/rayounouna/.nvm/versions/node/v24.6.0/bin:$PATH"

cd /home/rayounouna/Desktop/LifeOs || exit 1

npm start &
SERVER_PID=$!

echo "Starting LifeOS..."

until curl -s http://localhost:4200 > /dev/null; do
    sleep 1
done

echo "LifeOS is ready!"
brave-browser http://localhost:4200

wait $SERVER_PID
```

**Breakdown - Line by Line:**

| Line | Command | Purpose |
|------|---------|---------|
| `#!/bin/bash` | Shebang | Tells system to run this as a bash script |
| `export PATH="..."` | NVM Node setup | Adds Node v24.6.0 to available commands |
| `cd /home/.../LifeOs \|\| exit 1` | Change directory | Moves to project folder; exits if it fails |
| `npm start &` | Start server in background | `&` runs it without blocking the script |
| `SERVER_PID=$!` | Capture process ID | Saves the server's process ID for later |
| `until curl -s http://localhost:4200` | Loop until ready | Keeps checking if Angular is ready |
| `sleep 1` | Wait 1 second | Prevents hammering the server with requests |
| `brave-browser http://localhost:4200` | Open browser | Launches Brave when server is ready |
| `wait $SERVER_PID` | Keep process alive | Waits for server to finish running |

---

### 2. The Desktop Launcher: `~/Desktop/LifeOS.desktop`

**Location:** `/home/rayounouna/Desktop/LifeOS.desktop`

**Purpose:** Creates a clickable desktop icon that launches the startup script

**Full Source Code:**

```ini
[Desktop Entry]
Version=1.0
Type=Application
Name=LifeOS
Comment=Start LifeOS
Exec=/home/rayounouna/.start-lifeos.sh
Icon=applications-development
Terminal=true
Categories=Development;
```

**Key Properties:**

| Property | Value | Explanation |
|----------|-------|-------------|
| `Type=Application` | Application | This is an executable application |
| `Name=LifeOS` | LifeOS | What shows on the desktop icon |
| `Comment=` | Shows on hover | Tooltip text |
| `Exec=` | Path to script | Which script to run when double-clicked |
| `Icon=` | applications-development | Icon to display (builtin Ubuntu icon) |
| `Terminal=true` | Show terminal | Display terminal while running |
| `Categories=` | Development | File manager categorization |

---

## erminal Commands Explained

### Making script executable:

```bash
chmod +x ~/.start-lifeos.sh
```

**Breakdown:**
- `chmod` = **ch**ange **mod**e (permissions)
- `+x` = Add executable permission
- Without this, the file is just text, not a runnable program

---

### Creating the desktop launcher:

```bash
cat > ~/Desktop/LifeOS.desktop <<'EOF'
[paste the .desktop code above]
EOF
```

**Same concept as startup script** — creates the `.desktop` file that your desktop environment recognizes

---

### Making launcher trusted:

```bash
gio set ~/Desktop/LifeOS.desktop metadata::trusted true
```

**What it does:**
- `gio set` = GNOME IO properties tool
- `metadata::trusted true` = Tells Ubuntu this file is safe to run
- Without this, you might get a "run as program/display" dialog

---

### Setting permissions:

```bash
chmod +x ~/Desktop/LifeOS.desktop
```

**Same as the script** — makes the `.desktop` file executable

---

### Testing the launcher:

```bash
gtk-launch LifeOS
```

**What it does:**
- Uses GTK (GNOME toolkit) to test if the `.desktop` launcher works
- Simulates double-clicking without actually double-clicking
- Useful for debugging

---

## What is NVM? (Node Version Manager)

### The Problem NVM Solves

You might have **multiple versions** of Node.js installed on your system:
- Node v20 for one project
- Node v24 for another
- Node v18 for legacy code

**Without NVM:** You'd have to uninstall and reinstall Node every time you switched projects 😫

**With NVM:** You can instantly switch between versions.

### How It Works

```
~/.nvm/
├── versions/
│   ├── node/
│   │   ├── v18.0.0/  ← Old version
│   │   ├── v20.0.0/  ← Another version
│   │   └── v24.6.0/  ← Your LifeOS version ← We're using this one
```

### Why We Need It In Our Script

```bash
export PATH="/home/{userName}/.nvm/versions/node/v24.6.0/bin:$PATH"
```

**Explanation:**
- `$PATH` = Where Linux looks for commands (like `npm`, `node`)
- By default, it might find v20 or v18
- This line **prepends** v24.6.0 to the front of $PATH
- So when you run `npm`, it finds the v24.6.0 version first 
**Without this line:**
- `npm start` might use the wrong Node version
- Your Angular app might crash with compatibility errors
- We force it to use v24.6.0 every time

---

## Why Each Terminal Command Was Used

### Summary Table

| Command | Why It Was Used | Alternative |
|---------|-----------------|-------------|
| `mv ~/start-lifeos.sh ~/Desktop/` | Move script to Desktop | Not needed; we use hidden script instead |
| `chmod +x ~/.start-lifeos.sh` | Make it runnable | Without this, it's just a text file |
| `cat > ~/.start-lifeos.sh` | Create hidden script | Could use nano/vim, but cat is cleaner for scripts |
| `cat > ~/Desktop/LifeOS.desktop` | Create launcher file | Same as above |
| `gio set ... trusted true` | Ubuntu security check | Without this, Ubuntu won't run it |
| `gtk-launch LifeOS` | Test the launcher | Manual testing without double-clicking |

---

## How to Use It

### Initial Setup (One Time)

Copy and paste these commands into your terminal:

```bash
# 1. Create the startup script
cat > ~/.start-lifeos.sh <<'EOF'
#!/bin/bash

export PATH="/home/rayounouna/.nvm/versions/node/v24.6.0/bin:$PATH"

cd /home/rayounouna/Desktop/LifeOs || exit 1

npm start &
SERVER_PID=$!

echo "Starting LifeOS..."

until curl -s http://localhost:4200 > /dev/null; do
    sleep 1
done

echo "LifeOS is ready!"
brave-browser http://localhost:4200

wait $SERVER_PID
EOF

# 2. Make it executable
chmod +x ~/.start-lifeos.sh

# 3. Create the desktop launcher
cat > ~/Desktop/LifeOS.desktop <<'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=LifeOS
Comment=Start LifeOS
Exec=/home/rayounouna/.start-lifeos.sh
Icon=applications-development
Terminal=true
Categories=Development;
EOF

# 4. Make launcher executable
chmod +x ~/Desktop/LifeOS.desktop

# 5. Mark as trusted
gio set ~/Desktop/LifeOS.desktop metadata::trusted true
```
