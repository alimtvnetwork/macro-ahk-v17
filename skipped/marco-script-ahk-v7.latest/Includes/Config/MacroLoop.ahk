; Includes\Config\MacroLoop.ahk - Load [MacroLoop.*] sections

LoadMacroLoop(file) {
    InfoLog("Loading MacroLoop sections")

    ; === Timing ===
    global loopIntervalMs          := IniReadInt(file, Sec.ML_TIMING, LoopKey.LOOP_INTERVAL, LoopDef.LOOP_INTERVAL)
    global loopCountdownIntervalMs := IniReadInt(file, Sec.ML_TIMING, LoopKey.COUNTDOWN_INTERVAL, LoopDef.COUNTDOWN_INTERVAL)
    global loopFirstCycleDelayMs   := IniReadInt(file, Sec.ML_TIMING, LoopKey.FIRST_CYCLE_DELAY, LoopDef.FIRST_CYCLE_DELAY)
    global loopPostComboDelayMs    := IniReadInt(file, Sec.ML_TIMING, LoopKey.POST_COMBO_DELAY, LoopDef.POST_COMBO_DELAY)
    global loopPageLoadDelayMs     := IniReadInt(file, Sec.ML_TIMING, LoopKey.PAGE_LOAD_DELAY, LoopDef.PAGE_LOAD_DELAY)
    global loopDialogWaitMs        := IniReadInt(file, Sec.ML_TIMING, LoopKey.DIALOG_WAIT, LoopDef.DIALOG_WAIT)
    global loopWsCheckIntervalMs   := IniReadInt(file, Sec.ML_TIMING, LoopKey.WS_CHECK_INTERVAL, LoopDef.WS_CHECK_INTERVAL)
    global loopSettingsPageLoadDelayMs := IniReadInt(file, Sec.ML_TIMING, LoopKey.SETTINGS_PAGE_LOAD_DELAY, LoopDef.SETTINGS_PAGE_LOAD_DELAY)

    ; === URLs ===
    global loopRequiredDomain  := IniRead(file, Sec.ML_URLS, LoopKey.REQUIRED_DOMAIN, LoopDef.REQUIRED_DOMAIN)
    global loopSettingsTabPath := IniRead(file, Sec.ML_URLS, LoopKey.SETTINGS_TAB_PATH, LoopDef.SETTINGS_TAB_PATH)
    global loopDefaultView     := IniRead(file, Sec.ML_URLS, LoopKey.DEFAULT_VIEW, LoopDef.DEFAULT_VIEW)

    ; === XPaths ===
    global loopProjectButtonXPath := IniRead(file, Sec.ML_XPATHS, LoopKey.PROJECT_BTN_XPATH, CommonDef.EMPTY)
    global loopMainProgressXPath := IniRead(file, Sec.ML_XPATHS, LoopKey.MAIN_PROGRESS_XPATH, CommonDef.EMPTY)
    global loopProgressXPath   := IniRead(file, Sec.ML_XPATHS, LoopKey.PROGRESS_XPATH, CommonDef.EMPTY)
    global loopWorkspaceXPath  := IniRead(file, Sec.ML_XPATHS, LoopKey.WORKSPACE_XPATH, CommonDef.EMPTY)
    global loopWorkspaceNavXPath := IniRead(file, Sec.ML_XPATHS, LoopKey.WORKSPACE_NAV_XPATH, CommonDef.EMPTY)
    global loopPromptActiveXPath := IniRead(file, Sec.ML_XPATHS, LoopKey.PROMPT_ACTIVE_XPATH, CommonDef.EMPTY)
    global loopControlsXPath   := IniRead(file, Sec.ML_XPATHS, LoopKey.LOOP_CONTROLS_XPATH, CommonDef.EMPTY)
    global loopFreeCreditXPath := IniRead(file, Sec.ML_XPATHS, LoopKey.FREE_CREDIT_XPATH, CommonDef.EMPTY)

    ; === Element IDs ===
    global loopScriptMarkerId    := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.SCRIPT_MARKER_ID, LoopDef.SCRIPT_MARKER_ID)
    global loopContainerId       := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.CONTAINER_ID, LoopDef.CONTAINER_ID)
    global loopStatusId          := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.STATUS_ID, LoopDef.STATUS_ID)
    global loopStartBtnId        := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.START_BTN_ID, LoopDef.START_BTN_ID)
    global loopStopBtnId         := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.STOP_BTN_ID, LoopDef.STOP_BTN_ID)
    global loopUpBtnId           := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.UP_BTN_ID, LoopDef.UP_BTN_ID)
    global loopDownBtnId         := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.DOWN_BTN_ID, LoopDef.DOWN_BTN_ID)
    global loopRecordIndicatorId := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.RECORD_INDICATOR_ID, LoopDef.RECORD_INDICATOR_ID)
    global loopJsExecutorId      := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.JS_EXECUTOR_ID, LoopDef.JS_EXECUTOR_ID)
    global loopJsExecuteBtnId    := IniRead(file, Sec.ML_ELEMENT_IDS, LoopKey.JS_EXECUTE_BTN_ID, LoopDef.JS_EXECUTE_BTN_ID)

    ; === Shortcuts ===
    global loopFocusTextboxKey  := IniRead(file, Sec.ML_SHORTCUTS, LoopKey.FOCUS_TEXTBOX_KEY, LoopDef.FOCUS_TEXTBOX_KEY)
    global loopStartKey         := IniRead(file, Sec.ML_SHORTCUTS, LoopKey.START_KEY, LoopDef.START_KEY)
    global loopStopKey          := IniRead(file, Sec.ML_SHORTCUTS, LoopKey.STOP_KEY, LoopDef.STOP_KEY)
    global loopShortcutModifier := IniRead(file, Sec.ML_SHORTCUTS, LoopKey.SHORTCUT_MODIFIER, LoopDef.SHORTCUT_MODIFIER)
    SubLog("LoopInterval: " loopIntervalMs "ms, WsCheck: " loopWsCheckIntervalMs "ms, Domain: " loopRequiredDomain)
}
