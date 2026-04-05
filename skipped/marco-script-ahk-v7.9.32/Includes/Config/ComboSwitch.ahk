; Includes\Config\ComboSwitch.ahk - Load [ComboSwitch.*] sections

LoadComboSwitch(file) {
    InfoLog("Loading ComboSwitch sections")

    ; === XPaths ===
    global transferXPath    := IniRead(file, Sec.CS_XPATHS, ComboKey.TRANSFER_XPATH, CommonDef.EMPTY)
    global projectNameXPath := IniRead(file, Sec.CS_XPATHS, ComboKey.PROJECT_NAME_XPATH, CommonDef.EMPTY)
    global combo1XPath      := IniRead(file, Sec.CS_XPATHS, ComboKey.COMBO1_XPATH, CommonDef.EMPTY)
    global combo2XPath      := IniRead(file, Sec.CS_XPATHS, ComboKey.COMBO2_XPATH, CommonDef.EMPTY)
    global optionsXPath     := IniRead(file, Sec.CS_XPATHS, ComboKey.OPTIONS_XPATH, CommonDef.EMPTY)
    global confirmXPath     := IniRead(file, Sec.CS_XPATHS, ComboKey.CONFIRM_XPATH, CommonDef.EMPTY)
    SubLog("TransferXPath: " transferXPath)
    SubLog("ProjectNameXPath: " projectNameXPath)
    SubLog("Combo1XPath: " combo1XPath)
    SubLog("Combo2XPath: " combo2XPath)
    SubLog("OptionsXPath: " optionsXPath)
    SubLog("ConfirmXPath: " confirmXPath)

    ; === Element descriptor fallbacks ===
    LoadElementDescriptor(file, "ComboSwitch", "Transfer", ComboDef.TRANSFER_TEXT, ComboDef.TRANSFER_TAG, CommonDef.EMPTY)
    LoadElementDescriptor(file, "ComboSwitch", "Combo1", CommonDef.EMPTY, ComboDef.COMBO1_TAG, CommonDef.EMPTY)
    LoadElementDescriptor(file, "ComboSwitch", "Combo2", CommonDef.EMPTY, ComboDef.COMBO2_TAG, ComboDef.COMBO2_ROLE)
    LoadElementDescriptor(file, "ComboSwitch", "Options", CommonDef.EMPTY, CommonDef.EMPTY, ComboDef.OPTIONS_ROLE)
    LoadElementDescriptor(file, "ComboSwitch", "Confirm", ComboDef.CONFIRM_TEXT, ComboDef.CONFIRM_TAG, CommonDef.EMPTY)
    SubLog("Element descriptor fallbacks loaded")

    ; === Timing ===
    global ComboPollIntervalMs  := IniReadInt(file, Sec.CS_TIMING, ComboKey.POLL_INTERVAL, ComboDef.POLL_INTERVAL)
    global ComboOpenMaxAttempts := IniReadInt(file, Sec.CS_TIMING, ComboKey.OPEN_MAX_ATTEMPTS, ComboDef.OPEN_MAX_ATTEMPTS)
    global ComboWaitMaxAttempts := IniReadInt(file, Sec.CS_TIMING, ComboKey.WAIT_MAX_ATTEMPTS, ComboDef.WAIT_MAX_ATTEMPTS)
    global ComboRetryCount     := IniReadInt(file, Sec.CS_TIMING, ComboKey.RETRY_COUNT, ComboDef.RETRY_COUNT)
    global ComboRetryDelayMs   := IniReadInt(file, Sec.CS_TIMING, ComboKey.RETRY_DELAY, ComboDef.RETRY_DELAY)
    global ComboConfirmDelayMs := IniReadInt(file, Sec.CS_TIMING, ComboKey.CONFIRM_DELAY, ComboDef.CONFIRM_DELAY)
    SubLog("Poll: " ComboPollIntervalMs "ms, OpenMax: " ComboOpenMaxAttempts ", WaitMax: " ComboWaitMaxAttempts)

    ; === Element IDs ===
    global scriptMarkerId    := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.SCRIPT_MARKER_ID, ComboDef.SCRIPT_MARKER_ID)
    global buttonContainerId := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.BTN_CONTAINER_ID, ComboDef.BTN_CONTAINER_ID)
    global buttonUpId        := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.BTN_UP_ID, ComboDef.BTN_UP_ID)
    global buttonDownId      := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.BTN_DOWN_ID, ComboDef.BTN_DOWN_ID)
    global jsExecutorId      := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.JS_EXECUTOR_ID, ComboDef.JS_EXECUTOR_ID)
    global jsExecuteBtnId    := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.JS_EXECUTE_BTN_ID, ComboDef.JS_EXECUTE_BTN_ID)
    global progressStatusId  := IniRead(file, Sec.CS_ELEMENT_IDS, ComboKey.PROGRESS_STATUS_ID, ComboDef.PROGRESS_STATUS_ID)

    ; === Shortcuts ===
    global focusTextboxKey  := IniRead(file, Sec.CS_SHORTCUTS, ComboKey.FOCUS_TEXTBOX_KEY, ComboDef.FOCUS_TEXTBOX_KEY)
    global comboUpKey       := IniRead(file, Sec.CS_SHORTCUTS, ComboKey.COMBO_UP_KEY, ComboDef.COMBO_UP_KEY)
    global comboDownKey     := IniRead(file, Sec.CS_SHORTCUTS, ComboKey.COMBO_DOWN_KEY, ComboDef.COMBO_DOWN_KEY)
    global shortcutModifier := IniRead(file, Sec.CS_SHORTCUTS, ComboKey.SHORTCUT_MODIFIER, ComboDef.SHORTCUT_MODIFIER)
}
