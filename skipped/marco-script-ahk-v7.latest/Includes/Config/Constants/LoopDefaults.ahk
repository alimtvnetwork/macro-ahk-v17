; Config\Constants\LoopDefaults.ahk - [MacroLoop.*] default values

class LoopDef {
    ; Timing
    static LOOP_INTERVAL         := "15000"
    static COUNTDOWN_INTERVAL    := "1000"
    static FIRST_CYCLE_DELAY     := "500"
    static POST_COMBO_DELAY      := "4000"
    static PAGE_LOAD_DELAY       := "2500"
    static DIALOG_WAIT           := "2000"
    static WS_CHECK_INTERVAL     := "5000"
    static SETTINGS_PAGE_LOAD_DELAY := "3000"

    ; URLs
    static REQUIRED_DOMAIN       := "https://lovable.dev/"
    static SETTINGS_TAB_PATH     := "/settings?tab=project"
    static DEFAULT_VIEW          := "?view=codeEditor"

    ; ElementIDs
    static SCRIPT_MARKER_ID      := "ahk-loop-script"
    static CONTAINER_ID          := "ahk-loop-container"
    static STATUS_ID             := "ahk-loop-status"
    static START_BTN_ID          := "ahk-loop-start-btn"
    static STOP_BTN_ID           := "ahk-loop-stop-btn"
    static UP_BTN_ID             := "ahk-loop-up-btn"
    static DOWN_BTN_ID           := "ahk-loop-down-btn"
    static RECORD_INDICATOR_ID   := "ahk-loop-record"
    static JS_EXECUTOR_ID        := "ahk-loop-js-executor"
    static JS_EXECUTE_BTN_ID     := "ahk-loop-js-execute-btn"

    ; Shortcuts
    static FOCUS_TEXTBOX_KEY     := "/"
    static START_KEY             := "s"
    static STOP_KEY              := "x"
    static SHORTCUT_MODIFIER     := "none"
}
