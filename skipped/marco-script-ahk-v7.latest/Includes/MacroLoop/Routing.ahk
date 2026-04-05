; MacroLoop\Routing.ahk - Smart shortcut routing & URL reading

; ============================================
; Smart Shortcut Handler
; WARNING: Reads URL via address bar (Ctrl+L, Ctrl+C, Escape).
;   Then routes to either RunCombo or ToggleMacroLoop.
; ============================================
HandleSmartShortcut(direction) {
    global browserExe, loopRequiredDomain
    global browserActivateDelayMs, addressBarDelayMs

    InfoLog("HandleSmartShortcut called, direction=" direction)

    try {
        isBrowserDelayMissing := !browserActivateDelayMs
        if isBrowserDelayMissing {
            browserActivateDelayMs := 150
            SubLog("browserActivateDelayMs defaulted to 150")
        }
        isAddressDelayMissing := !addressBarDelayMs
        if isAddressDelayMissing {
            addressBarDelayMs := 100
            SubLog("addressBarDelayMs defaulted to 100")
        }

        InfoLog("  > Getting current URL to determine page type")
        currentUrl := GetCurrentUrl()
        SubLog("Current URL: " currentUrl)

        isOnRequiredDomain := InStr(currentUrl, loopRequiredDomain)
        if isOnRequiredDomain {
            SubLog("Domain check PASSED: on " loopRequiredDomain)
        } else {
            WarnLog("Domain check FAILED, not on " loopRequiredDomain)
            ShowTooltip("Not on lovable.dev")
            return
        }

        isOnSettingsPage := InStr(currentUrl, "/settings?tab=")
        if isOnSettingsPage {
            InfoLog("  > Routing to ComboSwitch (settings page detected)")
            ShowTooltip("Settings -> ComboSwitch " direction)
            RunCombo(direction)
            InfoLog("HandleSmartShortcut completed (ComboSwitch)")
            return
        }

        isOnProjectPage := InStr(currentUrl, "/projects/")
        if isOnProjectPage {
            InfoLog("  > Routing to MacroLoop (project page detected)")
            ShowTooltip("Project -> MacroLoop " direction)
            ToggleMacroLoop(direction)
            InfoLog("HandleSmartShortcut completed (MacroLoop)")
            return
        }

        WarnLog("Unknown page type, cannot route: " currentUrl)
        ShowTooltip("Unknown page")
    } catch as err {
        ErrorLog("HandleSmartShortcut FAILED: " err.Message)
        SubLog("Stack: " err.Stack, 1)
        throw err
    }
}

; ============================================
; Get Current URL from Address Bar
; WARNING: Sends Ctrl+L, Ctrl+C, Escape to read the URL.
;   Temporarily overwrites the clipboard.
; ============================================
GetCurrentUrl() {
    global browserExe, browserActivateDelayMs, addressBarDelayMs

    InfoLog("GetCurrentUrl called")

    try {
        isBrowserExeEmpty := !browserExe
        if isBrowserExeEmpty {
            ErrorLog("GetCurrentUrl: browserExe is empty, cannot get URL")
            return ""
        }

        isBrowserWindowPresent := WinExist("ahk_exe " browserExe)
        if isBrowserWindowPresent {
            SubLog("Browser window found: " browserExe)
        } else {
            ErrorLog("GetCurrentUrl: Browser window not found: " browserExe)
            return ""
        }

        ; v7.9.54: Use ActivateBrowserPage() to skip DevTools windows.
        ; Previously used generic WinActivate which could activate a DevTools window,
        ; causing Ctrl+L to NOT focus the address bar → empty clipboard → abort.
        ; See Issue #19.
        InfoLog("  > Activating browser PAGE window (skipping DevTools)")
        activatedHwnd := ActivateBrowserPage()
        isActivated := !!activatedHwnd
        if isActivated {
            ; Wait for window to fully accept keyboard input.
            ; ActivateBrowserPage() has an internal Sleep(browserActivateDelayMs=150ms),
            ; but that alone is not enough — the window needs WinWaitActive + extra settle
            ; time before Ctrl+L will reliably focus the address bar.
            ; v7.10.1: This was the root cause of "press twice" — first Ctrl+L was sent
            ; before the window was ready to receive keyboard shortcuts.
            WinWaitActive("ahk_id " activatedHwnd, , 3)
            Sleep(browserActivateDelayMs)
            SubLog("Browser PAGE window activated + WinWaitActive + " browserActivateDelayMs "ms settle")
        } else {
            WarnLog("GetCurrentUrl: ActivateBrowserPage returned fallback — using generic wait")
            Sleep(300)
        }

        SubLog("Saving clipboard before URL read")
        oldClip := ClipboardAll()
        A_Clipboard := ""

        SendKey("^l", "Focus address bar")
        Sleep(addressBarDelayMs)

        SendKey("^c", "Copy URL from address bar")
        Sleep(addressBarDelayMs)

        isClipReady := ClipWait(2)
        if !isClipReady {
            WarnLog("GetCurrentUrl: ClipWait timed out — clipboard still empty after 2s")
            ErrorLog("GetCurrentUrl: ❌ URL read FAILED — Ctrl+L/Ctrl+C did not populate clipboard. Possible cause: DevTools window was activated instead of page window.")
            SendKey("{Escape}", "Close address bar (after clipboard timeout)")
            Sleep(50)
            A_Clipboard := oldClip
            return ""
        }

        SendKey("{Escape}", "Close address bar")
        Sleep(50)

        url := A_Clipboard
        A_Clipboard := oldClip

        isUrlEmpty := !url || StrLen(url) == 0
        if isUrlEmpty {
            WarnLog("GetCurrentUrl: ⚠️ URL is empty despite ClipWait success")
            return ""
        }

        urlPreview := SubStr(url, 1, 100)
        isTruncated := StrLen(url) > 100
        if isTruncated
            urlPreview .= "..."
        InfoLog("GetCurrentUrl: ✅ Got URL: " urlPreview)
        return url

    } catch as err {
        ErrorLog("GetCurrentUrl FAILED: " err.Message)
        SubLog("What: " err.What, 1)
        SubLog("File: " err.File " Line: " err.Line, 1)
        throw err
    }
}
