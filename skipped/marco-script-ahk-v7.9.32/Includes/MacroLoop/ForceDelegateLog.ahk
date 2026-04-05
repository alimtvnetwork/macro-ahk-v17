; MacroLoop\ForceDelegateLog.ahk - Dedicated logging for Force Up/Down delegation
; DEPRECATED (v7.9.6): This module is deprecated.
; Only used by HandleDelegate (also deprecated). Kept for reference.
; Writes to logs/force_delegate.log with step number, action, WHY, and result.
;
; Format:
;   [2026-02-21 14:32:01] STEP 1/8: CLOSE DEVTOOLS
;     ACTION: Send F12
;     WHY: DevTools may steal keyboard focus — need clean slate for tab switching
;     RESULT: DevTools closed, waited 300ms

; ============================================
; Constants
; ============================================
global LOG_FILE_FORCE_DELEGATE := "\logs\force_delegate.log"

; ============================================
; ForceDelegateLog - Write a structured step entry
;
; Parameters:
;   step     - Step label, e.g. "STEP 1/8: CLOSE DEVTOOLS"
;   action   - What is being done, e.g. "Send F12"
;   why      - Why this action is needed
;   result   - Outcome of the action (can be empty if logging before action)
; ============================================
ForceDelegateLog(step, action, why, result := "") {
    global LOG_FILE_FORCE_DELEGATE

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    logFile := A_ScriptDir LOG_FILE_FORCE_DELEGATE

    entry := "[" timestamp "] " step "`n"
    entry .= "  ACTION: " action "`n"
    entry .= "  WHY: " why "`n"
    if (result != "")
        entry .= "  RESULT: " result "`n"
    entry .= "`n"

    try {
        FileAppend(entry, logFile)
    }

    ; Also write to main activity log for unified view
    InfoLog(step " | " action " | " result)
}

; ============================================
; ForceDelegateLogResult - Append a RESULT line to the last entry
; Use when the result is only known after the action executes.
; ============================================
ForceDelegateLogResult(result) {
    global LOG_FILE_FORCE_DELEGATE

    logFile := A_ScriptDir LOG_FILE_FORCE_DELEGATE

    entry := "  RESULT: " result "`n`n"

    try {
        FileAppend(entry, logFile)
    }
}

; ============================================
; ForceDelegateLogStart - Write a separator header for a new delegation
; ============================================
ForceDelegateLogStart(direction) {
    global LOG_FILE_FORCE_DELEGATE

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    logFile := A_ScriptDir LOG_FILE_FORCE_DELEGATE

    entry := "============================================================`n"
    entry .= "FORCE DELEGATE: " StrUpper(direction) " — " timestamp "`n"
    entry .= "============================================================`n`n"

    try {
        FileAppend(entry, logFile)
    }
}

; ============================================
; ForceDelegateLogEnd - Write a closing marker
; ============================================
ForceDelegateLogEnd(direction, success := true) {
    global LOG_FILE_FORCE_DELEGATE

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    logFile := A_ScriptDir LOG_FILE_FORCE_DELEGATE

    status := success ? "SUCCESS" : "FAILED"
    entry := "------------------------------------------------------------`n"
    entry .= "FORCE DELEGATE " StrUpper(direction) " " status " — " timestamp "`n"
    entry .= "------------------------------------------------------------`n`n"

    try {
        FileAppend(entry, logFile)
    }
}
