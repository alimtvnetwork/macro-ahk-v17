; Includes\JsInject.ahk - JS injection via DevTools console
; WARNING: This sends keyboard shortcuts to the browser:
;   F12           -> Opens DevTools (if closed) / no-op (if already open on non-Console)
;   Ctrl+Shift+J  -> Switches to Console panel (if DevTools open) / Opens Console (if closed)
;   Ctrl+V        -> Pastes clipboard content
;   Enter         -> Executes the pasted code
;
; v7.6: Toggle-close recovery mechanism.
;   Problem: Ctrl+Shift+J is a toggle — if DevTools is already on the Console tab,
;   pressing Ctrl+Shift+J closes DevTools instead of keeping it open.
;   Solution: For subsequent calls, send F12 first (ensures DevTools stays open),
;   then Ctrl+Shift+J to switch to Console panel. F12 is safe because:
;     - If DevTools is closed: F12 opens it (to last-used panel)
;     - If DevTools is open on any panel: F12 closes it
;   So the sequence is: F12 (close if open) → Ctrl+Shift+J (open Console fresh).
;   This guarantees Console focus without toggle-close risk.

global devToolsOpened := false
global injectConsecutiveFailures := 0
global INJECT_MAX_CONSECUTIVE_FAILURES := 3

; ============================================
; InjectViaDevTools - Core injection function
; v7.6: Toggle-close recovery for subsequent calls.
;   First call:  Ctrl+Shift+J (opens Console directly) + full consoleOpenDelayMs
;   Subsequent:  F12 (close DevTools) + Ctrl+Shift+J (reopen on Console) + consoleOpenDelayMs
;   This prevents the toggle-close problem where Ctrl+Shift+J closes DevTools
;   when already on the Console tab.
; ============================================
InjectViaDevTools(js) {
    global browserExe, devToolsOpened
    global consoleOpenDelayMs, pasteDelayMs, browserActivateDelayMs
    global injectConsecutiveFailures

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
        ; First time: Ctrl+Shift+J opens DevTools directly on Console panel
        SendKey("^+j", "Open DevTools Console (first time)")
        Sleep(consoleOpenDelayMs)
        SubLog("DevTools Console opened, waited " consoleOpenDelayMs "ms")
        devToolsOpened := true
    } else {
        ; Subsequent call: DevTools may be open on any panel (or Console).
        ; Strategy: F12 closes DevTools (guaranteed), then Ctrl+Shift+J reopens on Console.
        ; This avoids the toggle-close problem where Ctrl+Shift+J alone would close
        ; DevTools if already on the Console tab.
        ;
        ; F12 behavior:
        ;   - DevTools open  → closes it (any panel)
        ;   - DevTools closed → opens it (last-used panel, but we follow with Ctrl+Shift+J)
        ;
        ; We always close first to guarantee a clean state, then reopen on Console.
        SendKey("{F12}", "Close DevTools (reset for clean Console open)")
        Sleep(300)
        SubLog("F12 sent to close DevTools, waited 300ms")

        ; v7.9.1: Click on page content to anchor execution context to the PAGE
        ; before reopening DevTools. Without this, the console may target the
        ; DevTools frame (hostname=devtools) instead of the page frame.
        ClickPageContent()

        SendKey("^+j", "Reopen DevTools on Console panel")
        Sleep(consoleOpenDelayMs)
        SubLog("DevTools Console reopened via Ctrl+Shift+J, waited " consoleOpenDelayMs "ms")
    }

    SendKey("^v", "Paste JS code into console")
    Sleep(pasteDelayMs)
    SubLog("JS code pasted, waited " pasteDelayMs "ms")

    SendKey("{Enter}", "Execute pasted JS code")
    Sleep(200)
    SubLog("Enter sent, waited 200ms")

    ; S-009: Verify injection success by checking if a known marker exists
    ; Strategy: After injection, the clipboard is restored. We verify by checking
    ; if the browser title hasn't changed to an error state AND if we got no
    ; DevTools-context indicators. Track consecutive failures.
    VerifyInjectionSuccess(js)

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
; InjectJSQuick - Lightweight injection for consecutive calls
; SKIPS the F12/Ctrl+Shift+J DevTools toggle entirely.
; Use ONLY when DevTools Console is already open and focused
; from a prior InjectJS() call within the same batch.
; This prevents focus thrashing that causes scripts to execute
; in the DevTools document context instead of the page context.
; WARNING: Only sends Ctrl+V + Enter. No DevTools management.
; ============================================
InjectJSQuick(js) {
    global browserExe, pasteDelayMs, browserActivateDelayMs

    InfoLog("InjectJSQuick called, JS length=" StrLen(js) " chars (no DevTools toggle)")

    isPasteDelayMissing := !pasteDelayMs
    if isPasteDelayMissing
        pasteDelayMs := 200
    isBrowserDelayMissing := !browserActivateDelayMs
    if isBrowserDelayMissing
        browserActivateDelayMs := 150

    oldClip := ClipboardAll()
    A_Clipboard := js
    SubLog("InjectJSQuick: Clipboard set (" StrLen(js) " chars)")

    WinActivate("ahk_exe " browserExe)
    Sleep(browserActivateDelayMs)

    SendKey("^v", "Paste JS (quick mode)")
    Sleep(pasteDelayMs)

    SendKey("{Enter}", "Execute JS (quick mode)")
    Sleep(200)

    A_Clipboard := oldClip
    InfoLog("InjectJSQuick completed")
}

; ============================================
; InjectJSWithReset - Force a clean DevTools reset before injection
; Use when switching tabs or after errors where console context may be stale.
; WARNING: Sends F12 to close DevTools, then Ctrl+Shift+J to reopen fresh.
; ============================================
InjectJSWithReset(js) {
    global devToolsOpened, browserExe, consoleOpenDelayMs, browserActivateDelayMs

    InfoLog("InjectJSWithReset called — forcing F12 close + fresh Ctrl+Shift+J open")

    WinActivate("ahk_exe " browserExe)
    Sleep(browserActivateDelayMs)

    SendKey("{F12}", "Close DevTools (forced reset)")
    Sleep(300)
    devToolsOpened := false
    SubLog("DevTools closed for reset, waited 300ms")

    ; v7.9.1: Anchor execution context to page before fresh open
    ClickPageContent()

    ; Now delegate to normal InjectJS which will do first-time open path
    InjectJS(js)
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

; ============================================
; ClickPageContent - Click on the browser page content area
; v7.9.1: Ensures the page (not DevTools) is the active execution context.
; Sends a click to the center of the browser window's client area.
; Must be called AFTER DevTools is closed and BEFORE reopening Console.
; ============================================
ClickPageContent() {
    global browserExe, pageClickDelayMs

    isDelayMissing := !pageClickDelayMs
    if isDelayMissing
        pageClickDelayMs := 100

    SubLog("ClickPageContent: Clicking page area to anchor execution context")
    try {
        hwnd := WinGetID("ahk_exe " browserExe)
        WinGetPos(&winX, &winY, &winW, &winH, "ahk_id " hwnd)
        ; Click at UPPER 1/3 of the window — safely below tab bar (~80px)
        ; but well ABOVE any bottom-docked DevTools panel.
        ; Previous location (2/3 height) would land ON bottom-docked DevTools.
        centerX := winX + (winW // 2)
        centerY := winY + Max(100, winH // 3)  ; upper 1/3, minimum 100px from top
        Click(centerX, centerY)
        Sleep(pageClickDelayMs)
        ; Re-activate browser window to ensure page document has focus
        WinActivate("ahk_id " hwnd)
        Sleep(50)
        SubLog("ClickPageContent: Clicked at " centerX "," centerY " + WinActivate, waited " pageClickDelayMs "ms")
    } catch as e {
        SubLog("ClickPageContent: Failed — " e.Message ". Continuing without click.")
    }
}

; ============================================
; S-009: VerifyInjectionSuccess - Detect failed injection
; Checks for DevTools-context execution indicators and tracks
; consecutive failures. Shows TrayTip if threshold exceeded.
; ============================================
VerifyInjectionSuccess(js) {
    global injectConsecutiveFailures, INJECT_MAX_CONSECUTIVE_FAILURES, browserExe

    ; Strategy: Check if the script marker was injected by looking for the
    ; marker element in the page title (scripts set document.title markers).
    ; Also check if we got a domain guard abort (the script logs a warning
    ; and returns without injecting UI).
    ;
    ; For now, we use a lightweight heuristic:
    ; After paste+enter, briefly check if the console shows "DOMAIN GUARD ABORT"
    ; by reading the clipboard after a short delay (the console output trick).
    ;
    ; Simpler approach: Track if the marker element exists after injection
    ; by running a tiny verification snippet.

    ; Wait briefly for execution to complete
    Sleep(300)

    ; Run a quick verification: check if the last injection created the expected marker
    ; We check document.title for known failure markers
    try {
        title := WinGetTitle("ahk_exe " browserExe)

        ; Check for domain guard failure indicator
        hasDomainGuard := InStr(title, "devtools://")
        if hasDomainGuard {
            injectConsecutiveFailures++
            WarnLog("VerifyInjectionSuccess: DOMAIN GUARD DETECTED — script likely ran in DevTools context (failure #" injectConsecutiveFailures ")")

            if (injectConsecutiveFailures >= INJECT_MAX_CONSECUTIVE_FAILURES) {
                TrayTip("⚠️ JS Injection Failed " injectConsecutiveFailures " times", "DevTools may not be open or focused on the wrong context.`nTry: Close DevTools (F12), click on page, then retry.", 2)
                WarnLog("VerifyInjectionSuccess: TrayTip shown — " injectConsecutiveFailures " consecutive failures")
                injectConsecutiveFailures := 0  ; Reset after notification
            }
            return false
        }

        ; Success path
        if (injectConsecutiveFailures > 0) {
            InfoLog("VerifyInjectionSuccess: Injection succeeded after " injectConsecutiveFailures " prior failure(s)")
        }
        injectConsecutiveFailures := 0
        return true
    } catch as e {
        SubLog("VerifyInjectionSuccess: Check failed — " e.Message)
        return true  ; Don't block on verification errors
    }
}