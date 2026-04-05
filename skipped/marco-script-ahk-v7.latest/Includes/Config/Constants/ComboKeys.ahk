; Config\Constants\ComboKeys.ahk - [ComboSwitch.*] key names

class ComboKey {
    ; XPaths
    static TRANSFER_XPATH        := "TransferButtonXPath"
    static PROJECT_NAME_XPATH    := "ProjectNameXPath"
    static COMBO1_XPATH          := "Combo1XPath"
    static COMBO2_XPATH          := "Combo2ButtonXPath"
    static OPTIONS_XPATH         := "OptionsContainerXPath"
    static CONFIRM_XPATH         := "ConfirmButtonXPath"

    ; Timing
    static POLL_INTERVAL         := "PollIntervalMs"
    static OPEN_MAX_ATTEMPTS     := "OpenMaxAttempts"
    static WAIT_MAX_ATTEMPTS     := "WaitMaxAttempts"
    static RETRY_COUNT           := "RetryCount"
    static RETRY_DELAY           := "RetryDelayMs"
    static CONFIRM_DELAY         := "ConfirmDelayMs"

    ; ElementIDs
    static SCRIPT_MARKER_ID      := "ScriptMarkerId"
    static BTN_CONTAINER_ID      := "ButtonContainerId"
    static BTN_UP_ID             := "ButtonUpId"
    static BTN_DOWN_ID           := "ButtonDownId"
    static JS_EXECUTOR_ID        := "JsExecutorId"
    static JS_EXECUTE_BTN_ID     := "JsExecuteBtnId"
    static PROGRESS_STATUS_ID    := "ProgressStatusId"

    ; Shortcuts
    static FOCUS_TEXTBOX_KEY     := "FocusTextboxKey"
    static COMBO_UP_KEY          := "ComboUpKey"
    static COMBO_DOWN_KEY        := "ComboDownKey"
    static SHORTCUT_MODIFIER     := "ShortcutModifier"
}
