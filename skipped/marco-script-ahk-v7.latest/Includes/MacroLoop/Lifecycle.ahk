; MacroLoop\Lifecycle.ahk - Loop start/stop/toggle and interval adjustment

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

            ; v7.9.6: Clipboard polling deprecated but clean up if somehow still active
            isPollingActive := !!clipboardPollTimerId
            if isPollingActive {
                SetTimer(CheckClipboardForDelegate, 0)
                clipboardPollTimerId := 0
                SubLog("DEPRECATED: Clipboard polling stopped (legacy cleanup)")
            }
            InfoLog("MacroLoop STOPPED")
        } else {
            InfoLog("  > Starting loop with direction=" direction)
            CallLoopFunction("__loopStart", direction)
            macroLoopRunning := true

            ; v7.9.6: No clipboard polling needed — JS handles moves directly via API.
            ; The old delegation flow (clipboard signals → AHK tab switch → combo injection)
            ; is replaced by performDirectMove() in macro-looping.js which calls
            ; moveToAdjacentWorkspace() (PUT /move-to-workspace) directly.
            InfoLog("MacroLoop STARTED, direction=" direction " (v7.9.6: API-direct mode, no AHK delegation)")
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
