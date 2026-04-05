; Includes\Combo.ahk - ComboSwitch Handler
; WARNING: RunCombo reads combo.js, replaces placeholders, and calls InjectJS.
;   InjectJS sends Ctrl+Shift+J (first time only), F6, Ctrl+V, Enter to the browser.
;   The browser window must be open with DevTools available.
;
; FAST PATH: If we've already injected combo.js (scriptEmbedded flag),
;   we skip the full 40K injection and just call window.__comboSwitch(direction)
;   directly via a tiny JS snippet. Much faster, no extra DevTools windows.

global scriptEmbedded := false

RunCombo(direction) {
    global browserExe, scriptEmbedded, devToolsOpened
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath
    global ComboPollIntervalMs, ComboOpenMaxAttempts, ComboWaitMaxAttempts
    global ComboRetryCount, ComboRetryDelayMs, ComboConfirmDelayMs
    global scriptMarkerId, buttonContainerId, buttonUpId, buttonDownId
    global scriptVersion
    global pasteDelayMs, browserActivateDelayMs
    ; Credit Status globals
    global creditApiBaseUrl, creditAuthMode, creditBearerToken
    global creditAutoCheckEnabled, creditAutoCheckInterval, creditCacheTtl
    global creditMaxRetries, creditRetryBackoff
    global creditPlansXPath, creditFreeXPath, creditTotalXPath

    InfoLog("RunCombo called with direction=" direction ", scriptEmbedded=" scriptEmbedded)

    try {
        isPasteDelayMissing := !pasteDelayMs
        if isPasteDelayMissing {
            pasteDelayMs := 200
            SubLog("pasteDelayMs defaulted to 200")
        }
        isBrowserDelayMissing := !browserActivateDelayMs
        if isBrowserDelayMissing {
            browserActivateDelayMs := 150
            SubLog("browserActivateDelayMs defaulted to 150")
        }
        isPollMissing := !ComboPollIntervalMs
        if isPollMissing {
            ComboPollIntervalMs := 300
            SubLog("ComboPollIntervalMs defaulted to 300")
        }
        isOpenMaxMissing := !ComboOpenMaxAttempts
        if isOpenMaxMissing {
            ComboOpenMaxAttempts := 20
            SubLog("ComboOpenMaxAttempts defaulted to 20")
        }
        isWaitMaxMissing := !ComboWaitMaxAttempts
        if isWaitMaxMissing {
            ComboWaitMaxAttempts := 20
            SubLog("ComboWaitMaxAttempts defaulted to 20")
        }
        isConfirmDelayMissing := !ComboConfirmDelayMs
        if isConfirmDelayMissing {
            ComboConfirmDelayMs := 500
            SubLog("ComboConfirmDelayMs defaulted to 500")
        }

        ; === FAST PATH ===
        ; If we've already injected combo.js, check if function still exists (page may have refreshed)
        ; Uses document.title as a signal channel: if __comboSwitch is gone, title gets a marker
        if scriptEmbedded {
            InfoLog("  > FAST PATH: scriptEmbedded=true, verifying function exists")

            ; Inject a check: call if exists, else signal via title marker
            checkJs := "if(typeof window.__comboSwitch==='function'){window.__comboSwitch('" direction "')}else{document.title='__AHK_REINJECT__'+document.title}"
            InjectJS(checkJs)
            Sleep(400)

            ; Read browser title to see if reinject marker appeared
            try {
                browserTitle := WinGetTitle("ahk_exe " browserExe)
            } catch {
                browserTitle := ""
            }
            needsReinject := InStr(browserTitle, "__AHK_REINJECT__")

            if !needsReinject {
                InfoLog("  > Fast path OK: __comboSwitch exists, call sent for direction=" direction)
                ShowTooltip("Fast path: " direction, 1500)
                ; Poll for combo failure marker (JS signals via title)
                SetTimer(CheckComboFailureMarker, -3000)
                InfoLog("RunCombo completed via fast path for direction=" direction)
                return
            }

            ; Function is gone (page refreshed) — clean up title marker
            InfoLog("  > Fast path FAILED: page was refreshed, __comboSwitch not found")
            cleanJs := "document.title=document.title.replace('__AHK_REINJECT__','')"
            InjectJS(cleanJs)
            Sleep(200)

            ; === SESSION STORAGE RECOVERY ===
            ; Try recovering from sessionStorage cache (~200 char inject instead of 40KB)
            InfoLog("  > Attempting sessionStorage recovery")
            recoveryJs := "var s=sessionStorage.getItem('__combo_src__');if(s){window.__comboRecoverDirection='" direction "';eval(s);document.title='__AHK_RECOVERED__'+document.title}else{document.title='__AHK_NO_CACHE__'+document.title}"
            InjectJS(recoveryJs)
            Sleep(600)

            ; Check recovery result
            try {
                browserTitle2 := WinGetTitle("ahk_exe " browserExe)
            } catch {
                browserTitle2 := ""
            }

            if InStr(browserTitle2, "__AHK_RECOVERED__") {
                ; SessionStorage recovery succeeded — clean up title and mark embedded
                InfoLog("  > sessionStorage recovery SUCCEEDED, cleaning up title marker")
                cleanJs2 := "document.title=document.title.replace('__AHK_RECOVERED__','')"
                InjectJS(cleanJs2)
                scriptEmbedded := true
                devToolsOpened := true
                ShowTooltip("Recovered from cache: " direction, 1500)
                SetTimer(CheckComboFailureMarker, -3000)
                InfoLog("RunCombo completed via sessionStorage recovery for direction=" direction)
                return
            }

            ; SessionStorage empty or failed — fall through to full injection
            InfoLog("  > sessionStorage recovery FAILED, falling through to full injection")
            cleanJs3 := "document.title=document.title.replace('__AHK_NO_CACHE__','')"
            InjectJS(cleanJs3)
            Sleep(100)
            scriptEmbedded := false
            devToolsOpened := false
            ShowTooltip("Re-injecting after refresh (no cache)...", 2000)
            InfoLog("  > scriptEmbedded and devToolsOpened reset to false, falling through to full injection")
        }

        ; === FULL INJECTION PATH ===
        InfoLog("  > FULL PATH: First injection, loading xpath-utils.js + combo.js")

        isXPathsMissing := !transferXPath || !combo1XPath || !combo2XPath || !optionsXPath || !confirmXPath
        if isXPathsMissing {
            ErrorLog("ComboSwitch XPaths missing in config.ini")
            SubLog("Transfer=" transferXPath, 1)
            SubLog("Combo1=" combo1XPath, 1)
            SubLog("Combo2=" combo2XPath, 1)
            SubLog("Options=" optionsXPath, 1)
            SubLog("Confirm=" confirmXPath, 1)
            MsgBox("ComboSwitch XPaths missing in config.ini", "Error")
            return
        }
        SubLog("All XPaths present")

        ; === INJECT XPathUtils.js FIRST ===
        xpathUtilsFile := A_ScriptDir "\xpath-utils.js"
        isXPathUtilsPresent := FileExist(xpathUtilsFile)
        if isXPathUtilsPresent {
            InfoLog("  > Injecting xpath-utils.js BEFORE combo.js")
            xpathUtilsJs := FileRead(xpathUtilsFile, "UTF-8")
            SubLog("xpath-utils.js loaded: " StrLen(xpathUtilsJs) " chars")
            InjectJS(xpathUtilsJs)
            Sleep(300)
            InfoLog("  > xpath-utils.js injected successfully")
        } else {
            WarnLog("xpath-utils.js not found at: " xpathUtilsFile " — combo.js will use inline fallback")
        }

        comboFile := A_ScriptDir "\combo.js"
        isComboFilePresent := FileExist(comboFile)
        if isComboFilePresent {
            SubLog("combo.js found: " comboFile)
        } else {
            ErrorLog("combo.js not found: " comboFile)
            MsgBox("combo.js not found at:`n" comboFile, "Error")
            return
        }

        InfoLog("  > Reading combo.js from disk")
        js := FileRead(comboFile, "UTF-8")
        SubLog("Raw file read, length=" StrLen(js) " chars")

        InfoLog("  > Replacing template placeholders")
        js := StrReplace(js, "__DIRECTION__", direction)
        js := StrReplace(js, "__TRANSFER_XPATH__", transferXPath)
        js := StrReplace(js, "__COMBO1_XPATH__", combo1XPath)
        js := StrReplace(js, "__COMBO2_XPATH__", combo2XPath)
        js := StrReplace(js, "__OPTIONS_XPATH__", optionsXPath)
        js := StrReplace(js, "__CONFIRM_XPATH__", confirmXPath)
        js := StrReplace(js, "__COMBO_POLL_INTERVAL_MS__", ComboPollIntervalMs)
        js := StrReplace(js, "__COMBO_OPEN_MAX_ATTEMPTS__", ComboOpenMaxAttempts)
        js := StrReplace(js, "__COMBO_WAIT_MAX_ATTEMPTS__", ComboWaitMaxAttempts)
        js := StrReplace(js, "__SCRIPT_MARKER_ID__", scriptMarkerId)
        js := StrReplace(js, "__BUTTON_CONTAINER_ID__", buttonContainerId)
        js := StrReplace(js, "__BUTTON_UP_ID__", buttonUpId)
        js := StrReplace(js, "__BUTTON_DOWN_ID__", buttonDownId)
        js := StrReplace(js, "__SCRIPT_VERSION__", scriptVersion)
        ; S-005: Replace retry placeholders
        js := StrReplace(js, "__COMBO_RETRY_COUNT__", ComboRetryCount)
        js := StrReplace(js, "__COMBO_RETRY_DELAY_MS__", ComboRetryDelayMs)
        js := StrReplace(js, "__COMBO_CONFIRM_DELAY_MS__", ComboConfirmDelayMs)
        ; Credit Status placeholders
        js := StrReplace(js, "__LOVABLE_API_BASE_URL__", creditApiBaseUrl)
        js := StrReplace(js, "__LOVABLE_AUTH_MODE__", creditAuthMode)
        js := StrReplace(js, "__LOVABLE_BEARER_TOKEN__", creditBearerToken)
        js := StrReplace(js, "__CREDITS_AUTO_CHECK_ENABLED__", creditAutoCheckEnabled)
        js := StrReplace(js, "__CREDITS_AUTO_CHECK_INTERVAL_S__", creditAutoCheckInterval)
        js := StrReplace(js, "__CREDITS_CACHE_TTL_S__", creditCacheTtl)
        js := StrReplace(js, "__CREDITS_MAX_RETRIES__", creditMaxRetries)
        js := StrReplace(js, "__CREDITS_RETRY_BACKOFF_MS__", creditRetryBackoff)
        js := StrReplace(js, "__PLANS_BUTTON_XPATH__", creditPlansXPath)
        js := StrReplace(js, "__FREE_PROGRESS_XPATH__", creditFreeXPath)
        js := StrReplace(js, "__TOTAL_CREDITS_XPATH__", creditTotalXPath)
        SubLog("Placeholders replaced, final length=" StrLen(js) " chars")

        isTooShort := StrLen(js) < 500
        if isTooShort {
            ErrorLog("combo.js templating failed - too short: " StrLen(js) " chars")
            MsgBox("combo.js templating failed", "Error")
            return
        }

        InfoLog("  > Injecting combo.js (" StrLen(js) " chars) via InjectJS [FULL PATH]")
        ShowTooltip("Full inject: " direction, 2000)
        InjectJS(js)

        ; Mark as embedded so next call uses fast path
        scriptEmbedded := true
        InfoLog("  > scriptEmbedded set to true")
        SetTimer(CheckComboFailureMarker, -3000)
        InfoLog("RunCombo completed via full injection for direction=" direction)

    } catch as err {
        ErrorLog("RunCombo FAILED: " err.Message)
        SubLog("File: " err.File " Line: " err.Line, 1)
        SubLog("Stack: " err.Stack, 1)
        ShowTooltip("Combo Error: " err.Message)
        ; S-004: Show tray notification on combo error
        TrayTip("ComboSwitch error: " err.Message "`nFile: " err.File " Line: " err.Line, "Automator Error", 3)
        throw err
    }
}

; ============================================
; ResetScriptEmbedded - Reset the embedded flag
; Call when page navigates away or script needs re-injection
; ============================================
ResetScriptEmbedded() {
    global scriptEmbedded
    InfoLog("ResetScriptEmbedded: scriptEmbedded reset from " scriptEmbedded " to false")
    scriptEmbedded := false
}

; ============================================
; CheckComboFailureMarker - Poll browser title for failure signal
; Called via SetTimer after fast path combo invocation
; JS writes __AHK_COMBO_FAILED__<stepName>__ into document.title on failure
; WARNING: Reads browser window title via WinGetTitle
; ============================================
CheckComboFailureMarker() {
    global browserExe
    fn := "CheckComboFailureMarker"
    InfoLog(fn ": Checking for combo failure marker in browser title")

    try {
        browserTitle := WinGetTitle("ahk_exe " browserExe)
    } catch {
        browserTitle := ""
    }

    failurePos := InStr(browserTitle, "__AHK_COMBO_FAILED__")
    hasFailure := failurePos > 0

    if hasFailure {
        ; Extract step name from marker: __AHK_COMBO_FAILED__<stepName>__
        markerStart := failurePos + StrLen("__AHK_COMBO_FAILED__")
        remaining := SubStr(browserTitle, markerStart)
        endPos := InStr(remaining, "__")
        hasEndMarker := endPos > 0
        if hasEndMarker {
            stepName := SubStr(remaining, 1, endPos - 1)
        } else {
            stepName := remaining
        }

        ErrorLog(fn ": Combo FAILED at step: " stepName)

        ; Show TrayTip error notification (type 3 = error icon)
        TrayTip("ComboSwitch failed at step: " stepName "`nAll retries exhausted.", "Automator Error", 3)

        ; Clean up the title marker
        cleanJs := "document.title=document.title.replace(/__AHK_COMBO_FAILED__[^_]*__/,'')"
        InjectJS(cleanJs)

        InfoLog(fn ": TrayTip shown and title marker cleaned")
    } else {
        SubLog(fn ": No failure marker found (combo likely still running or succeeded)")
        ; Re-check after another 3 seconds if combo might still be running
        ; Max 4 checks (12 seconds total coverage for slow combos)
        static checkCount := 0
        checkCount++
        isUnderLimit := checkCount < 4
        if isUnderLimit {
            SetTimer(CheckComboFailureMarker, -3000)
        } else {
            checkCount := 0
            SubLog(fn ": Max checks reached, stopping failure monitor")
        }
    }
}