; Includes\JsInject.ahk - JS injection via DevTools console
; WARNING: This sends keyboard shortcuts to the browser:
;   Ctrl+Shift+J  -> Opens/focuses DevTools Console (FIRST TIME ONLY)
;   Escape        -> Dismisses autocomplete in console (subsequent calls)
;   Ctrl+V        -> Pastes clipboard content
;   Enter         -> Executes the pasted code
;
; IMPORTANT: Ctrl+Shift+J is only sent ONCE (tracked by devToolsOpened flag).
; Subsequent injections send Escape (to dismiss autocomplete) then paste.
; NOTE: F6 was REMOVED in v5.4 - it focuses the browser ADDRESS BAR, not the console!

global devToolsOpened := false

; ============================================
; InjectViaDevTools - Core injection function
; First call: opens DevTools with Ctrl+Shift+J, then pastes
; Subsequent calls: just pastes into the existing console (no Ctrl+Shift+J)
; ============================================
InjectViaDevTools(js) {
    global browserExe, devToolsOpened
    global consoleOpenDelayMs, pasteDelayMs, browserActivateDelayMs

    InfoLog("InjectViaDevTools called, JS length=" StrLen(js) " chars, devToolsOpened=" devToolsOpened)

    isConsoleDelayMissing := !consoleOpenDelayMs
    if isConsoleDelayMissing {
        consoleOpenDelayMs := 800
        SubLog("consoleOpenDelayMs was empty, defaulting to 800")
    }
    isPasteDelayMissing := !pasteDelayMs
    if isPasteDelayMissing {
        pasteDelayMs := 200
        SubLog("pasteDelayMs was empty, defaulting to 200")
    }
    isBrowserDelayMissing := !browserActivateDelayMs
    if isBrowserDelayMissing {
        browserActivateDelayMs := 150
        SubLog("browserActivateDelayMs was empty, defaulting to 150")
    }

    SubLog("Saving current clipboard")
    oldClip := ClipboardAll()
    A_Clipboard := js
    SubLog("Clipboard set to JS code (" StrLen(js) " chars)")

    InfoLog("  > Activating browser: " browserExe)
    WinActivate("ahk_exe " browserExe)
    Sleep(browserActivateDelayMs)
    SubLog("Browser activated, waited " browserActivateDelayMs "ms")

    if !devToolsOpened {
        ; First time: open DevTools console
        ; Ctrl+Shift+J opens Console panel with input already focused
        LogKeyPress("^+j", "Open DevTools Console (first time)")
        Send("^+j")
        Sleep(consoleOpenDelayMs)
        SubLog("DevTools Console opened, waited " consoleOpenDelayMs "ms")
        devToolsOpened := true
    } else {
        ; Already open: close DevTools first, then reopen with Console focused
        ; Escape alone is unreliable — console output or autocomplete can steal focus
        ; F12 closes DevTools, Ctrl+Shift+J reopens with Console input focused
        SubLog("DevTools already open — closing with F12, then reopening with Ctrl+Shift+J for reliable focus")
        LogKeyPress("{F12}", "Close DevTools (to reset focus)")
        Send("{F12}")
        Sleep(300)
        SubLog("DevTools closed, waited 300ms")
        LogKeyPress("^+j", "Reopen DevTools Console (guaranteed focus)")
        Send("^+j")
        Sleep(consoleOpenDelayMs)
        SubLog("DevTools Console reopened, waited " consoleOpenDelayMs "ms")
    }

    ; Console input should be focused after Ctrl+Shift+J (first time) or Escape (subsequent)
    ; No F6 needed - F6 focuses the ADDRESS BAR which causes JS to be typed there

    LogKeyPress("^v", "Paste JS code into console")
    Send("^v")
    Sleep(pasteDelayMs)
    SubLog("JS code pasted, waited " pasteDelayMs "ms")

    LogKeyPress("{Enter}", "Execute pasted JS code")
    Send("{Enter}")
    Sleep(200)
    SubLog("Enter sent, waited 200ms")

    SubLog("Restoring original clipboard")
    A_Clipboard := oldClip
    InfoLog("InjectViaDevTools completed successfully")
}

; ============================================
; InjectJS - Public entry point for JS injection
; ============================================
InjectJS(js) {
    InfoLog("InjectJS called, delegating to InjectViaDevTools")
    InjectViaDevTools(js)
    InfoLog("InjectJS completed")
}

; ============================================
; ResetDevToolsState - Reset the devToolsOpened flag
; Call this if DevTools was closed manually or on error
; ============================================
ResetDevToolsState() {
    global devToolsOpened
    InfoLog("ResetDevToolsState: devToolsOpened reset from " devToolsOpened " to false")
    devToolsOpened := false
}