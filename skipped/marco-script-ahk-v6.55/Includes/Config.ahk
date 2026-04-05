; Includes\Config.ahk - Read all settings from config.ini
; WARNING: LoadConfig() must be called before any other operation.
;   All globals are set here. If config.ini is missing keys, defaults are used.

IniReadInt(file, section, key, default) {
    val := IniRead(file, section, key, default)
    pos := InStr(val, ";")
    hasComment := pos > 0
    if hasComment
        val := SubStr(val, 1, pos - 1)
    val := Trim(val)
    isEmpty := (val = "")
    if isEmpty
        return Integer(default)
    return Integer(val)
}

LoadConfig() {
    global configFile := A_ScriptDir "\config.ini"

    InfoLog("LoadConfig started, file: " configFile)

    ; === Hotkeys ===
    InfoLog("Loading Hotkeys section")
    global comboDownHotkey    := IniRead(configFile, "Hotkeys", "ComboDown", "^Down")
    global comboUpHotkey      := IniRead(configFile, "Hotkeys", "ComboUp", "^Up")
    global gmailUnreadHotkey  := IniRead(configFile, "Hotkeys", "GmailUnread", "^+F9")
    global macroLoopUpHotkey  := IniRead(configFile, "Hotkeys", "MacroLoopUp", "^+Up")
    global macroLoopDownHotkey := IniRead(configFile, "Hotkeys", "MacroLoopDown", "^+Down")
    global loopIntervalDecreaseHotkey := IniRead(configFile, "Hotkeys", "LoopIntervalDecrease", "^+[")
    global loopIntervalIncreaseHotkey := IniRead(configFile, "Hotkeys", "LoopIntervalIncrease", "^+]")
    global loopIntervalStep   := IniReadInt(configFile, "Hotkeys", "LoopIntervalStep", "5000")
    global delegateUpHotkey   := IniRead(configFile, "Hotkeys", "DelegateUp", "^+=")
    global delegateDownHotkey := IniRead(configFile, "Hotkeys", "DelegateDown", "^+-")
    global comboAltUpHotkey   := IniRead(configFile, "Hotkeys", "ComboAltUp", "^!Up")
    global comboAltDownHotkey := IniRead(configFile, "Hotkeys", "ComboAltDown", "^!Down")
    global useSmartShortcuts  := IniReadInt(configFile, "Hotkeys", "UseSmartShortcuts", "0")
    SubLog("ComboDown: " comboDownHotkey ", ComboUp: " comboUpHotkey ", SmartShortcuts: " useSmartShortcuts)

    ; === ComboSwitch ===
    InfoLog("Loading ComboSwitch section")
    global transferXPath := IniRead(configFile, "ComboSwitch", "TransferButtonXPath", "")
    global combo1XPath   := IniRead(configFile, "ComboSwitch", "Combo1XPath", "")
    global combo2XPath   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath", "")
    global optionsXPath  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath", "")
    global confirmXPath  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath", "")
    SubLog("TransferXPath: " transferXPath)
    SubLog("Combo1XPath: " combo1XPath)
    SubLog("Combo2XPath: " combo2XPath)
    SubLog("OptionsXPath: " optionsXPath)
    SubLog("ConfirmXPath: " confirmXPath)

    global ComboPollIntervalMs  := IniReadInt(configFile, "ComboSwitch", "ComboPollIntervalMs", "300")
    global ComboOpenMaxAttempts := IniReadInt(configFile, "ComboSwitch", "ComboOpenMaxAttempts", "20")
    global ComboWaitMaxAttempts := IniReadInt(configFile, "ComboSwitch", "ComboWaitMaxAttempts", "20")
    ; S-005: Auto-retry config
    global ComboRetryCount     := IniReadInt(configFile, "ComboSwitch", "ComboRetryCount", "2")
    global ComboRetryDelayMs   := IniReadInt(configFile, "ComboSwitch", "ComboRetryDelayMs", "1000")
    global ComboConfirmDelayMs := IniReadInt(configFile, "ComboSwitch", "ComboConfirmDelayMs", "500")

    global scriptMarkerId    := IniRead(configFile, "ComboSwitch", "ScriptMarkerId", "ahk-combo-script")
    global buttonContainerId := IniRead(configFile, "ComboSwitch", "ButtonContainerId", "ahk-combo-btn-container")
    global buttonUpId        := IniRead(configFile, "ComboSwitch", "ButtonUpId", "ahk-combo-up-btn")
    global buttonDownId      := IniRead(configFile, "ComboSwitch", "ButtonDownId", "ahk-combo-down-btn")
    global jsExecutorId      := IniRead(configFile, "ComboSwitch", "JsExecutorId", "ahk-js-executor")
    global jsExecuteBtnId    := IniRead(configFile, "ComboSwitch", "JsExecuteBtnId", "ahk-js-execute-btn")

    global focusTextboxKey  := IniRead(configFile, "ComboSwitch", "FocusTextboxKey", "/")
    global comboUpKey       := IniRead(configFile, "ComboSwitch", "ComboUpKey", "ArrowUp")
    global comboDownKey     := IniRead(configFile, "ComboSwitch", "ComboDownKey", "ArrowDown")
    global shortcutModifier := IniRead(configFile, "ComboSwitch", "ShortcutModifier", "none")
    SubLog("Poll: " ComboPollIntervalMs "ms, OpenMax: " ComboOpenMaxAttempts ", WaitMax: " ComboWaitMaxAttempts)

    ; === MacroLoop ===
    InfoLog("Loading MacroLoop section")
    global loopIntervalMs          := IniReadInt(configFile, "MacroLoop", "LoopIntervalMs", "15000")
    global loopCountdownIntervalMs := IniReadInt(configFile, "MacroLoop", "CountdownIntervalMs", "1000")
    global loopFirstCycleDelayMs   := IniReadInt(configFile, "MacroLoop", "FirstCycleDelayMs", "500")
    global loopPostComboDelayMs    := IniReadInt(configFile, "MacroLoop", "PostComboDelayMs", "4000")
    global loopPageLoadDelayMs     := IniReadInt(configFile, "MacroLoop", "PageLoadDelayMs", "2500")
    global loopDialogWaitMs        := IniReadInt(configFile, "MacroLoop", "DialogWaitMs", "2000")
    global loopWsCheckIntervalMs   := IniReadInt(configFile, "MacroLoop", "WorkspaceCheckIntervalMs", "5000")

    global loopRequiredDomain  := IniRead(configFile, "MacroLoop", "RequiredDomain", "https://lovable.dev/")
    global loopSettingsTabPath := IniRead(configFile, "MacroLoop", "SettingsTabPath", "/settings?tab=project")
    global loopDefaultView     := IniRead(configFile, "MacroLoop", "DefaultView", "?view=codeEditor")
    global loopProjectButtonXPath := IniRead(configFile, "MacroLoop", "ProjectButtonXPath", "")
    global loopMainProgressXPath := IniRead(configFile, "MacroLoop", "MainProgressXPath", "")
    global loopProgressXPath   := IniRead(configFile, "MacroLoop", "ProgressXPath", "")
    global loopWorkspaceXPath  := IniRead(configFile, "MacroLoop", "WorkspaceNameXPath", "")
    global loopWorkspaceNavXPath := IniRead(configFile, "MacroLoop", "WorkspaceNavXPath", "")
    global loopPromptActiveXPath := IniRead(configFile, "MacroLoop", "PromptActiveXPath", "")
    global loopControlsXPath   := IniRead(configFile, "MacroLoop", "LoopControlsXPath", "")

    global loopScriptMarkerId    := IniRead(configFile, "MacroLoop", "LoopScriptMarkerId", "ahk-loop-script")
    global loopContainerId       := IniRead(configFile, "MacroLoop", "LoopContainerId", "ahk-loop-container")
    global loopStatusId          := IniRead(configFile, "MacroLoop", "LoopStatusId", "ahk-loop-status")
    global loopStartBtnId        := IniRead(configFile, "MacroLoop", "LoopStartBtnId", "ahk-loop-start-btn")
    global loopStopBtnId         := IniRead(configFile, "MacroLoop", "LoopStopBtnId", "ahk-loop-stop-btn")
    global loopUpBtnId           := IniRead(configFile, "MacroLoop", "LoopUpBtnId", "ahk-loop-up-btn")
    global loopDownBtnId         := IniRead(configFile, "MacroLoop", "LoopDownBtnId", "ahk-loop-down-btn")
    global loopRecordIndicatorId := IniRead(configFile, "MacroLoop", "LoopRecordIndicatorId", "ahk-loop-record")
    global loopJsExecutorId      := IniRead(configFile, "MacroLoop", "LoopJsExecutorId", "ahk-loop-js-executor")
    global loopJsExecuteBtnId    := IniRead(configFile, "MacroLoop", "LoopJsExecuteBtnId", "ahk-loop-js-execute-btn")

    global loopFocusTextboxKey  := IniRead(configFile, "MacroLoop", "LoopFocusTextboxKey", "/")
    global loopStartKey         := IniRead(configFile, "MacroLoop", "LoopStartKey", "s")
    global loopStopKey          := IniRead(configFile, "MacroLoop", "LoopStopKey", "x")
    global loopShortcutModifier := IniRead(configFile, "MacroLoop", "LoopShortcutModifier", "none")
    SubLog("LoopInterval: " loopIntervalMs "ms, WsCheck: " loopWsCheckIntervalMs "ms, Domain: " loopRequiredDomain)

    ; === Credit Status ===
    InfoLog("Loading CreditStatus section")
    global creditApiBaseUrl       := IniRead(configFile, "CreditStatus", "LovableApiBaseUrl", "https://api.lovable.dev")
    global creditAuthMode         := IniRead(configFile, "CreditStatus", "LovableAuthMode", "cookieSession")
    global creditBearerToken      := IniRead(configFile, "CreditStatus", "LovableBearerToken", "")
    global creditAutoCheckEnabled := IniRead(configFile, "CreditStatus", "CreditsAutoCheckEnabled", "1")
    global creditAutoCheckInterval := IniRead(configFile, "CreditStatus", "CreditsAutoCheckIntervalSeconds", "60")
    global creditCacheTtl         := IniRead(configFile, "CreditStatus", "CreditsStatusCacheTtlSeconds", "30")
    global creditMaxRetries       := IniRead(configFile, "CreditStatus", "MaxRetries", "2")
    global creditRetryBackoff     := IniRead(configFile, "CreditStatus", "RetryBackoffMs", "1000")
    global creditPlansXPath       := IniRead(configFile, "CreditStatus", "PlansButtonXPath", "")
    global creditFreeXPath        := IniRead(configFile, "CreditStatus", "FreeProgressBarXPath", "")
    global creditTotalXPath       := IniRead(configFile, "CreditStatus", "TotalCreditsXPath", "")
    SubLog("CreditAuth: " creditAuthMode ", AutoCheck: " creditAutoCheckEnabled ", Interval: " creditAutoCheckInterval "s")

    ; === AHK Timing ===
    InfoLog("Loading AHK section")
    global consoleOpenDelayMs    := IniReadInt(configFile, "AHK", "ConsoleOpenDelayMs", "800")
    global pasteDelayMs          := IniReadInt(configFile, "AHK", "PasteDelayMs", "200")
    global executeDelayMs        := IniReadInt(configFile, "AHK", "ExecuteDelayMs", "300")
    global browserActivateDelayMs := IniReadInt(configFile, "AHK", "BrowserActivateDelayMs", "150")
    global addressBarDelayMs     := IniReadInt(configFile, "AHK", "AddressBarDelayMs", "100")
    global delegateTabSwitchDelayMs := IniReadInt(configFile, "AHK", "DelegateTabSwitchDelayMs", "300")
    global delegateMaxTabSearch  := IniReadInt(configFile, "AHK", "DelegateMaxTabSearch", "10")
    SubLog("ConsoleOpen: " consoleOpenDelayMs "ms, Paste: " pasteDelayMs "ms, BrowserActivate: " browserActivateDelayMs "ms")

    ; === Gmail ===
    InfoLog("Loading Gmail section")
    global gmailUrl          := IniRead(configFile, "Gmail", "URL", "https://mail.google.com")
    global gmailSearch       := IniRead(configFile, "Gmail", "SearchQuery", "in:inbox is:unread")
    global gmailOpenDelayMs  := IniReadInt(configFile, "Gmail", "OpenDelayMs", "1500")
    global gmailSlashDelayMs := IniReadInt(configFile, "Gmail", "SlashDelayMs", "500")
    global gmailTypeDelayMs  := IniReadInt(configFile, "Gmail", "TypeDelayMs", "300")
    global gmailEnterDelayMs := IniReadInt(configFile, "Gmail", "EnterDelayMs", "100")
    SubLog("Gmail URL: " gmailUrl)

    ; === General ===
    InfoLog("Loading General section")
    global browserExe := IniRead(configFile, "General", "BrowserExe", "chrome.exe")
    global scriptVersion := IniRead(configFile, "General", "ScriptVersion", "4.8")
    global debugMode := IniReadInt(configFile, "General", "Debug", "1")
    global configWatchIntervalMs := IniReadInt(configFile, "General", "ConfigWatchIntervalMs", "2000")
    SubLog("Browser: " browserExe ", Version: " scriptVersion ", Debug: " debugMode ", ConfigWatch: " configWatchIntervalMs "ms")

    InfoLog("LoadConfig completed successfully")
}

; ============================================
; Config Hot-Reload: Watch config.ini for changes
; Uses file modification timestamp comparison
; WARNING: Re-reads ALL config values on change.
;   Does NOT re-register hotkeys (requires script reload).
; ============================================
global configLastModified := ""
global configWatcherRunning := false

StartConfigWatcher() {
    global configFile, configWatchIntervalMs, configLastModified, configWatcherRunning

    isDisabled := configWatchIntervalMs <= 0
    if isDisabled {
        InfoLog("Config watcher disabled (interval: 0)")
        return
    }

    ; Record initial modification time
    configLastModified := FileGetTime(configFile, "M")
    configWatcherRunning := true
    InfoLog("Config watcher started, interval: " configWatchIntervalMs "ms, timestamp: " configLastModified)
    SetTimer(CheckConfigModified, configWatchIntervalMs)
}

StopConfigWatcher() {
    global configWatcherRunning
    isRunning := !!configWatcherRunning
    if isRunning {
        SetTimer(CheckConfigModified, 0)
        configWatcherRunning := false
        InfoLog("Config watcher stopped")
    }
}

CheckConfigModified() {
    global configFile, configLastModified

    try {
        currentModified := FileGetTime(configFile, "M")
    } catch {
        return
    }

    hasChanged := currentModified != configLastModified
    if !hasChanged
        return

    InfoLog("Config changed, previous: " configLastModified ", current: " currentModified)
    configLastModified := currentModified

    ; Reload config values (non-hotkey values only — hotkeys need script reload)
    try {
        LoadConfig()
        InfoLog("Config hot-reloaded successfully")
        ShowTooltip("Config reloaded", 1500)
        TrayTip("config.ini reloaded.`nNote: Hotkey changes require script reload.", "Config Hot-Reload", 1)
    } catch as err {
        ErrorLog("Config hot-reload FAILED: " err.Message)
        TrayTip("config.ini reload failed: " err.Message, "Config Error", 3)
    }
}