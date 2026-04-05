; Config\Constants\ElementKeys.ahk - Shared element descriptor key names
; Used by LoadElementDescriptor() across ComboSwitch/MacroLoop

class ElemKey {
    static TEXT_MATCH     := "TextMatch"
    static TAG            := "Tag"
    static SELECTOR       := "Selector"
    static ARIA_LABEL     := "AriaLabel"
    static HEADING_SEARCH := "HeadingSearch"
    static ROLE           := "Role"
}
