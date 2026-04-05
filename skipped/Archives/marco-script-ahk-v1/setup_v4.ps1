# ============================================
# setup_modular.ps1 - generate modular AHK v2 project
# ============================================

$outputDir = $PSScriptRoot
if (-not $outputDir) { $outputDir = Get-Location }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Modular Automator v2 Setup" -ForegroundColor Cyan
Write-Host " Output directory: $outputDir" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Ensure Includes folder exists
$includesDir = Join-Path $outputDir "Includes"
if (-not (Test-Path $includesDir)) {
    New-Item -Path $includesDir -ItemType Directory | Out-Null
}

# ------------------------------
# 1) Write core includes
# ------------------------------

$comboInclude = @"
; Includes\Combo.ahk - ComboSwitch logic

RunCombo(direction) {
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath

    js := ""
    try js := FileRead(A_ScriptDir "\combo.js")
    catch {
        MsgBox("Could not read combo.js", "Automator v2")
        return
    }

    js := StrReplace(js, "__DIRECTION__", direction)
    js := StrReplace(js, "__TRANSFER_XPATH__", transferXPath)
    js := StrReplace(js, "__COMBO1_XPATH__", combo1XPath)
    js := StrReplace(js, "__COMBO2_XPATH__", combo2XPath)
    js := StrReplace(js, "__OPTIONS_XPATH__", optionsXPath)
    js := StrReplace(js, "__CONFIRM_XPATH__", confirmXPath)

    InjectJS(js)
}
"@

$gmailInclude = @"
; Includes\Gmail.ahk - Gmail helper

RunGmail() {
    global browserExe, gmailUrl, gmailSearch

    Run(browserExe " " gmailUrl)
    if WinWait("ahk_exe " browserExe,, 10) {
        WinActivate("ahk_exe " browserExe)
    }
    Sleep(3000)
    Send("/")
    Sleep(500)
    SendText(gmailSearch)
    Sleep(300)
    Send("{Enter}")
}
"@

$macroInclude = @"
; Includes\Macro.ahk - Macro loop for Lovable.dev

global isMacroRunning := false
global macroDirection := "down"

ToggleMacro(direction) {
    global isMacroRunning, macroDirection, macroIntervalMs

    currentUrl := InjectJSGet("(function(){return window.location.href;})();")
    if !(SubStr(currentUrl, 1, 21) = "https://lovable.dev/") {
        MsgBox("Macro can only run on https://lovable.dev/ pages.`nCurrent: " currentUrl, "Automator v2")
        return
    }

    if isMacroRunning {
        isMacroRunning := false
        SetTimer(MacroTick, 0)
        return
    }

    isMacroRunning := true
    macroDirection := direction
    SetTimer(MacroTick, macroIntervalMs)
}

MacroTick() {
    global isMacroRunning
    if isMacroRunning {
        MacroStep()
    }
}

MacroStep() {
    global browserExe
    WinActivate("ahk_exe " browserExe)
    Sleep(300)

    ClickToolButton()
    Sleep(1000)

    hasProgress := CheckProgressBar()
    if hasProgress {
        HandleBusyState()
    } else {
        HandleIdleState()
    }
}

ClickToolButton() {
    global toolButtonXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_TOOLBTN_X"");
      if (btn) {
        console.log(""[Macro] Tool button click"");
        btn.click();
      } else {
        console.log(""[Macro] Tool button NOT found"");
      }
    })();
    )"
    js := StrReplace(js, "X_TOOLBTN_X", toolButtonXPath)
    InjectJS(js)
}

CheckProgressBar() {
    global progressXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var pr = x(""X_PROGRESS_X"");
      if (pr) {
        console.log(""[Macro] Progress exists"");
        return ""busy"";
      }
      console.log(""[Macro] No progress bar"");
      return ""idle"";
    })();
    )"
    js := StrReplace(js, "X_PROGRESS_X", progressXPath)
    state := InjectJSGet(js)
    return (state = "busy")
}

HandleBusyState() {
    global suggestionsAllXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var container = x(""X_SUGALL_X"");
      if (!container) {
        console.log(""[Macro] Suggestions container not found"");
        return ""nosuggestions"";
      }
      var items = Array.from(container.querySelectorAll(""div""));
      console.log(""[Macro] Suggestions count: "" + items.length);
      for (var i = 0; i < items.length; i++) {
        var txt = (items[i].textContent || """").trim();
        var lower = txt.toLowerCase();
        if (txt && lower.indexOf(""verify"") === -1) {
          console.log(""[Macro] Clicking suggestion: "" + txt);
          items[i].click();
          return ""clicked"";
        }
      }
      console.log(""[Macro] No suitable suggestion (only verify/empty)"");
      return ""skipped"";
    })();
    )"
    js := StrReplace(js, "X_SUGALL_X", suggestionsAllXPath)
    result := InjectJSGet(js)

    if (result = "clicked") {
        ClickExecuteButton()
    }
}

ClickExecuteButton() {
    global executeButtonXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_EXECBTN_X"");
      if (btn) {
        console.log(""[Macro] Execute button click"");
        btn.click();
        return ""ok"";
      }
      console.log(""[Macro] Execute button not found"");
      return ""missing"";
    })();
    )"
    js := StrReplace(js, "X_EXECBTN_X", executeButtonXPath)
    InjectJS(js)
}

HandleIdleState() {
    global macroDirection, transferXPath

    currentUrl := InjectJSGet("(function(){return window.location.href;})();")
    if (currentUrl = "") {
        return
    }

    settingsUrl := currentUrl
    qPos := InStr(settingsUrl, "?")
    if (qPos)
        settingsUrl := SubStr(settingsUrl, 1, qPos - 1)
    hPos := InStr(settingsUrl, "#")
    if (hPos)
        settingsUrl := SubStr(settingsUrl, 1, hPos - 1)
    if (SubStr(settingsUrl, StrLen(settingsUrl), 1) = "/")
        settingsUrl := RTrim(settingsUrl, "/")
    settingsUrl := settingsUrl . "/settings?tab=project"

    Send("^l")
    Sleep(150)
    SendText(settingsUrl)
    Sleep(150)
    Send("{Enter}")
    Sleep(2500)

    RunCombo(macroDirection)

    jsMark := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_TRANSFER_X"");
      if (!btn) {
        console.log(""[Macro] Transfer button not found to label"");
        return ""nolabel"";
      }
      var id = ""ahk-macro-done-label"";
      var existing = document.getElementById(id);
      if (existing) {
        existing.textContent = "" DONE"";
        return ""updated"";
      }
      var span = document.createElement(""span"");
      span.id = id;
      span.textContent = "" DONE"";
      span.style.marginLeft = ""8px"";
      span.style.color = ""#22c55e"";
      span.style.fontWeight = ""bold"";
      btn.parentNode.appendChild(span);
      console.log(""[Macro] DONE label added"");
      return ""added"";
    })();
    )"
    jsMark := StrReplace(jsMark, "X_TRANSFER_X", transferXPath)
    InjectJSGet(jsMark)

    Send("!{Left}")
    Sleep(2000)
}
"@

$jsInclude = @"
; Includes\JsInject.ahk - JS injection helpers

InjectJS(js) {
    global browserExe, consoleDelay, pasteDelay
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
    Sleep(200)
    A_Clipboard := oldClip
}

InjectJSGet(js) {
    global browserExe, consoleDelay, pasteDelay

    wrapped := "
    (
    (function(){
      var __r = (function(){ " js " })();
      try {
        prompt('AHK_RESULT', __r);
      } catch(e) {
        prompt('AHK_RESULT', String(__r));
      }
    })();
    )"

    oldClip := ClipboardAll()
    A_Clipboard := wrapped
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
    result := ""
    if WinWaitActive("AHK_RESULT",,1) {
        ControlGetText(&result,"Edit1","AHK_RESULT")
        Send("{Enter}")
    }
    A_Clipboard := oldClip
    return result
}
"@

Set-Content -Path (Join-Path $includesDir "Combo.ahk")  -Value $comboInclude  -Encoding UTF8
Set-Content -Path (Join-Path $includesDir "Gmail.ahk")  -Value $gmailInclude  -Encoding UTF8
Set-Content -Path (Join-Path $includesDir "Macro.ahk")  -Value $macroInclude  -Encoding UTF8
Set-Content -Path (Join-Path $includesDir "JsInject.ahk") -Value $jsInclude   -Encoding UTF8

# ------------------------------
# 2) Write Automator.ahk (main)
# ------------------------------
$automator = @"
#Requires AutoHotkey >=2.0
#SingleInstance Force

configFile := A_ScriptDir "\config.ini"

comboDownHotkey   := IniRead(configFile, "Hotkeys", "ComboDown", "^Down")
comboUpHotkey     := IniRead(configFile, "Hotkeys", "ComboUp", "^Up")
gmailUnreadHotkey := IniRead(configFile, "Hotkeys", "GmailUnread", "^+F9")
macroUpHotkey     := IniRead(configFile, "Hotkeys", "MacroUp", "^+!Up")
macroDownHotkey   := IniRead(configFile, "Hotkeys", "MacroDown", "^+!Down")

transferXPath := IniRead(configFile, "ComboSwitch", "TransferButtonXPath")
combo1XPath   := IniRead(configFile, "ComboSwitch", "Combo1XPath")
combo2XPath   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath")
optionsXPath  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath")
confirmXPath  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath")

gmailUrl    := IniRead(configFile, "Gmail", "URL", "https://mail.google.com")
gmailSearch := IniRead(configFile, "Gmail", "SearchQuery", "is:unread")

browserExe   := IniRead(configFile, "General", "BrowserExe", "chrome.exe")
consoleDelay := Integer(IniRead(configFile, "General", "ConsoleDelay", "800"))
pasteDelay   := Integer(IniRead(configFile, "General", "PasteDelay", "200"))

toolButtonXPath      := IniRead(configFile, "Macro", "ToolButtonXPath")
progressXPath        := IniRead(configFile, "Macro", "ProgressXPath")
suggestionsAllXPath  := IniRead(configFile, "Macro", "SuggestionsAllXPath")
firstSuggestionXPath := IniRead(configFile, "Macro", "FirstSuggestionXPath")
macroIntervalMs      := Integer(IniRead(configFile, "Macro", "IntervalMs", "15000"))
executeButtonXPath   := IniRead(configFile, "Macro", "ExecuteButtonXPath")

#Include *i Includes\JsInject.ahk
#Include *i Includes\Combo.ahk
#Include *i Includes\Gmail.ahk
#Include *i Includes\Macro.ahk

Hotkey(comboDownHotkey,  (*) => RunCombo("down"))
Hotkey(comboUpHotkey,    (*) => RunCombo("up"))
Hotkey(gmailUnreadHotkey,(*) => RunGmail())
Hotkey(macroUpHotkey,    (*) => ToggleMacro("up"))
Hotkey(macroDownHotkey,  (*) => ToggleMacro("down"))

TraySetIcon("shell32.dll", 44)
A_IconTip := "Lovable Macro AHK"

Tray := A_TrayMenu
Tray.Delete()
Tray.Add("Start Macro (Up)", MenuStartMacroUp)
Tray.SetIcon("Start Macro (Up)", "shell32.dll", 44)
Tray.Add("Start Macro (Down)", MenuStartMacroDown)
Tray.SetIcon("Start Macro (Down)", "shell32.dll", 44)
Tray.Add("Stop Macro", MenuStopMacro)
Tray.SetIcon("Stop Macro", "shell32.dll", 131)
Tray.Add()
Tray.Add("Run Combo Down", MenuComboDown)
Tray.Add("Run Combo Up",   MenuComboUp)
Tray.Add("Gmail Unread",   MenuGmail)
Tray.Add()
Tray.Add("Open Config.ini", MenuOpenConfig)
Tray.Add("Reload Script",   MenuReload)
Tray.Add("Exit",            MenuExit)
Tray.Default := "Start Macro (Down)"

TrayTip("Automator v2 loaded (modular).", "Automator v2", 1)

MenuStartMacroUp(*)   => ToggleMacro("up")
MenuStartMacroDown(*) => ToggleMacro("down")
MenuStopMacro(*) {
    global isMacroRunning
    isMacroRunning := false
    SetTimer(MacroTick, 0)
}
MenuComboDown(*) => RunCombo("down")
MenuComboUp(*)   => RunCombo("up")
MenuGmail(*)     => RunGmail()
MenuOpenConfig(*) {
    global configFile
    Run(A_WinDir "\System32\notepad.exe " Chr(34) configFile Chr(34))
}
MenuReload(*) => Reload()
MenuExit(*)   => ExitApp()

Esc::ExitApp()
"@

Set-Content -Path (Join-Path $outputDir "Automator.ahk") -Value $automator -Encoding UTF8

Write-Host ""
Write-Host "Created:" -ForegroundColor Cyan
Write-Host "  Automator.ahk" -ForegroundColor Green
Write-Host "  Includes\JsInject.ahk" -ForegroundColor Green
Write-Host "  Includes\Combo.ahk" -ForegroundColor Green
Write-Host "  Includes\Gmail.ahk" -ForegroundColor Green
Write-Host "  Includes\Macro.ahk" -ForegroundColor Green
