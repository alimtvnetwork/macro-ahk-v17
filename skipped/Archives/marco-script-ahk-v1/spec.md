# Automator v2 — Technical Specification

## 1. Overview

Automator is a desktop automation toolkit that bridges AutoHotkey v2 (Windows hotkey engine)
with browser-side JavaScript to perform multi-step UI workflows with a single keypress.

### Design Goals

- **No external dependencies**: Only AutoHotkey v2 and a Chromium browser required.
- **Separation of concerns**: Configuration (INI), browser logic (JS), and desktop orchestration (AHK) in separate files.
- **User-configurable without code changes**: All values externalized to config.ini.
- **Built-in Settings GUI**: Visual editor for all configuration values.
- **Resilient to timing**: JavaScript uses polling/retry loops instead of fixed timeouts.

## 2. Architecture

```
User (hotkey press)
       |
       v
Automator.ahk (AutoHotkey v2)
  1. Reads config.ini (IniRead)
  2. Registers hotkeys dynamically
  3. On trigger:
     a. Reads .js file (FileRead)
     b. StrReplace() placeholders with config values
     c. Copies JS to A_Clipboard
     d. Activates Chrome window
     e. Opens DevTools Console (Ctrl+Shift+J)
     f. Pastes and executes JS
       |
       v
Chrome DevTools Console
  combo.js runs:
  1. Clicks Transfer button
  2. Waits for modal, reads Combo 1 text
  3. Opens Combo 2 dropdown
  4. Finds matching item, selects next/prev
  5. Clicks Confirm button
```

## 3. Component Details

### 3.1 config.ini

| Section | Purpose |
|---|---|
| [Hotkeys] | Maps actions to AHK hotkey strings |
| [ComboSwitch] | XPath selectors for ComboSwitch workflow |
| [Gmail] | URL and search query |
| [General] | Browser exe, timing delays |

### 3.2 combo.js

Browser-side JavaScript with placeholder tokens replaced at runtime:

| Token | Source |
|---|---|
| __DIRECTION__ | "up" or "down" from hotkey |
| __TRANSFER_XPATH__ | config.ini ComboSwitch section |
| __COMBO1_XPATH__ | config.ini ComboSwitch section |
| __COMBO2_XPATH__ | config.ini ComboSwitch section |
| __OPTIONS_XPATH__ | config.ini ComboSwitch section |
| __CONFIRM_XPATH__ | config.ini ComboSwitch section |

**Resilience**: waitForElement() polls every 300ms, up to 20 attempts (6s max).

### 3.3 Automator.ahk (v2)

Key v2 features used:
- `#Requires AutoHotkey >=2.0` — ensures correct version
- `IniRead()` function syntax (not command)
- `FileRead()` returns string directly
- `StrReplace()` returns new string
- `Hotkey(key, callback)` with fat arrow functions
- `Gui()` object-based GUI with `.Add()`, `.OnEvent()`, `.Show()`
- `A_Clipboard` instead of `Clipboard`
- `try/catch` for error handling
- `SetTimer(() => ToolTip(), -2000)` inline timer callbacks

### 3.4 Settings GUI

Built with native AHK v2 Gui object:
- GroupBox sections for Hotkeys, XPaths, Gmail, General
- Edit fields pre-filled with current config values
- Save button writes all values with IniWrite() and calls Reload()
- Accessible from tray menu (right-click > Settings)

### 3.5 Gmail Automation

Uses Gmail built-in `/` keyboard shortcut:
1. Run() opens browser with Gmail URL
2. Send("/") focuses search box
3. SendText() types the search query
4. Send("{Enter}") executes search

No JavaScript injection needed.

## 4. Target UI (ComboSwitch)

- **Framework**: React + Radix UI Select component
- **Dropdown trigger**: `<button>` with `data-state="open"/"closed"`
- **Options**: `<div role="option">` with `data-radix-collection-item`
- **Labels**: `<p class="min-w-0 truncate">` inside each option

## 5. Limitations

- Single browser window targeting (ahk_exe)
- Console must be accessible (no restrictive CSP)
- Absolute XPaths break if page structure changes
- Temporary clipboard usage during JS injection
- Gmail `/` shortcut requires keyboard shortcuts enabled in Gmail settings

## 6. Future Improvements

- Chrome DevTools Protocol (CDP) via WebSocket for clipboard-free injection
- Multiple browser window support via window title matching
- File logging for debugging without Console
- Auto-reload on config.ini file change detection
