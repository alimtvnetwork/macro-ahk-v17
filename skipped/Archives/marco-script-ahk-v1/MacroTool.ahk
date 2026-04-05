#Requires AutoHotkey >=2.0
#SingleInstance Force

; This script assumes:
; - config.ini and combo.js are in the same folder (from main Automator v2 setup)
; - ComboSwitch (up/down) is handled by combo.js with same placeholders
; - Browser is Chrome (or Chromium) specified by BrowserExe in config.ini

configFile := A_ScriptDir "\config.ini"

; Load shared config
hkMacroUp   := IniRead(configFile, "Hotkeys", "MacroUp", "^+!Up")
hkMacroDown := IniRead(configFile, "Hotkeys", "MacroDown", "^+!Down")

browserExe   := IniRead(configFile, "General", "BrowserExe", "chrome.exe")
consoleDelay := Integer(IniRead(configFile, "General", "ConsoleDelay", "800"))
pasteDelay   := Integer(IniRead(configFile, "General", "PasteDelay", "200"))

; Reuse ComboSwitch XPaths
xpTransfer := IniRead(configFile, "ComboSwitch", "TransferButtonXPath")
xpCombo1   := IniRead(configFile, "ComboSwitch", "Combo1XPath")
xpCombo2   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath")
xpOptions  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath")
xpConfirm  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath")

; New XPaths for Macro behaviour
toolButtonXPath   := IniRead(configFile, "Macro", "ToolButtonXPath", "/html/body/div[2]/div/div[2]/nav/div/div/div/div[1]/div[1]/button/div/div/svg")
progressXPath     := IniRead(configFile, "Macro", "ProgressXPath", "/html/body/div[4]/div/div[2]/div[2]/div/div[2]/div/div[2]")
suggestionsAllXPath := IniRead(configFile, "Macro", "SuggestionsAllXPath", "/html/body/div[2]/div/div[2]/main/div/div/div[1]/div/div[2]/div/div[1]/div[1]")
firstSuggestionXPath := IniRead(configFile, "Macro", "FirstSuggestionXPath", "/html/body/div[2]/div/div[2]/main/div/div/div[1]/div/div[2]/div/div[1]/div[1]/div[1]")

macroIntervalMs := Integer(IniRead(configFile, "Macro", "IntervalMs", "15000"))

; State
global gMacroRunning := false
global gMacroDirection := "down"   ; "up" or "down"

; Register hotkeys
Hotkey(hkMacroUp,   (*) => ToggleMacro("up"))
Hotkey(hkMacroDown, (*) => ToggleMacro("down"))

TrayTip("MacroTool loaded.
Macro Up: " hkMacroUp "
Macro Down: " hkMacroDown, "MacroTool v2", 1)

; ============================================
; Toggle start/stop
; ============================================
ToggleMacro(direction) {
    global gMacroRunning, gMacroDirection, macroIntervalMs

    if !gMacroRunning {
        gMacroRunning := true
        gMacroDirection := direction
        ToolTip("MacroTool: started (" direction ")")
        SoundBeep(1300, 150)
        SetTimer(MacroTick, macroIntervalMs)
    } else {
        gMacroRunning := false
        ToolTip("MacroTool: stopped")
        SoundBeep(800, 150)
        SetTimer(MacroTick, 0)
        SetTimer(() => ToolTip(), -1500)
    }
}

; ============================================
; Main loop tick
; ============================================
MacroTick() {
    global gMacroRunning
    if !gMacroRunning
        return

    ToolTip("MacroTool: tick (" gMacroDirection ")")
    try {
        MacroStep()
    } catch e {
        MsgBox("Macro error:
" e.Message, "MacroTool", 48)
    }
}

; ============================================
; One cycle
; ============================================
MacroStep() {
    global browserExe, toolButtonXPath, progressXPath
    global suggestionsAllXPath, firstSuggestionXPath
    global gMacroDirection

    WinActivate("ahk_exe " browserExe)
    Sleep(300)

    ; 1) Click tool button
    jsClickTool :=
    (
    (function() {
      function x(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x("@@TOOLBTN@@");
      if (btn) {
        console.log("[Macro] Tool button found, clicking");
        btn.click();
      } else {
        console.log("[Macro] Tool button NOT found");
      }
    })();
    )
    jsClickTool := StrReplace(jsClickTool, "@@TOOLBTN@@", toolButtonXPath)
    InjectJS(jsClickTool)

    ; 2) Check progress
    Sleep(1000)
    jsCheckProgress :=
    (
    (function() {
      function x(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var progress = x("@@PROGRESS@@");
      if (progress) {
        console.log("[Macro] Progress exists");
        return "busy";
      } else {
        console.log("[Macro] No progress bar");
        return "idle";
      }
    })();
    )
    jsCheckProgress := StrReplace(jsCheckProgress, "@@PROGRESS@@", progressXPath)

    state := InjectJSGet(jsCheckProgress)
    if (state = "busy") {
        HandleBusy()
    } else {
        HandleIdle()
    }
}

; ============================================
; Busy: click suggestion (skip 'verify')
; ============================================
HandleBusy() {
    global suggestionsAllXPath, firstSuggestionXPath

    js :=
    (
    (function() {
      function x(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var container = x("@@SUGALL@@");
      if (!container) {
        console.log("[Macro] Suggestions container not found");
        return "nosuggestions";
      }
      var items = container.querySelectorAll("div");
      console.log("[Macro] Suggestions count: " + items.length);
      for (var i = 0; i < items.length; i++) {
        var txt = items[i].textContent || "";
        var lower = txt.toLowerCase();
        if (lower.indexOf("verify") === -1 && lower.trim() !== "") {
          console.log("[Macro] Clicking suggestion: " + txt.trim());
          items[i].click();
          return "clicked";
        }
      }
      console.log("[Macro] Only verify / empty suggestions, nothing clicked");
      return "skipped";
    })();
    )
    js := StrReplace(js, "@@SUGALL@@", suggestionsAllXPath)

    res := InjectJSGet(js)
    ToolTip("MacroTool busy: " res)
    SetTimer(() => ToolTip(), -2000)
}

; ============================================
; Idle: go to settings tab, run ComboSwitch, mark done, return
; ============================================
HandleIdle() {
    global browserExe, gMacroDirection
    global xpTransfer, xpCombo1, xpCombo2, xpOptions, xpConfirm

    ; Find current URL and target settings URL
    jsGetUrl :=
    (
    (function() {
      return window.location.href;
    })();
    )
    currentUrl := InjectJSGet(jsGetUrl)
    if !currentUrl {
        ToolTip("MacroTool: no URL?")
        SetTimer(() => ToolTip(), -1500)
        return
    }
    settingsUrl := currentUrl
    ; Trim any existing query or hash and append /settings?tab=project
    jsBuild :=
    (
    (function(u) {
      try {
        var url = new URL(u);
        return url.origin + url.pathname + "/settings?tab=project";
      } catch(e) {
        return u + "/settings?tab=project";
      }
    })("URL_PLACEHOLDER");
    )
    jsBuild := StrReplace(jsBuild, "URL_PLACEHOLDER", currentUrl)
    settingsUrl := InjectJSGet(jsBuild)

    ; Try to reuse existing tab (Ctrl+Tab cycling)
    ; Simple approach: open new tab with target URL
    Send("^l")
    Sleep(150)
    SendText(settingsUrl)
    Sleep(150)
    Send("{Enter}")
    Sleep(2500)

    ; Now run ComboSwitch JS on this tab
    ToolTip("MacroTool: Combo " gMacroDirection)
    RunComboOnce(gMacroDirection)

    ; Mark DONE near transfer button
    jsMark :=
    (
    (function() {
      function x(xpath) {
        return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x("@@XFER@@");
      if (!btn) {
        console.log("[Macro] Transfer button not found to label");
        return "nolabel";
      }
      var labelId = "macro-transfer-done-label";
      var existing = document.getElementById(labelId);
      if (existing) {
        existing.textContent = "DONE";
        return "updated";
      }
      var span = document.createElement("span");
      span.id = labelId;
      span.textContent = " DONE";
      span.style.marginLeft = "8px";
      span.style.color = "#22c55e";
      span.style.fontWeight = "bold";
      btn.parentNode.appendChild(span);
      console.log("[Macro] DONE label added");
      return "added";
    })();
    )
    jsMark := StrReplace(jsMark, "@@XFER@@", xpTransfer)
    res := InjectJSGet(jsMark)
    ToolTip("MacroTool: Combo " gMacroDirection " (" res ")")
    SetTimer(() => ToolTip(), -2500)

    ; Go back to previous tab/page (Alt+Left as simple back)
    Send("!{Left}")
    Sleep(2000)
}

; ============================================
; Run ComboSwitch once (reusing combo.js)
; ============================================
RunComboOnce(direction) {
    global xpTransfer, xpCombo1, xpCombo2, xpOptions, xpConfirm

    try {
        js := FileRead(A_ScriptDir "\combo.js")
    } catch {
        MsgBox("MacroTool: could not read combo.js", "MacroTool")
        return
    }

    js := StrReplace(js, "__DIRECTION__", direction)
    js := StrReplace(js, "__TRANSFER_XPATH__", xpTransfer)
    js := StrReplace(js, "__COMBO1_XPATH__", xpCombo1)
    js := StrReplace(js, "__COMBO2_XPATH__", xpCombo2)
    js := StrReplace(js, "__OPTIONS_XPATH__", xpOptions)
    js := StrReplace(js, "__CONFIRM_XPATH__", xpConfirm)

    InjectJS(js)
}

; ============================================
; Inject JS (no return)
; ============================================
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

; ============================================
; Inject JS and get string return (using prompt)
; ============================================
InjectJSGet(js) {
    global browserExe, consoleDelay, pasteDelay
    ; Wrap JS to return via prompt
    wrapped := "(function(){var __r = (function(){ " js " })(); try { prompt('AHK_RESULT', __r); } catch(e) { prompt('AHK_RESULT', String(__r)); }})();"

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

    ; Wait for prompt and capture value
    res := ""
    WinWaitActive("AHK_RESULT",, 1)
    if WinActive("AHK_RESULT") {
        ControlGetText(&res, "Edit1", "AHK_RESULT")
        Send("{Enter}")
    }
    A_Clipboard := oldClip
    return res
}

Esc::ExitApp()
