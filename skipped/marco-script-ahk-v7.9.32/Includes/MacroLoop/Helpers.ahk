; MacroLoop\Helpers.ahk - Utility functions (ExtractProjectId, CallLoopFunction, etc.)

; ============================================
; Extract Project ID from URL or text
; ============================================
ExtractProjectId(text) {
    InfoLog("ExtractProjectId called")
    try {
        if RegExMatch(text, "/projects/([a-f0-9-]+)", &match) {
            SubLog("Extracted project ID: " match[1])
            return match[1]
        }
        SubLog("No project ID pattern found")
        return ""
    } catch as err {
        ErrorLog("ExtractProjectId FAILED: " err.Message)
        return ""
    }
}

; ============================================
; Call Loop JS Function — simplified
; v7.2: Just call the function. No typeof checks, no console.warn.
;   If it doesn't exist, it throws — which we catch at the caller level.
; ============================================
CallLoopFunction(funcName, param := "") {
    InfoLog("CallLoopFunction: " funcName "(" param ")")

    try {
        if (param != "") {
            js := "window." funcName "('" param "');"
        } else {
            js := "window." funcName "();"
        }
        SubLog("JS: " js)
        InjectJS(js)
        InfoLog("CallLoopFunction completed: " funcName)
    } catch as err {
        ErrorLog("CallLoopFunction FAILED for " funcName ": " err.Message)
        throw err
    }
}

; ============================================
; OpenDevToolsIfNeeded - DEPRECATED (no-op)
; ============================================
OpenDevToolsIfNeeded() {
    DebugLog("OpenDevToolsIfNeeded called (no-op)")
}

; ============================================
; v7.9: Read combo status from window title (NO JS injection needed)
; combo.js sets __AHK_COMBO_DONE__ or __AHK_COMBO_ERROR__ in document.title
; Returns: "done", "error", "in_progress", or "idle"
; ============================================
ReadStatusFromTitle() {
    global browserExe
    try {
        title := WinGetTitle("ahk_exe " browserExe)
    } catch {
        title := ""
    }
    if InStr(title, "__AHK_COMBO_DONE__")
        return ProgressStatus.DONE
    if InStr(title, "__AHK_COMBO_ERROR__")
        return ProgressStatus.ERROR
    ; No terminal marker — could be in_progress or idle
    return ""
}

; ============================================
; v7.9: Clean AHK markers from title via JS injection
; Used after polling completes to restore clean title
; ============================================
CleanTitleMarkers() {
    InfoLog("CleanTitleMarkers: Removing __AHK_COMBO_*__ from title")
    InjectJSQuick("document.title=document.title.replace(/__AHK_COMBO_\w+__/g,'')")
    Sleep(100)
}

; ============================================
; v7.9: Reset progress status element to idle
; Also cleans title markers
; ============================================
ResetElementStatus(elementId) {
    InfoLog("ResetElementStatus: " elementId)
    InjectJSQuick("var _p=document.getElementById('" elementId "');if(_p){_p.setAttribute('data-status','" ProgressStatus.IDLE "');_p.textContent='" ProgressStatus.IDLE "'};document.title=document.title.replace(/__AHK_COMBO_\w+__/g,'')")
    Sleep(100)
    SubLog("Element reset to " ProgressStatus.IDLE ", title markers cleared")
}

; ============================================
; v7.9: Strip all __AHK_*__ markers from a title string
; Used for robust title comparison in tab matching
; ============================================
StripAhkMarkers(title) {
    cleaned := RegExReplace(title, "__AHK_\w+__", "")
    return Trim(cleaned)
}

; ============================================
; DEPRECATED: Clipboard-based polling (v7.8 and earlier)
; navigator.clipboard.writeText() returns a Promise — AHK reads empty clipboard.
; Kept for reference; use ReadStatusFromTitle() instead.
; ============================================
BuildClipboardReadJs(elementId) {
    WarnLog("BuildClipboardReadJs: DEPRECATED — use ReadStatusFromTitle() instead")
    return "var _s=document.getElementById('" elementId "');navigator.clipboard.writeText(_s?_s.getAttribute('data-status')||'" ProgressStatus.IDLE "':'" ProgressStatus.IDLE "')"
}

ReadElementStatusViaClipboard(elementId, waitMs := 400) {
    WarnLog("ReadElementStatusViaClipboard: DEPRECATED — use ReadStatusFromTitle() instead")
    InfoLog("ReadElementStatusViaClipboard: " elementId)
    A_Clipboard := ""
    InjectJS(BuildClipboardReadJs(elementId))
    Sleep(waitMs)
    result := A_Clipboard
    SubLog("Clipboard returned: " (result ? result : "(empty)"))
    return result
}
