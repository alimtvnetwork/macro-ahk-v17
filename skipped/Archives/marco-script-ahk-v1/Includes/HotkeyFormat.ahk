; Includes\HotkeyFormat.ahk - convert AHK hotkey string to readable text

FormatHotkeyLabel(hk) {
    ; Simple parser for combos like ^+!Up, ^Down, ^+F9, etc.
    mods := ""
    key  := hk

    if InStr(key, "^") {
        mods .= (mods ? "+" : "") "Ctrl"
        key := StrReplace(key, "^")
    }
    if InStr(key, "+") {
        mods .= (mods ? "+" : "") "Shift"
        key := StrReplace(key, "+")
    }
    if InStr(key, "!") {
        mods .= (mods ? "+" : "") "Alt"
        key := StrReplace(key, "!")
    }
    if InStr(key, "#") {
        mods .= (mods ? "+" : "") "Win"
        key := StrReplace(key, "#")
    }

    ; Trim whitespace
    key := Trim(key)

    if (mods != "")
        return mods " + " key
    return key
}
