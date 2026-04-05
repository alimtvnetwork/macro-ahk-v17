; Config\Constants\LoopKeys.ahk - [MacroLoop.*] key names

class LoopKey {
    ; Timing
    static LOOP_INTERVAL         := "LoopIntervalMs"
    static COUNTDOWN_INTERVAL    := "CountdownIntervalMs"
    static FIRST_CYCLE_DELAY     := "FirstCycleDelayMs"
    static POST_COMBO_DELAY      := "PostComboDelayMs"
    static PAGE_LOAD_DELAY       := "PageLoadDelayMs"
    static DIALOG_WAIT           := "DialogWaitMs"
    static WS_CHECK_INTERVAL     := "WorkspaceCheckIntervalMs"
    static SETTINGS_PAGE_LOAD_DELAY := "SettingsPageLoadDelayMs"

    ; URLs
    static REQUIRED_DOMAIN       := "RequiredDomain"
    static SETTINGS_TAB_PATH     := "SettingsTabPath"
    static DEFAULT_VIEW          := "DefaultView"

    ; XPaths
    static PROJECT_BTN_XPATH     := "ProjectButtonXPath"
    static MAIN_PROGRESS_XPATH   := "MainProgressXPath"
    static PROGRESS_XPATH        := "ProgressXPath"
    static WORKSPACE_XPATH       := "WorkspaceNameXPath"
    static WORKSPACE_NAV_XPATH   := "WorkspaceNavXPath"
    static PROMPT_ACTIVE_XPATH   := "PromptActiveXPath"
    static LOOP_CONTROLS_XPATH   := "LoopControlsXPath"
    static FREE_CREDIT_XPATH     := "FreeCreditProgressXPath"

    ; ElementIDs
    static SCRIPT_MARKER_ID      := "LoopScriptMarkerId"
    static CONTAINER_ID          := "LoopContainerId"
    static STATUS_ID             := "LoopStatusId"
    static START_BTN_ID          := "LoopStartBtnId"
    static STOP_BTN_ID           := "LoopStopBtnId"
    static UP_BTN_ID             := "LoopUpBtnId"
    static DOWN_BTN_ID           := "LoopDownBtnId"
    static RECORD_INDICATOR_ID   := "LoopRecordIndicatorId"
    static JS_EXECUTOR_ID        := "LoopJsExecutorId"
    static JS_EXECUTE_BTN_ID     := "LoopJsExecuteBtnId"

    ; Shortcuts
    static FOCUS_TEXTBOX_KEY     := "FocusTextboxKey"
    static START_KEY             := "StartKey"
    static STOP_KEY              := "StopKey"
    static SHORTCUT_MODIFIER     := "ShortcutModifier"
}
