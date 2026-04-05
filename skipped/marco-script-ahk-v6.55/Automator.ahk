#Requires AutoHotkey >=2.0
#SingleInstance Force

; ============================================
; Automator - Enhanced Logging & MacroLoop Force Switch Edition
; Features:
;   - Smart Ctrl+Up/Down: ComboSwitch on settings, MacroLoop on project
;   - MacroLoop with clipboard-based delegation (JS writes, AHK polls)
;   - AHK handles all tab switching
;   - Dynamic interval adjustment (Ctrl+Shift+[/])
;   - Gmail automation
;   - JS Executor textboxes
;   - Error logging to logs/error.txt
;   - Debug Mode with activity log panels in browser UI
;   - Comprehensive logging on every action and keypress
; ============================================

; ============================================
; Includes (Utils first for error handling, HotkeyFormat before Utils needs it)
; ============================================
#Include *i Includes\HotkeyFormat.ahk
#Include *i Includes\Utils.ahk
#Include *i Includes\Config.ahk
#Include *i Includes\JsInject.ahk
#Include *i Includes\Combo.ahk
#Include *i Includes\Gmail.ahk
#Include *i Includes\MacroLoop.ahk

; ============================================
; Hardcoded build version (update this on each release)
; Must match config.ini [General] ScriptVersion
; ============================================
AHK_BUILD_VERSION := "6.54"

; ============================================
; Clear logs folder for fresh start
; ============================================
logsDir := A_ScriptDir "\logs"
isLogsDirPresent := DirExist(logsDir)
if isLogsDirPresent {
    try {
        DirDelete(logsDir, true)
    }
}
DirCreate(logsDir)

; ============================================
; Load config
; ============================================
try {
    LoadConfig()
    InfoLog("Config loaded successfully")
    InfoLog("Logs folder cleared for fresh start: " logsDir)
    StartConfigWatcher()
} catch as err {
    MsgBox("Failed to load config: " err.Message, "Error", 16)
    ExitApp()
}

; ============================================
; Version mismatch check
; ============================================
if (AHK_BUILD_VERSION != scriptVersion) {
    WarnLog("VERSION MISMATCH: AHK build=" AHK_BUILD_VERSION " config.ini=" scriptVersion)
    mismatchResult := MsgBox(
        "Version mismatch detected!`n`n" .
        "Running AHK build: v" AHK_BUILD_VERSION "`n" .
        "config.ini version: v" scriptVersion "`n`n" .
        "This usually means you updated config.ini but are running an old AHK script.`n" .
        "Click OK to continue anyway, or Cancel to exit.",
        "Automator - Version Mismatch",
        49  ; OK/Cancel + Warning icon
    )
    if (mismatchResult = "Cancel") {
        ExitApp()
    }
    InfoLog("User chose to continue despite version mismatch")
}

; ============================================
; Icon constants (shell32.dll)
; ============================================
ICON_DLL   := "shell32.dll"
ICON_GEAR  := 278
ICON_PLAY  := 138
ICON_STOP  := 131
ICON_DOC   := 167
ICON_REC   := 174
ICON_MAIL  := 156
ICON_UP    := 247
ICON_DOWN  := 248
ICON_REFRESH := 239

; ============================================
; Sound constants (Hz)
; ============================================
global FREQ_START_1 := 1500
global FREQ_START_2 := 1800
global FREQ_STOP    := 500
global FREQ_CYCLE   := 1000
global FREQ_ACTION  := 1200
global FREQ_ERROR   := 300

; ============================================
; Hotkeys registration
; WARNING: These register global hotkeys that send commands to the browser.
;   Ctrl+Down/Up -> ComboSwitch or SmartShortcut
;   Ctrl+Shift+Up/Down -> MacroLoop toggle
;   Ctrl+Shift+[/] -> Adjust loop interval
;   Ctrl+Shift+F9 -> Gmail
; ============================================
isSmartMode := !!useSmartShortcuts
if isSmartMode {
    InfoLog("Registering SMART shortcuts (URL check enabled)")
    ; $ prefix: prevent programmatic Send("^{Down}") from HandleDelegate from re-triggering
    SubLog("ComboDown=$" comboDownHotkey " -> HandleSmartShortcut(down)")
    SubLog("ComboUp=$" comboUpHotkey " -> HandleSmartShortcut(up)")
    Hotkey("$" comboDownHotkey, (*) => HandleSmartShortcut("down"))
    Hotkey("$" comboUpHotkey,   (*) => HandleSmartShortcut("up"))
} else {
    InfoLog("Registering DIRECT shortcuts (no URL check)")
    ; $ prefix: prevent programmatic Send("^{Down}") from HandleDelegate from re-triggering
    SubLog("ComboDown=$" comboDownHotkey " -> RunComboSafe(down)")
    SubLog("ComboUp=$" comboUpHotkey " -> RunComboSafe(up)")
    Hotkey("$" comboDownHotkey, (*) => RunComboSafe("down"))
    Hotkey("$" comboUpHotkey,   (*) => RunComboSafe("up"))
}

InfoLog("Registering Gmail hotkey: $" gmailUnreadHotkey)
Hotkey("$" gmailUnreadHotkey, (*) => RunGmail())

InfoLog("Registering MacroLoop hotkeys: $" macroLoopUpHotkey ", $" macroLoopDownHotkey)
Hotkey("$" macroLoopUpHotkey, (*) => ToggleMacroLoop("up"))
Hotkey("$" macroLoopDownHotkey, (*) => ToggleMacroLoop("down"))

InfoLog("Registering interval hotkeys: $" loopIntervalDecreaseHotkey ", $" loopIntervalIncreaseHotkey)
Hotkey("$" loopIntervalDecreaseHotkey, (*) => AdjustLoopInterval(-1))
Hotkey("$" loopIntervalIncreaseHotkey, (*) => AdjustLoopInterval(1))

InfoLog("All hotkeys registered (all with $ prefix for Send safety)")

; ============================================
; Safe wrapper for RunCombo
; WARNING: Catches errors from RunCombo and displays tooltip.
;   RunCombo calls InjectJS which sends Ctrl+Shift+J, F6, Ctrl+V, Enter.
; ============================================
; S-004: Safe wrapper with tray error notification
RunComboSafe(direction) {
    InfoLog("RunComboSafe called, direction=" direction)
    try {
        RunCombo(direction)
        InfoLog("RunComboSafe completed successfully")
    } catch as err {
        ErrorLog("RunComboSafe FAILED: " err.Message)
        SubLog("File: " err.File " Line: " err.Line, 1)
        SubLog("Stack: " err.Stack, 1)
        ShowTooltip("Combo Error: " err.Message)
        ; S-004: Show tray notification on error
        TrayTip("ComboSwitch failed: " err.Message "`nFile: " err.File " Line: " err.Line, "Automator Error", 3)
    }
}

; ============================================
; Tray icon + menu setup
; ============================================
TraySetIcon(ICON_DLL, ICON_GEAR)
A_IconTip := "Automator v" scriptVersion " - Ready"

Tray := A_TrayMenu
Tray.Delete()

labelSmartDown    := "Smart Down           [" FormatHotkeyLabel(comboDownHotkey) "]"
labelSmartUp      := "Smart Up             [" FormatHotkeyLabel(comboUpHotkey) "]"
labelComboDown    := "Combo Down           [" FormatHotkeyLabel(comboDownHotkey) "]"
labelComboUp      := "Combo Up             [" FormatHotkeyLabel(comboUpHotkey) "]"
labelMacroLoopDown := "MacroLoop Down       [" FormatHotkeyLabel(macroLoopDownHotkey) "]"
labelMacroLoopUp   := "MacroLoop Up         [" FormatHotkeyLabel(macroLoopUpHotkey) "]"
labelIntervalDecrease := "Interval -" loopIntervalStep "ms  [" FormatHotkeyLabel(loopIntervalDecreaseHotkey) "]"
labelIntervalIncrease := "Interval +" loopIntervalStep "ms  [" FormatHotkeyLabel(loopIntervalIncreaseHotkey) "]"
labelGmail        := "Gmail Unread         [" FormatHotkeyLabel(gmailUnreadHotkey) "]"

Tray.Add("=== SMART SHORTCUTS ===", MenuDummy)
Tray.Disable("=== SMART SHORTCUTS ===")

Tray.Add(labelSmartDown, MenuSmartDown)
Tray.SetIcon(labelSmartDown, ICON_DLL, ICON_DOWN)

Tray.Add(labelSmartUp, MenuSmartUp)
Tray.SetIcon(labelSmartUp, ICON_DLL, ICON_UP)

Tray.Add()

Tray.Add("=== MACRO LOOP ===", MenuDummy)
Tray.Disable("=== MACRO LOOP ===")

Tray.Add(labelMacroLoopDown, MenuMacroLoopDown)
Tray.SetIcon(labelMacroLoopDown, ICON_DLL, ICON_PLAY)

Tray.Add(labelMacroLoopUp, MenuMacroLoopUp)
Tray.SetIcon(labelMacroLoopUp, ICON_DLL, ICON_PLAY)

Tray.Add("Stop MacroLoop", MenuStopMacroLoop)
Tray.SetIcon("Stop MacroLoop", ICON_DLL, ICON_STOP)

Tray.Add(labelIntervalDecrease, MenuIntervalDecrease)
Tray.Add(labelIntervalIncrease, MenuIntervalIncrease)

Tray.Add()

Tray.Add("=== COMBO SWITCH ===", MenuDummy)
Tray.Disable("=== COMBO SWITCH ===")

Tray.Add(labelComboDown, MenuComboDown)
Tray.SetIcon(labelComboDown, ICON_DLL, ICON_DOWN)

Tray.Add(labelComboUp, MenuComboUp)
Tray.SetIcon(labelComboUp, ICON_DLL, ICON_UP)

Tray.Add()

Tray.Add(labelGmail, MenuGmail)
Tray.SetIcon(labelGmail, ICON_DLL, ICON_MAIL)

Tray.Add()

Tray.Add("Debug Mode", MenuToggleDebug)
UpdateDebugMenuCheckmark()

Tray.Add()

Tray.Add("Open Config.ini", MenuOpenConfig)
Tray.SetIcon("Open Config.ini", ICON_DLL, ICON_DOC)

Tray.Add("Reload Script", MenuReload)
Tray.SetIcon("Reload Script", ICON_DLL, ICON_REFRESH)

Tray.Add()

Tray.Add("Help (README)", MenuHelpReadme)
Tray.SetIcon("Help (README)", ICON_DLL, ICON_DOC)

Tray.Add("Spec (SPEC.md)", MenuHelpSpec)
Tray.SetIcon("Spec (SPEC.md)", ICON_DLL, ICON_DOC)

Tray.Add()

Tray.Add("Exit", MenuExit)
Tray.SetIcon("Exit", ICON_DLL, ICON_STOP)

Tray.Default := labelSmartDown

TrayTip(
    "Automator v" scriptVersion " loaded.`n" .
    "Smart: " FormatHotkeyLabel(comboDownHotkey) "/" FormatHotkeyLabel(comboUpHotkey) "`n" .
    "MacroLoop: " FormatHotkeyLabel(macroLoopDownHotkey) "/" FormatHotkeyLabel(macroLoopUpHotkey) "`n" .
    "Delegate: Clipboard polling (auto)`n" .
    "Interval: " FormatHotkeyLabel(loopIntervalDecreaseHotkey) "/" FormatHotkeyLabel(loopIntervalIncreaseHotkey) "`n" .
    "Gmail: " FormatHotkeyLabel(gmailUnreadHotkey) "`n" .
    "Debug Mode: " (debugMode ? "ON" : "OFF") " | Esc=stop",
    "Automator v" scriptVersion,
    1
)

InfoLog("Automator v" scriptVersion " startup complete, tray menu built")

; ============================================
; Menu dummy handler (for disabled items)
; ============================================
MenuDummy(*) {
    return
}

; ============================================
; Tray menu handlers - Smart Shortcuts
; ============================================
MenuSmartDown(*) {
    InfoLog("Tray menu: Smart Down clicked")
    HandleSmartShortcut("down")
}
MenuSmartUp(*) {
    InfoLog("Tray menu: Smart Up clicked")
    HandleSmartShortcut("up")
}

; ============================================
; Tray menu handlers - MacroLoop
; ============================================
MenuMacroLoopDown(*) {
    InfoLog("Tray menu: MacroLoop Down clicked")
    ToggleMacroLoop("down")
}
MenuMacroLoopUp(*) {
    InfoLog("Tray menu: MacroLoop Up clicked")
    ToggleMacroLoop("up")
}

MenuStopMacroLoop(*) {
    global macroLoopRunning
    InfoLog("Tray menu: Stop MacroLoop clicked, isRunning=" macroLoopRunning)
    isRunning := !!macroLoopRunning
    if isRunning {
        StopMacroLoop()
    } else {
        ShowTooltip("MacroLoop not running")
    }
}

MenuIntervalDecrease(*) {
    InfoLog("Tray menu: Interval Decrease clicked")
    AdjustLoopInterval(-1)
}
MenuIntervalIncrease(*) {
    InfoLog("Tray menu: Interval Increase clicked")
    AdjustLoopInterval(1)
}

; ============================================
; Tray menu handlers - ComboSwitch
; ============================================
MenuComboDown(*) {
    InfoLog("Tray menu: Combo Down clicked")
    RunCombo("down")
}
MenuComboUp(*) {
    InfoLog("Tray menu: Combo Up clicked")
    RunCombo("up")
}

; ============================================
; Tray menu handlers - Gmail
; ============================================
MenuGmail(*) {
    InfoLog("Tray menu: Gmail clicked")
    RunGmail()
}

; ============================================
; Tray menu handlers - System
; ============================================
MenuOpenConfig(*) {
    global configFile
    InfoLog("Tray menu: Open Config clicked")
    Run Format('notepad.exe "{1}"', configFile)
}

MenuReload(*) {
    InfoLog("Tray menu: Reload clicked")
    Reload()
}

MenuHelpReadme(*) {
    readmePath := A_ScriptDir "\README.md"
    isReadmePresent := FileExist(readmePath)
    if isReadmePresent {
        InfoLog("Opening README.md")
        Run(readmePath)
    } else {
        WarnLog("README.md not found: " readmePath)
        MsgBox("README.md not found in script folder.", "Automator v" scriptVersion)
    }
}

MenuHelpSpec(*) {
    specPath := A_ScriptDir "\SPEC.md"
    isSpecPresent := FileExist(specPath)
    if isSpecPresent {
        InfoLog("Opening SPEC.md")
        Run(specPath)
    } else {
        WarnLog("SPEC.md not found: " specPath)
        MsgBox("SPEC.md not found in script folder.", "Automator v" scriptVersion)
    }
}

MenuExit(*) {
    InfoLog("Tray menu: Exit clicked")
    ExitApp()
}

; ============================================
; Tray menu handler - Debug Mode Toggle
; ============================================
MenuToggleDebug(*) {
    InfoLog("Tray menu: Debug Mode toggle clicked")
    ToggleDebugMode()
}

UpdateDebugMenuCheckmark() {
    global debugMode, Tray
    isDebugOn := !!debugMode
    if isDebugOn {
        Tray.Check("Debug Mode")
    } else {
        Tray.Uncheck("Debug Mode")
    }
}

; ============================================
; Update tray icon based on loop state
; ============================================
UpdateTrayIcon() {
    global macroLoopRunning, macroLoopDirection, debugMode
    global ICON_DLL, ICON_GEAR, ICON_PLAY, ICON_REC

    debugStatus := debugMode ? " [DEBUG]" : ""

    isLoopActive := !!macroLoopRunning
    if isLoopActive {
        TraySetIcon(ICON_DLL, ICON_REC)
        A_IconTip := "Automator v" scriptVersion " - LOOP RUNNING (" macroLoopDirection ")" debugStatus
    } else {
        TraySetIcon(ICON_DLL, ICON_GEAR)
        A_IconTip := "Automator v" scriptVersion " - Ready" debugStatus
    }
}

; ============================================
; Clear tooltip helper
; ============================================
ClearMainToolTip() {
    ToolTip()
}

; ============================================
; Esc handler: stop loop or exit
; IMPORTANT: Uses $ prefix (keyboard hook) so programmatic Send("{Escape}")
; from GetCurrentUrl() does NOT trigger this hotkey. Only physical key presses.
; ============================================
$Esc::{
    global macroLoopRunning
    isLoopActive := !!macroLoopRunning
    if isLoopActive {
        InfoLog("Esc pressed: stopping MacroLoop")
        StopMacroLoop()
    } else {
        InfoLog("Esc pressed: exiting app")
        ExitApp()
    }
}
