; Includes\HotkeyFormat.ahk - Convert AHK hotkey string to readable text
; WARNING: Used by LogKeyPress() in Utils.ahk for human-readable key logging.
;   Also used by Automator.ahk for tray menu labels.

FormatHotkeyLabel(hk) {
    mods := ""
    key  := hk

    hasCtrl := InStr(key, "^")
    if hasCtrl {
        mods .= (mods ? "+" : "") "Ctrl"
        key := StrReplace(key, "^")
    }

    hasShift := InStr(key, "+")
    if hasShift {
        mods .= (mods ? "+" : "") "Shift"
        key := StrReplace(key, "+")
    }

    hasAlt := InStr(key, "!")
    if hasAlt {
        mods .= (mods ? "+" : "") "Alt"
        key := StrReplace(key, "!")
    }

    hasWin := InStr(key, "#")
    if hasWin {
        mods .= (mods ? "+" : "") "Win"
        key := StrReplace(key, "#")
    }

    key := Trim(key)

    hasModifiers := (mods != "")
    if hasModifiers
        return mods " + " key
    return key
}
