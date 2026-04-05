; Includes\Config\Validate.ahk - Config validation on startup
; Checks required/optional keys exist AND validates type/format.
; Schema types: int, posint, url, xpath, hotkey, bool01, enum, string, version

ValidateConfig() {
    global configFile
    fn := "ValidateConfig"
    InfoLog(fn ": Starting config validation (presence + schema)")

    missingCount := 0
    warnCount := 0
    schemaErrors := 0

    ; ============================================
    ; Presence Checks (existing)
    ; ============================================

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

    ; ============================================
    ; Schema Type Validators (S-013)
    ; ============================================

    ; Read raw value (returns "" if missing/empty, strips inline comments)
    ReadRaw(section, key) {
        val := IniRead(configFile, section, key, "")
        pos := InStr(val, ";")
        hasComment := pos > 0
        if hasComment
            val := SubStr(val, 1, pos - 1)
        return Trim(val)
    }

    ; Validate a key's value against a type. Returns 1 on error, 0 on pass.
    ; Types: "int" | "posint" | "url" | "xpath" | "hotkey" | "bool01" | "enum:a,b,c" | "version"
    ; skipIfEmpty: if true, empty/missing values are OK (for optional keys)
    ValidateType(section, key, schemaType, skipIfEmpty := false) {
        val := ReadRaw(section, key)
        isEmpty := (val = "")
        if isEmpty {
            if skipIfEmpty
                return 0
            ; Required keys already flagged by CheckRequired, skip double-logging
            return 0
        }

        ; --- int: any integer (including 0, negative) ---
        isIntType := (schemaType = "int")
        if isIntType {
            isValid := RegExMatch(val, "^-?\d+$")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected integer")
                return 1
            }
            return 0
        }

        ; --- posint: positive integer (>= 0) ---
        isPosIntType := (schemaType = "posint")
        if isPosIntType {
            isValid := RegExMatch(val, "^\d+$")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected positive integer")
                return 1
            }
            return 0
        }

        ; --- url: starts with http:// or https:// ---
        isUrlType := (schemaType = "url")
        if isUrlType {
            isValid := RegExMatch(val, "^https?://")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected URL (http/https)")
                return 1
            }
            return 0
        }

        ; --- xpath: starts with / ---
        isXPathType := (schemaType = "xpath")
        if isXPathType {
            isValid := (SubStr(val, 1, 1) = "/")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected XPath (starts with /)")
                return 1
            }
            return 0
        }

        ; --- hotkey: AHK hotkey format (contains ^, !, +, #, or single key) ---
        isHotkeyType := (schemaType = "hotkey")
        if isHotkeyType {
            ; Basic check: non-empty and contains at least one alphanumeric or modifier
            isValid := RegExMatch(val, "[a-zA-Z0-9\^\!\+\#\[\]]")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected hotkey string")
                return 1
            }
            return 0
        }

        ; --- bool01: must be 0 or 1 ---
        isBoolType := (schemaType = "bool01")
        if isBoolType {
            isValid := (val = "0" || val = "1")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected 0 or 1")
                return 1
            }
            return 0
        }

        ; --- version: semver-like (N.N or N.N.N) ---
        isVersionType := (schemaType = "version")
        if isVersionType {
            isValid := RegExMatch(val, "^\d+\.\d+(\.\d+)?$")
            if !isValid {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected version (N.N or N.N.N)")
                return 1
            }
            return 0
        }

        ; --- enum:val1,val2,val3 ---
        isEnumType := (SubStr(schemaType, 1, 5) = "enum:")
        if isEnumType {
            allowed := SubStr(schemaType, 6)
            ; Check if val is in the comma-separated list
            found := false
            Loop Parse, allowed, ","
            {
                if (Trim(A_LoopField) = val) {
                    found := true
                    break
                }
            }
            if !found {
                WarnLog(fn ": SCHEMA [" section "] " key " = '" val "' — expected one of: " allowed)
                return 1
            }
            return 0
        }

        ; --- string: always passes (default) ---
        return 0
    }

    ; === Required keys (presence check) ===
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

    ; === Optional keys (presence check) ===
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

    ; ============================================
    ; Schema Validation (S-013) — type/format checks
    ; ============================================
    InfoLog(fn ": Running schema type validation")

    ; [General]
    schemaErrors += ValidateType(Sec.GENERAL, GeneralKey.SCRIPT_VERSION, "version")
    schemaErrors += ValidateType(Sec.GENERAL, "Debug", "bool01", true)
    schemaErrors += ValidateType(Sec.GENERAL, "ConfigWatchIntervalMs", "posint", true)

    ; [Hotkeys] — all hotkey format
    schemaErrors += ValidateType(Sec.HOTKEYS, HotkeyKey.COMBO_DOWN, "hotkey")
    schemaErrors += ValidateType(Sec.HOTKEYS, HotkeyKey.COMBO_UP, "hotkey")
    schemaErrors += ValidateType(Sec.HOTKEYS, "GmailUnread", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "MacroLoopUp", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "MacroLoopDown", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "LoopIntervalDecrease", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "LoopIntervalIncrease", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "LoopIntervalStep", "posint", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "DelegateUp", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "DelegateDown", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "ComboAltUp", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "ComboAltDown", "hotkey", true)
    schemaErrors += ValidateType(Sec.HOTKEYS, "UseSmartShortcuts", "bool01", true)

    ; [ComboSwitch.XPaths] — all xpath format
    schemaErrors += ValidateType(Sec.CS_XPATHS, ComboKey.TRANSFER_XPATH, "xpath")
    schemaErrors += ValidateType(Sec.CS_XPATHS, "ProjectNameXPath", "xpath", true)
    schemaErrors += ValidateType(Sec.CS_XPATHS, ComboKey.COMBO1_XPATH, "xpath")
    schemaErrors += ValidateType(Sec.CS_XPATHS, ComboKey.COMBO2_XPATH, "xpath")
    schemaErrors += ValidateType(Sec.CS_XPATHS, ComboKey.OPTIONS_XPATH, "xpath")
    schemaErrors += ValidateType(Sec.CS_XPATHS, ComboKey.CONFIRM_XPATH, "xpath")

    ; [ComboSwitch.Timing] — all posint
    schemaErrors += ValidateType(Sec.CS_TIMING, "PollIntervalMs", "posint", true)
    schemaErrors += ValidateType(Sec.CS_TIMING, "OpenMaxAttempts", "posint", true)
    schemaErrors += ValidateType(Sec.CS_TIMING, "WaitMaxAttempts", "posint", true)
    schemaErrors += ValidateType(Sec.CS_TIMING, "RetryCount", "posint", true)
    schemaErrors += ValidateType(Sec.CS_TIMING, "RetryDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.CS_TIMING, "ConfirmDelayMs", "posint", true)

    ; [ComboSwitch.Shortcuts]
    schemaErrors += ValidateType(Sec.CS_SHORTCUTS, "ShortcutModifier", "enum:none,ctrl,alt,shift", true)

    ; [MacroLoop.Timing] — all posint
    schemaErrors += ValidateType(Sec.ML_TIMING, LoopKey.LOOP_INTERVAL, "posint")
    schemaErrors += ValidateType(Sec.ML_TIMING, "CountdownIntervalMs", "posint", true)
    schemaErrors += ValidateType(Sec.ML_TIMING, "FirstCycleDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.ML_TIMING, "PostComboDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.ML_TIMING, "PageLoadDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.ML_TIMING, "DialogWaitMs", "posint", true)
    schemaErrors += ValidateType(Sec.ML_TIMING, "WorkspaceCheckIntervalMs", "posint", true)

    ; [MacroLoop.URLs]
    schemaErrors += ValidateType(Sec.ML_URLS, LoopKey.REQUIRED_DOMAIN, "url")

    ; [MacroLoop.XPaths] — all xpath (skip if empty for optional ones)
    schemaErrors += ValidateType(Sec.ML_XPATHS, LoopKey.PROJECT_BTN_XPATH, "xpath")
    schemaErrors += ValidateType(Sec.ML_XPATHS, LoopKey.MAIN_PROGRESS_XPATH, "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, LoopKey.PROGRESS_XPATH, "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, LoopKey.WORKSPACE_XPATH, "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, "WorkspaceNavXPath", "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, "FreeCreditProgressXPath", "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, "PromptActiveXPath", "xpath", true)
    schemaErrors += ValidateType(Sec.ML_XPATHS, "LoopControlsXPath", "xpath", true)

    ; [MacroLoop.Shortcuts]
    schemaErrors += ValidateType(Sec.ML_SHORTCUTS, "ShortcutModifier", "enum:none,ctrl,alt,shift", true)

    ; [AHK.Timing] — all posint
    schemaErrors += ValidateType(Sec.AHK_TIMING, TimingKey.CONSOLE_OPEN_DELAY, "posint")
    schemaErrors += ValidateType(Sec.AHK_TIMING, TimingKey.PASTE_DELAY, "posint")
    schemaErrors += ValidateType(Sec.AHK_TIMING, "ExecuteDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.AHK_TIMING, "BrowserActivateDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.AHK_TIMING, "AddressBarDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.AHK_TIMING, "DelegateTabSwitchDelayMs", "posint", true)
    schemaErrors += ValidateType(Sec.AHK_TIMING, "DelegateMaxTabSearch", "posint", true)
    schemaErrors += ValidateType(Sec.AHK_TIMING, "PageClickDelayMs", "posint", true)

    ; [Gmail]
    schemaErrors += ValidateType("Gmail", "URL", "url", true)
    schemaErrors += ValidateType("Gmail", "OpenDelayMs", "posint", true)
    schemaErrors += ValidateType("Gmail", "SlashDelayMs", "posint", true)
    schemaErrors += ValidateType("Gmail", "TypeDelayMs", "posint", true)
    schemaErrors += ValidateType("Gmail", "EnterDelayMs", "posint", true)

    ; [CreditStatus.API]
    schemaErrors += ValidateType(Sec.CR_API, CreditKey.API_BASE_URL, "url", true)
    schemaErrors += ValidateType(Sec.CR_API, CreditKey.AUTH_MODE, "enum:cookieSession,token,officialFlow", true)

    ; [CreditStatus.Timing]
    schemaErrors += ValidateType("CreditStatus.Timing", "AutoCheckEnabled", "bool01", true)
    schemaErrors += ValidateType("CreditStatus.Timing", "AutoCheckIntervalSeconds", "posint", true)
    schemaErrors += ValidateType("CreditStatus.Timing", "CacheTtlSeconds", "posint", true)

    ; [CreditStatus.Retry]
    schemaErrors += ValidateType("CreditStatus.Retry", "MaxRetries", "posint", true)
    schemaErrors += ValidateType("CreditStatus.Retry", "RetryBackoffMs", "posint", true)

    ; [CreditStatus.XPaths]
    schemaErrors += ValidateType("CreditStatus.XPaths", "PlansButtonXPath", "xpath", true)
    schemaErrors += ValidateType("CreditStatus.XPaths", "FreeProgressBarXPath", "xpath", true)
    schemaErrors += ValidateType("CreditStatus.XPaths", "TotalCreditsXPath", "xpath", true)

    ; ============================================
    ; Summary
    ; ============================================
    hasPresenceIssues := (missingCount > 0)
    hasSchemaIssues := (schemaErrors > 0)

    if hasPresenceIssues || hasSchemaIssues {
        summary := fn ": Validation: " missingCount " missing, " schemaErrors " schema error(s), " warnCount " optional not set"
        ErrorLog(summary)
        trayMsg := ""
        if hasPresenceIssues
            trayMsg := missingCount " required key(s) missing.`n"
        if hasSchemaIssues
            trayMsg := trayMsg . schemaErrors " value(s) have wrong type/format.`n"
        trayMsg := trayMsg . "Check logs for details."
        TrayTip(trayMsg, "Config Validation Warning", 2)
    } else {
        infoMsg := "Validation passed (presence + schema)"
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
