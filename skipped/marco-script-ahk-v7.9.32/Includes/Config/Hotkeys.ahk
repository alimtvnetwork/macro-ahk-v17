; Includes\Config\Hotkeys.ahk - Load [Hotkeys] section

LoadHotkeys(file) {
    InfoLog("Loading Hotkeys section")
    global comboDownHotkey    := IniRead(file, Sec.HOTKEYS, HotkeyKey.COMBO_DOWN, HotkeyDef.COMBO_DOWN)
    global comboUpHotkey      := IniRead(file, Sec.HOTKEYS, HotkeyKey.COMBO_UP, HotkeyDef.COMBO_UP)
    global gmailUnreadHotkey  := IniRead(file, Sec.HOTKEYS, HotkeyKey.GMAIL_UNREAD, HotkeyDef.GMAIL_UNREAD)
    global macroLoopUpHotkey  := IniRead(file, Sec.HOTKEYS, HotkeyKey.MACRO_LOOP_UP, HotkeyDef.MACRO_LOOP_UP)
    global macroLoopDownHotkey := IniRead(file, Sec.HOTKEYS, HotkeyKey.MACRO_LOOP_DOWN, HotkeyDef.MACRO_LOOP_DOWN)
    global loopIntervalDecreaseHotkey := IniRead(file, Sec.HOTKEYS, HotkeyKey.LOOP_INTERVAL_DECREASE, HotkeyDef.LOOP_INTERVAL_DECREASE)
    global loopIntervalIncreaseHotkey := IniRead(file, Sec.HOTKEYS, HotkeyKey.LOOP_INTERVAL_INCREASE, HotkeyDef.LOOP_INTERVAL_INCREASE)
    global loopIntervalStep   := IniReadInt(file, Sec.HOTKEYS, HotkeyKey.LOOP_INTERVAL_STEP, HotkeyDef.LOOP_INTERVAL_STEP)
    global delegateUpHotkey   := IniRead(file, Sec.HOTKEYS, HotkeyKey.DELEGATE_UP, HotkeyDef.DELEGATE_UP)
    global delegateDownHotkey := IniRead(file, Sec.HOTKEYS, HotkeyKey.DELEGATE_DOWN, HotkeyDef.DELEGATE_DOWN)
    global comboAltUpHotkey   := IniRead(file, Sec.HOTKEYS, HotkeyKey.COMBO_ALT_UP, HotkeyDef.COMBO_ALT_UP)
    global comboAltDownHotkey := IniRead(file, Sec.HOTKEYS, HotkeyKey.COMBO_ALT_DOWN, HotkeyDef.COMBO_ALT_DOWN)
    global useSmartShortcuts  := IniReadInt(file, Sec.HOTKEYS, HotkeyKey.USE_SMART_SHORTCUTS, HotkeyDef.USE_SMART_SHORTCUTS)
    SubLog("ComboDown: " comboDownHotkey ", ComboUp: " comboUpHotkey ", SmartShortcuts: " useSmartShortcuts)
}
