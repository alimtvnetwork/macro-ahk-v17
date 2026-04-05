; Includes\AutoLoop.ahk - AutoLoop for Lovable.dev (AHK v2)
; WARNING: This module sends keyboard shortcuts and navigates between pages.
;   Ctrl+L -> Focuses address bar
;   Ctrl+C -> Copies current URL
;   Alt+Left -> Browser back navigation
;   Also calls RunCombo() which triggers InjectJS keypresses.
; Workflow: Click tool -> check progress -> handle suggestions -> execute -> move to next combo

global isAutoLoopRunning := false
global autoLoopDirection := "down"
global cycleCount := 0

; ============================================
; Toggle AutoLoop on/off
; WARNING: Sends Ctrl+L, Ctrl+C, Escape to read the address bar URL.
; ============================================
ToggleAutoLoop(direction) {
    global isAutoLoopRunning, autoLoopDirection, autoLoopIntervalMs, cycleCount
    global browserExe, requiredDomain

    InfoLog("ToggleAutoLoop called, direction=" direction ", isRunning=" isAutoLoopRunning)

    if isAutoLoopRunning {
        InfoLog("  > AutoLoop is running, stopping it")
        StopAutoLoop()
        return
    }

    InfoLog("  > Checking current URL for domain validation")
    WinActivate("ahk_exe " browserExe)
    Sleep(200)
    SubLog("Browser activated")

    LogKeyPress("^l", "Focus address bar to read URL")
    Send("^l")
    Sleep(150)

    LogKeyPress("^c", "Copy URL from address bar")
    Send("^c")
    Sleep(150)

    LogKeyPress("{Escape}", "Close address bar")
    Send("{Escape}")
    Sleep(100)

    currentUrl := A_Clipboard
    SubLog("Current URL: " currentUrl)

    isOnRequiredDomain := InStr(currentUrl, requiredDomain) = 1
    if isOnRequiredDomain {
        SubLog("Domain check PASSED: " requiredDomain)
    } else {
        WarnLog("Domain check FAILED, expected: " requiredDomain ", got: " currentUrl)
        MsgBox("AutoLoop can only run on " requiredDomain " pages.`nCurrent: " currentUrl, "Automator v5.2")
        return
    }

    isAutoLoopRunning := true
    autoLoopDirection := direction
    cycleCount := 0

    UpdateTrayIcon()

    ToolTip("AutoLoop STARTED (" direction ")`nInterval: " (autoLoopIntervalMs // 1000) "s`nPress Esc to stop")
    SoundBeep(1500, 150)
    SoundBeep(1800, 150)
    InfoLog("AutoLoop STARTED, direction=" direction ", interval=" autoLoopIntervalMs "ms")

    SetTimer(AutoLoopTick, -100)
    SetTimer(AutoLoopTimer, autoLoopIntervalMs)
    SetTimer(ClearToolTip, -3000)
}

; ============================================
; Stop AutoLoop
; ============================================
StopAutoLoop() {
    global isAutoLoopRunning, cycleCount

    InfoLog("StopAutoLoop called, totalCycles=" cycleCount)

    isAutoLoopRunning := false
    SetTimer(AutoLoopTimer, 0)

    UpdateTrayIcon()

    ToolTip("AutoLoop STOPPED`nTotal cycles: " cycleCount)
    SoundBeep(500, 300)
    TrayTip("AutoLoop stopped`nCycles: " cycleCount, "Automator v4", 1)

    InfoLog("AutoLoop STOPPED, total cycles=" cycleCount)
    cycleCount := 0
    SetTimer(ClearToolTip, -3000)
}

; ============================================
; Timer callback
; ============================================
AutoLoopTimer() {
    global isAutoLoopRunning
    isRunning := !!isAutoLoopRunning
    if isRunning {
        DebugLog("AutoLoopTimer tick fired")
        AutoLoopTick()
    }
}

; ============================================
; Single AutoLoop tick (one cycle)
; WARNING: Injects JS via InjectJS -> sends Ctrl+Shift+J, F6, Ctrl+V, Enter.
;   Also calls HandleIdleStateIfNeeded which may navigate between pages.
; ============================================
AutoLoopTick() {
    global isAutoLoopRunning, autoLoopDirection, cycleCount
    global browserExe, toolButtonXPath, progressXPath
    global suggestionsAllXPath, executeButtonXPath

    isRunning := !!isAutoLoopRunning
    if isRunning {
        InfoLog("AutoLoopTick starting cycle")
    } else {
        DebugLog("AutoLoopTick skipped - not running")
        return
    }

    cycleCount++
    InfoLog("AutoLoopTick cycle #" cycleCount " (" autoLoopDirection ")")
    ToolTip("AutoLoop: Cycle #" cycleCount " (" autoLoopDirection ")...")
    SoundBeep(1000, 100)

    InfoLog("  > Activating browser: " browserExe)
    WinActivate("ahk_exe " browserExe)
    Sleep(300)

    loopJs := "
    (
    (function(){
        console.log('%c[AutoLoop] === Cycle Start ===', 'color: magenta; font-weight: bold;');

        function getNode(xpath) {
            try {
                return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            } catch(e) { return null; }
        }

        var toolBtn = getNode(""X_TOOL_X"");
        if (toolBtn) {
            console.log('[AutoLoop] Tool button clicked');
            toolBtn.click();
        } else {
            console.log('[AutoLoop] Tool button not found');
        }

        setTimeout(function() {
            var progress = getNode(""X_PROGRESS_X"");

            if (progress) {
                console.log('[AutoLoop] Progress bar found - BUSY state');

                var container = getNode(""X_SUGGESTIONS_X"");
                if (container) {
                    var items = Array.from(container.querySelectorAll('div'));
                    for (var i = 0; i < items.length; i++) {
                        var txt = (items[i].textContent || '').trim().toLowerCase();
                        if (txt && txt.indexOf('verify') === -1 && txt.length > 5) {
                            console.log('[AutoLoop] Clicking suggestion: ' + txt.substring(0, 40));
                            items[i].click();

                            setTimeout(function() {
                                var execBtn = getNode(""X_EXECUTE_X"");
                                if (execBtn) {
                                    console.log('[AutoLoop] Execute button clicked');
                                    execBtn.click();
                                }
                            }, 500);
                            break;
                        }
                    }
                }
            } else {
                console.log('[AutoLoop] No progress bar - IDLE state');
                console.log('[AutoLoop] Will navigate to settings...');
                window.__AUTOLOOP_NEEDS_SETTINGS__ = true;
            }

            console.log('%c[AutoLoop] === Cycle End ===', 'color: magenta;');
        }, 1000);
    })();
    )"

    loopJs := StrReplace(loopJs, "X_TOOL_X", toolButtonXPath)
    loopJs := StrReplace(loopJs, "X_PROGRESS_X", progressXPath)
    loopJs := StrReplace(loopJs, "X_SUGGESTIONS_X", suggestionsAllXPath)
    loopJs := StrReplace(loopJs, "X_EXECUTE_X", executeButtonXPath)
    SubLog("AutoLoop JS prepared, length=" StrLen(loopJs) " chars")

    InfoLog("  > Injecting AutoLoop JS via InjectJS")
    InjectJS(loopJs)

    SubLog("Waiting 3000ms for JS execution")
    Sleep(3000)

    InfoLog("  > Checking idle state")
    HandleIdleStateIfNeeded()

    ToolTip("AutoLoop: Cycle #" cycleCount " complete")
    InfoLog("AutoLoopTick cycle #" cycleCount " completed")
    SetTimer(ClearToolTip, -2000)
}

; ============================================
; Handle idle state: navigate to settings, run combo, go back
; WARNING: Sends Ctrl+L, Ctrl+C, Ctrl+V, Enter, Alt+Left to navigate.
;   Also calls RunCombo() which triggers full injection flow.
; ============================================
HandleIdleStateIfNeeded() {
    global autoLoopDirection, settingsTabPath, browserExe

    InfoLog("HandleIdleStateIfNeeded called")

    InfoLog("  > Reading current URL from address bar")
    WinActivate("ahk_exe " browserExe)
    Sleep(100)

    LogKeyPress("^l", "Focus address bar")
    Send("^l")
    Sleep(150)

    LogKeyPress("^c", "Copy URL")
    Send("^c")
    Sleep(150)

    LogKeyPress("{Escape}", "Close address bar")
    Send("{Escape}")
    Sleep(100)

    currentUrl := A_Clipboard
    SubLog("Current URL: " currentUrl)

    isAlreadyOnSettings := InStr(currentUrl, "/settings?tab=")
    if isAlreadyOnSettings {
        InfoLog("  > Already on settings page, running combo directly")
        ToolTip("AutoLoop: Running combo on settings page...")
        RunCombo(autoLoopDirection)
        SubLog("Waiting 4000ms after combo")
        Sleep(4000)
        InfoLog("HandleIdleStateIfNeeded completed (combo on existing settings page)")
        return
    }

    settingsUrl := currentUrl
    qPos := InStr(settingsUrl, "?")
    hasQueryString := qPos > 0
    if hasQueryString
        settingsUrl := SubStr(settingsUrl, 1, qPos - 1)
    hPos := InStr(settingsUrl, "#")
    hasHash := hPos > 0
    if hasHash
        settingsUrl := SubStr(settingsUrl, 1, hPos - 1)
    hasTrailingSlash := SubStr(settingsUrl, StrLen(settingsUrl), 1) = "/"
    if hasTrailingSlash
        settingsUrl := RTrim(settingsUrl, "/")
    settingsUrl := settingsUrl . settingsTabPath
    SubLog("Built settings URL: " settingsUrl)

    InfoLog("  > Navigating to settings page")
    ToolTip("AutoLoop: Navigating to settings...")

    LogKeyPress("^l", "Focus address bar for navigation")
    Send("^l")
    Sleep(150)

    A_Clipboard := settingsUrl
    LogKeyPress("^v", "Paste settings URL")
    Send("^v")
    Sleep(150)

    LogKeyPress("{Enter}", "Navigate to settings URL")
    Send("{Enter}")
    SubLog("Waiting 2500ms for page load")
    Sleep(2500)

    InfoLog("  > Running combo on settings page")
    ToolTip("AutoLoop: Running combo (" autoLoopDirection ")...")
    RunCombo(autoLoopDirection)
    SubLog("Waiting 4000ms after combo")
    Sleep(4000)

    InfoLog("  > Navigating back to previous page")
    ToolTip("AutoLoop: Going back...")
    LogKeyPress("!{Left}", "Browser back navigation")
    Send("!{Left}")
    SubLog("Waiting 2000ms for page load")
    Sleep(2000)

    InfoLog("HandleIdleStateIfNeeded completed")
}

; ============================================
; Clear tooltip helper (used by AutoLoop timers)
; ============================================
ClearToolTip() {
    ToolTip()
}
