#Requires AutoHotkey >=2.0
#SingleInstance Force

; ============================================
; Includes
; ============================================
#Include *i Includes\Config.ahk
#Include *i Includes\JsInject.ahk
#Include *i Includes\Combo.ahk
#Include *i Includes\Gmail.ahk
#Include *i Includes\Macro.ahk
#Include *i Includes\HotkeyFormat.ahk

; ============================================
; Load config
; ============================================
LoadConfig()

; ============================================
; Icon constants
; ============================================
ICON_DLL  := "shell32.dll" ; shared icon library
ICON_MAIN := 44            ; main action icon index
ICON_STOP := 131           ; stop/error icon index
ICON_DOC  := 167           ; document/info icon index

; ============================================
; Hotkeys
; ============================================
Hotkey(comboDownHotkey,  (*) => RunCombo("down"))
Hotkey(comboUpHotkey,    (*) => RunCombo("up"))
Hotkey(gmailUnreadHotkey,(*) => RunGmail())
Hotkey(macroUpHotkey,    (*) => ToggleMacro("up"))
Hotkey(macroDownHotkey,  (*) => ToggleMacro("down"))

; ============================================
; Tray icon + menu
; ============================================
TraySetIcon(ICON_DLL, ICON_MAIN)
A_IconTip := "Lovable Macro AHK"

Tray := A_TrayMenu
Tray.Delete()

; Human-readable labels via FormatHotkeyLabel()
labelMacroUpLoop    := "Macro Loop (Up)      [" FormatHotkeyLabel(macroUpHotkey) "]"
labelMacroDownLoop  := "Macro Loop (Down)    [" FormatHotkeyLabel(macroDownHotkey) "]"
labelComboDown      := "Run Combo Down       [" FormatHotkeyLabel(comboDownHotkey) "]"
labelComboUp        := "Run Combo Up         [" FormatHotkeyLabel(comboUpHotkey) "]"
labelGmail          := "Gmail Unread         [" FormatHotkeyLabel(gmailUnreadHotkey) "]"

Tray.Add(labelMacroUpLoop, MenuStartMacroUp)
Tray.SetIcon(labelMacroUpLoop, ICON_DLL, ICON_MAIN)

Tray.Add(labelMacroDownLoop, MenuStartMacroDown)
Tray.SetIcon(labelMacroDownLoop, ICON_DLL, ICON_MAIN)

Tray.Add("Stop Macro", MenuStopMacro)
Tray.SetIcon("Stop Macro", ICON_DLL, ICON_STOP)

Tray.Add()  ; separator

Tray.Add(labelComboDown, MenuComboDown)
Tray.Add(labelComboUp,   MenuComboUp)
Tray.Add(labelGmail,     MenuGmail)

Tray.Add()  ; separator

Tray.Add("Open Config.ini", MenuOpenConfig)
Tray.Add("Reload Script",   MenuReload)

Tray.Add()  ; separator
Tray.Add("Help (README)", MenuHelpReadme)
Tray.SetIcon("Help (README)", ICON_DLL, ICON_DOC)
Tray.Add("Spec (SPEC.md)", MenuHelpSpec)
Tray.SetIcon("Spec (SPEC.md)", ICON_DLL, ICON_DOC)

Tray.Add()  ; separator
Tray.Add("Exit", MenuExit)

Tray.Default := labelMacroDownLoop

TrayTip(
    "Automator v2 loaded (modular)." . "`n" .
    "Right-click tray icon → Help (README) for full docs.",
    "Automator v2",
    1
)

; ============================================
; Tray menu handlers
; ============================================
MenuStartMacroUp(*)   => ToggleMacro("up")
MenuStartMacroDown(*) => ToggleMacro("down")

MenuStopMacro(*) {
    global isMacroRunning
    isMacroRunning := false
    SetTimer(MacroTick, 0)
}

MenuComboDown(*) => RunCombo("down")
MenuComboUp(*)   => RunCombo("up")
MenuGmail(*)     => RunGmail()

MenuOpenConfig(*) {
    global configFile
    Run Format('notepad.exe "{1}"', configFile)
}

MenuReload(*) => Reload()

MenuHelpReadme(*) {
    readmePath := A_ScriptDir "\README.md"
    if FileExist(readmePath) {
        Run(readmePath)  ; opens in default handler (browser or editor)
    } else {
        MsgBox("README.md not found in script folder.", "Automator v2")
    }
}

MenuHelpSpec(*) {
    specPath := A_ScriptDir "\SPEC.md"
    if FileExist(specPath) {
        Run(specPath)    ; opens in default handler
    } else {
        MsgBox("SPEC.md not found in script folder.", "Automator v2")
    }
}

MenuExit(*) => ExitApp()

Esc::ExitApp()
