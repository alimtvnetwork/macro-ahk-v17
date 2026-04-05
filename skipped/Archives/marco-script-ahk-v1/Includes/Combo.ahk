; Includes\Combo.ahk - run Combo Switch JS on Lovable

RunCombo(direction) {
    global browserExe
    global transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath
    global ComboPollIntervalMs, ComboOpenMaxAttempts, ComboWaitMaxAttempts

    ; --- ensure required config values exist ---
    if !transferXPath || !combo1XPath || !combo2XPath || !optionsXPath || !confirmXPath {
        MsgBox("ComboSwitch XPaths are missing or empty in config.ini.`nPlease check [ComboSwitch] section.", "Automator v2")
        return
    }

    ; simple defaults if delays not loaded for some reason
    if !ComboPollIntervalMs
        ComboPollIntervalMs := 300
    if !ComboOpenMaxAttempts
        ComboOpenMaxAttempts := 20
    if !ComboWaitMaxAttempts
        ComboWaitMaxAttempts := 20

    ; --- activate browser window ---
    WinActivate("ahk_exe " browserExe)
    Sleep(200)

    ; --- load combo.js template from script directory ---
    comboFile := A_ScriptDir "\combo.js"
    if !FileExist(comboFile) {
        MsgBox("combo.js not found next to the script.`nExpected: " comboFile, "Automator v2")
        return
    }

    comboJs := FileRead(comboFile, "UTF-8")

    ; --- substitute placeholders from config / direction ---

    ; direction
    comboJs := StrReplace(comboJs, "__DIRECTION__", direction)

    ; XPaths
    comboJs := StrReplace(comboJs, "__TRANSFER_XPATH__", transferXPath)
    comboJs := StrReplace(comboJs, "__COMBO1_XPATH__",   combo1XPath)
    comboJs := StrReplace(comboJs, "__COMBO2_XPATH__",   combo2XPath)
    comboJs := StrReplace(comboJs, "__OPTIONS_XPATH__",  optionsXPath)
    comboJs := StrReplace(comboJs, "__CONFIRM_XPATH__",  confirmXPath)

    ; delays (numbers, no quotes)
    comboJs := StrReplace(comboJs, "__COMBO_POLL_INTERVAL_MS__", ComboPollIntervalMs)
    comboJs := StrReplace(comboJs, "__COMBO_OPEN_MAX_ATTEMPTS__", ComboOpenMaxAttempts)
    comboJs := StrReplace(comboJs, "__COMBO_WAIT_MAX_ATTEMPTS__", ComboWaitMaxAttempts)

    ; --- final JS length sanity check ---
    if (StrLen(comboJs) < 1000) {
        MsgBox("combo.js after templating looks too short.`nAborting to avoid injecting broken script.", "Automator v2")
        return
    }

    ; --- inject into browser ---
    InjectJS(comboJs)
}

