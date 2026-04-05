; MacroLoop\Delegate.ahk - HandleDelegate: tab switching & combo delegation
; DEPRECATED (v7.9.6): This entire module is deprecated.
; Workspace moves are now handled directly via API in macro-looping.js (performDirectMove).
; No tab switching, clipboard signals, or title markers needed.
; Kept for reference and backward compatibility only.
;
; v7.4.1: Implements the "no Settings tab" fallback — extracts project ID from
;          current tab URL, opens a new Settings tab via Ctrl+T, then proceeds.
; FLOW (7 steps):
;   1. Close DevTools (clean slate for tab switching)
;   2. Remember current tab title (for return later)
;   3. Search existing tabs for Settings tab (Ctrl+Tab loop — no project ID needed)
;      3b. If NOT found → return to start tab, read URL, extract project ID,
;          open new Settings tab via Ctrl+T + paste URL
;   4. Check if combo controller exists (getElementById)
;      4a. If yes → send Ctrl+Alt+Up/Down shortcut
;      4b. If no  → inject combo.js (full injection)
;   5. Wait for completion (poll __combo_progress_status__ element)
;   6. Return to previous tab (Ctrl+Shift+Tab loop, match startTitle)
;   7. Cleanup & done

; ============================================
; Handle Delegate - v7.4 with tab-search-first flow
; ============================================
HandleDelegate(direction, embeddedUrl := "") {
    global browserExe, loopRequiredDomain, loopSettingsTabPath, loopSettingsPageLoadDelayMs
    global delegateTabSwitchDelayMs, delegateMaxTabSearch
    global devToolsOpened, isHandlingDelegate
    global consecutiveDelegateFailures, MAX_DELEGATE_FAILURES
    global macroLoopRunning, macroLoopDirection
    global clipboardPollTimerId, scriptMarkerId

    isHandlingDelegate := true
    ForceDelegateLogStart(direction)

    try {
        ; --- Failure guard ---
        if (consecutiveDelegateFailures >= MAX_DELEGATE_FAILURES) {
            ForceDelegateLog("BLOCKED", "Aborting — " consecutiveDelegateFailures " consecutive failures", "Too many failures in a row indicate a systemic problem — stop to prevent infinite loop", "Loop stopped, failures reset")
            ErrorLog("HandleDelegate BLOCKED: " consecutiveDelegateFailures " consecutive failures")
            ShowTooltip("ERROR: Delegate failed " consecutiveDelegateFailures " times — loop stopped")
            TrayTip("Delegation failed " consecutiveDelegateFailures " times. Loop stopped.", "Automator Error", 3)
            CallLoopFunction("__loopStop")
            macroLoopRunning := false
            if clipboardPollTimerId {
                SetTimer(CheckClipboardForDelegate, 0)
                clipboardPollTimerId := 0
            }
            isHandlingDelegate := false
            consecutiveDelegateFailures := 0
            UpdateTrayIcon()
            ForceDelegateLogEnd(direction, false)
            return
        }

        ; --- Default timing values ---
        if !delegateTabSwitchDelayMs
            delegateTabSwitchDelayMs := 300
        if !delegateMaxTabSearch
            delegateMaxTabSearch := 10

        ; ========================================
        ; STEP 1/7: CLOSE DEVTOOLS
        ; ========================================
        if devToolsOpened {
            ForceDelegateLog("STEP 1/7: CLOSE DEVTOOLS", "Send F12 + wait 300ms", "DevTools steals keyboard focus — Ctrl+Tab would switch DevTools panels instead of browser tabs", "DevTools closed")
            SendKey("{F12}", "Close DevTools")
            Sleep(300)
            devToolsOpened := false
        } else {
            ForceDelegateLog("STEP 1/7: CLOSE DEVTOOLS", "Skip (already closed)", "DevTools was not open — no action needed", "Skipped")
        }

        ; ========================================
        ; STEP 2/7: REMEMBER STARTING TAB
        ; ========================================
        try {
            startTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            startTitle := ""
        }
        truncatedTitle := SubStr(startTitle, 1, 80)
        ForceDelegateLog("STEP 2/7: REMEMBER STARTING TAB", "WinGetTitle() → stored as startTitle", "After delegation completes on Settings tab, we need to return to this exact tab", "Title: " truncatedTitle)

        ; ========================================
        ; STEP 3/7: SEARCH FOR SETTINGS TAB (FIRST!)
        ; No project ID needed — just look for "Settings" in title.
        ; ========================================
        ForceDelegateLog("STEP 3/7: FIND SETTINGS TAB", "Ctrl+Tab loop (max " delegateMaxTabSearch " tabs)", "Search for an existing Settings tab BEFORE doing anything else — this is the fastest path", "Searching...")
        ShowTooltip("Searching for Settings tab...")
        settingsFound := false

        Loop delegateMaxTabSearch {
            SendKey("^{Tab}", "Next tab")
            Sleep(delegateTabSwitchDelayMs)

            ; Use GetTabInfoFromTitle without projectId — isSettings works without it
            tabInfo := GetTabInfoFromTitle()
            tabTitle := SubStr(tabInfo.title, 1, 60)
            isSettings := tabInfo.isSettings ? "YES" : "NO"

            ForceDelegateLog("STEP 3/7: TAB " A_Index " CHECK", "Read title + check isSettings", "Checking if this tab is a Settings page", "Title: [" tabTitle "] isSettings=" isSettings)

            if tabInfo.isSettings {
                ForceDelegateLog("STEP 3/7: FIND SETTINGS TAB", "FOUND at tab position " A_Index, "This tab is a Settings page — staying here to check for controller", "Staying on this tab")
                ShowTooltip("Found Settings tab!")
                settingsFound := true
                break
            }

            ; Loop-back detection: if we're back to starting tab, stop searching
            if (SubStr(tabInfo.title, 1, 60) = SubStr(startTitle, 1, 60)) {
                ForceDelegateLog("STEP 3/7: FIND SETTINGS TAB", "Looped back to start tab after " A_Index " tabs", "We've cycled through all open tabs without finding Settings", "Not found")
                break
            }
        }

        ; --- Settings tab not found: extract project ID, open new Settings tab ---
        if !settingsFound {
            ForceDelegateLog("STEP 3b/7: NO SETTINGS TAB", "Settings tab not found after " delegateMaxTabSearch " tabs", "Must extract project ID from current tab URL and open a new Settings tab", "Extracting project ID...")

            ; First, return to starting tab so we can read its URL
            ShowTooltip("Returning to project tab for URL...")
            Loop delegateMaxTabSearch {
                try {
                    retTitle := WinGetTitle("ahk_exe " browserExe)
                } catch {
                    retTitle := ""
                }
                if (SubStr(retTitle, 1, 60) = SubStr(startTitle, 1, 60)) {
                    break
                }
                SendKey("^+{Tab}", "Previous tab (return to start)")
                Sleep(delegateTabSwitchDelayMs)
            }

            ; Read URL from address bar to extract project ID
            ForceDelegateLog("STEP 3b/7: READ URL", "Ctrl+L → Ctrl+C → Escape", "Need the full URL to extract the project ID (e.g. /projects/abc-123-def)", "Reading address bar...")
            oldClip := ClipboardAll()
            A_Clipboard := ""

            SendKey("^l", "Focus address bar")
            Sleep(100)
            SendKey("^c", "Copy URL")
            Sleep(100)
            ClipWait(2)
            SendKey("{Escape}", "Close address bar")
            Sleep(50)

            currentUrl := A_Clipboard
            A_Clipboard := oldClip
            urlPreview := SubStr(currentUrl, 1, 100)
            ForceDelegateLog("STEP 3b/7: READ URL", "URL captured", "Will extract project ID from this URL", "URL: " urlPreview)

            ; Extract project ID
            projectId := ExtractProjectId(currentUrl)
            if (projectId = "") {
                ForceDelegateLog("STEP 3b/7: EXTRACT PROJECT ID", "FAILED — no project ID found in URL", "Cannot construct Settings URL without a project ID — aborting delegation", "Returning without action")
                ShowTooltip("No project ID found — cannot open Settings")
                WarnLog("HandleDelegate: No project ID in URL: " urlPreview)
                A_Clipboard := ""
                isHandlingDelegate := false
                ForceDelegateLogEnd(direction, false)
                return
            }

            ForceDelegateLog("STEP 3b/7: EXTRACT PROJECT ID", "Project ID: " projectId, "Will use this to construct the Settings tab URL", "ID extracted")

            ; Construct settings URL and open in new tab
            settingsUrl := loopRequiredDomain "projects/" projectId loopSettingsTabPath
            ForceDelegateLog("STEP 3b/7: OPEN NEW SETTINGS TAB", "Ctrl+T → navigate to " SubStr(settingsUrl, 1, 80), "No existing Settings tab — opening a new one with the correct project settings URL", "Opening...")

            SendKey("^t", "New tab")
            Sleep(300)

            ; Type the URL into the address bar (new tab auto-focuses address bar)
            oldClip2 := ClipboardAll()
            A_Clipboard := settingsUrl
            SendKey("^v", "Paste settings URL")
            Sleep(100)
            SendKey("{Enter}", "Navigate to settings URL")
            A_Clipboard := oldClip2

            ; Wait for the page to load (configurable via config.ini [MacroLoop.Timing] SettingsPageLoadDelayMs)
            pageLoadDelay := loopSettingsPageLoadDelayMs ? loopSettingsPageLoadDelayMs : 3000
            ForceDelegateLog("STEP 3b/7: WAIT FOR PAGE LOAD", "Sleep " pageLoadDelay "ms", "Settings page needs time to fully load before we can inject or interact", "Waiting...")
            Sleep(pageLoadDelay)
            ShowTooltip("Settings tab opened!")
            ForceDelegateLog("STEP 3b/7: OPEN NEW SETTINGS TAB", "New Settings tab opened and loaded", "Ready to check for controller and trigger combo", "Settings tab ready")
        }

        ; ========================================
        ; STEP 4/7: CHECK CONTROLLER & TRIGGER COMBO
        ; Settings tab is active — check if combo controller is already injected.
        ; ========================================
        ForceDelegateLog("STEP 4/7: CHECK CONTROLLER", "getElementById('" scriptMarkerId "')", "If combo.js is already running, we just send the shortcut — no need to re-inject 40KB of JS", "Checking...")

        checkJs := "document.getElementById('" scriptMarkerId "') ? 'FOUND' : 'MISSING'"
        devToolsOpened := false
        InjectJS("document.title=document.title.replace(/__AHK_CTRL_(FOUND|MISSING)__/g,'');document.title=((" checkJs ")==='FOUND'?'__AHK_CTRL_FOUND__':'__AHK_CTRL_MISSING__')+document.title")
        Sleep(400)

        try {
            checkTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            checkTitle := ""
        }

        controllerExists := InStr(checkTitle, "__AHK_CTRL_FOUND__")
        controllerMissing := InStr(checkTitle, "__AHK_CTRL_MISSING__")

        ; Clean up the title marker immediately
        InjectJS("document.title=document.title.replace(/__AHK_CTRL_(FOUND|MISSING)__/g,'')")
        Sleep(100)

        if controllerExists {
            ; Controller exists — send shortcut
            shortcutKey := (direction = "up") ? "^!{Up}" : "^!{Down}"
            shortcutLabel := (direction = "up") ? "Ctrl+Alt+Up" : "Ctrl+Alt+Down"
            ForceDelegateLog("STEP 4a/7: SEND SHORTCUT", "Send " shortcutLabel, "Controller already running — just send the keyboard shortcut to trigger combo " direction, "Sending...")

            if devToolsOpened {
                SendKey("{F12}", "Close DevTools before shortcut")
                Sleep(300)
                devToolsOpened := false
            }

            SendKey(shortcutKey, shortcutLabel " to combo.js")
            Sleep(500)
            ForceDelegateLog("STEP 4a/7: SEND SHORTCUT", shortcutLabel " sent", "Shortcut delivered to the page — combo.js should now be executing the " direction " action", "Shortcut sent, waited 500ms")
        } else {
            ; Controller not found — inject combo.js
            reasonDetail := controllerMissing ? "getElementById returned null" : "Title marker not detected (injection may have failed)"
            ForceDelegateLog("STEP 4b/7: INJECT COMBO.JS", "RunComboSafe(" direction ")", "Controller NOT found — " reasonDetail ". Must inject full combo.js before triggering", "Injecting...")
            ShowTooltip("Injecting combo controller...")

            if devToolsOpened {
                SendKey("{F12}", "Close DevTools for fresh inject")
                Sleep(300)
                devToolsOpened := false
            }

            RunComboSafe(direction)
            ForceDelegateLog("STEP 4b/7: INJECT COMBO.JS", "RunComboSafe completed", "combo.js injected and direction=" direction " executed", "Injection done")
        }

        ; ========================================
        ; STEP 5/7: WAIT FOR COMPLETION
        ; v7.9: Title-based polling — NO JS injection needed!
        ; combo.js sets __AHK_COMBO_DONE__ or __AHK_COMBO_ERROR__ in document.title.
        ; AHK just reads WinGetTitle() — zero DevTools interaction during polling.
        ; This fixes the async clipboard.writeText() Promise issue.
        ; ========================================
        ForceDelegateLog("STEP 5/7: WAIT FOR COMPLETION", "Title-based polling (v7.9 — no JS injection)", "combo.js signals via document.title markers (__AHK_COMBO_DONE__ / __AHK_COMBO_ERROR__)", "Starting poll...")

        progressMaxPolls := 30       ; max 30 polls
        progressPollDelayMs := 500    ; 500ms between polls = ~15s max wait
        progressResult := ProgressStatus.TIMEOUT

        Loop progressMaxPolls {
            pollIndex := A_Index

            ; v7.9: Read status from window title — no injection needed
            titleStatus := ReadStatusFromTitle()

            if (titleStatus = ProgressStatus.DONE) {
                progressResult := ProgressStatus.DONE
                ForceDelegateLog("STEP 5/7: POLL " pollIndex "/" progressMaxPolls, "Title status = DONE", "combo.js finished successfully — safe to switch tabs now", "Completed!")
                break
            }
            if (titleStatus = ProgressStatus.ERROR) {
                progressResult := ProgressStatus.ERROR
                ForceDelegateLog("STEP 5/7: POLL " pollIndex "/" progressMaxPolls, "Title status = ERROR", "combo.js encountered an error during execution", "Error detected")
                break
            }
            ; No terminal marker yet — still in_progress or idle
            if (pollIndex <= 3 || Mod(pollIndex, 5) = 0) {
                ForceDelegateLog("STEP 5/7: POLL " pollIndex "/" progressMaxPolls, "Title status = (waiting)", "No done/error marker in title yet — combo.js still working", "Waiting...")
            }

            Sleep(progressPollDelayMs)
        }

        if (progressResult = ProgressStatus.TIMEOUT) {
            ForceDelegateLog("STEP 5/7: WAIT FOR COMPLETION", "TIMEOUT after " progressMaxPolls " polls", "combo.js did not signal done/error within ~" (progressMaxPolls * progressPollDelayMs) // 1000 "s — proceeding anyway", "Timed out")
            WarnLog("Delegate: progress polling timed out after " progressMaxPolls " attempts")
        }

        ; v7.9: Clean up title markers and reset status element
        ; Need DevTools briefly for the cleanup JS
        if !devToolsOpened {
            SendKey("^+j", "Open DevTools for cleanup")
            Sleep(300)
            devToolsOpened := true
        }
        ResetElementStatus(progressStatusId)

        ; ========================================
        ; STEP 6/7: RETURN TO PROJECT TAB
        ; v7.9: Strip __AHK_*__ markers before comparing titles for robust matching
        ; ========================================
        if devToolsOpened {
            ForceDelegateLog("STEP 6/7: PRE-RETURN CLEANUP", "Send F12", "DevTools opened during injection — close before tab switching", "DevTools closed")
            SendKey("{F12}", "Close DevTools before return")
            Sleep(300)
            devToolsOpened := false
        }

        ; v7.9: Strip AHK markers from startTitle for clean comparison
        startTitleClean := StripAhkMarkers(startTitle)
        startTitleMatch := SubStr(startTitleClean, 1, 60)

        ForceDelegateLog("STEP 6/7: RETURN TO PROJECT TAB", "Ctrl+Shift+Tab loop (max " delegateMaxTabSearch " tabs)", "Must return to the original project tab so MacroLoop can continue its cycle", "Searching for (cleaned): " startTitleMatch)
        ShowTooltip("Returning to project tab...")

        Loop delegateMaxTabSearch {
            SendKey("^+{Tab}", "Previous tab")
            Sleep(delegateTabSwitchDelayMs)

            try {
                currentTitle := WinGetTitle("ahk_exe " browserExe)
            } catch {
                currentTitle := ""
            }
            ; v7.9: Strip AHK markers from current title too
            currentTitleClean := StripAhkMarkers(currentTitle)
            currentTitleMatch := SubStr(currentTitleClean, 1, 60)

            ForceDelegateLog("STEP 6/7: TAB " A_Index " CHECK", "Compare cleaned titles", "Looking for the original tab we started on", "Current: [" currentTitleMatch "] vs Start: [" startTitleMatch "]")

            if (currentTitleMatch = startTitleMatch) {
                ForceDelegateLog("STEP 6/7: RETURN TO PROJECT TAB", "FOUND original tab at position " A_Index, "Cleaned title matches startTitle — we're back where we started", "Back on project tab")
                ShowTooltip("Back on project!")
                break
            }
        }

        ; ========================================
        ; STEP 7/7: CLEANUP & DONE
        ; ========================================
        A_Clipboard := ""
        consecutiveDelegateFailures := 0
        isHandlingDelegate := false
        ForceDelegateLog("STEP 7/7: CLEANUP & DONE", "Clear clipboard, reset failure counter, reset isHandlingDelegate", "Cleanup state so next delegation starts fresh", "Direction=" direction ", clipboard cleared, failures=0")
        ShowTooltip("Delegate complete!")
        ForceDelegateLogEnd(direction, true)

    } catch as err {
        ForceDelegateLog("ERROR", "HandleDelegate CRASHED: " err.Message, "Unexpected exception — File: " err.File " Line: " err.Line, "Delegation failed")
        ErrorLog("HandleDelegate FAILED: " err.Message)
        SubLog("File: " err.File ", Line: " err.Line)
        TrayTip("Delegate failed: " err.Message, "Automator Error", 3)
        devToolsOpened := false
        A_Clipboard := ""
        isHandlingDelegate := false
        ForceDelegateLogEnd(direction, false)
        throw err
    }
}