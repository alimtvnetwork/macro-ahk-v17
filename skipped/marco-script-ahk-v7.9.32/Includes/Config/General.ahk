; Includes\Config\General.ahk - Load [General] section

LoadGeneral(file) {
    InfoLog("Loading General section")
    global browserExe := IniRead(file, Sec.GENERAL, GeneralKey.BROWSER_EXE, GeneralDef.BROWSER_EXE)
    global scriptVersion := IniRead(file, Sec.GENERAL, GeneralKey.SCRIPT_VERSION, GeneralDef.SCRIPT_VERSION)
    global debugMode := IniReadInt(file, Sec.GENERAL, GeneralKey.DEBUG, GeneralDef.DEBUG)
    global configWatchIntervalMs := IniReadInt(file, Sec.GENERAL, GeneralKey.CONFIG_WATCH_INTERVAL, GeneralDef.CONFIG_WATCH_INTERVAL)
    SubLog("Browser: " browserExe ", Version: " scriptVersion ", Debug: " debugMode ", ConfigWatch: " configWatchIntervalMs "ms")
}
