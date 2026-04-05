; MacroLoop\TabSearch.ahk - Tab identification from window titles
; DEPRECATED (v7.9.6): This module is deprecated.
; Only used by HandleDelegate (also deprecated). Kept for reference.
;
; ============================================
; v6.56: Get tab identity from window title (instant, no keyboard automation)
; Returns object: { title, isSettings, isProject, hasProjectId, raw }
; Replaces GetCurrentUrl() in tab search loops — saves ~600ms per tab.
; ============================================
GetTabInfoFromTitle(projectId := "") {
    global browserExe

    try {
        title := WinGetTitle("ahk_exe " browserExe)
    } catch {
        title := ""
    }

    result := {}
    result.title := title
    result.raw := title
    ; v7.1.4: Broadened settings detection — Lovable titles often show "Settings" or "settings?tab="
    ; Also check for the settings URL pattern in case title includes the path
    result.isSettings := InStr(title, "Settings") || InStr(title, "settings") || InStr(title, "/settings") || InStr(title, "?tab=")
    result.isProject := InStr(title, "Lovable") || InStr(title, "lovable") || InStr(title, "/projects/")

    isProjectIdProvided := (projectId != "")
    if isProjectIdProvided {
        ; Check first 8 chars of project ID in title (Lovable shows truncated IDs)
        shortId := SubStr(projectId, 1, 8)
        result.hasProjectId := InStr(title, shortId) || InStr(title, projectId)
    } else {
        result.hasProjectId := false
    }

    return result
}
