# Automator v2 — Consolidated Technical Specification

This spec describes **how** Automator v2 works: modules, data flow, and key algorithms. It reflects the current design (AutoHotkey v2 + injected JavaScript + `config.ini`).

---

## 1. System overview

Automator v2 automates workflows on:

- **Lovable.dev** – combo switching and a macro loop around a project “tool”.
- **Gmail** – “unread in inbox” search in the current Gmail tab (or a new one).

Technologies:

- **AutoHotkey v2** for keyboard hooks, timers, window control, and JS injection.
- **JavaScript** injected into the active browser tab for DOM/XPath operations.
- **`config.ini`** as the single source of configuration: hotkeys, XPaths, timings, browser exe.

Goals:

1. **ComboSwitch** – move Lovable project combos up/down via a modal.
2. **Macro loop** – repeatedly:
   - Click Lovable’s tool button.
   - Pick a suitable suggestion (skipping “verify”).
   - Click Execute.
   - Move to next/previous project via combo when idle.
3. **Gmail hotkey** – open Gmail (if needed) and run a predefined search.

---

## 2. Components

### 2.1 Configuration

- `config.ini` – edited by the user.
- `Includes\Config.ahk` – reads `config.ini` and exposes globals.

#### 2.1.1 `config.ini` sections (current schema)

**[Hotkeys]**

```ini
[Hotkeys]
ComboDown=^Down
ComboUp=^Up
GmailUnread=^+F9
MacroUp=^+!Up
MacroDown=^+!Down
```

**[ComboSwitch]** (Lovable project settings)

```ini
[ComboSwitch]
TransferButtonXPath=/html/body/div/div/div/div/div/div/div/div/div/div/div/div/div/button
Combo1XPath=/html/body/div/div/div/div/p
Combo2ButtonXPath=/html/body/div/div/div/button
OptionsContainerXPath=/html/body/div/div
ConfirmButtonXPath=/html/body/div/div/button

; combo timing controls (ms)
ComboPollIntervalMs=300
ComboOpenMaxAttempts=20
ComboWaitMaxAttempts=20
```

**[Gmail]**

```ini
[Gmail]
URL=https://mail.google.com
SearchQuery=in:inbox is:unread

OpenDelayMs=1500
SlashDelayMs=500
TypeDelayMs=300
EnterDelayMs=100
```

**[General]**

```ini
[General]
BrowserExe=chrome.exe
ConsoleDelay=800
PasteDelay=200
```

**[Macro]**

```ini
[Macro]
ToolButtonXPath=/html/body/div/div/div/nav/div/div/div/div/div/button/div/div/svg
ProgressXPath=/html/body/div/div/div/div/div/div/div/div
SuggestionsAllXPath=/html/body/div/div/div/main/div/div/div/div/div/div/div/div
FirstSuggestionXPath=/html/body/div/div/div/main/div/div/div/div/div/div/div/div/div
IntervalMs=15000
ExecuteButtonXPath=/html/body/div/div/div/main/div/div/div/div/div/div/form/div/div/button
```

#### 2.1.2 `Includes\Config.ahk`

- `IniReadInt(file, section, key, default)` strips inline comments and converts to `Integer`.
- `LoadConfig()` reads all sections once at script startup and sets these globals:

Hotkeys:

- `comboDownHotkey`, `comboUpHotkey`, `gmailUnreadHotkey`, `macroUpHotkey`, `macroDownHotkey`.

ComboSwitch:

- `transferXPath`, `combo1XPath`, `combo2XPath`, `optionsXPath`, `confirmXPath`.
- `ComboPollIntervalMs`, `ComboOpenMaxAttempts`, `ComboWaitMaxAttempts`.

Gmail:

- `gmailUrl`, `gmailSearch`.
- `gmailOpenDelayMs`, `gmailSlashDelayMs`, `gmailTypeDelayMs`, `gmailEnterDelayMs`.

General:

- `browserExe`, `consoleDelay`, `pasteDelay`.

Macro:

- `toolButtonXPath`, `progressXPath`, `suggestionsAllXPath`, `firstSuggestionXPath`.
- `macroIntervalMs`, `executeButtonXPath`.

All other modules assume these globals exist.

---

## 3. Main script: `Automator.ahk`

### 3.1 Responsibilities

- Run `LoadConfig()` from `Includes\Config.ahk`.
- Register hotkeys using `Hotkey()` and lambdas.
- Build tray UI.
- Provide startup notification.
- Delegate to feature modules:

  - `RunCombo("up" | "down")` – from `Includes\Combo.ahk`.
  - `RunGmail()` – from `Includes\Gmail.ahk`.
  - `ToggleMacro("up" | "down")` – from `Includes\Macro.ahk`.

### 3.2 Hotkeys

Bound at runtime from `config.ini`:

- Combo up/down → `RunCombo("up" / "down")`.
- Gmail unread → `RunGmail()`.
- Macro up/down → `ToggleMacro("up" / "down")`.
- `Esc` → `ExitApp()`.

### 3.3 Tray menu

- Entries for:
  - Macro Loop (Up/Down).
  - Stop Macro.
  - Combo Down / Up.
  - Gmail Unread.
  - Open `config.ini`.
  - Reload Script.
  - Help (`README.md`).
  - Spec (`SPEC.md`).
  - Exit.

- Uses `Includes\HotkeyFormat.ahk` to display hotkeys like `[Ctrl+Shift+Alt+Down]`.

---

## 4. JS injection layer

### 4.1 `Includes\JsInject.ahk` (conceptual interface)

Public functions:

- `InjectJS(js)`  
  Executes JS in the active browser tab without returning a result.

- `InjectJSGet(js)`  
  Executes JS and returns a string result (typically via a `prompt("AHK_RESULT", value)` glue layer).

Typical DevTools‑based implementation:

1. Activate `browserExe` window.
2. Ensure DevTools console is open (e.g. `Ctrl+Shift+J`).
3. Wait `consoleDelay`.
4. Focus console input.
5. Save `ClipboardAll`, set clipboard to JS, paste (`Ctrl+V`).
6. Press Enter.
7. Restore clipboard.

`consoleDelay` and `pasteDelay` parameters come from `[General]` and can be tuned.

---

## 5. ComboSwitch module

### 5.1 AHK side: `Includes\Combo.ahk`

Entry point:

```ahk
RunCombo(direction)  ; "up" or "down"
```

Steps:

1. Validate that `transferXPath`, `combo1XPath`, `combo2XPath`, `optionsXPath`, and `confirmXPath` are non‑empty. If not, show a message and abort.
2. Ensure timing values (`ComboPollIntervalMs`, `ComboOpenMaxAttempts`, `ComboWaitMaxAttempts`) have sane defaults.
3. Activate the browser: `WinActivate("ahk_exe " browserExe)`.
4. `FileRead` the `combo.js` template from `A_ScriptDir`.
5. Replace placeholders:
   - `__DIRECTION__`
   - `__TRANSFER_XPATH__`
   - `__COMBO1_XPATH__`
   - `__COMBO2_XPATH__`
   - `__OPTIONS_XPATH__`
   - `__CONFIRM_XPATH__`
   - `__COMBO_POLL_INTERVAL_MS__`
   - `__COMBO_OPEN_MAX_ATTEMPTS__`
   - `__COMBO_WAIT_MAX_ATTEMPTS__`
6. Optionally sanity‑check length to avoid injecting empty/partial JS.
7. Call `InjectJS(finalJs)`.

### 5.2 JS side: `combo.js`

The injected script is fully self‑contained and parameterized.

#### 5.2.1 Configuration constants

Injected at runtime:

```js
var POLL_INTERVAL_MS    = __COMBO_POLL_INTERVAL_MS__;
var OPEN_MAX_ATTEMPTS   = __COMBO_OPEN_MAX_ATTEMPTS__;
var WAIT_MAX_ATTEMPTS   = __COMBO_WAIT_MAX_ATTEMPTS__;
```

Direction and XPaths are replaced as raw strings.

#### 5.2.2 Helper: `getNodeByXPath(xpath)`

- If `xpath` is empty or whitespace:
  - Logs `[ComboSwitch] getNodeByXPath: EMPTY xpath`.
  - Returns `null`.
- Wraps `document.evaluate` in `try/catch`:
  - On exception: logs the invalid XPath and error.
  - Returns `null`.

#### 5.2.3 Helper: `waitForElement(xpath, description, callback, maxAttempts)`

- If XPath is empty:
  - Logs `[ComboSwitch] waitForElement: EMPTY xpath for description`.
  - Shows an `alert()` with the description and “EMPTY” warning.
  - Returns.

- Otherwise:
  - Uses `setInterval` with `POLL_INTERVAL_MS`.
  - On each tick:
    - Calls `getNodeByXPath(xpath)`.
    - If element found:
      - Clears interval.
      - Logs `"FOUND (attempt N)"`.
      - Calls `callback(el)`.
    - If attempts exceed `maxAttempts` or `WAIT_MAX_ATTEMPTS`:
      - Clears interval.
      - Logs `"NOT FOUND after N attempts"` plus exact XPath string.
      - Alerts user with the same XPath.
    - Else:
      - Logs `"Waiting for DESCRIPTION... (attempt/max), xpath: XPATH"`.

#### 5.2.4 Workflow steps

1. **Transfer button**  
   - Log `Using TransferButtonXPath: __TRANSFER_XPATH__`.
   - `transferBtn = getNodeByXPath("__TRANSFER_XPATH__")`.
   - If found: log and click.
   - If not: log + alert with XPath; abort.

2. **Combo 1 (current value)**  
   - Log `Using Combo1XPath: __COMBO1_XPATH__`.
   - `waitForElement("__COMBO1_XPATH__", "Combo 1 text", callback)`:
     - In callback:
       - `sourceText = (combo1.textContent || "").trim()`.
       - Log the text.

3. **Combo 2 button**  
   - Log `Using Combo2ButtonXPath: __COMBO2_XPATH__`.
   - `waitForElement("__COMBO2_XPATH__", "Combo 2 button", callback)`:
     - In callback: log and `combo2Btn.click()`.

4. **Dropdown open detection**  
   - `openAttempts = 0`.
   - `setInterval` (using `POLL_INTERVAL_MS`):
     - `openTrigger = document.querySelector("button[data-state='open']")`.
     - If found: clear interval, log success, proceed to options.
     - If `openAttempts >= OPEN_MAX_ATTEMPTS`:
       - Clear interval, log + alert “did not open after N attempts”.
     - Else: log waiting status.

5. **Options container**  
   - Log `Using OptionsContainerXPath: __OPTIONS_XPATH__`.
   - `waitForElement("__OPTIONS_XPATH__", "Options container", callback)`:
     - In callback:
       - `options = Array.from(listRoot.querySelectorAll("div[role='option']"))`.
       - `labels = options.map(opt => ...)` using `p.min-w-0.truncate` or full text.
       - Log number of options and all labels.

6. **Current index detection**  
   - Initialize `currentIndex = -1`.
   - Try exact match: `labels[i] === sourceText`.
   - If still `-1`: partial match:
     - `labels[j].indexOf(sourceText) !== -1` OR `sourceText.indexOf(labels[j]) !== -1`.
   - If still `-1`:
     - Log full error with sourceText and labels.
     - Alert and abort.
   - Else:
     - Log `"Match at index i: 'label'"`.

7. **Target index**

   - If `__DIRECTION__ === "up"`:
     - `targetIndex = (currentIndex - 1 >= 0 ? currentIndex - 1 : options.length - 1)`.
   - Else:
     - `targetIndex = (currentIndex + 1 < options.length ? currentIndex + 1 : 0)`.
   - Log `"Selecting 'label[targetIndex]' (__DIRECTION__)"`.
   - `options[targetIndex].click()`.

8. **Confirm**

   - Log `Using ConfirmButtonXPath: __CONFIRM_XPATH__`.
   - `waitForElement("__CONFIRM_XPATH__", "Confirm button", callback)`:
     - In callback:
       - Log "Confirm clicked".
       - `finalBtn.click()`.
       - Log `"DONE! Moved __DIRECTION__ to: 'labels[targetIndex]'"`.

---

## 6. Gmail module

### 6.1 AHK: `Includes\Gmail.ahk`

Globals:

- `browserExe`, `gmailUrl`, `gmailSearch`.
- `gmailOpenDelayMs`, `gmailSlashDelayMs`, `gmailTypeDelayMs`, `gmailEnterDelayMs`.

Flow in `RunGmail()`:

1. Determine if the active window is the configured browser and on Gmail:
   - `WinGetProcessName("A")` (lower‑cased) equals `browserExe` file name.
   - `WinGetTitle("A")` contains `"gmail"` (case‑insensitive heuristic).
2. If yes → `GmailSearchCurrentTab()`.
3. If not:
   - `Run Format('"{1}" "{2}"', browserExe, gmailUrl)`.
   - `Sleep gmailOpenDelayMs`.
   - `GmailSearchCurrentTab()`.

`GmailSearchCurrentTab()`:

1. `Sleep gmailSlashDelayMs`.
2. `Send "/"`.
3. `Sleep gmailTypeDelayMs`.
4. `SendText gmailSearch`.
5. `Sleep gmailEnterDelayMs`.
6. `Send "{Enter}"`.

All behaviour is tuned via `[Gmail]` section.

---

## 7. Macro module

### 7.1 State and API

Globals:

- `isMacroRunning` (bool).
- `macroDirection` (`"up"` or `"down"`).
- `macroIntervalMs` (from config).

Public functions:

- `ToggleMacro(direction)` – start/stop macro.
- `MacroTick(*)` – timer callback.
- `MacroStep()` – one iteration body.

JS‑backed helpers:

- `ClickToolButton()`.
- `CheckProgressBar()` → bool.
- `HandleBusyState()`.
- `ClickExecuteButton()`.
- `HandleIdleState()`.

### 7.2 `ToggleMacro(direction)`

1. If `isMacroRunning` is true:
   - Set `isMacroRunning := false`.
   - `SetTimer(MacroTick, 0)` to stop loop.
   - Return.

2. If `isMacroRunning` is false:
   - Optionally check domain (URL starts with `https://lovable.dev/` using JS).
   - If not on Lovable: show error, return.
   - Else:
     - Set `macroDirection := direction`.
     - Set `isMacroRunning := true`.
     - `SetTimer(MacroTick, macroIntervalMs)`.

### 7.3 `MacroTick(*)`

- If `isMacroRunning`:
  - Call `MacroStep()`.
- Otherwise:
  - Stop timer (`SetTimer(MacroTick, 0)`).

### 7.4 `MacroStep()` logic

1. `WinActivate("ahk_exe " browserExe)`.
2. `ClickToolButton()`:
   - Inject JS that:
     - Uses `toolButtonXPath`.
     - Logs success/failure.
     - Clicks button if present.
3. `Sleep 1000`.
4. `hasProgress := CheckProgressBar()`:
   - JS uses `progressXPath`.
   - Returns `"busy"` or `"idle"`.
5. If busy → `HandleBusyState()`.
6. If idle → `HandleIdleState()`.

### 7.5 Busy state

`HandleBusyState()` JS:

1. `container = getNodeByXPath(suggestionsAllXPath)`.
   - Logs if not found and returns `"nosuggestions"`.
2. `items = Array.from(container.querySelectorAll("div"))`.
3. For each item:
   - `txt = textContent.trim().toLowerCase()`.
   - Skip if empty or contains `"verify"`.
   - First acceptable:
     - Log label.
     - `click()` and return `"clicked"`.
4. If none acceptable: log `"No suitable suggestion"` and return `"skipped"`.

AHK:

- If result is `"clicked"` → `ClickExecuteButton()`:
  - JS finds `executeButtonXPath`, logs, and clicks if present.

### 7.6 Idle state

`HandleIdleState()` in AHK:

1. `currentUrl := InjectJSGet("(function(){return window.location.href;})();")`.
2. If empty: exit early.
3. Normalize `settingsUrl`:
   - Strip query (`?`) and hash (`#`).
   - Trim trailing `/`.
   - Append `/settings?tab=project`.
4. Navigate:
   - `Send("^l")`, `Sleep`.
   - `SendText(settingsUrl)`, `Sleep`.
   - `Send("{Enter}")`, `Sleep(2500)`.
5. Call `RunCombo(macroDirection)` to move project combo.
6. Inject “DONE” label JS:
   - Finds `transferXPath`.
   - If found:
     - If `#ahk-macro-done-label` exists → update text to `" DONE"`.
     - Else create `<span id="ahk-macro-done-label"> DONE</span>` next to button (green, bold).
7. Navigate back:
   - `Send("!{Left}")`, `Sleep(2000)`.

The macro loop continues until `ToggleMacro` is called again or the script exits.

---

## 8. Diagnostics and error behaviour

- **Broken XPaths**:
  - JS logs full XPath and “EMPTY/INVALID/NOT FOUND” messages to the DevTools console.
  - `alert()` messages show the failing description and XPath, making it easy to copy into `config.ini`.
- **Domain mismatch**:
  - Macro refuses to start when the current URL is not on Lovable; user sees a message.
- **Timing issues**:
  - If JS doesn’t run reliably, increase:
    - `ConsoleDelay` / `PasteDelay` (for injection).
    - Combo/Gmail timing values (for slow pages).

---

## 9. Extensibility

To extend Automator v2 for new workflows:

1. Add a new section in `config.ini` with XPaths and timing for that site.
2. Create an `Includes\YourSite.ahk`:
   - Read the relevant config (already done by `LoadConfig()` or via new globals).
   - Load a `your_site.js` template, replace placeholders, and call `InjectJS()`.
3. Add a new hotkey to `[Hotkeys]` and wire it in `Automator.ahk`.

By keeping the **config**, **AHK orchestration**, and **JS logic** separated and parameterized, you can adjust DOM selectors and timing without rewriting the core automation logic.