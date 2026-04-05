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
            ErrorLog("browserExe is empty, cannot get URL")
            return ""
        }

        isBrowserWindowPresent := WinExist("ahk_exe " browserExe)
        if isBrowserWindowPresent {
            SubLog("Browser window found: " browserExe)
        } else {
            ErrorLog("Browser window not found: " browserExe)
            return ""
        }

        InfoLog("  > Activating browser window")
        WinActivate("ahk_exe " browserExe)
        isBrowserActivated := WinWaitActive("ahk_exe " browserExe, , 3)
        if isBrowserActivated {
            SubLog("Browser activated successfully")
        } else {
            ErrorLog("Failed to activate browser within 3 seconds")
            return ""
        }

        Sleep(browserActivateDelayMs)

        SubLog("Saving clipboard before URL read")
        oldClip := ClipboardAll()
        A_Clipboard := ""

        SendKey("^l", "Focus address bar")
        Sleep(addressBarDelayMs)

        SendKey("^c", "Copy URL from address bar")
        Sleep(addressBarDelayMs)

        ClipWait(2)

        SendKey("{Escape}", "Close address bar")
        Sleep(50)

        url := A_Clipboard
        A_Clipboard := oldClip

        urlPreview := SubStr(url, 1, 100)
        isTruncated := StrLen(url) > 100
        if isTruncated
            urlPreview .= "..."
        SubLog("Got URL: " urlPreview)
        return url

    } catch as err {
        ErrorLog("GetCurrentUrl FAILED: " err.Message)
        SubLog("What: " err.What, 1)
        SubLog("File: " err.File " Line: " err.Line, 1)
        throw err
    }
}
