; Includes\Config.ahk - read all settings from config.ini

; Helper: read an integer from INI, stripping any inline comment
IniReadInt(file, section, key, default) {
    val := IniRead(file, section, key, default)
    pos := InStr(val, ";")
    if (pos > 0)
        val := SubStr(val, 1, pos - 1)
    val := Trim(val)
    if (val = "")
        return Integer(default)
    return Integer(val)
}

LoadConfig() {
    global configFile
    global comboDownHotkey, comboUpHotkey, gmailUnreadHotkey, macroUpHotkey, macroDownHotkey
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath
    global ComboPollIntervalMs, ComboOpenMaxAttempts, ComboWaitMaxAttempts
    global gmailUrl, gmailSearch
    global gmailOpenDelayMs, gmailSlashDelayMs, gmailTypeDelayMs, gmailEnterDelayMs
    global browserExe, consoleDelay, pasteDelay
    global toolButtonXPath, progressXPath, suggestionsAllXPath, firstSuggestionXPath
    global macroIntervalMs, executeButtonXPath

    configFile := A_ScriptDir "\config.ini"

    ; ---------------------------
    ; Hotkeys
    ; ---------------------------
    comboDownHotkey   := IniRead(configFile, "Hotkeys", "ComboDown",   "^Down")
    comboUpHotkey     := IniRead(configFile, "Hotkeys", "ComboUp",     "^Up")
    gmailUnreadHotkey := IniRead(configFile, "Hotkeys", "GmailUnread", "^+F9")
    macroUpHotkey     := IniRead(configFile, "Hotkeys", "MacroUp",     "^+!Up")
    macroDownHotkey   := IniRead(configFile, "Hotkeys", "MacroDown",   "^+!Down")

    ; ---------------------------
    ; Combo switch XPaths + timing
    ; ---------------------------
    transferXPath := IniRead(configFile, "ComboSwitch", "TransferButtonXPath",       "")
    combo1XPath   := IniRead(configFile, "ComboSwitch", "Combo1XPath",               "")
    combo2XPath   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath",         "")
    optionsXPath  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath",     "")
    confirmXPath  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath",        "")

    ComboPollIntervalMs   := IniReadInt(configFile, "ComboSwitch", "ComboPollIntervalMs",   "300")
    ComboOpenMaxAttempts  := IniReadInt(configFile, "ComboSwitch", "ComboOpenMaxAttempts",  "20")
    ComboWaitMaxAttempts  := IniReadInt(configFile, "ComboSwitch", "ComboWaitMaxAttempts",  "20")

    ; ---------------------------
    ; Gmail settings
    ; ---------------------------
    gmailUrl    := IniRead(configFile, "Gmail", "URL",         "https://mail.google.com")
    gmailSearch := IniRead(configFile, "Gmail", "SearchQuery", "in:inbox is:unread")

    ; Gmail timing (ms)
    gmailOpenDelayMs  := IniReadInt(configFile, "Gmail", "OpenDelayMs",  "1500")
    gmailSlashDelayMs := IniReadInt(configFile, "Gmail", "SlashDelayMs", "500")
    gmailTypeDelayMs  := IniReadInt(configFile, "Gmail", "TypeDelayMs",  "300")
    gmailEnterDelayMs := IniReadInt(configFile, "Gmail", "EnterDelayMs", "100")

    ; ---------------------------
    ; General
    ; ---------------------------
    browserExe   := IniRead(configFile, "General", "BrowserExe",   "chrome.exe")
    consoleDelay := IniReadInt(configFile, "General", "ConsoleDelay", "800")
    pasteDelay   := IniReadInt(configFile, "General", "PasteDelay",   "200")

    ; ---------------------------
    ; Macro
    ; ---------------------------
    toolButtonXPath      := IniRead(configFile, "Macro", "ToolButtonXPath",      "")
    progressXPath        := IniRead(configFile, "Macro", "ProgressXPath",        "")
    suggestionsAllXPath  := IniRead(configFile, "Macro", "SuggestionsAllXPath",  "")
    firstSuggestionXPath := IniRead(configFile, "Macro", "FirstSuggestionXPath", "")
    macroIntervalMs      := IniReadInt(configFile, "Macro", "IntervalMs",        "15000")
    executeButtonXPath   := IniRead(configFile, "Macro", "ExecuteButtonXPath",   "")
}
