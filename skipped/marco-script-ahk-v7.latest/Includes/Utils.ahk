; Includes\Utils.ahk - Utility Functions
; Logging framework, error handling, and common helpers
;
; WARNING: Every log function writes to logs/activity.txt.
;   ErrorLog also writes to logs/error.txt.
;   DebugLog only writes when debugMode=1.
;   LogKeyPress uses FormatHotkeyLabel to produce human-readable key names.

; ============================================
; Constants (LogLevel enum is in Config\Constants\LogLevel.ahk)
; ============================================

global LOG_FILE_ACTIVITY := "\logs\activity.txt"
global LOG_FILE_ERROR    := "\logs\error.txt"

global LOG_INDENT_CHAR := "  "

; ============================================
; Global Error Handler
; ============================================
OnError(HandleUncaughtError)

HandleUncaughtError(exception, mode) {
    global scriptVersion

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    errorFile := logsDir "\error.txt"

    errorMsg := "========================================`n"
    errorMsg .= "CRASH REPORT - " timestamp "`n"
    errorMsg .= "Script Version: " (scriptVersion ? scriptVersion : "unknown") "`n"
    errorMsg .= "========================================`n"
    errorMsg .= "Error Message: " exception.Message "`n"
    errorMsg .= "Error What: " exception.What "`n"
    errorMsg .= "Error File: " exception.File "`n"
    errorMsg .= "Error Line: " exception.Line "`n"
    errorMsg .= "Error Extra: " exception.Extra "`n"
    errorMsg .= "----------------------------------------`n"
    errorMsg .= "Stack Trace:`n"
    errorMsg .= exception.Stack "`n"
    errorMsg .= "========================================`n`n"

    try {
        FileAppend(errorMsg, errorFile)
    }

    MsgBox(
        "Script crashed!`n`n" .
        "Error: " exception.Message "`n" .
        "File: " exception.File "`n" .
        "Line: " exception.Line "`n`n" .
        "Full details saved to:`n" errorFile,
        "Automator Crash - v" (scriptVersion ? scriptVersion : "?"),
        16
    )

    return 1
}

; ============================================
; Extract module name from caller stack
; Returns function name or file name (without extension)
; ============================================
GetModuleName(skipFrames := 4) {
    try {
        err := Error("trace")
        stack := err.Stack
        lines := StrSplit(stack, "`n")
        lineCount := lines.Length

        targetFrame := skipFrames
        isFrameAvailable := lineCount >= targetFrame
        if isFrameAvailable {
            callerLine := lines[targetFrame]
        } else {
            isFallbackAvailable := lineCount >= 3
            if isFallbackAvailable {
                callerLine := lines[lineCount]
            } else {
                return ""
            }
        }

        callerLine := Trim(callerLine)
        isLineEmpty := (callerLine = "")
        if isLineEmpty
            return ""

        hasAtSign := InStr(callerLine, " at ")
        if hasAtSign {
            parts := StrSplit(callerLine, " at ")
            isPartsValid := parts.Length >= 2
            if isPartsValid {
                funcName := Trim(parts[1])
                ; Return function name if available
                isFuncPresent := (funcName != "")
                if isFuncPresent
                    return funcName
            }
        }

        return ""
    } catch {
        return ""
    }
}

; ============================================
; Clean message: strip leading "  > " prefix
; ============================================
CleanLogMessage(msg) {
    ; Strip "  > " prefix if present
    if SubStr(msg, 1, 4) = "  > "
        msg := SubStr(msg, 5)
    ; Also strip "> " if msg starts with it
    else if SubStr(msg, 1, 2) = "> "
        msg := SubStr(msg, 3)
    return msg
}

; ============================================
; Core Log function - writes to logs/activity.txt
; Format: [timestamp] [LEVEL] [Module] message
; ============================================
WriteLog(level, msg, callerOverride := "") {
    global scriptVersion, LOG_FILE_ACTIVITY

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    logFile := A_ScriptDir LOG_FILE_ACTIVITY

    ; Clean the message
    msg := CleanLogMessage(msg)

    ; Get module name
    moduleName := ""
    if (callerOverride != "") {
        ; Extract function name from override like "[file:line func]"
        moduleName := callerOverride
    } else {
        moduleName := GetModuleName()
    }

    ; Format: [timestamp] [LEVEL] [Module] message
    logLine := "[" timestamp "] [" level "]"
    if (moduleName != "")
        logLine .= " [" moduleName "]"
    logLine .= " " msg "`n"

    try {
        FileAppend(logLine, logFile)
    }
}

; ============================================
; Dedicated Log Functions
; ============================================
InfoLog(msg, callerOverride := "") {
    WriteLog(LogLevel.INFO, msg, callerOverride)
}

WarnLog(msg, callerOverride := "") {
    WriteLog(LogLevel.WARN, msg, callerOverride)
}

ErrorLog(msg, callerOverride := "") {
    global LOG_FILE_ERROR

    WriteLog(LogLevel.ERROR, msg, callerOverride)

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    errorFile := A_ScriptDir LOG_FILE_ERROR

    msg := CleanLogMessage(msg)

    ; Build error entry with stack trace
    errorEntry := "[" timestamp "] " msg "`n"
    try {
        err := Error("trace")
        errorEntry .= "  Stack: " err.Stack "`n"
    }

    try {
        FileAppend(errorEntry, errorFile)
    }
}

DebugLog(msg, callerOverride := "") {
    global debugMode

    isDebugEnabled := !!debugMode
    if isDebugEnabled {
        WriteLog(LogLevel.DEBUG, msg, callerOverride)
    }
}

; ============================================
; Indented Sub-action Log
; Use for child actions within a parent operation
; Format: "  HH:mm message" (no seconds, no level tag, no caller)
;
; Indentation Levels:
;   Level 1: "  "           - Direct sub-action of a main log
;   Level 2: "    "         - Detail within a sub-action
;   Level 3: "      "       - Nested detail (e.g. XPath result)
;   Level 4: "        "     - Deep nested detail (e.g. element attribute)
; ============================================
SubLog(msg, indent := 1, callerOverride := "") {
    global LOG_FILE_ACTIVITY

    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing
        DirCreate(logsDir)

    timestamp := FormatTime(, "HH:mm")
    logFile := A_ScriptDir LOG_FILE_ACTIVITY

    prefix := ""
    Loop indent {
        prefix .= LOG_INDENT_CHAR
    }

    logLine := prefix timestamp " " msg "`n"

    try {
        FileAppend(logLine, logFile)
    }
}

SubDebugLog(msg, indent := 1, callerOverride := "") {
    global debugMode, LOG_FILE_ACTIVITY
    isDebugEnabled := !!debugMode
    if isDebugEnabled {
        logsDir := A_ScriptDir "\logs"
        isDirMissing := !DirExist(logsDir)
        if isDirMissing
            DirCreate(logsDir)

        timestamp := FormatTime(, "HH:mm")
        logFile := A_ScriptDir LOG_FILE_ACTIVITY

        prefix := ""
        Loop indent {
            prefix .= LOG_INDENT_CHAR
        }

        logLine := prefix timestamp " " msg "`n"

        try {
            FileAppend(logLine, logFile)
        }
    }
}

; ============================================
; Key Press Logger
; WARNING: Calls FormatHotkeyLabel() to produce human-readable output
; Example: LogKeyPress("^+j") logs "Sending key: Ctrl + Shift + J"
; ============================================
LogKeyPress(hotkeyStr, context := "") {
    friendlyKey := FormatHotkeyLabel(hotkeyStr)
    msg := "Sending: " friendlyKey
    isContextProvided := (context != "")
    if isContextProvided
        msg .= " (" context ")"
    InfoLog(msg)
}

; ============================================
; SendKey - Log + Send in one call
; Replaces the repetitive LogKeyPress() + Send() pattern
; WARNING: Sends a keyboard shortcut AND logs it in one call.
; ============================================
SendKey(key, context := "") {
    LogKeyPress(key, context)
    Send(key)
}

; ============================================
; Send debug log to browser UI (JavaScript console)
; DISABLED: Was opening/closing DevTools on EVERY log message
; causing multiple console windows. Logs go to file only now.
; ============================================
SendDebugToUI(msg, level := LogLevel.DEBUG) {
    return
}

; ============================================
; Toggle debug mode and persist to config.ini
; ============================================
ToggleDebugMode() {
    global debugMode, configFile

    previousState := debugMode
    debugMode := !debugMode

    try {
        IniWrite(debugMode ? "1" : "0", configFile, "General", "Debug")

        status := debugMode ? "ENABLED" : "DISABLED"
        InfoLog("Debug mode toggled: " previousState " -> " debugMode " (" status ")")
        ShowTooltip("Debug Mode " status, 2000)

        UpdateDebugMenuCheckmark()
    } catch as err {
        ErrorLog("Failed to toggle debug mode: " err.Message)
        ShowTooltip("Error toggling debug mode")
    }
}

; ============================================
; Safe function wrapper - catches errors
; WARNING: This invokes the function by name dynamically.
; ============================================
SafeCall(funcName, params*) {
    InfoLog("SafeCall invoking: " funcName)
    try {
        result := %funcName%(params*)
        InfoLog("SafeCall completed: " funcName)
        return result
    } catch as err {
        ErrorLog("SafeCall FAILED for " funcName ": " err.Message)
        SubLog("File: " err.File ", Line: " err.Line, 1)
        SubLog("Stack: " err.Stack, 1)
        throw err
    }
}

; ============================================
; Show Tooltip Helper (unified)
; ============================================
ShowTooltip(msg, duration := 2000) {
    InfoLog("Tooltip: " msg)
    ToolTip(msg)
    SetTimer(ClearTooltipCallback, -duration)
}

ClearTooltipCallback() {
    ToolTip()
}