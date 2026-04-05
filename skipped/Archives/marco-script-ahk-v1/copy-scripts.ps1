# ============================================
# Automator Setup Script
# Creates all required files in the current directory
# ============================================

$outputDir = $PSScriptRoot
if (-not $outputDir) { $outputDir = Get-Location }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Automator Setup" -ForegroundColor Cyan
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
# 3) Automator.ahk
# ============================================
$automatorAhk = @"
#NoEnv
#SingleInstance Force
SetBatchLines, -1

; ============================================
; Read all settings from config.ini
; ============================================
configFile := A_ScriptDir . "\config.ini"

; Hotkeys
IniRead, hkComboDown, %configFile%, Hotkeys, ComboDown, ^Down
IniRead, hkComboUp, %configFile%, Hotkeys, ComboUp, ^Up
IniRead, hkGmailUnread, %configFile%, Hotkeys, GmailUnread, ^+F9

; ComboSwitch XPaths
IniRead, xpTransfer, %configFile%, ComboSwitch, TransferButtonXPath
IniRead, xpCombo1, %configFile%, ComboSwitch, Combo1XPath
IniRead, xpCombo2, %configFile%, ComboSwitch, Combo2ButtonXPath
IniRead, xpOptions, %configFile%, ComboSwitch, OptionsContainerXPath
IniRead, xpConfirm, %configFile%, ComboSwitch, ConfirmButtonXPath

; Gmail
IniRead, gmailURL, %configFile%, Gmail, URL, https://mail.google.com
IniRead, gmailSearch, %configFile%, Gmail, SearchQuery, is:unread

; General
IniRead, browserExe, %configFile%, General, BrowserExe, chrome.exe
IniRead, consoleDelay, %configFile%, General, ConsoleDelay, 800
IniRead, pasteDelay, %configFile%, General, PasteDelay, 200

; ============================================
; Register hotkeys dynamically from config
; ============================================
Hotkey, %hkComboDown%, LabelComboDown
Hotkey, %hkComboUp%, LabelComboUp
Hotkey, %hkGmailUnread%, LabelGmailUnread

; Show tray tip on start
TrayTip, Automator, Script loaded!``nCombo Down: %hkComboDown%``nCombo Up: %hkComboUp%``nGmail: %hkGmailUnread%, 5

return

; ============================================
; Labels for hotkey actions
; ============================================
LabelComboDown:
    RunCombo("down")
return

LabelComboUp:
    RunCombo("up")
return

LabelGmailUnread:
    RunGmail()
return

; ============================================
; Combo Switch function
; ============================================
RunCombo(direction) {
    global xpTransfer, xpCombo1, xpCombo2, xpOptions, xpConfirm
    global browserExe, consoleDelay, pasteDelay

    ToolTip, ComboSwitch: %direction%...
    SoundBeep, 1000, 150

    FileRead, js, %A_ScriptDir%\combo.js
    if (ErrorLevel) {
        MsgBox, Could not read combo.js
        ToolTip
        return
    }

    StringReplace, js, js, __DIRECTION__, %direction%, All
    StringReplace, js, js, __TRANSFER_XPATH__, %xpTransfer%, All
    StringReplace, js, js, __COMBO1_XPATH__, %xpCombo1%, All
    StringReplace, js, js, __COMBO2_XPATH__, %xpCombo2%, All
    StringReplace, js, js, __OPTIONS_XPATH__, %xpOptions%, All
    StringReplace, js, js, __CONFIRM_XPATH__, %xpConfirm%, All

    InjectJS(js)

    ToolTip, ComboSwitch: %direction% done!
    SetTimer, ClearToolTip, -2000
}

; ============================================
; Gmail function (no JS needed, uses / shortcut)
; ============================================
RunGmail() {
    global gmailURL, gmailSearch, browserExe

    ToolTip, Gmail: searching unread...
    SoundBeep, 1200, 150

    ; Open Gmail
    Run, %browserExe% %gmailURL%
    WinWait, ahk_exe %browserExe%,, 10
    WinActivate, ahk_exe %browserExe%
    Sleep, 3000

    ; Press / to focus search box
    Send, /
    Sleep, 500

    ; Type the search query
    SendRaw, %gmailSearch%
    Sleep, 300

    ; Press Enter to search
    Send, {Enter}

    ToolTip, Gmail: done!
    SetTimer, ClearToolTip, -2000
}

; ============================================
; Shared: Inject JS into Chrome Console
; ============================================
InjectJS(js) {
    global browserExe, consoleDelay, pasteDelay

    old_clip := ClipboardAll
    Clipboard := js

    WinActivate, ahk_exe %browserExe%
    Sleep, 100
    Send, ^+j
    Sleep, %consoleDelay%
    Send, {F6}
    Sleep, %pasteDelay%
    Send, ^v
    Sleep, %pasteDelay%
    Send, {Enter}

    Sleep, 300
    Clipboard := old_clip
}

; ============================================
; Utility
; ============================================
ClearToolTip:
    ToolTip
return

Esc::ExitApp
"@

$automatorPath = Join-Path $outputDir "Automator.ahk"
Set-Content -Path $automatorPath -Value $automatorAhk -Encoding UTF8
Write-Host "[OK] Automator.ahk" -ForegroundColor Green

# ============================================
# Done
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " All files created successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Files:" -ForegroundColor White
Write-Host "   config.ini     - All settings (hotkeys, XPaths, Gmail, delays)" -ForegroundColor Gray
Write-Host "   combo.js       - JavaScript for ComboSwitch automation" -ForegroundColor Gray
Write-Host "   Automator.ahk  - Main AutoHotkey script" -ForegroundColor Gray
Write-Host ""
Write-Host " Usage:" -ForegroundColor White
Write-Host "   1. Double-click Automator.ahk to start" -ForegroundColor Gray
Write-Host "   2. Ctrl+Down   = Combo next item" -ForegroundColor Gray
Write-Host "   3. Ctrl+Up     = Combo previous item" -ForegroundColor Gray
Write-Host "   4. Ctrl+Shift+F9 = Gmail search unread" -ForegroundColor Gray
Write-Host "   5. Esc         = Exit script" -ForegroundColor Gray
Write-Host ""
Write-Host " Edit config.ini with Notepad to customize." -ForegroundColor Yellow
Write-Host " After editing, right-click AHK tray icon > Reload." -ForegroundColor Yellow
Write-Host ""
