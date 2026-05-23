# CLAUDE.md — AI & Tech News Homepage (Chrome Extension)

## Project Overview

A Chrome Extension that replaces the new tab page with a personal dashboard featuring AI/tech news, Google Calendar events, Google Tasks, a countdown timer, a progress bar, and customizable widgets (graphs and heatmaps).

- **Manifest version:** V3
- **Extension name:** AI & Tech News Homepage (v1.1)
- **Entry point:** `newtab.html` (overrides Chrome's new tab)

---

## Architecture

Vanilla JavaScript with ES6 modules — no framework, no bundler, no build step.

```
newtab.html         UI structure (single page)
script.js           Main orchestrator — initializes all managers in parallel
styles.css          All styling (~1415 lines)
news.js             News RSS aggregation
calendar.js         Google Calendar integration
countdown.js        Countdown timer + progress bar
tasks.js            Google Tasks integration
progress-tracker.js Toggle panel visibility manager
widgets.js          Graph and heatmap widget rendering + data
```

---

## Features

### News Aggregator (`news.js`)
- Aggregates RSS from 7 sources: VentureBeat AI, Hugging Face, AI Alignment Forum, OpenAI, Google DeepMind, Ars Technica, The Gradient
- 15-minute cache via `chrome.storage.local` (`tech_content_cache`)
- Parsed with native `DOMParser`

### Google Calendar (`calendar.js`)
- OAuth2 via Chrome Identity API
- Shows next 2 upcoming events with smart date labels (Today/Tomorrow/weekday)
- 15-minute cache (`calendar_cache`)
- Silent token refresh

### Countdown Timer + Progress Bar (`countdown.js`)
- Countdown to a user-set date with a custom title (default: "Days until End of Semester")
- Progress bar (0–100%) editable by click
- Both persisted to `chrome.storage.local`

### Google Tasks (`tasks.js`)
- Fetches up to 10 tasks from the primary task list
- Smart due-date labels (Overdue / Due today / Due in X days)
- Add tasks and mark complete with animations
- 15-minute cache (`tasks_cache`)

### Progress Tracker Panel (`progress-tracker.js`, `widgets.js`)
- Slide-out panel with 4 widget slots
- **Graph widgets:** SVG line charts with 7D/30D/1Y range buttons
- **Heatmap widgets:** GitHub-style 26-week activity grids with color themes (Blue/Green/Red)
- Widgets support: rename, color change, add/delete entries, reset, delete

---

## APIs & Permissions

| API | Usage |
|-----|-------|
| `chrome.storage.local` | All persistence (cache, settings, widget data) |
| `chrome.identity` | OAuth2 token acquisition |
| Google Calendar API v3 | Fetch calendar events |
| Google Tasks API v1 | Fetch and update tasks |
| RSS/XML (Fetch + DOMParser) | News aggregation |

**`manifest.json` permissions:** `storage`, `identity`

**OAuth scopes:** `https://www.googleapis.com/auth/calendar.readonly`, `https://www.googleapis.com/auth/tasks`

---

## Storage Keys

| Key | Contents |
|-----|----------|
| `tech_content_cache` | Cached news articles |
| `calendar_cache` | Cached calendar events |
| `calendar_connected` | Boolean — calendar auth state |
| `tasks_cache` | Cached task list |
| `target_date` | Countdown target (ISO string) |
| `target_title` | Countdown label |
| `progress_bar_value` | Progress bar percentage (0–100) |
| `tracker_panel_open` | Panel open/closed state |
| `widget_0` – `widget_3` | Widget configs (type, data, color, title) |

---

## Development

No build step required.

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder
4. Reload the extension after making changes (`Ctrl+R` on the extensions page or the refresh button)
5. Open a new tab to see changes

### Editing tips
- CSS is organized in clearly labeled sections — find the relevant section before adding styles
- Each feature is self-contained in its own JS module with a manager class
- All caching follows the same pattern: check timestamp, fetch if stale, store with `Date.now()`
- The `script.js` initializes all managers — add new managers there
