# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs TypeScript compiler in watch mode + Vite dev server + Electron)
npm run dev

# Build (Vite renderer + TypeScript compile of electron/)
npm run build

# Lint
npm run lint

# Package for distribution
npm run package         # current platform
npm run package-mac     # macOS
npm run package-win     # Windows
```

There are no tests (`npm run test` is a no-op). The dev server runs on port 54321.

## Architecture

This is an **Electron + React + TypeScript** desktop app. There are two separate compilation targets that must both build successfully:

- **`electron/`** — Main process (Node.js/Electron). Compiled by `tsc -p tsconfig.electron.json` into `dist-electron/`.
- **`src/`** — Renderer process (React/Vite). Compiled by Vite into `dist/`.

### Electron main process (`electron/`)

- **`main.ts`** — Entry point. Manages the single `BrowserWindow`, application state, and wires together all helpers. Exports interfaces (`IProcessingHelperDeps`, `IShortcutsHelperDeps`, `IIpcHandlerDeps`) that enforce the dependency injection pattern used by all helpers.
- **`ProcessingHelper.ts`** — The core AI integration. Handles screenshot-to-solution pipeline in three phases: (1) vision extraction of problem info from screenshots, (2) solution generation, (3) debug analysis. Supports OpenAI, Gemini (via REST), and Anthropic providers, selected per-config.
- **`ConfigHelper.ts`** — Singleton (`configHelper`) that persists config to `userData/config.json`. Emits `config-updated` events that cause `ProcessingHelper` to reinitialize its AI client. Auto-detects provider from API key prefix (`sk-` → OpenAI, `sk-ant-` → Anthropic, otherwise Gemini).
- **`ScreenshotHelper.ts`** — Manages two screenshot queues: a primary queue (`queue` view) and an extra queue (`solutions`/`debug` view). Screenshots are stored as files and referenced by path.
- **`shortcuts.ts`** — Registers all global keyboard shortcuts.
- **`ipcHandlers.ts`** — All `ipcMain.handle()` registrations. Bridges renderer ↔ main process.
- **`preload.ts`** — Exposes `window.electronAPI` to the renderer via `contextBridge`. All renderer↔main communication goes through this surface.

### Renderer process (`src/`)

- **`App.tsx`** — Root component. Checks for API key on startup; shows `WelcomeScreen` if missing, otherwise `SubscribedApp`. Manages global state: language, credits (always 999), settings dialog visibility.
- **`_pages/SubscribedApp.tsx`** — Manages the three-state view machine: `queue` → `solutions` → `debug`. Listens to Electron IPC events (`onSolutionStart`, `onResetView`, etc.) to drive view transitions. Uses a `ResizeObserver` to notify the main process of content dimension changes so the window auto-resizes.
- **`_pages/Queue.tsx`** — Screenshot capture UI. Users add screenshots here before processing.
- **`_pages/Solutions.tsx`** — Displays AI-generated solution (code, thoughts, complexity). Extra screenshots taken here go into the debug queue.
- **`_pages/Debug.tsx`** — Displays debug analysis from AI.
- **`components/Settings/SettingsDialog.tsx`** — API key and model configuration UI.

### View state machine

The app has three views managed in parallel by both the main process (`state.view` in `main.ts`) and the renderer (`view` state in `SubscribedApp.tsx`):

```
queue  →(Cmd+Enter)→  solutions  →(Cmd+Enter again)→  debug
  ↑___________________(Cmd+R reset)_______________________↑
```

### IPC communication pattern

The renderer never calls Electron APIs directly — everything goes through `window.electronAPI` (defined in `preload.ts`). The main process sends push events to the renderer via `mainWindow.webContents.send(eventName, data)`. Event names are defined as constants in `PROCESSING_EVENTS` in both `main.ts` and `preload.ts`.

### Global keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+H` | Take screenshot |
| `Cmd/Ctrl+Enter` | Process screenshots / trigger debug |
| `Cmd/Ctrl+R` | Reset all queues, return to queue view |
| `Cmd/Ctrl+B` | Toggle window visibility |
| `Cmd/Ctrl+Arrow` | Move window |
| `Cmd/Ctrl+[` / `]` | Decrease / increase opacity |
| `Cmd/Ctrl+-` / `=` / `0` | Zoom out / in / reset |
| `Cmd/Ctrl+L` | Delete last screenshot |
| `Cmd/Ctrl+Q` | Quit |

### Config schema

Stored at `{userData}/config.json`. Provider is auto-detected from key format. Allowed models are allowlisted in `ConfigHelper.sanitizeModelSelection()`:
- OpenAI: `gpt-4o`, `gpt-4o-mini`
- Gemini: `gemini-1.5-pro`, `gemini-2.0-flash`
- Anthropic: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`

### Window behavior

The window is frameless, transparent, always-on-top, and screen-capture-resistant (`setContentProtection(true)`). Visibility is controlled by setting opacity to 0 (hidden) or restoring saved opacity (shown) — the window is never actually hidden/shown to avoid taskbar flicker.
