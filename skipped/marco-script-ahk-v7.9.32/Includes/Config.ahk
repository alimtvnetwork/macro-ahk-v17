; Includes\Config.ahk - Config orchestrator
; Includes all Config/ submodules and provides LoadConfig() entry point.
; WARNING: LoadConfig() must be called before any other operation.

#Include *i Config\Constants.ahk
#Include *i Config\ConfigUtils.ahk
#Include *i Config\Hotkeys.ahk
#Include *i Config\ComboSwitch.ahk
#Include *i Config\MacroLoop.ahk
#Include *i Config\CreditStatus.ahk
#Include *i Config\AhkTiming.ahk
#Include *i Config\Gmail.ahk
#Include *i Config\General.ahk
#Include *i Config\Validate.ahk
#Include *i Config\Watcher.ahk

LoadConfig() {
    global configFile := A_ScriptDir "\config.ini"

    InfoLog("LoadConfig started, file: " configFile)

    LoadHotkeys(configFile)
    LoadComboSwitch(configFile)
    LoadMacroLoop(configFile)
    LoadCreditStatus(configFile)
    LoadAhkTiming(configFile)
    LoadGmail(configFile)
    LoadGeneral(configFile)

    InfoLog("LoadConfig completed successfully")

    ; Run validation after loading
    ValidateConfig()
}
