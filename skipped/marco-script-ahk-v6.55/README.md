# Automator v5.3 - Multi-Method XPath & Hotkey Fix Edition

Browser automation for lovable.dev using AutoHotkey v2 + JavaScript injection.

## What's New in V4.8

- **🔧 CRITICAL FIX: Multiple DevTools Windows**: AHK **no longer opens DevTools** - user must open it manually ONCE
  - **Why**: Script restarts reset flags → multiple windows
  - **Solution**: User opens DevTools with `Ctrl+Shift+J`, keeps it open, AHK just uses it
  - **No more**: Multiple console panels, multiple DevTools windows!
- **Dedicated Log Functions**: InfoLog, WarnLog, ErrorLog, DebugLog for cleaner code
- **Error Log File**: All errors now written to `logs/error.txt` in addition to activity.txt
- **Log Constants**: Centralized LOG_LEVEL_* constants for consistency
- **DRY Code**: Removed redundant log level parameters, cleaner function signatures
- **Improved Log Format**: `[LEVEL] message [file:line function]` for easier debugging

## Previous Features (V4.7)

- **Debug Mode**: Toggle verbose logging via tray menu checkbox
- **Activity Log Panels**: Collapsible activity logs in both ComboSwitch and MacroLoop UIs
- **Real-time Logging**: Line-by-line logs showing all file operations and script execution
- **Config Persistence**: Debug mode setting saved to `config.ini`
- **Color-coded Logs**: ERROR (red), INFO (green), DEBUG (purple), WARN (orange)

## Previous Features (V4.1-4.6)

- **JS Executor Textbox**: Visible textarea near Transfer button for running arbitrary JS
- **Run Button**: Green execute button with Ctrl+Enter shortcut
- **AHK Textbox Injection**: After initial embed, AHK uses textbox instead of DevTools
- **MacroLoop Delegate Mode**: JS monitors progress, AHK handles all tab switching
- All V4 features: Single embedded script, configurable IDs, no prompts, fast subsequent calls

## Quick Start

1. Double-click `Automator.ahk`
2. Gear icon appears in system tray
3. Open Chrome, go to https://lovable.dev/
4. **IMPORTANT**: Press `Ctrl+Shift+J` to open DevTools Console (keep it open!)
5. Navigate to a project's Settings > Project tab
6. Press `Ctrl+Down` or `Ctrl+Up` for ComboSwitch
7. Use the JS Executor textbox to run custom scripts
8. Press `Ctrl+Shift+Alt+Down` to start AutoLoop

**⚠️ CRITICAL**: You must manually open DevTools (step 4) BEFORE using the script. The script will NOT open DevTools for you. This prevents multiple DevTools windows from appearing.

## Tray Icon

| Icon | State |
|------|-------|
| ⚙️ Gear | Idle/Ready |
| ▶️ Green Arrow | AutoLoop Running |

**Right-click** the tray icon for all actions with hotkey labels.

## Hotkeys

| Hotkey | Action |
|--------|--------|
| `Ctrl+Down` | ComboSwitch next (down) |
| `Ctrl+Up` | ComboSwitch previous (up) |
| `Ctrl+Shift+Alt+Down` | Start AutoLoop (down) |
| `Ctrl+Shift+Alt+Up` | Start AutoLoop (up) |
| `Ctrl+Shift+F9` | Gmail search unread |
| `Esc` | Stop AutoLoop / Exit |

## UI Elements

After first ComboSwitch hotkey, these UI elements appear near the Transfer button:

```
┌─────────────────────────────────────────────────────────┐
│  [▲ Up]  [▼ Down]                                       │
│                                                         │
│  JS Executor (Ctrl+Enter to run)                        │
│  ┌─────────────────────────────────────────┐ [▶ Run]   │
│  │ Enter JavaScript code here...           │            │
│  └─────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

### JS Executor Usage

- Type JavaScript code in the textbox
- Press **Ctrl+Enter** or click **▶ Run** to execute
- Results appear in browser console (F12 → Console)
- AHK can also inject code via this textbox

## File Structure

```
marco-script-ahk-v4/
├── Automator.ahk           # Main entry point (AHK v2)
├── Includes/
│   ├── Config.ahk          # Reads config.ini (incl. JS executor IDs)
│   ├── JsInject.ahk        # DevTools + textbox injection
│   ├── Combo.ahk           # ComboSwitch logic
│   ├── AutoLoop.ahk        # AutoLoop logic
│   ├── Gmail.ahk           # Gmail automation
│   └── HotkeyFormat.ahk    # Hotkey label formatter
├── combo.js                # Single embedded script (v4.1)
├── config.ini              # All configuration
├── README.md               # This file
├── SPEC.md                 # Technical specification
└── MEMORY.md               # AI learning document
```

## Configuration

Edit `config.ini`, then right-click tray → Reload Script.

### [Hotkeys] Section
```ini
ComboDown=^Down           ; Ctrl+Down
ComboUp=^Up               ; Ctrl+Up
AutoLoopDown=^+!Down      ; Ctrl+Shift+Alt+Down
```

### [ComboSwitch] Section
```ini
; XPaths for elements
TransferButtonXPath=/html/body/...
Combo1XPath=/html/body/...

; Timing (ms)
ComboPollIntervalMs=300
ComboOpenMaxAttempts=20

; Element IDs (for embedded UI)
ScriptMarkerId=ahk-combo-script
ButtonUpId=ahk-combo-up-btn
ButtonDownId=ahk-combo-down-btn

; JS Executor IDs (new in v4.1)
JsExecutorId=ahk-js-executor
JsExecuteBtnId=ahk-js-execute-btn
```

### Hotkey Syntax

| Symbol | Key |
|--------|-----|
| `^` | Ctrl |
| `+` | Shift |
| `!` | Alt |
| `#` | Win |

## How ComboSwitch Works

1. **First Press**: Injects `combo.js` → embeds as script → creates Up/Down buttons + JS Executor
2. **Subsequent Presses**: Just clicks the existing button (fast!)

The UI appears below the Transfer button with:
- **▲ Up** - Blue button (#3b82f6)
- **▼ Down** - Dark button (#1f2937)
- **JS Executor** - Textarea + green Run button (#10b981)

## How JS Executor Works

1. **First embed**: combo.js creates the textbox and Run button
2. **Manual use**: Type code → Ctrl+Enter or click Run
3. **AHK use**: AHK sets textbox value → calls `window.__executeJs()`
4. **Results**: Logged to browser console

## AutoLoop Workflow

1. Click tool button
2. Check for progress bar
3. If BUSY: Click suggestion → Click execute
4. If IDLE: Navigate to settings → Run combo → Go back

## Requirements

- Windows with **AutoHotkey v2** installed
- Google Chrome (or Chromium browser)
- Access to DevTools Console (Ctrl+Shift+J) - only for initial embed

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No tray icon | Check AHK v2 installed |
| Buttons don't appear | Check TransferButtonXPath in config.ini |
| Wrong domain error | Navigate to lovable.dev first |
| Combo fails | Update XPaths in config.ini |
| JS Executor not visible | Refresh page, re-run combo hotkey |
| JS Executor errors | Check console for E011 error code |
