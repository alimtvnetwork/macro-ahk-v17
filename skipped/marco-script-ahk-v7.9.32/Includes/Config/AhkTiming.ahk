; Includes\Config\AhkTiming.ahk - Load [AHK.Timing] section

LoadAhkTiming(file) {
    InfoLog("Loading AHK.Timing section")
    global consoleOpenDelayMs    := IniReadInt(file, Sec.AHK_TIMING, TimingKey.CONSOLE_OPEN_DELAY, TimingDef.CONSOLE_OPEN_DELAY)
    global pasteDelayMs          := IniReadInt(file, Sec.AHK_TIMING, TimingKey.PASTE_DELAY, TimingDef.PASTE_DELAY)
    global executeDelayMs        := IniReadInt(file, Sec.AHK_TIMING, TimingKey.EXECUTE_DELAY, TimingDef.EXECUTE_DELAY)
    global browserActivateDelayMs := IniReadInt(file, Sec.AHK_TIMING, TimingKey.BROWSER_ACTIVATE_DELAY, TimingDef.BROWSER_ACTIVATE_DELAY)
    global addressBarDelayMs     := IniReadInt(file, Sec.AHK_TIMING, TimingKey.ADDRESS_BAR_DELAY, TimingDef.ADDRESS_BAR_DELAY)
    global delegateTabSwitchDelayMs := IniReadInt(file, Sec.AHK_TIMING, TimingKey.DELEGATE_TAB_SWITCH_DELAY, TimingDef.DELEGATE_TAB_SWITCH_DELAY)
    global delegateMaxTabSearch  := IniReadInt(file, Sec.AHK_TIMING, TimingKey.DELEGATE_MAX_TAB_SEARCH, TimingDef.DELEGATE_MAX_TAB_SEARCH)
    global pageClickDelayMs      := IniReadInt(file, Sec.AHK_TIMING, TimingKey.PAGE_CLICK_DELAY, TimingDef.PAGE_CLICK_DELAY)
    SubLog("ConsoleOpen: " consoleOpenDelayMs "ms, Paste: " pasteDelayMs "ms, BrowserActivate: " browserActivateDelayMs "ms, PageClick: " pageClickDelayMs "ms")
}
