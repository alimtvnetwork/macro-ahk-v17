; MacroLoop\Embed.ahk - Script injection (EmbedMacroLoopScript)
; BuildMacroLoopJS() — returns compiled JS string (no injection).
;   Used by EmbedMacroLoopScript() for injection and ExportMacroLoopJS() for debugging export.

; ============================================
; BuildMacroLoopJS - Read macro-looping.js and replace all placeholders, return compiled string.
; Does NOT inject — caller decides what to do with the result.
; Returns: Fully resolved JS string, or throws on error.
; ============================================
BuildMacroLoopJS() {
    global loopScriptMarkerId, loopContainerId, loopStatusId
    global loopStartBtnId, loopStopBtnId, loopUpBtnId, loopDownBtnId
    global loopRecordIndicatorId, loopJsExecutorId, loopJsExecuteBtnId
    global loopIntervalMs, loopCountdownIntervalMs, loopFirstCycleDelayMs
    global loopPostComboDelayMs, loopPageLoadDelayMs, loopWsCheckIntervalMs, loopDialogWaitMs
    global loopProjectButtonXPath, loopMainProgressXPath, loopProgressXPath, loopControlsXPath, loopWorkspaceXPath, loopWorkspaceNavXPath, loopPromptActiveXPath
    global loopRequiredDomain, loopSettingsTabPath, loopDefaultView
    global loopFocusTextboxKey, loopStartKey, loopStopKey, loopShortcutModifier
    global pasteDelayMs, scriptVersion
    global projectNameXPath

    InfoLog("BuildMacroLoopJS called")

    loopFile := A_ScriptDir "\macro-looping.js"
    isLoopFilePresent := FileExist(loopFile)
    if !isLoopFilePresent {
        throw Error("macro-looping.js not found: " loopFile)
    }

    js := FileRead(loopFile, "UTF-8")
    SubLog("BuildMacroLoopJS: raw file read, length=" StrLen(js) " chars")

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

    js := StrReplace(js, "__PROJECT_NAME_XPATH__", projectNameXPath)
    js := StrReplace(js, "__SCRIPT_VERSION__", scriptVersion)
    SubLog("BuildMacroLoopJS: placeholders replaced, length=" StrLen(js) " chars")

    InfoLog("BuildMacroLoopJS completed, " StrLen(js) " chars")
    return js
}

; ============================================
; Embed MacroLoop Script
; WARNING: Reads macro-looping.js from disk, replaces placeholders,
;   then injects via DevTools using Ctrl+A, Ctrl+V, Enter.
; Now uses BuildMacroLoopJS() for placeholder resolution.
; ============================================
EmbedMacroLoopScript() {
    InfoLog("EmbedMacroLoopScript called")

    try {
        ; === INJECT XPathUtils.js FIRST ===
        ; First InjectJS call opens DevTools Console. All subsequent calls use InjectJSQuick
        ; (paste+enter only, no F12/Ctrl+Shift+J toggle) to prevent focus thrashing.
        xpathUtilsFile := A_ScriptDir "\xpath-utils.js"
        xpathUtilsJs := ""
        isXPathUtilsPresent := FileExist(xpathUtilsFile)
        if isXPathUtilsPresent {
            InfoLog("  > Injecting xpath-utils.js BEFORE macro-looping.js (full DevTools open)")
            xpathUtilsJs := FileRead(xpathUtilsFile, "UTF-8")
            SubLog("xpath-utils.js loaded: " StrLen(xpathUtilsJs) " chars")
            InjectJS(xpathUtilsJs)
            Sleep(500)
            InfoLog("  > xpath-utils.js injected successfully (500ms settle)")
        } else {
            WarnLog("xpath-utils.js not found at: " xpathUtilsFile " — macro-looping.js will use inline fallback")
        }

        ; Build compiled JS using shared builder function
        js := BuildMacroLoopJS()

        ; Use InjectJSQuick — Console is already focused from xpath-utils injection above
        InfoLog("  > Injecting macro-looping.js via InjectJSQuick (" StrLen(js) " chars, Console already focused)")
        InjectJSQuick(js)
        InfoLog("EmbedMacroLoopScript completed, " StrLen(js) " chars injected")

        ; === STORE FULL BUNDLE for Export button ===
        ; Build xpath-utils + macro-looping bundle, store as window.__exportBundle
        ; The Export button in macro-looping.js reads this global to download/copy the bundle.
        ; NOTE: combo.js is NOT included — this bundle is for standalone MacroLoop usage.
        try {
            InfoLog("  > Building export bundle (xpath-utils + macro-looping only)...")

            ; Concatenate: xpath-utils + macro-looping (no combo)
            bundle := ""
            if (StrLen(xpathUtilsJs) > 0) {
                bundle .= "// === PART 1: xpath-utils.js ===`n"
                bundle .= xpathUtilsJs
                bundle .= "`n`n"
            }
            bundle .= "// === PART 2: macro-looping.js (compiled) ===`n"
            bundle .= js

            InfoLog("  > Full bundle built: " StrLen(bundle) " chars")

            ; Escape for JS single-quoted string literal
            bundleEscaped := StrReplace(bundle, "\", "\\")
            bundleEscaped := StrReplace(bundleEscaped, "'", "\'")
            bundleEscaped := StrReplace(bundleEscaped, "`n", "\n")
            bundleEscaped := StrReplace(bundleEscaped, "`r", "\r")

            ; Inject as window global
            storageSnippet := "window.__exportBundle='" . bundleEscaped . "';console.log('[MacroLoop] Export bundle stored: '+window.__exportBundle.length+' chars');"
            InjectJSQuick(storageSnippet)
            InfoLog("  > Export bundle stored in window.__exportBundle (" StrLen(bundle) " chars)")
        } catch as bundleErr {
            WarnLog("  > Export bundle storage failed (non-critical): " bundleErr.Message)
            WarnLog("  > Export button will show 'No bundle available' — combo.js may not be configured")
        }

    } catch as err {
        ErrorLog("EmbedMacroLoopScript FAILED: " err.Message)
        SubLog("Stack: " err.Stack, 1)
        throw err
    }
}
