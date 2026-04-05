# ============================================
# Automator v2 Setup Script
# Creates all required files for AutoHotkey v2
# ============================================

$outputDir = $PSScriptRoot
if (-not $outputDir) { $outputDir = Get-Location }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Automator v2 Setup" -ForegroundColor Cyan
Write-Host " Output directory: $outputDir" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1) config.ini
# ============================================
$configIni = @"
[Hotkeys]
ComboDown=^Down
ComboUp=^Up
GmailUnread=^+F9

[ComboSwitch]
TransferButtonXPath=/html/body/div[2]/div/div/div/div/div/div/div[1]/div/div/div[3]/div[6]/div[2]/button
Combo1XPath=/html/body/div[5]/div[2]/div[1]/div/p
Combo2ButtonXPath=/html/body/div[5]/div[2]/div[2]/button
OptionsContainerXPath=/html/body/div[6]/div
ConfirmButtonXPath=/html/body/div[5]/div[3]/button[2]

[Gmail]
URL=https://mail.google.com
SearchQuery=is:unread

[General]
BrowserExe=chrome.exe
ConsoleDelay=800
PasteDelay=200
"@

$configPath = Join-Path $outputDir "config.ini"
Set-Content -Path $configPath -Value $configIni -Encoding UTF8
Write-Host "[OK] config.ini" -ForegroundColor Green

# ============================================
# 2) combo.js
# ============================================
$comboJs = @"
(function() {
  console.log("%c[ComboSwitch] Started, direction: __DIRECTION__", "color: cyan; font-weight: bold;");

  function getNodeByXPath(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  function waitForElement(xpath, description, callback, maxAttempts) {
    var attempts = 0;
    var max = maxAttempts || 20;
    var interval = setInterval(function() {
      attempts++;
      var el = getNodeByXPath(xpath);
      if (el) {
        clearInterval(interval);
        console.log("%c[ComboSwitch] " + description + " FOUND (attempt " + attempts + ")", "color: lime;");
        callback(el);
      } else if (attempts >= max) {
        clearInterval(interval);
        console.error("[ComboSwitch] " + description + " NOT FOUND after " + max + " attempts");
        alert("[ComboSwitch] FAILED: " + description + " not found.");
      }
    }, 300);
  }

  var transferBtn = getNodeByXPath("__TRANSFER_XPATH__");
  if (transferBtn) {
    console.log("%c[ComboSwitch] Transfer button FOUND, clicking...", "color: lime;");
    transferBtn.click();
  } else {
    console.error("[ComboSwitch] Transfer button NOT FOUND");
    alert("[ComboSwitch] FAILED: Transfer button not found.");
    return;
  }

  waitForElement("__COMBO1_XPATH__", "Combo 1 text", function(combo1) {
    var sourceText = combo1.textContent.trim();
    console.log("%c[ComboSwitch] Combo 1 text = '" + sourceText + "'", "color: lime;");

    waitForElement("__COMBO2_XPATH__", "Combo 2 button", function(combo2Btn) {
      combo2Btn.click();

      var openAttempts = 0;
      var openInterval = setInterval(function() {
        openAttempts++;
        var openTrigger = document.querySelector("button[data-state='open']");
        if (openTrigger) {
          clearInterval(openInterval);
          console.log("%c[ComboSwitch] Combo 2 is OPEN", "color: lime;");

          waitForElement("__OPTIONS_XPATH__", "Options container", function(listRoot) {
            var options = Array.from(listRoot.querySelectorAll("div[role='option']"));
            console.log("%c[ComboSwitch] Found " + options.length + " options", "color: lime;");

            var labels = options.map(function(opt) {
              var p = opt.querySelector("p.min-w-0.truncate");
              return p ? p.textContent.trim() : opt.textContent.trim();
            });
            console.log("[ComboSwitch] All labels:", labels);

            var currentIndex = -1;
            for (var i = 0; i < labels.length; i++) {
              if (labels[i] === sourceText) { currentIndex = i; break; }
            }

            if (currentIndex === -1) {
              for (var j = 0; j < labels.length; j++) {
                if (labels[j].indexOf(sourceText) !== -1 || sourceText.indexOf(labels[j]) !== -1) {
                  currentIndex = j;
                  break;
                }
              }
            }

            if (currentIndex === -1) {
              console.error("[ComboSwitch] '" + sourceText + "' NOT FOUND");
              alert("[ComboSwitch] FAILED: Could not match '" + sourceText + "'");
              return;
            }

            var targetIndex;
            if ("__DIRECTION__" === "up") {
              targetIndex = (currentIndex - 1 >= 0) ? currentIndex - 1 : options.length - 1;
            } else {
              targetIndex = (currentIndex + 1 < options.length) ? currentIndex + 1 : 0;
            }

            console.log("%c[ComboSwitch] Selecting '" + labels[targetIndex] + "' (__DIRECTION__)", "color: yellow; font-weight: bold;");
            options[targetIndex].click();

            waitForElement("__CONFIRM_XPATH__", "Confirm button", function(finalBtn) {
              finalBtn.click();
              console.log("%c[ComboSwitch] DONE!", "color: cyan; font-weight: bold; font-size: 14px;");
            });
          });
        } else if (openAttempts >= 20) {
          clearInterval(openInterval);
          alert("[ComboSwitch] FAILED: Combo 2 did not open.");
        }
      }, 300);
    });
  });
})();
"@

$comboPath = Join-Path $outputDir "combo.js"
Set-Content -Path $comboPath -Value $comboJs -Encoding UTF8
Write-Host "[OK] combo.js" -ForegroundColor Green

# ============================================
# 3) Automator.ahk (AutoHotkey v2)
# ============================================
$automatorAhk = @"
#Requires AutoHotkey >=2.0
#SingleInstance Force

; ============================================
; Read all settings from config.ini
; ============================================
configFile := A_ScriptDir "\config.ini"

; Hotkeys
hkComboDown  := IniRead(configFile, "Hotkeys", "ComboDown", "^Down")
hkComboUp    := IniRead(configFile, "Hotkeys", "ComboUp", "^Up")
hkGmailUnread := IniRead(configFile, "Hotkeys", "GmailUnread", "^+F9")

; ComboSwitch XPaths
xpTransfer := IniRead(configFile, "ComboSwitch", "TransferButtonXPath")
xpCombo1   := IniRead(configFile, "ComboSwitch", "Combo1XPath")
xpCombo2   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath")
xpOptions  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath")
xpConfirm  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath")

; Gmail
gmailURL    := IniRead(configFile, "Gmail", "URL", "https://mail.google.com")
gmailSearch := IniRead(configFile, "Gmail", "SearchQuery", "is:unread")

; General
browserExe   := IniRead(configFile, "General", "BrowserExe", "chrome.exe")
consoleDelay := Integer(IniRead(configFile, "General", "ConsoleDelay", "800"))
pasteDelay   := Integer(IniRead(configFile, "General", "PasteDelay", "200"))

; ============================================
; Register hotkeys dynamically from config
; ============================================
Hotkey(hkComboDown, (*) => RunCombo("down"))
Hotkey(hkComboUp, (*) => RunCombo("up"))
Hotkey(hkGmailUnread, (*) => RunGmail())

; Show tray tip on start
TrayTip("Script loaded!`nCombo Down: " hkComboDown "`nCombo Up: " hkComboUp "`nGmail: " hkGmailUnread, "Automator v2", 1)

; ============================================
; Tray menu: add Settings option
; ============================================
A_TrayMenu.Add("Settings", (*) => ShowSettings())
A_TrayMenu.Add()
A_TrayMenu.Default := "Settings"

; ============================================
; Combo Switch function
; ============================================
RunCombo(direction) {
    ToolTip("ComboSwitch: " direction "...")
    SoundBeep(1000, 150)

    try {
        js := FileRead(A_ScriptDir "\combo.js")
    } catch {
        MsgBox("Could not read combo.js`nMake sure it is in: " A_ScriptDir)
        ToolTip()
        return
    }

    js := StrReplace(js, "__DIRECTION__", direction)
    js := StrReplace(js, "__TRANSFER_XPATH__", xpTransfer)
    js := StrReplace(js, "__COMBO1_XPATH__", xpCombo1)
    js := StrReplace(js, "__COMBO2_XPATH__", xpCombo2)
    js := StrReplace(js, "__OPTIONS_XPATH__", xpOptions)
    js := StrReplace(js, "__CONFIRM_XPATH__", xpConfirm)

    InjectJS(js)

    ToolTip("ComboSwitch: " direction " done!")
    SetTimer(() => ToolTip(), -2000)
}

; ============================================
; Gmail function (uses / shortcut, no JS)
; ============================================
RunGmail() {
    ToolTip("Gmail: searching unread...")
    SoundBeep(1200, 150)

    Run(browserExe " " gmailURL)

    if WinWait("ahk_exe " browserExe,, 10) {
        WinActivate("ahk_exe " browserExe)
    }
    Sleep(3000)

    Send("/")
    Sleep(500)

    SendText(gmailSearch)
    Sleep(300)

    Send("{Enter}")

    ToolTip("Gmail: done!")
    SetTimer(() => ToolTip(), -2000)
}

; ============================================
; Shared: Inject JS into Chrome Console
; ============================================
InjectJS(js) {
    oldClip := ClipboardAll()
    A_Clipboard := js

    WinActivate("ahk_exe " browserExe)
    Sleep(100)
    Send("^+j")
    Sleep(consoleDelay)
    Send("{F6}")
    Sleep(pasteDelay)
    Send("^v")
    Sleep(pasteDelay)
    Send("{Enter}")

    Sleep(300)
    A_Clipboard := oldClip
}

; ============================================
; Settings GUI
; ============================================
ShowSettings() {
    settingsGui := Gui("+Resize", "Automator v2 — Settings")
    settingsGui.SetFont("s10")

    settingsGui.Add("GroupBox", "w500 h110 Section", "Hotkeys")
    settingsGui.Add("Text", "xs+15 ys+25 w120", "Combo Down:")
    edComboDown := settingsGui.Add("Edit", "x+10 yp-3 w200", hkComboDown)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Combo Up:")
    edComboUp := settingsGui.Add("Edit", "x+10 yp-3 w200", hkComboUp)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Gmail Unread:")
    edGmailHk := settingsGui.Add("Edit", "x+10 yp-3 w200", hkGmailUnread)

    settingsGui.Add("GroupBox", "xs w500 h190 Section", "ComboSwitch XPaths")
    settingsGui.Add("Text", "xs+15 ys+25 w120", "Transfer Button:")
    edTransfer := settingsGui.Add("Edit", "x+10 yp-3 w340", xpTransfer)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Combo 1:")
    edC1 := settingsGui.Add("Edit", "x+10 yp-3 w340", xpCombo1)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Combo 2 Button:")
    edC2 := settingsGui.Add("Edit", "x+10 yp-3 w340", xpCombo2)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Options Container:")
    edOpts := settingsGui.Add("Edit", "x+10 yp-3 w340", xpOptions)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Confirm Button:")
    edConf := settingsGui.Add("Edit", "x+10 yp-3 w340", xpConfirm)

    settingsGui.Add("GroupBox", "xs w500 h80 Section", "Gmail")
    settingsGui.Add("Text", "xs+15 ys+25 w120", "URL:")
    edGmailURL := settingsGui.Add("Edit", "x+10 yp-3 w340", gmailURL)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Search Query:")
    edGmailQ := settingsGui.Add("Edit", "x+10 yp-3 w340", gmailSearch)

    settingsGui.Add("GroupBox", "xs w500 h110 Section", "General")
    settingsGui.Add("Text", "xs+15 ys+25 w120", "Browser Exe:")
    edBrowser := settingsGui.Add("Edit", "x+10 yp-3 w200", browserExe)
    settingsGui.Add("Text", "xs+15 y+10 w120", "Console Delay (ms):")
    edConsole := settingsGui.Add("Edit", "x+10 yp-3 w100", String(consoleDelay))
    settingsGui.Add("Text", "xs+15 y+10 w120", "Paste Delay (ms):")
    edPaste := settingsGui.Add("Edit", "x+10 yp-3 w100", String(pasteDelay))

    btnSave := settingsGui.Add("Button", "xs w150 h35", "Save && Reload")
    btnSave.OnEvent("Click", (*) => SaveSettings(
        edComboDown.Value, edComboUp.Value, edGmailHk.Value,
        edTransfer.Value, edC1.Value, edC2.Value, edOpts.Value, edConf.Value,
        edGmailURL.Value, edGmailQ.Value,
        edBrowser.Value, edConsole.Value, edPaste.Value
    ))

    settingsGui.Show()
}

SaveSettings(hkDown, hkUp, hkGmail, xpT, xpC1, xpC2, xpO, xpCf, gURL, gQ, bExe, cDel, pDel) {
    cf := A_ScriptDir "\config.ini"

    IniWrite(hkDown, cf, "Hotkeys", "ComboDown")
    IniWrite(hkUp, cf, "Hotkeys", "ComboUp")
    IniWrite(hkGmail, cf, "Hotkeys", "GmailUnread")

    IniWrite(xpT, cf, "ComboSwitch", "TransferButtonXPath")
    IniWrite(xpC1, cf, "ComboSwitch", "Combo1XPath")
    IniWrite(xpC2, cf, "ComboSwitch", "Combo2ButtonXPath")
    IniWrite(xpO, cf, "ComboSwitch", "OptionsContainerXPath")
    IniWrite(xpCf, cf, "ComboSwitch", "ConfirmButtonXPath")

    IniWrite(gURL, cf, "Gmail", "URL")
    IniWrite(gQ, cf, "Gmail", "SearchQuery")

    IniWrite(bExe, cf, "General", "BrowserExe")
    IniWrite(cDel, cf, "General", "ConsoleDelay")
    IniWrite(pDel, cf, "General", "PasteDelay")

    MsgBox("Settings saved! Script will reload now.", "Automator v2")
    Reload()
}

; ============================================
; Exit hotkey
; ============================================
Esc::ExitApp()
"@

$automatorPath = Join-Path $outputDir "Automator.ahk"
Set-Content -Path $automatorPath -Value $automatorAhk -Encoding UTF8
Write-Host "[OK] Automator.ahk (v2)" -ForegroundColor Green

# ============================================
# 4) README.md
# ============================================
$readmeMd = @"
# Automator v2 — AutoHotkey Browser Automation Toolkit

A lightweight, configurable automation toolkit built with **AutoHotkey v2** and JavaScript.
Control browser actions with keyboard shortcuts — no browser extensions or external libraries required.

## Features

- **ComboSwitch**: Click a transfer button, read a dropdown value, find it in a second dropdown, and select the next/previous item — one keypress.
- **Gmail Quick Search**: Open Gmail and instantly search for unread emails (or any custom query).
- **Settings GUI**: Change hotkeys, XPaths, URLs, and timing from a visual window — no code editing needed.
- **Fully Configurable**: All settings stored in ``config.ini``. Edit with Notepad or use the built-in Settings GUI.
- **Zero Dependencies**: Just AutoHotkey v2 + Chrome. No libraries, no extensions.

## Quick Start

### Prerequisites

- [AutoHotkey v2](https://www.autohotkey.com/) (v2.0.19 or newer)
- Google Chrome (or any Chromium-based browser)

### Installation

``````powershell
.\Setup_v2.ps1
``````

This creates: ``config.ini``, ``combo.js``, ``Automator.ahk``, ``README.md``, ``SPEC.md``

### Running

1. Double-click ``Automator.ahk``
2. A tray notification confirms the script is loaded
3. Use the hotkeys:

| Hotkey | Action |
|---|---|
| Ctrl+Down | ComboSwitch: select next item |
| Ctrl+Up | ComboSwitch: select previous item |
| Ctrl+Shift+F9 | Open Gmail and search unread |
| Esc | Exit the script |

### Settings GUI

Right-click the AutoHotkey tray icon and select **Settings** to open the configuration window.
Change any setting, click **Save & Reload**, and the script restarts with the new values.

## File Structure

``````
MyAutomation/
+-- Setup_v2.ps1      # PowerShell generator (creates all files)
+-- config.ini        # All user settings
+-- combo.js          # Browser-side JavaScript for ComboSwitch
+-- Automator.ahk     # Main AutoHotkey v2 script
+-- README.md         # Usage documentation
+-- SPEC.md           # Technical specification
``````

## Configuration

Edit ``config.ini`` or use the Settings GUI.

**AHK hotkey syntax:** ``^`` = Ctrl, ``+`` = Shift, ``!`` = Alt, ``#`` = Win

**Gmail search examples:**
- ``is:unread`` — all unread
- ``is:unread in:inbox`` — unread in inbox only
- ``is:unread newer_than:1d`` — unread from last 24 hours
- ``from:boss@company.com is:unread`` — unread from specific sender

## Troubleshooting

| Problem | Solution |
|---|---|
| Nothing happens on hotkey | Check AHK tray icon is running. Listen for beep. |
| Console opens but JS fails | Increase ConsoleDelay in config.ini (try 1200). |
| Combo 1 not found | Modal hasn't loaded. Script retries 20 times. If still fails, update XPath. |
| Gmail / key not working | Enable Gmail keyboard shortcuts: Settings > General > Keyboard shortcuts > ON |
"@

$readmePath = Join-Path $outputDir "README.md"
Set-Content -Path $readmePath -Value $readmeMd -Encoding UTF8
Write-Host "[OK] README.md" -ForegroundColor Green

# ============================================
# 5) SPEC.md
# ============================================
$specMd = @"
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

``````
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
``````

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
- ``#Requires AutoHotkey >=2.0`` — ensures correct version
- ``IniRead()`` function syntax (not command)
- ``FileRead()`` returns string directly
- ``StrReplace()`` returns new string
- ``Hotkey(key, callback)`` with fat arrow functions
- ``Gui()`` object-based GUI with ``.Add()``, ``.OnEvent()``, ``.Show()``
- ``A_Clipboard`` instead of ``Clipboard``
- ``try/catch`` for error handling
- ``SetTimer(() => ToolTip(), -2000)`` inline timer callbacks

### 3.4 Settings GUI

Built with native AHK v2 Gui object:
- GroupBox sections for Hotkeys, XPaths, Gmail, General
- Edit fields pre-filled with current config values
- Save button writes all values with IniWrite() and calls Reload()
- Accessible from tray menu (right-click > Settings)

### 3.5 Gmail Automation

Uses Gmail built-in ``/`` keyboard shortcut:
1. Run() opens browser with Gmail URL
2. Send("/") focuses search box
3. SendText() types the search query
4. Send("{Enter}") executes search

No JavaScript injection needed.

## 4. Target UI (ComboSwitch)

- **Framework**: React + Radix UI Select component
- **Dropdown trigger**: ``<button>`` with ``data-state="open"/"closed"``
- **Options**: ``<div role="option">`` with ``data-radix-collection-item``
- **Labels**: ``<p class="min-w-0 truncate">`` inside each option

## 5. Limitations

- Single browser window targeting (ahk_exe)
- Console must be accessible (no restrictive CSP)
- Absolute XPaths break if page structure changes
- Temporary clipboard usage during JS injection
- Gmail ``/`` shortcut requires keyboard shortcuts enabled in Gmail settings

## 6. Future Improvements

- Chrome DevTools Protocol (CDP) via WebSocket for clipboard-free injection
- Multiple browser window support via window title matching
- File logging for debugging without Console
- Auto-reload on config.ini file change detection
"@

$specPath = Join-Path $outputDir "SPEC.md"
Set-Content -Path $specPath -Value $specMd -Encoding UTF8
Write-Host "[OK] SPEC.md" -ForegroundColor Green

# ============================================
# Done
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " All 5 files created successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Files:" -ForegroundColor White
Write-Host "   config.ini     - All settings" -ForegroundColor Gray
Write-Host "   combo.js       - JavaScript for ComboSwitch" -ForegroundColor Gray
Write-Host "   Automator.ahk  - Main script (AutoHotkey v2)" -ForegroundColor Gray
Write-Host "   README.md      - Usage documentation" -ForegroundColor Gray
Write-Host "   SPEC.md        - Technical specification" -ForegroundColor Gray
Write-Host ""
Write-Host " Usage:" -ForegroundColor White
Write-Host "   1. Double-click Automator.ahk to start" -ForegroundColor Gray
Write-Host "   2. Ctrl+Down      = Combo next item" -ForegroundColor Gray
Write-Host "   3. Ctrl+Up        = Combo previous item" -ForegroundColor Gray
Write-Host "   4. Ctrl+Shift+F9  = Gmail search unread" -ForegroundColor Gray
Write-Host "   5. Right-click tray > Settings = GUI editor" -ForegroundColor Gray
Write-Host "   6. Esc            = Exit script" -ForegroundColor Gray
Write-Host ""
