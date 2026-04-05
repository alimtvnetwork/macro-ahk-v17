; Includes\MacroLoop.ahk - MacroLoop with Clipboard-based Delegation
; WARNING: This module sends many keyboard shortcuts to the browser:
;   Ctrl+L -> Focus address bar
;   Ctrl+C -> Copy URL
;   Escape -> Close address bar / dismiss dialogs
;   Ctrl+Tab / Ctrl+Shift+Tab -> Switch browser tabs
;   Ctrl+T -> Open new tab
;   Ctrl+V -> Paste URL
;   Enter -> Navigate / Execute
;   Ctrl+Up / Ctrl+Down -> Trigger combo hotkeys
;   Also calls InjectJS which sends Ctrl+Shift+J, F6, Ctrl+V, Enter.
; JS writes DELEGATE_UP/DELEGATE_DOWN to clipboard, AHK polls and acts.

global macroLoopRunning := false
global macroLoopDirection := "down"
global clipboardPollTimerId := 0
global isHandlingDelegate := false
global consecutiveDelegateFailures := 0
global MAX_DELEGATE_FAILURES := 3

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

        LogKeyPress("^l", "Focus address bar")
        Send("^l")
        Sleep(addressBarDelayMs)

        LogKeyPress("^c", "Copy URL from address bar")
        Send("^c")
        Sleep(addressBarDelayMs)

        ClipWait(2)

        LogKeyPress("{Escape}", "Close address bar")
        Send("{Escape}")
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

; ============================================
; Toggle MacroLoop - Embeds script and starts clipboard polling
; WARNING: Calls EmbedMacroLoopScript which injects JS via DevTools.
;   Starts a 500ms timer for clipboard polling.
; ============================================
ToggleMacroLoop(direction) {
    global macroLoopRunning, macroLoopDirection, clipboardPollTimerId
    global browserExe, loopRequiredDomain, devToolsOpened
    global browserActivateDelayMs, addressBarDelayMs

    InfoLog("ToggleMacroLoop called, direction=" direction ", isRunning=" macroLoopRunning)

    try {
        ; === PAGE VALIDATION ===
        ; Prevent hotkey from firing on wrong pages (fixes Ctrl+Shift+Down typing JS into browser)
        InfoLog("  > Validating page before MacroLoop action")
        currentUrl := GetCurrentUrl()
        SubLog("Current URL: " currentUrl)

        isOnRequiredDomain := InStr(currentUrl, loopRequiredDomain)
        if !isOnRequiredDomain {
            WarnLog("ToggleMacroLoop: Not on " loopRequiredDomain ", aborting")
            ShowTooltip("Not on lovable.dev")
            return
        }

        isOnProjectPage := InStr(currentUrl, "/projects/")
        if !isOnProjectPage {
            WarnLog("ToggleMacroLoop: Not on a project page, aborting")
            ShowTooltip("MacroLoop requires a project page")
            return
        }

        ; === RESET DEVTOOLS STATE ===
        ; DevTools state may be stale from a different tab (e.g. ComboSwitch on settings tab)
        ; Force re-open to ensure DevTools is active in THIS tab
        InfoLog("  > Resetting devToolsOpened to ensure DevTools opens in current tab")
        devToolsOpened := false

        macroLoopDirection := direction

        InfoLog("  > Embedding MacroLoop script (has duplicate check)")
        EmbedMacroLoopScript()
        SubLog("Waiting 1000ms for embed to settle")
        Sleep(1000)

        isLoopCurrentlyRunning := !!macroLoopRunning
        if isLoopCurrentlyRunning {
            InfoLog("  > Stopping running loop")
            CallLoopFunction("__loopStop")
            macroLoopRunning := false

            isPollingActive := !!clipboardPollTimerId
            if isPollingActive {
                SetTimer(CheckClipboardForDelegate, 0)
                clipboardPollTimerId := 0
                SubLog("Clipboard polling stopped")
            }
            InfoLog("MacroLoop STOPPED")
        } else {
            InfoLog("  > Starting loop with direction=" direction)
            CallLoopFunction("__loopStart", direction)
            macroLoopRunning := true

            ; Clear ALL stale signals before starting poll
            ; 1. Clear clipboard
            clipText := A_Clipboard
            isStaleSignal := (clipText = "DELEGATE_UP" || clipText = "DELEGATE_DOWN")
            if isStaleSignal {
                A_Clipboard := ""
                SubLog("Cleared stale clipboard signal: " clipText, 1)
            }
            ; 2. Clear title markers via JS injection
            InfoLog("Clearing any stale title markers before poll start")
            InjectJS("document.title=document.title.replace(/__AHK_DELEGATE_(UP|DOWN)__URL:.*?__ENDURL__/g,'').replace(/__AHK_DELEGATE_(UP|DOWN)__/g,'')")

            SetTimer(CheckClipboardForDelegate, 500)
            clipboardPollTimerId := 1
            SubLog("Signal polling started (title + clipboard, 500ms interval)", 1)
            InfoLog("MacroLoop STARTED, direction=" direction)
        }

        UpdateTrayIcon()
    } catch as err {
        ErrorLog("ToggleMacroLoop FAILED: " err.Message)
        SubLog("Stack: " err.Stack, 1)
        ; S-004: Show tray notification on error
        TrayTip("MacroLoop failed: " err.Message, "Automator Error", 3)
        throw err
    }
}

; ============================================
; Stop MacroLoop
; ============================================
StopMacroLoop() {
    global macroLoopRunning, clipboardPollTimerId

    InfoLog("StopMacroLoop called")

    try {
        InfoLog("  > Calling __loopStop JS function")
        CallLoopFunction("__loopStop")
        macroLoopRunning := false

        isPollingActive := !!clipboardPollTimerId
        if isPollingActive {
            SetTimer(CheckClipboardForDelegate, 0)
            clipboardPollTimerId := 0
            SubLog("Clipboard polling stopped")
        }

        UpdateTrayIcon()
        ShowTooltip("Loop Stopped")
        InfoLog("StopMacroLoop completed")
    } catch as err {
        ErrorLog("StopMacroLoop FAILED: " err.Message)
        throw err
    }
}

; ============================================
; Check Clipboard for Delegate Signals
; Called by timer every 500ms when loop is running
; ============================================
CheckClipboardForDelegate() {
    global macroLoopRunning, browserExe

    try {
        isLoopRunning := !!macroLoopRunning
        if !isLoopRunning
            return

        ; Guard: Prevent re-entrance while HandleDelegate is running
        ; AHK timers can interrupt, causing GetCurrentUrl to read stale clipboard
        if isHandlingDelegate {
            return
        }

        ; PRIMARY: Check browser title for delegate signal (always reliable)
        ; v6.53: Title now contains embedded URL: __AHK_DELEGATE_DOWN__URL:https://.../__ENDURL__
        try {
            browserTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            browserTitle := ""
        }

        ; Extract URL from title signal if present
        delegateUrl := ""
        hasUrlInTitle := RegExMatch(browserTitle, "__ENDURL__")
        if hasUrlInTitle {
            hasUrlMatch := RegExMatch(browserTitle, "URL:(.*?)__ENDURL__", &urlMatch)
            if hasUrlMatch {
                delegateUrl := urlMatch[1]
                SubLog("Extracted URL from title signal: " SubStr(delegateUrl, 1, 80))
            }
        }

        isTitleDelegateUp := InStr(browserTitle, "__AHK_DELEGATE_UP__")
        if isTitleDelegateUp {
            InfoLog("Title signal received: DELEGATE_UP")
            ShowTooltip("Received: DELEGATE_UP")
            ; v6.54: NO InjectJS cleanup here — it takes 2-3s of keyboard automation
            ; and disrupts browser state before HandleDelegate. The isHandlingDelegate
            ; guard prevents duplicate detection, and HandleDelegate cleans up at the end.
            HandleDelegate("up", delegateUrl)
            return
        }

        isTitleDelegateDown := InStr(browserTitle, "__AHK_DELEGATE_DOWN__")
        if isTitleDelegateDown {
            InfoLog("Title signal received: DELEGATE_DOWN")
            ShowTooltip("Received: DELEGATE_DOWN")
            ; v6.54: Same — skip InjectJS cleanup, let HandleDelegate handle it
            HandleDelegate("down", delegateUrl)
            return
        }

        ; SECONDARY: Check clipboard (works for user-gesture Force buttons)
        ; v6.53: Also check title for embedded URL even for clipboard signals
        ; (Force buttons set both clipboard AND title with URL)
        clipText := A_Clipboard
        isDelegateUp := (clipText = "DELEGATE_UP")
        if isDelegateUp {
            A_Clipboard := ""
            InfoLog("Clipboard signal received: DELEGATE_UP")
            ShowTooltip("Received: DELEGATE_UP")
            ; Try to extract URL from title (Force buttons set it)
            HandleDelegate("up", delegateUrl)
            return
        }
        isDelegateDown := (clipText = "DELEGATE_DOWN")
        if isDelegateDown {
            A_Clipboard := ""
            InfoLog("Clipboard signal received: DELEGATE_DOWN")
            ShowTooltip("Received: DELEGATE_DOWN")
            HandleDelegate("down", delegateUrl)
            return
        }
    } catch as err {
        ErrorLog("CheckClipboardForDelegate error: " err.Message)
    }
}

; ============================================
; Handle Delegate - Switch tabs and trigger combo
; WARNING: Sends Ctrl+Tab, Ctrl+Shift+Tab for tab switching.
;   Sends Ctrl+T for new tab.
;   Sends Ctrl+V, Enter for URL navigation.
;   Sends Ctrl+Up or Ctrl+Down to trigger combo hotkeys.
; ============================================
HandleDelegate(direction, embeddedUrl := "") {
    global browserExe, loopRequiredDomain, loopSettingsTabPath
    global browserActivateDelayMs, addressBarDelayMs
    global delegateTabSwitchDelayMs, delegateMaxTabSearch
    global devToolsOpened, isHandlingDelegate
    global consecutiveDelegateFailures, MAX_DELEGATE_FAILURES

    isHandlingDelegate := true
    InfoLog("=== HandleDelegate START: " direction " ===")

    try {
        ; v6.53: Check consecutive failure guard
        if (consecutiveDelegateFailures >= MAX_DELEGATE_FAILURES) {
            ErrorLog("HandleDelegate BLOCKED: " consecutiveDelegateFailures " consecutive failures reached limit of " MAX_DELEGATE_FAILURES)
            SubLog("Stopping loop to prevent infinite delegation loop", 1)
            ShowTooltip("ERROR: Delegate failed " consecutiveDelegateFailures " times — loop stopped")
            TrayTip("Delegation failed " consecutiveDelegateFailures " times consecutively. Loop stopped.", "Automator Error", 3)
            ; Call __loopStop to stop the JS loop
            CallLoopFunction("__loopStop")
            macroLoopRunning := false
            if clipboardPollTimerId {
                SetTimer(CheckClipboardForDelegate, 0)
                clipboardPollTimerId := 0
            }
            isHandlingDelegate := false
            consecutiveDelegateFailures := 0
            UpdateTrayIcon()
            return
        }

        isTabDelayMissing := !delegateTabSwitchDelayMs
        if isTabDelayMissing {
            delegateTabSwitchDelayMs := 300
            SubLog("delegateTabSwitchDelayMs defaulted to 300", 1)
        }
        isMaxSearchMissing := !delegateMaxTabSearch
        if isMaxSearchMissing {
            delegateMaxTabSearch := 10
            SubLog("delegateMaxTabSearch defaulted to 10", 1)
        }

        ShowTooltip("Delegate: " direction " - Switching tabs...")

        ; CRITICAL: Close DevTools before URL read
        ; When DevTools console is focused, Ctrl+L opens "go to line" dialog instead of address bar
        InfoLog("Step 0: Closing DevTools to ensure Ctrl+L reaches address bar")
        devToolsOpened := false
        Send("{F12}")
        Sleep(500)

        ; v6.53: Use embedded URL from title signal if available (eliminates fragile Ctrl+L/Ctrl+C)
        projectUrl := ""
        projectId := ""
        if (embeddedUrl != "") {
            InfoLog("Step 1: Using embedded URL from title signal (no address bar read needed)")
            projectUrl := embeddedUrl
            SubLog("Embedded URL: " SubStr(projectUrl, 1, 100), 1)
        } else {
            InfoLog("Step 1: No embedded URL — falling back to GetCurrentUrl()")
            projectUrl := GetCurrentUrl()
        }
        projectId := ExtractProjectId(projectUrl)

        isProjectIdFound := (projectId != "")
        if isProjectIdFound {
            SubLog("Project ID: " projectId, 1)
            ; Reset failure counter on success
            consecutiveDelegateFailures := 0
        } else {
            consecutiveDelegateFailures++
            ErrorLog("No project ID found in URL: " projectUrl " (failure " consecutiveDelegateFailures "/" MAX_DELEGATE_FAILURES ")")
            SubLog("Stack: " Error("trace").Stack, 1)
            SubLog("Possible cause: clipboard was empty, address bar copy failed, or embeddedUrl was empty", 2)
            ShowTooltip("ERROR: No project ID found (" consecutiveDelegateFailures "/" MAX_DELEGATE_FAILURES ")")
            ; Reset delegating state so JS can retry
            CallLoopFunction("__delegateComplete")
            isHandlingDelegate := false
            return
        }

        settingsUrlPart := "/settings?tab="
        isSettingsTabFound := false
        startUrl := projectUrl

        InfoLog("Step 2: Searching for settings tab (max " delegateMaxTabSearch " tabs)")
        SubLog("Looking for: projectId=" projectId " AND '" settingsUrlPart "'", 1)
        SubLog("Start URL: " SubStr(startUrl, 1, 100), 2)
        Loop delegateMaxTabSearch {
            LogKeyPress("^{Tab}", "Switch to next tab")
            Send("^{Tab}")
            Sleep(delegateTabSwitchDelayMs)

            currentUrl := GetCurrentUrl()
            SubLog("Tab " A_Index "/" delegateMaxTabSearch ": " SubStr(currentUrl, 1, 100), 1)

            hasSettingsPath := InStr(currentUrl, settingsUrlPart)
            hasProjectId := InStr(currentUrl, projectId)
            isSettingsForProject := hasSettingsPath && hasProjectId
            if isSettingsForProject {
                isSettingsTabFound := true
                InfoLog("MATCH: Found settings tab at tab " A_Index)
                SubLog("Tab URL matches: hasSettings=yes, hasProjectId=yes", 2)
                ShowTooltip("Found settings tab!")
                break
            } else {
                SubLog("NO MATCH: hasSettings=" (hasSettingsPath ? "yes" : "no") ", hasProjectId=" (hasProjectId ? "yes" : "no"), 2)
            }

            isBackToStart := (currentUrl = startUrl)
            if isBackToStart {
                SubLog("Looped back to start URL after " A_Index " tabs, stopping search", 1)
                break
            }
        }

        if isSettingsTabFound {
            SubLog("Settings tab already existed, using it", 1)
        } else {
            InfoLog("Settings tab NOT found after searching " delegateMaxTabSearch " tabs, opening new one")
            ShowTooltip("Opening new settings tab...")
            settingsUrl := loopRequiredDomain "projects/" projectId loopSettingsTabPath
            SubLog("Settings URL to open: " settingsUrl, 1)

            LogKeyPress("^t", "Open new browser tab")
            Send("^t")
            Sleep(500)

            oldClip := ClipboardAll()
            A_Clipboard := settingsUrl

            LogKeyPress("^v", "Paste settings URL into new tab")
            Send("^v")
            Sleep(200)

            LogKeyPress("{Enter}", "Navigate to settings URL")
            Send("{Enter}")
            SubLog("Waiting 2500ms for page load", 1)
            Sleep(2500)
            A_Clipboard := oldClip
            SubLog("Opened settings URL: " settingsUrl, 1)
        }

        ; Step 3: Focus the web page before triggering combo
        InfoLog("Step 3: Focusing web page before combo trigger")
        Sleep(500)

        ; CRITICAL: Reset devToolsOpened so combo injection reopens DevTools on THIS tab
        InfoLog("Resetting devToolsOpened for settings tab context")
        devToolsOpened := false

        ; Send Escape to dismiss any DevTools focus, then click page
        LogKeyPress("{Escape}", "Dismiss DevTools focus")
        Send("{Escape}")
        Sleep(200)

        ; Send F6 to move focus back to page content
        LogKeyPress("{F6}", "Focus page content")
        Send("{F6}")
        Sleep(300)

        ; === LIGHTWEIGHT PROBE: Check if combo.js is already on this tab ===
        ; Instead of always doing full 40KB injection via RunComboSafe,
        ; first check if __comboSwitch exists on the settings tab.
        ; v6.52: Probe-first optimization
        InfoLog("Step 4: Probing for existing combo.js on settings tab")
        probeJs := "if(typeof window.__comboSwitch==='function'){window.__comboSwitch('" direction "');document.title='__AHK_COMBO_PROBED__'+document.title}else{document.title='__AHK_COMBO_MISSING__'+document.title}"
        InjectJS(probeJs)
        Sleep(500)

        ; Read title to determine probe result
        try {
            probeTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            probeTitle := ""
        }

        isComboAlreadyPresent := InStr(probeTitle, "__AHK_COMBO_PROBED__")
        isComboMissing := InStr(probeTitle, "__AHK_COMBO_MISSING__")

        ; Clean up probe marker
        InjectJS("document.title=document.title.replace(/__AHK_COMBO_(PROBED|MISSING)__/g,'')")
        Sleep(200)

        if isComboAlreadyPresent {
            InfoLog("Step 4: Combo.js ALREADY PRESENT on settings tab — called directly (~50 chars), skipped 40KB injection")
            ShowTooltip("Combo probe: already embedded!")
        } else {
            InfoLog("Step 4: Combo.js NOT found on settings tab — falling through to full RunComboSafe")
            ShowTooltip("Triggering Combo " direction " (full inject)")
            RunComboSafe(direction)
        }

        SubLog("Waiting 3000ms for combo to process", 1)
        Sleep(3000)

        ; CRITICAL: Close DevTools AGAIN before return URL reads
        ; RunComboSafe (Step 4) re-opens DevTools on settings tab, which breaks Ctrl+L
        InfoLog("Step 5a: Closing DevTools before return tab search")
        devToolsOpened := false
        Send("{F12}")
        Sleep(500)

        InfoLog("Step 5b: Returning to project tab")
        SubLog("Looking for: projectId=" projectId " AND NOT /settings", 1)
        ShowTooltip("Returning to project tab...")
        Loop delegateMaxTabSearch {
            LogKeyPress("^+{Tab}", "Switch to previous tab")
            Send("^+{Tab}")
            Sleep(delegateTabSwitchDelayMs)

            currentUrl := GetCurrentUrl()
            SubLog("Return tab " A_Index "/" delegateMaxTabSearch ": " SubStr(currentUrl, 1, 100), 1)

            isProjectTab := InStr(currentUrl, "/projects/") && InStr(currentUrl, projectId)
            isSettingsTab := InStr(currentUrl, "/settings")
            isBackOnProject := isProjectTab && !isSettingsTab
            if isBackOnProject {
                InfoLog("MATCH: Back on project tab at tab " A_Index)
                ShowTooltip("Back on project!")
                break
            } else {
                SubLog("NO MATCH: isProject=" (isProjectTab ? "yes" : "no") ", isSettings=" (isSettingsTab ? "yes" : "no"), 2)
            }
        }

        ; CRITICAL: Reset devToolsOpened so script is injected on THIS (project) tab
        InfoLog("Step 6: Resetting devToolsOpened for project tab context")
        devToolsOpened := false
        Sleep(500)

        ; === LIGHTWEIGHT PROBE: Check if macro-looping.js is still on this tab ===
        ; Instead of always re-injecting the full ~50KB script,
        ; first check if __delegateComplete exists on the project tab.
        ; v6.52: Probe-first optimization | v6.55: Added fallback + retry + diagnostics
        InfoLog("Step 6b: Probing for existing macro-looping.js on project tab")
        probeLoopJs := "if(typeof window.__delegateComplete==='function'){document.title='__AHK_LOOP_PROBED__'+document.title}else{document.title='__AHK_LOOP_MISSING__'+document.title}"
        InjectJS(probeLoopJs)
        Sleep(800)

        ; Read title to determine probe result
        try {
            loopProbeTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            loopProbeTitle := ""
        }

        isLoopAlreadyPresent := InStr(loopProbeTitle, "__AHK_LOOP_PROBED__")
        isLoopMissing := InStr(loopProbeTitle, "__AHK_LOOP_MISSING__")
        isProbeNoResult := !isLoopAlreadyPresent && !isLoopMissing

        ; Diagnostic: log raw title for debugging probe failures
        SubLog("Probe title (first 120 chars): " SubStr(loopProbeTitle, 1, 120), 1)
        SubLog("Probe result: PROBED=" (isLoopAlreadyPresent ? "yes" : "no") " MISSING=" (isLoopMissing ? "yes" : "no") " NO_RESULT=" (isProbeNoResult ? "yes" : "no"), 1)

        ; Clean up probe marker
        InjectJS("document.title=document.title.replace(/__AHK_LOOP_(PROBED|MISSING)__/g,'')")
        Sleep(200)

        if isLoopAlreadyPresent {
            InfoLog("Step 6b: macro-looping.js ALREADY PRESENT — skipping full re-injection (~50KB saved)")
        } else if isProbeNoResult {
            ; v6.55: Probe injection itself failed (DevTools didn't execute, timing issue, etc.)
            ; Retry once before falling back to full injection
            WarnLog("Step 6b: Probe returned NO RESULT — retrying once")
            Sleep(300)
            devToolsOpened := false
            InjectJS(probeLoopJs)
            Sleep(800)
            try {
                loopProbeTitle2 := WinGetTitle("ahk_exe " browserExe)
            } catch {
                loopProbeTitle2 := ""
            }
            isRetryProbed := InStr(loopProbeTitle2, "__AHK_LOOP_PROBED__")
            SubLog("Retry probe title (first 120 chars): " SubStr(loopProbeTitle2, 1, 120), 1)
            InjectJS("document.title=document.title.replace(/__AHK_LOOP_(PROBED|MISSING)__/g,'')")
            Sleep(200)
            if isRetryProbed {
                InfoLog("Step 6b RETRY: macro-looping.js FOUND on retry — skipping full re-injection")
            } else {
                WarnLog("Step 6b RETRY: Still no result — performing full re-injection as safety fallback")
                EmbedMacroLoopScript()
                Sleep(1000)
            }
        } else {
            InfoLog("Step 6b: macro-looping.js NOT found (MISSING) — performing full re-injection")
            EmbedMacroLoopScript()
            Sleep(1000)
        }

        InfoLog("Calling __delegateComplete to resume loop")
        CallLoopFunction("__delegateComplete")

        ; CRITICAL: Clear any stale delegate signals to prevent re-triggering
        ; Force buttons may have queued multiple signals while we were busy
        InfoLog("Clearing stale signals after delegate completion")
        A_Clipboard := ""
        Sleep(200)
        InjectJS("document.title=document.title.replace(/__AHK_DELEGATE_(UP|DOWN)__URL:.*?__ENDURL__/g,'').replace(/__AHK_DELEGATE_(UP|DOWN)__/g,'')")
        Sleep(300)

        ShowTooltip("Delegate complete!")
        InfoLog("=== HandleDelegate COMPLETE: " direction " ===")
        consecutiveDelegateFailures := 0
        isHandlingDelegate := false

    } catch as err {
        ErrorLog("HandleDelegate FAILED: " err.Message)
        SubLog("File: " err.File ", Line: " err.Line, 1)
        SubLog("Stack: " err.Stack, 1)
        ; S-004: Show tray notification on delegate error
        TrayTip("Delegate failed: " err.Message "`nDirection: " direction, "Automator Error", 3)
        try {
            devToolsOpened := false
            ; Clear stale signals to prevent cascading re-triggers
            A_Clipboard := ""
            Sleep(200)
            InjectJS("document.title=document.title.replace(/__AHK_DELEGATE_(UP|DOWN)__URL:.*?__ENDURL__/g,'').replace(/__AHK_DELEGATE_(UP|DOWN)__/g,'')")
            Sleep(300)
            CallLoopFunction("__delegateComplete")
        }
        isHandlingDelegate := false
        throw err
    }
}

; ============================================
; Extract Project ID from URL
; ============================================
ExtractProjectId(url) {
    InfoLog("ExtractProjectId called")
    try {
        hasProjectMatch := RegExMatch(url, "/projects/([a-f0-9-]+)", &match)
        if hasProjectMatch {
            SubLog("Extracted project ID: " match[1])
            return match[1]
        }
        SubLog("No project ID pattern found in URL")
        return ""
    } catch as err {
        ErrorLog("ExtractProjectId FAILED: " err.Message)
        return ""
    }
}

; ============================================
; Call Loop JS Function
; WARNING: Uses existing DevTools console (assumed open).
;   Sends Ctrl+A, Ctrl+V, Enter to paste and execute JS.
; ============================================
CallLoopFunction(funcName, param := "") {
    global pasteDelayMs, executeDelayMs

    InfoLog("CallLoopFunction called: " funcName "(" param ")")

    try {
        isPasteDelayMissing := !pasteDelayMs
        if isPasteDelayMissing {
            pasteDelayMs := 200
            SubLog("pasteDelayMs defaulted to 200")
        }
        isExecDelayMissing := !executeDelayMs
        if isExecDelayMissing {
            executeDelayMs := 300
            SubLog("executeDelayMs defaulted to 300")
        }

        isParamProvided := (param != "")
        if isParamProvided {
            js := "if(typeof " funcName "==='function'){" funcName "('" param "');}else{console.warn('" funcName " not defined');}"
        } else {
            js := "if(typeof " funcName "==='function'){" funcName "();}else{console.warn('" funcName " not defined');}"
        }
        SubLog("JS to execute: " js)

        InfoLog("  > Injecting JS function call via InjectJS")
        InjectJS(js)
        InfoLog("CallLoopFunction completed: " funcName)
    } catch as err {
        ErrorLog("CallLoopFunction FAILED for " funcName ": " err.Message)
        throw err
    }
}

; ============================================
; Embed MacroLoop Script
; WARNING: Reads macro-looping.js from disk, replaces placeholders,
;   then injects via DevTools using Ctrl+A, Ctrl+V, Enter.
; ============================================
EmbedMacroLoopScript() {
    global loopScriptMarkerId, loopContainerId, loopStatusId
    global loopStartBtnId, loopStopBtnId, loopUpBtnId, loopDownBtnId
    global loopRecordIndicatorId, loopJsExecutorId, loopJsExecuteBtnId
    global loopIntervalMs, loopCountdownIntervalMs, loopFirstCycleDelayMs
    global loopPostComboDelayMs, loopPageLoadDelayMs, loopWsCheckIntervalMs
    global loopProjectButtonXPath, loopMainProgressXPath, loopProgressXPath, loopControlsXPath, loopWorkspaceXPath, loopWorkspaceNavXPath, loopPromptActiveXPath
    global loopRequiredDomain, loopSettingsTabPath, loopDefaultView
    global loopFocusTextboxKey, loopStartKey, loopStopKey, loopShortcutModifier
    global pasteDelayMs, scriptVersion

    InfoLog("EmbedMacroLoopScript called")

    try {
        ; === INJECT XPathUtils.js FIRST ===
        xpathUtilsFile := A_ScriptDir "\xpath-utils.js"
        isXPathUtilsPresent := FileExist(xpathUtilsFile)
        if isXPathUtilsPresent {
            InfoLog("  > Injecting xpath-utils.js BEFORE macro-looping.js")
            xpathUtilsJs := FileRead(xpathUtilsFile, "UTF-8")
            SubLog("xpath-utils.js loaded: " StrLen(xpathUtilsJs) " chars")
            InjectJS(xpathUtilsJs)
            Sleep(300)
            InfoLog("  > xpath-utils.js injected successfully")
        } else {
            WarnLog("xpath-utils.js not found at: " xpathUtilsFile " — macro-looping.js will use inline fallback")
        }

        loopFile := A_ScriptDir "\macro-looping.js"
        isLoopFilePresent := FileExist(loopFile)
        if isLoopFilePresent {
            SubLog("macro-looping.js found: " loopFile)
        } else {
            ErrorLog("macro-looping.js not found: " loopFile)
            MsgBox("macro-looping.js not found", "Error")
            return
        }

        InfoLog("Reading macro-looping.js from disk")
        js := FileRead(loopFile, "UTF-8")
        SubLog("Raw file read, length: " StrLen(js) " chars")

        InfoLog("Replacing template placeholders")
        js := StrReplace(js, "__LOOP_SCRIPT_MARKER_ID__", loopScriptMarkerId)
        js := StrReplace(js, "__LOOP_CONTAINER_ID__", loopContainerId)
        js := StrReplace(js, "__LOOP_STATUS_ID__", loopStatusId)
        js := StrReplace(js, "__LOOP_START_BTN_ID__", loopStartBtnId)
        js := StrReplace(js, "__LOOP_STOP_BTN_ID__", loopStopBtnId)
        js := StrReplace(js, "__LOOP_UP_BTN_ID__", loopUpBtnId)
        js := StrReplace(js, "__LOOP_DOWN_BTN_ID__", loopDownBtnId)
        js := StrReplace(js, "__LOOP_RECORD_INDICATOR_ID__", loopRecordIndicatorId)
        js := StrReplace(js, "__LOOP_JS_EXECUTOR_ID__", loopJsExecutorId)
        js := StrReplace(js, "__LOOP_JS_EXECUTE_BTN_ID__", loopJsExecuteBtnId)

        js := StrReplace(js, "__LOOP_INTERVAL_MS__", loopIntervalMs)
        js := StrReplace(js, "__COUNTDOWN_INTERVAL_MS__", loopCountdownIntervalMs)
        js := StrReplace(js, "__FIRST_CYCLE_DELAY_MS__", loopFirstCycleDelayMs)
        js := StrReplace(js, "__POST_COMBO_DELAY_MS__", loopPostComboDelayMs)
        js := StrReplace(js, "__PAGE_LOAD_DELAY_MS__", loopPageLoadDelayMs)
        js := StrReplace(js, "__DIALOG_WAIT_MS__", loopDialogWaitMs)
        js := StrReplace(js, "__WS_CHECK_INTERVAL_MS__", loopWsCheckIntervalMs)

        js := StrReplace(js, "__LOOP_PROJECT_BUTTON_XPATH__", loopProjectButtonXPath)
        js := StrReplace(js, "__LOOP_MAIN_PROGRESS_XPATH__", loopMainProgressXPath)
        js := StrReplace(js, "__LOOP_PROGRESS_XPATH__", loopProgressXPath)
        js := StrReplace(js, "__LOOP_WORKSPACE_XPATH__", loopWorkspaceXPath)
        js := StrReplace(js, "__LOOP_WORKSPACE_NAV_XPATH__", loopWorkspaceNavXPath)
        js := StrReplace(js, "__LOOP_CONTROLS_XPATH__", loopControlsXPath)
        js := StrReplace(js, "__LOOP_PROMPT_ACTIVE_XPATH__", loopPromptActiveXPath)
        js := StrReplace(js, "__LOOP_REQUIRED_DOMAIN__", loopRequiredDomain)
        js := StrReplace(js, "__LOOP_SETTINGS_TAB_PATH__", loopSettingsTabPath)
        js := StrReplace(js, "__LOOP_DEFAULT_VIEW__", loopDefaultView)

        js := StrReplace(js, "__LOOP_FOCUS_TEXTBOX_KEY__", loopFocusTextboxKey)
        js := StrReplace(js, "__LOOP_START_KEY__", loopStartKey)
        js := StrReplace(js, "__LOOP_STOP_KEY__", loopStopKey)
        js := StrReplace(js, "__LOOP_SHORTCUT_MODIFIER__", loopShortcutModifier)

        js := StrReplace(js, "__SCRIPT_VERSION__", scriptVersion)
        SubLog("Placeholders replaced, length: " StrLen(js) " chars")

        InfoLog("Injecting macro-looping.js via InjectJS (" StrLen(js) " chars)")
        InjectJS(js)
        InfoLog("EmbedMacroLoopScript completed, " StrLen(js) " chars injected")

    } catch as err {
        ErrorLog("EmbedMacroLoopScript FAILED: " err.Message)
        SubLog("Stack: " err.Stack, 1)
        throw err
    }
}

; ============================================
; OpenDevToolsIfNeeded - DEPRECATED
; DevTools is now managed by InjectJS/JsInject.ahk via devToolsOpened flag.
; This function is kept as a no-op for backward compatibility.
; ============================================
OpenDevToolsIfNeeded() {
    DebugLog("OpenDevToolsIfNeeded called (no-op, DevTools managed by InjectJS)")
}

; ============================================
; Adjust Loop Interval
; ============================================
AdjustLoopInterval(direction) {
    global loopIntervalMs, loopIntervalStep, macroLoopRunning

    InfoLog("AdjustLoopInterval called, direction=" direction ", current=" loopIntervalMs "ms")

    try {
        minInterval := 5000
        maxInterval := 120000

        newInterval := loopIntervalMs + (direction * loopIntervalStep)
        SubLog("Calculated new interval: " newInterval "ms (step=" loopIntervalStep ")")

        isAtMinimum := newInterval < minInterval
        if isAtMinimum {
            newInterval := minInterval
            SubLog("Clamped to minimum: " minInterval "ms")
            ShowTooltip("Interval at minimum: " (newInterval // 1000) "s")
        } else {
            isAtMaximum := newInterval > maxInterval
            if isAtMaximum {
                newInterval := maxInterval
                SubLog("Clamped to maximum: " maxInterval "ms")
                ShowTooltip("Interval at maximum: " (newInterval // 1000) "s")
            } else {
                ShowTooltip("Loop interval: " (newInterval // 1000) "s")
            }
        }

        loopIntervalMs := newInterval
        InfoLog("  > Interval updated: " newInterval "ms (" (newInterval // 1000) "s)")

        isLoopRunning := !!macroLoopRunning
        if isLoopRunning {
            InfoLog("  > Loop is running, updating JS interval")
            CallLoopFunction("__loopSetInterval", newInterval)
        }
    } catch as err {
        ErrorLog("AdjustLoopInterval FAILED: " err.Message)
        throw err
    }
}
