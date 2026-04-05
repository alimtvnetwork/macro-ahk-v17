; Includes\JsInject.ahk - JS injection via DevTools console
; WARNING: This sends keyboard shortcuts to the browser:
;   Ctrl+Shift+J  -> Opens/toggles Console panel (PAGE context)
;   Ctrl+V        -> Pastes clipboard content
;   Enter         -> Executes the pasted code
;
; v7.9.50: REMOVED the probe-and-retry mechanism entirely.
;   The probe (paste+Enter before real script) was DESTRUCTIVE:
;   if Ctrl+Shift+J toggled Console CLOSED, the probe's Ctrl+V+Enter
;   pasted JS code into the address bar and navigated to a garbage URL.
;
;   New approach: Direct inject + post-inject retry.
;   - Send Ctrl+Shift+J, paste script, Enter.
;   - If toggle-close happened, Ctrl+V on the page body is harmless.
;   - VerifyInjectionSuccess detects failure.
;   - On failure: send Ctrl+Shift+J again (reopens Console), re-paste.
;
; v7.9.49: ActivateBrowserPage() — skip DevTools windows when activating.
; v7.9.48: Removed F6 — causes address bar focus in docked DevTools mode.
; v7.9.45: No F12 — that caused devtools:// context bug.

global injectConsecutiveFailures := 0
global INJECT_MAX_CONSECUTIVE_FAILURES := 3

; ============================================
; ActivateBrowserPage - Activate the PAGE window, NOT a DevTools window.
; When DevTools is detached, multiple chrome.exe windows exist.
; WinActivate("ahk_exe chrome.exe") may pick the DevTools window.
; This function enumerates all chrome.exe windows and activates the
; first one whose title does NOT contain "DevTools -" or "devtools://".
;
; Returns: HWND of activated window, or 0 if fallback used.
; ============================================
ActivateBrowserPage() {
    global browserExe, browserActivateDelayMs

    try {
        windows := WinGetList("ahk_exe " browserExe)
        SubLog("ActivateBrowserPage: Found " windows.Length " chrome window(s)")

        for hwnd in windows {
            try {
                title := WinGetTitle(hwnd)
            } catch {
                continue
            }

            isDevToolsWindow := InStr(title, "DevTools -") || InStr(title, "devtools://")
            if isDevToolsWindow {
                SubLog("ActivateBrowserPage: SKIPPING DevTools window: " SubStr(title, 1, 80))
                continue
            }

            ; Found a non-DevTools window — activate it
            WinActivate(hwnd)
            Sleep(browserActivateDelayMs)
            SubLog("ActivateBrowserPage: ✅ Activated PAGE window: " SubStr(title, 1, 80))
            return hwnd
        }
    } catch as e {
        WarnLog("ActivateBrowserPage: Error enumerating windows: " e.Message)
    }

    ; Fallback: no non-DevTools window found, activate any browser window
    WarnLog("ActivateBrowserPage: No non-DevTools window found — fallback to any chrome window")
    WinActivate("ahk_exe " browserExe)
    Sleep(browserActivateDelayMs)
    return 0
}

; ============================================
; GetPageWindowTitle - Get the title of the PAGE window (not DevTools).
; Used by verification to read the correct window's title.
; ============================================
GetPageWindowTitle() {
    global browserExe

    try {
        windows := WinGetList("ahk_exe " browserExe)
        for hwnd in windows {
            try {
                title := WinGetTitle(hwnd)
            } catch {
                continue
            }
            isDevToolsWindow := InStr(title, "DevTools -") || InStr(title, "devtools://")
            if !isDevToolsWindow
                return title
        }
    } catch {
    }

    ; Fallback
    try {
        return WinGetTitle("ahk_exe " browserExe)
    } catch {
        return ""
    }
}

; ============================================
; PasteAndExecute - Paste JS from clipboard and press Enter.
; Isolated helper so retry logic can reuse it cleanly.
; ============================================
PasteAndExecute(js, context := "") {
    global pasteDelayMs

    A_Clipboard := js
    ctxLabel := context ? " (" context ")" : ""
    SendKey("^v", "Paste JS" ctxLabel)
    Sleep(pasteDelayMs)
    SendKey("{Enter}", "Execute JS" ctxLabel)
    Sleep(200)
}

; ============================================
; InjectViaDevTools - Core injection function
; v7.9.50: Direct inject + retry (no probe).
;   1. Activate PAGE window (skip DevTools windows)
;   2. Ctrl+Shift+J to open Console
;   3. Paste + Enter
;   4. Verify — if failed (toggle-close or wrong context), retry once
; ============================================
InjectViaDevTools(js) {
    global browserExe
    global consoleOpenDelayMs, pasteDelayMs, browserActivateDelayMs
    global injectConsecutiveFailures

    InfoLog("InjectViaDevTools called, JS length=" StrLen(js) " chars")

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

    ; Step 1: Activate PAGE window (skip DevTools windows)
    ; v7.10.1: Must WinWaitActive + settle before sending Ctrl+Shift+J.
    ; Without this, the keystroke fires before the window is ready (Issue #19 pattern).
    InfoLog("  > Activating browser PAGE window (skipping DevTools)")
    activatedHwnd := ActivateBrowserPage()
    isActivated := !!activatedHwnd
    if isActivated {
        WinWaitActive("ahk_id " activatedHwnd, , 3)
        Sleep(browserActivateDelayMs)
        SubLog("PAGE window activated + WinWaitActive + " browserActivateDelayMs "ms settle")
    } else {
        WarnLog("InjectViaDevTools: ActivateBrowserPage fallback — extra 300ms wait")
        Sleep(300)
    }

    ; Step 2: Open Console with Ctrl+Shift+J
    ; If Console is already the active panel, this CLOSES DevTools (toggle).
    ; In that case, Ctrl+V goes to the page body (harmless) and Enter does nothing.
    SendKey("^+j", "Open DevTools Console")
    Sleep(consoleOpenDelayMs)

    ; Step 3: Paste and execute
    PasteAndExecute(js, "attempt 1")

    ; Step 4: Verify injection success
    isFirstAttemptOk := VerifyInjectionSuccess(js)

    if !isFirstAttemptOk {
        ; Toggle-close likely happened, or wrong context.
        ; Ctrl+Shift+J again will REOPEN Console (since it was just closed).
        WarnLog("InjectViaDevTools: First attempt failed — retrying with second Ctrl+Shift+J")
        
        ; Re-activate page window in case focus shifted
        retryHwnd := ActivateBrowserPage()
        isRetryActivated := !!retryHwnd
        if isRetryActivated {
            WinWaitActive("ahk_id " retryHwnd, , 3)
            Sleep(browserActivateDelayMs)
        } else {
            Sleep(300)
        }

        SendKey("^+j", "Reopen DevTools Console (retry)")
        Sleep(consoleOpenDelayMs)

        PasteAndExecute(js, "retry")

        isRetryOk := VerifyInjectionSuccess(js)
        if !isRetryOk {
            ErrorLog("InjectViaDevTools: ❌ INJECTION FAILED after retry — script may not have executed")
        } else {
            InfoLog("InjectViaDevTools: ✅ Retry succeeded")
        }
    }

    SubLog("Restoring original clipboard")
    A_Clipboard := oldClip
    InfoLog("InjectViaDevTools completed")
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
; SKIPS the Ctrl+Shift+J DevTools toggle entirely.
; Use ONLY when DevTools Console is already open and focused
; from a prior InjectJS() call within the same batch.
; WARNING: Only sends Ctrl+V + Enter. No DevTools management, NO window activation.
; v7.9.51: REMOVED ActivateBrowserPage() — it steals focus from detached Console.
; ============================================
InjectJSQuick(js) {
    global browserExe, pasteDelayMs, browserActivateDelayMs

    InfoLog("InjectJSQuick called, JS length=" StrLen(js) " chars (no DevTools toggle)")

    isPasteDelayMissing := !pasteDelayMs
    if isPasteDelayMissing
        pasteDelayMs := 200

    oldClip := ClipboardAll()

    ; v7.9.51: DO NOT activate any window here!
    ; InjectJSQuick assumes Console is already focused from a prior InjectJS() call.
    ; Calling ActivateBrowserPage() would STEAL focus from a detached DevTools Console
    ; back to the page window, causing paste to go to the address bar (Issue #13).

    PasteAndExecute(js, "quick mode")

    A_Clipboard := oldClip
    InfoLog("InjectJSQuick completed")
}

; ============================================
; InjectJSWithReset - Alias for InjectJS
; ============================================
InjectJSWithReset(js) {
    InfoLog("InjectJSWithReset called — delegating to InjectJS")
    InjectJS(js)
}

; ============================================
; ResetDevToolsState - No-op. Kept for backward compatibility.
; ============================================
ResetDevToolsState() {
    SubLog("ResetDevToolsState: no-op (v7.9.50, no state tracking)")
}

; ============================================
; VerifyInjectionSuccess - Detect failed injection
; Checks if script ran in wrong context (devtools://) or if
; the page title shows no sign of execution.
; Tracks consecutive failures and shows TrayTip alert.
; v7.9.50: Also detects toggle-close (script went to page body).
; ============================================
VerifyInjectionSuccess(js) {
    global injectConsecutiveFailures, INJECT_MAX_CONSECUTIVE_FAILURES, browserExe

    ; Wait briefly for execution to complete
    Sleep(300)

    try {
        ; Read PAGE title (skip DevTools windows)
        title := GetPageWindowTitle()
        SubLog("VerifyInjectionSuccess: Page title: " SubStr(title, 1, 100))

        ; Check 1: Domain guard failure (script ran in DevTools context)
        hasDomainGuard := InStr(title, "devtools://")
        if hasDomainGuard {
            injectConsecutiveFailures++
            ErrorLog("VerifyInjectionSuccess: ❌ DOMAIN GUARD — script ran in DevTools context (failure #" injectConsecutiveFailures ")")

            if (injectConsecutiveFailures >= INJECT_MAX_CONSECUTIVE_FAILURES) {
                TrayTip("⚠️ JS Injection Failed " injectConsecutiveFailures " times", "Script injected into DevTools context.`nClose detached DevTools window and retry.", 2)
                ErrorLog("VerifyInjectionSuccess: TrayTip shown — " injectConsecutiveFailures " consecutive failures")
                injectConsecutiveFailures := 0
            }
            return false
        }

        ; Check 2: Title contains address-bar navigation artifact
        ; If Ctrl+Shift+J closed Console, paste went to page body (harmless)
        ; but if it went to address bar, title might show "void(document..." or blank
        hasAddressBarArtifact := InStr(title, "void(") || InStr(title, "about:blank")
        if hasAddressBarArtifact {
            injectConsecutiveFailures++
            ErrorLog("VerifyInjectionSuccess: ❌ ADDRESS BAR — JS was likely pasted into URL bar (failure #" injectConsecutiveFailures ")")
            return false
        }

        ; Success path
        if (injectConsecutiveFailures > 0) {
            InfoLog("VerifyInjectionSuccess: ✅ Injection succeeded after " injectConsecutiveFailures " prior failure(s)")
        }
        injectConsecutiveFailures := 0
        return true
    } catch as e {
        SubLog("VerifyInjectionSuccess: Check failed — " e.Message)
        return true  ; Don't block on verification errors
    }
}
