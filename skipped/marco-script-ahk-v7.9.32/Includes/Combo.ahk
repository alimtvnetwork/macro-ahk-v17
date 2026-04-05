; Includes\Combo.ahk - ComboSwitch Handler
; WARNING: RunCombo reads combo.js, replaces placeholders, and calls InjectJS.
;   InjectJS sends Ctrl+Shift+J (first time only), F6, Ctrl+V, Enter to the browser.
;   The browser window must be open with DevTools available.
;
; FAST PATH: If we've already injected combo.js (scriptEmbedded flag),
;   we skip the full 40K injection and just call window.__comboSwitch(direction)
;   directly via a tiny JS snippet. Much faster, no extra DevTools windows.
;
; BuildComboJS(direction) — returns compiled JS string (no injection).
;   Used by RunCombo() for injection and ExportComboJS() for debugging export.

global scriptEmbedded := false

; Element descriptor globals — explicit init suppresses #Warn for dynamic %prefix% assignments
global TransferTextMatch := "", TransferTag := "", TransferSelector := "", TransferAriaLabel := "", TransferHeadingSearch := "", TransferRole := ""
global Combo1TextMatch := "", Combo1Tag := "", Combo1Selector := "", Combo1AriaLabel := "", Combo1HeadingSearch := "", Combo1Role := ""
global Combo2TextMatch := "", Combo2Tag := "", Combo2Selector := "", Combo2AriaLabel := "", Combo2HeadingSearch := "", Combo2Role := ""
global OptionsTextMatch := "", OptionsTag := "", OptionsSelector := "", OptionsAriaLabel := "", OptionsHeadingSearch := "", OptionsRole := ""
global ConfirmTextMatch := "", ConfirmTag := "", ConfirmSelector := "", ConfirmAriaLabel := "", ConfirmHeadingSearch := "", ConfirmRole := ""

RunCombo(direction) {
    global browserExe, scriptEmbedded, devToolsOpened
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath
    global ComboPollIntervalMs, ComboOpenMaxAttempts, ComboWaitMaxAttempts
    global ComboRetryCount, ComboRetryDelayMs, ComboConfirmDelayMs
    global scriptMarkerId, buttonContainerId, buttonUpId, buttonDownId
    global scriptVersion
    ; Element descriptor globals (must redeclare here so function sees the globals, not locals)
    global TransferTextMatch, TransferTag, TransferSelector, TransferAriaLabel, TransferHeadingSearch, TransferRole
    global Combo1TextMatch, Combo1Tag, Combo1Selector, Combo1AriaLabel, Combo1HeadingSearch, Combo1Role
    global Combo2TextMatch, Combo2Tag, Combo2Selector, Combo2AriaLabel, Combo2HeadingSearch, Combo2Role
    global OptionsTextMatch, OptionsTag, OptionsSelector, OptionsAriaLabel, OptionsHeadingSearch, OptionsRole
    global ConfirmTextMatch, ConfirmTag, ConfirmSelector, ConfirmAriaLabel, ConfirmHeadingSearch, ConfirmRole
    global pasteDelayMs, browserActivateDelayMs
    ; Credit Status globals
    global creditApiBaseUrl, creditAuthMode, creditBearerToken
    global creditAutoCheckEnabled, creditAutoCheckInterval, creditCacheTtl
    global creditMaxRetries, creditRetryBackoff
    global creditPlansXPath, creditFreeXPath, creditTotalXPath

    InfoLog("RunCombo called with direction=" direction)

    ; v7.9.2: ALWAYS reset devToolsOpened to false at the start of RunCombo.
    ; DevTools state is per-tab in Chrome, so the flag from a previous project tab
    ; is stale when switching to a 2nd project. Without this reset, InjectViaDevTools
    ; takes the "subsequent" path (F12 close → ClickPageContent → Ctrl+Shift+J),
    ; but F12 OPENS DevTools on the new tab (it was closed), causing scripts to
    ; execute in the DevTools frame context → DOMAIN GUARD ABORT.
    devToolsOpened := false
    SubLog("devToolsOpened reset to false (per-tab safety)")

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

        ; === DOM ID CHECK (replaces unreliable scriptEmbedded flag) ===
        ; Single self-cleaning JS: check marker + set title signal + auto-cleanup after 2s.
        ; This is ONE InjectJS call instead of two (check + cleanup were separate before).
        InfoLog("  > DOM ID CHECK: getElementById('" scriptMarkerId "')")
        checkJs := "(function(){var m=document.getElementById('" scriptMarkerId "')?'FOUND':'MISSING';document.title=document.title.replace(/__AHK_CTRL_(FOUND|MISSING)__/g,'');document.title='__AHK_CTRL_'+m+'__'+document.title;setTimeout(function(){document.title=document.title.replace(/__AHK_CTRL_(FOUND|MISSING)__/g,'')},2000)})()"
        InjectJS(checkJs)
        Sleep(400)

        try {
            browserTitle := WinGetTitle("ahk_exe " browserExe)
        } catch {
            browserTitle := ""
        }

        controllerFound := InStr(browserTitle, "__AHK_CTRL_FOUND__")
        ; Title cleanup is automatic via setTimeout — no extra InjectJS needed

        if controllerFound {
            ; === FAST PATH: Controller exists in DOM — send keyboard shortcut ===
            shortcutKey := (direction = "up") ? "^!{Up}" : "^!{Down}"
            shortcutLabel := (direction = "up") ? "Ctrl+Alt+Up" : "Ctrl+Alt+Down"
            InfoLog("  > FAST PATH: Script marker FOUND in DOM, sending " shortcutLabel)

            ; v7.5: Keep DevTools open — keyboard shortcut targets the page regardless
            ; No F12 close needed; avoids redundant close/reopen on next injection

            SendKey(shortcutKey, shortcutLabel " to combo.js")
            Sleep(500)
            ShowTooltip("Fast path: " direction, 1500)
            SetTimer(CheckComboFailureMarker, -3000)
            InfoLog("RunCombo completed via fast path (DOM ID) for direction=" direction)
            return
        }

        ; === Script marker NOT in DOM — need full injection ===
        ; NOTE: DevTools Console is ALREADY OPEN from the InjectJS call above.
        ; All subsequent injections use InjectJSQuick (paste+enter only, NO F12/Ctrl+Shift+J toggle).
        ; This prevents focus thrashing that causes scripts to execute in DevTools context.
        InfoLog("  > Script marker MISSING from DOM — proceeding to full injection (Console already focused)")
        scriptEmbedded := false

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

        ; === INJECT XPathUtils.js FIRST (using InjectJSQuick — Console already focused) ===
        xpathUtilsFile := A_ScriptDir "\xpath-utils.js"
        isXPathUtilsPresent := FileExist(xpathUtilsFile)
        if isXPathUtilsPresent {
            InfoLog("  > Injecting xpath-utils.js BEFORE combo.js (quick mode)")
            xpathUtilsJs := FileRead(xpathUtilsFile, "UTF-8")
            SubLog("xpath-utils.js loaded: " StrLen(xpathUtilsJs) " chars")
            InjectJSQuick(xpathUtilsJs)
            Sleep(500)
            ; Verify + auto-cleanup in single call (no separate cleanup InjectJS needed)
            InfoLog("  > xpath-utils.js injected, verifying load...")
            InjectJSQuick("(function(){var ok=!!window.XPathUtils;var tag=ok?'__XPU_OK__':'__XPU_FAIL__';document.title=tag+document.title.replace(/__XPU_(OK|FAIL)__/g,'');setTimeout(function(){document.title=document.title.replace(/__XPU_(OK|FAIL)__/g,'')},2000)})()")
            Sleep(200)
            try {
                xpuTitle := WinGetTitle("ahk_exe " browserExe)
            } catch {
                xpuTitle := ""
            }
            if InStr(xpuTitle, "__XPU_OK__") {
                InfoLog("  > xpath-utils.js verified: XPathUtils loaded OK")
            } else {
                WarnLog("  > xpath-utils.js verification: XPathUtils NOT detected — combo.js will use deferred retry")
            }
            ; Title cleanup is automatic via setTimeout
        } else {
            WarnLog("xpath-utils.js not found at: " xpathUtilsFile " — combo.js will use inline fallback")
        }

        ; Build compiled JS using shared builder function
        js := BuildComboJS(direction)

        InfoLog("  > Injecting combo.js (" StrLen(js) " chars) via InjectJSQuick [FULL PATH, Console already focused]")
        ShowTooltip("Full inject: " direction, 2000)
        InjectJSQuick(js)

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
; BuildComboJS - Read combo.js and replace all placeholders, return compiled string.
; Does NOT inject — caller decides what to do with the result.
; Used by RunCombo() for injection and ExportComboJS() for debugging export.
; Parameters:
;   direction - "up" or "down" (affects __DIRECTION__ placeholder)
; Returns: Fully resolved JS string, or throws on error.
; ============================================
BuildComboJS(direction) {
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath
    global projectNameXPath
    global ComboPollIntervalMs, ComboOpenMaxAttempts, ComboWaitMaxAttempts
    global ComboRetryCount, ComboRetryDelayMs, ComboConfirmDelayMs
    global scriptMarkerId, buttonContainerId, buttonUpId, buttonDownId
    global scriptVersion
    global TransferTextMatch, TransferTag, TransferSelector, TransferAriaLabel, TransferHeadingSearch, TransferRole
    global Combo1TextMatch, Combo1Tag, Combo1Selector, Combo1AriaLabel, Combo1HeadingSearch, Combo1Role
    global Combo2TextMatch, Combo2Tag, Combo2Selector, Combo2AriaLabel, Combo2HeadingSearch, Combo2Role
    global OptionsTextMatch, OptionsTag, OptionsSelector, OptionsAriaLabel, OptionsHeadingSearch, OptionsRole
    global ConfirmTextMatch, ConfirmTag, ConfirmSelector, ConfirmAriaLabel, ConfirmHeadingSearch, ConfirmRole
    global creditApiBaseUrl, creditAuthMode, creditBearerToken
    global creditAutoCheckEnabled, creditAutoCheckInterval, creditCacheTtl
    global creditMaxRetries, creditRetryBackoff
    global creditPlansXPath, creditFreeXPath, creditTotalXPath
    global loopProjectButtonXPath, loopWorkspaceXPath

    InfoLog("BuildComboJS called, direction=" direction)

    comboFile := A_ScriptDir "\combo.js"
    isComboFilePresent := FileExist(comboFile)
    if !isComboFilePresent {
        throw Error("combo.js not found: " comboFile)
    }

    js := FileRead(comboFile, "UTF-8")
    SubLog("BuildComboJS: raw file read, length=" StrLen(js) " chars")

    js := StrReplace(js, "__DIRECTION__", direction)
    js := StrReplace(js, "__TRANSFER_XPATH__", transferXPath)
    js := StrReplace(js, "__PROJECT_NAME_XPATH__", projectNameXPath)
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
    js := StrReplace(js, "__COMBO_RETRY_COUNT__", ComboRetryCount)
    js := StrReplace(js, "__COMBO_RETRY_DELAY_MS__", ComboRetryDelayMs)
    js := StrReplace(js, "__COMBO_CONFIRM_DELAY_MS__", ComboConfirmDelayMs)
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
    js := StrReplace(js, "__COMBO_PROJECT_BUTTON_XPATH__", loopProjectButtonXPath)
    js := StrReplace(js, "__COMBO_WORKSPACE_XPATH__", loopWorkspaceXPath)

    js := StrReplace(js, "__TRANSFER_TEXT_MATCH__", TransferTextMatch)
    js := StrReplace(js, "__TRANSFER_TAG__", TransferTag)
    js := StrReplace(js, "__TRANSFER_SELECTOR__", TransferSelector)
    js := StrReplace(js, "__TRANSFER_ARIA_LABEL__", TransferAriaLabel)
    js := StrReplace(js, "__TRANSFER_HEADING_SEARCH__", TransferHeadingSearch)
    js := StrReplace(js, "__TRANSFER_ROLE__", TransferRole)

    js := StrReplace(js, "__COMBO1_TEXT_MATCH__", Combo1TextMatch)
    js := StrReplace(js, "__COMBO1_TAG__", Combo1Tag)
    js := StrReplace(js, "__COMBO1_SELECTOR__", Combo1Selector)
    js := StrReplace(js, "__COMBO1_ARIA_LABEL__", Combo1AriaLabel)
    js := StrReplace(js, "__COMBO1_HEADING_SEARCH__", Combo1HeadingSearch)
    js := StrReplace(js, "__COMBO1_ROLE__", Combo1Role)

    js := StrReplace(js, "__COMBO2_TEXT_MATCH__", Combo2TextMatch)
    js := StrReplace(js, "__COMBO2_TAG__", Combo2Tag)
    js := StrReplace(js, "__COMBO2_SELECTOR__", Combo2Selector)
    js := StrReplace(js, "__COMBO2_ARIA_LABEL__", Combo2AriaLabel)
    js := StrReplace(js, "__COMBO2_HEADING_SEARCH__", Combo2HeadingSearch)
    js := StrReplace(js, "__COMBO2_ROLE__", Combo2Role)

    js := StrReplace(js, "__OPTIONS_TEXT_MATCH__", OptionsTextMatch)
    js := StrReplace(js, "__OPTIONS_TAG__", OptionsTag)
    js := StrReplace(js, "__OPTIONS_SELECTOR__", OptionsSelector)
    js := StrReplace(js, "__OPTIONS_ARIA_LABEL__", OptionsAriaLabel)
    js := StrReplace(js, "__OPTIONS_HEADING_SEARCH__", OptionsHeadingSearch)
    js := StrReplace(js, "__OPTIONS_ROLE__", OptionsRole)

    js := StrReplace(js, "__CONFIRM_TEXT_MATCH__", ConfirmTextMatch)
    js := StrReplace(js, "__CONFIRM_TAG__", ConfirmTag)
    js := StrReplace(js, "__CONFIRM_SELECTOR__", ConfirmSelector)
    js := StrReplace(js, "__CONFIRM_ARIA_LABEL__", ConfirmAriaLabel)
    js := StrReplace(js, "__CONFIRM_HEADING_SEARCH__", ConfirmHeadingSearch)
    js := StrReplace(js, "__CONFIRM_ROLE__", ConfirmRole)

    SubLog("BuildComboJS: placeholders replaced, final length=" StrLen(js) " chars")

    isTooShort := StrLen(js) < 500
    if isTooShort {
        throw Error("combo.js templating failed - too short: " StrLen(js) " chars")
    }

    InfoLog("BuildComboJS completed, " StrLen(js) " chars")
    return js
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