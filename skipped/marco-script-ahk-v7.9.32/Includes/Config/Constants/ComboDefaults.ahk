; Config\Constants\ComboDefaults.ahk - [ComboSwitch.*] default values

class ComboDef {
    ; Timing
    static POLL_INTERVAL         := "300"
    static OPEN_MAX_ATTEMPTS     := "20"
    static WAIT_MAX_ATTEMPTS     := "20"
    static RETRY_COUNT           := "2"
    static RETRY_DELAY           := "1000"
    static CONFIRM_DELAY         := "500"

    ; ElementIDs
    static SCRIPT_MARKER_ID      := "ahk-combo-script"
    static BTN_CONTAINER_ID      := "ahk-combo-btn-container"
    static BTN_UP_ID             := "ahk-combo-up-btn"
    static BTN_DOWN_ID           := "ahk-combo-down-btn"
    static JS_EXECUTOR_ID        := "ahk-js-executor"
    static JS_EXECUTE_BTN_ID     := "ahk-js-execute-btn"
    static PROGRESS_STATUS_ID    := "__combo_progress_status__"

    ; Shortcuts
    static FOCUS_TEXTBOX_KEY     := "/"
    static COMBO_UP_KEY          := "ArrowUp"
    static COMBO_DOWN_KEY        := "ArrowDown"
    static SHORTCUT_MODIFIER     := "none"

    ; Element Descriptors
    static TRANSFER_TEXT         := "Transfer|Transfer project"
    static TRANSFER_TAG          := "button"
    static COMBO1_TAG            := "p"
    static COMBO2_TAG            := "button"
    static COMBO2_ROLE           := "combobox"
    static OPTIONS_ROLE          := "listbox"
    static CONFIRM_TEXT          := "Confirm|Confirm transfer|Save"
    static CONFIRM_TAG           := "button"
}
