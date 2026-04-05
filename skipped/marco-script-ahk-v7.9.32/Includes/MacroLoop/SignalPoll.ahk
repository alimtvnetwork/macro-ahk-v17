; MacroLoop\SignalPoll.ahk - Clipboard & title signal polling for delegation
; DEPRECATED (v7.9.6): This entire module is deprecated.
; Workspace moves are now handled directly via API in macro-looping.js (performDirectMove).
; Clipboard/title signal polling is no longer needed.
; Kept for reference and backward compatibility only.
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
