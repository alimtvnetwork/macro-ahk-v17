; Includes\Config\Validate.ahk - Config validation on startup
; Checks required/optional keys exist, logs warnings, shows TrayTip on issues.

ValidateConfig() {
    global configFile
    fn := "ValidateConfig"
    InfoLog(fn ": Starting config validation")

    missingCount := 0
    warnCount := 0

    CheckRequired(section, key) {
        val := IniRead(configFile, section, key, CommonDef.MISSING)
        isMissing := (val = CommonDef.MISSING)
        if isMissing {
            WarnLog(fn ": MISSING required key [" section "] " key)
            return 1
        }
        isEmpty := (Trim(val) = "")
        if isEmpty {
            WarnLog(fn ": EMPTY required key [" section "] " key)
            return 1
        }
        return 0
    }

    CheckOptional(section, key) {
        val := IniRead(configFile, section, key, CommonDef.MISSING)
        isMissing := (val = CommonDef.MISSING)
        if isMissing {
            SubLog(fn ": optional key not set [" section "] " key)
            return 1
        }
        return 0
    }

    ; === Required keys ===
    missingCount += CheckRequired(Sec.GENERAL, GeneralKey.BROWSER_EXE)
    missingCount += CheckRequired(Sec.GENERAL, GeneralKey.SCRIPT_VERSION)

    missingCount += CheckRequired(Sec.HOTKEYS, HotkeyKey.COMBO_DOWN)
    missingCount += CheckRequired(Sec.HOTKEYS, HotkeyKey.COMBO_UP)

    missingCount += CheckRequired(Sec.CS_XPATHS, ComboKey.TRANSFER_XPATH)
    missingCount += CheckRequired(Sec.CS_XPATHS, ComboKey.COMBO1_XPATH)
    missingCount += CheckRequired(Sec.CS_XPATHS, ComboKey.COMBO2_XPATH)
    missingCount += CheckRequired(Sec.CS_XPATHS, ComboKey.OPTIONS_XPATH)
    missingCount += CheckRequired(Sec.CS_XPATHS, ComboKey.CONFIRM_XPATH)

    missingCount += CheckRequired(Sec.ML_URLS, LoopKey.REQUIRED_DOMAIN)
    missingCount += CheckRequired(Sec.ML_XPATHS, LoopKey.PROJECT_BTN_XPATH)
    missingCount += CheckRequired(Sec.ML_TIMING, LoopKey.LOOP_INTERVAL)

    missingCount += CheckRequired(Sec.AHK_TIMING, TimingKey.CONSOLE_OPEN_DELAY)
    missingCount += CheckRequired(Sec.AHK_TIMING, TimingKey.PASTE_DELAY)

    ; === Optional keys ===
    warnCount += CheckOptional(Sec.CS_TRANSFER, ElemKey.TEXT_MATCH)
    warnCount += CheckOptional(Sec.CS_TRANSFER, ElemKey.TAG)
    warnCount += CheckOptional(Sec.CS_COMBO1, ElemKey.SELECTOR)
    warnCount += CheckOptional(Sec.CS_COMBO2, ElemKey.SELECTOR)
    warnCount += CheckOptional(Sec.CS_OPTIONS, ElemKey.SELECTOR)
    warnCount += CheckOptional(Sec.CS_CONFIRM, ElemKey.TEXT_MATCH)
    warnCount += CheckOptional(Sec.CS_CONFIRM, ElemKey.SELECTOR)

    warnCount += CheckOptional(Sec.ML_XPATHS, LoopKey.MAIN_PROGRESS_XPATH)
    warnCount += CheckOptional(Sec.ML_XPATHS, LoopKey.PROGRESS_XPATH)
    warnCount += CheckOptional(Sec.ML_XPATHS, LoopKey.WORKSPACE_XPATH)
    warnCount += CheckOptional(Sec.ML_XPATHS, LoopKey.PROMPT_ACTIVE_XPATH)

    warnCount += CheckOptional(Sec.CR_API, CreditKey.API_BASE_URL)
    warnCount += CheckOptional(Sec.CR_API, CreditKey.AUTH_MODE)

    ; Summary
    hasIssues := (missingCount > 0)
    if hasIssues {
        ErrorLog(fn ": Validation found " missingCount " REQUIRED key(s) missing/empty, " warnCount " optional key(s) not set")
        TrayTip(missingCount " required config key(s) missing or empty.`nCheck logs for details.", "Config Validation Warning", 2)
    } else {
        infoMsg := "Validation passed"
        hasOptionalMissing := (warnCount > 0)
        if hasOptionalMissing
            infoMsg := infoMsg " (" warnCount " optional key(s) not set)"
        InfoLog(fn ": " infoMsg)
    }

    ; Verify enum classes are accessible
    ValidateEnums()
}

; ============================================
; Enum Validation - verify all static classes resolve at startup
; ============================================
ValidateEnums() {
    fn := "ValidateEnums"
    InfoLog(fn ": Checking enum classes")
    errors := 0

    ; ProgressStatus
    try {
        SubLog(fn ": ProgressStatus.IDLE=" ProgressStatus.IDLE
            . ", IN_PROGRESS=" ProgressStatus.IN_PROGRESS
            . ", DONE=" ProgressStatus.DONE
            . ", ERROR=" ProgressStatus.ERROR
            . ", TIMEOUT=" ProgressStatus.TIMEOUT)
    } catch as err {
        ErrorLog(fn ": ProgressStatus FAILED — " err.Message)
        errors++
    }

    ; LogLevel
    try {
        SubLog(fn ": LogLevel.INFO=" LogLevel.INFO
            . ", WARN=" LogLevel.WARN
            . ", ERROR=" LogLevel.ERROR
            . ", DEBUG=" LogLevel.DEBUG)
    } catch as err {
        ErrorLog(fn ": LogLevel FAILED — " err.Message)
        errors++
    }

    ; AuthMode
    try {
        SubLog(fn ": AuthMode.COOKIE_SESSION=" AuthMode.COOKIE_SESSION
            . ", TOKEN=" AuthMode.TOKEN)
    } catch as err {
        ErrorLog(fn ": AuthMode FAILED — " err.Message)
        errors++
    }

    hasErrors := (errors > 0)
    if hasErrors {
        ErrorLog(fn ": " errors " enum class(es) failed validation — halting script")
        result := MsgBox(errors " enum class(es) failed to load!`n`n"
            . "This usually means a Constants/ include file is missing or has a syntax error.`n"
            . "Check error.txt for details.`n`n"
            . "Click OK to exit, or Cancel to continue anyway.",
            "Automator - Enum Validation Failed", "OC Icon!")
        if (result = "OK")
            ExitApp
    } else {
        InfoLog(fn ": All enum classes OK")
    }
}
