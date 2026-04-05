; Includes\Config\ConfigUtils.ahk - Shared config helper functions

IniReadInt(file, section, key, default) {
    val := IniRead(file, section, key, default)
    pos := InStr(val, ";")
    hasComment := pos > 0
    if hasComment
        val := SubStr(val, 1, pos - 1)
    val := Trim(val)
    isEmpty := (val = "")
    if isEmpty
        return Integer(default)
    return Integer(val)
}

; Helper: read 6 descriptor fields for one element subsection
LoadElementDescriptor(file, parentSection, prefix, defText, defTag, defRole) {
    global  ; assume-global mode handles dynamic %prefix% variables
    section := parentSection "." prefix
    %prefix%TextMatch     := IniRead(file, section, ElemKey.TEXT_MATCH, defText)
    %prefix%Tag           := IniRead(file, section, ElemKey.TAG, defTag)
    %prefix%Selector      := IniRead(file, section, ElemKey.SELECTOR, CommonDef.EMPTY)
    %prefix%AriaLabel     := IniRead(file, section, ElemKey.ARIA_LABEL, CommonDef.EMPTY)
    %prefix%HeadingSearch := IniRead(file, section, ElemKey.HEADING_SEARCH, CommonDef.EMPTY)
    %prefix%Role          := IniRead(file, section, ElemKey.ROLE, defRole)
}
