; Includes\ExportCompiledJS.ahk - Export compiled JS for developer debugging
; Saves placeholder-resolved JS to logs/ folder with metadata header and copies to clipboard.
;
; Usage:
;   compiledJs := BuildComboJS("down")    ; from Combo.ahk
;   SaveCompiledJS("combo", compiledJs)   ; saves to logs/compiled-combo.js + clipboard
;
; Generic design: any new script only needs a BuildXxxJS() function,
; then call SaveCompiledJS(name, js) to export it.

; ============================================
; SaveCompiledJS - Generic export function
; Adds metadata header, writes to logs/compiled-<name>.js, copies to clipboard.
; Parameters:
;   scriptName  - Short identifier (e.g., "combo", "macro-looping")
;   compiledJs  - The fully resolved JS string (all placeholders replaced)
;   sourceFile  - Original .js filename for metadata (e.g., "combo.js")
; ============================================
SaveCompiledJS(scriptName, compiledJs, sourceFile := "") {
    global scriptVersion, configFile

    InfoLog("SaveCompiledJS called for [" scriptName "]")

    isJsEmpty := !compiledJs || StrLen(compiledJs) < 10
    if isJsEmpty {
        ErrorLog("SaveCompiledJS: compiled JS is empty or too short for [" scriptName "]")
        TrayTip("Export failed: compiled JS is empty for " scriptName, "Automator Error", 3)
        return false
    }

    ; Build metadata header
    timestamp := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    sourceLabel := sourceFile ? sourceFile : scriptName ".js"

    header := "// ============================================`n"
    header .= "// COMPILED JS EXPORT`n"
    header .= "// Generated: " timestamp "`n"
    header .= "// Source:     " sourceLabel "`n"
    header .= "// Version:    v" scriptVersion "`n"
    header .= "// Config:     " configFile "`n"
    header .= "// Length:     " StrLen(compiledJs) " chars`n"
    header .= "// ============================================`n"
    header .= "// All __PLACEHOLDER__ tokens have been resolved with values from config.ini.`n"
    header .= "// Paste this entire script into the browser DevTools Console to test.`n"
    header .= "// ============================================`n`n"

    fullOutput := header . compiledJs

    ; Ensure logs directory exists
    logsDir := A_ScriptDir "\logs"
    isDirMissing := !DirExist(logsDir)
    if isDirMissing {
        DirCreate(logsDir)
    }

    ; Write to file
    outputFile := logsDir "\compiled-" scriptName ".js"
    try {
        ; Overwrite if exists
        isFilePresent := FileExist(outputFile)
        if isFilePresent {
            FileDelete(outputFile)
        }
        FileAppend(fullOutput, outputFile)
        InfoLog("SaveCompiledJS: written to " outputFile " (" StrLen(fullOutput) " chars)")
    } catch as err {
        ErrorLog("SaveCompiledJS: failed to write file: " err.Message)
        TrayTip("Export failed: " err.Message, "Automator Error", 3)
        return false
    }

    ; Copy to clipboard
    A_Clipboard := fullOutput
    SubLog("SaveCompiledJS: copied to clipboard (" StrLen(fullOutput) " chars)")

    ; Show success notification
    TrayTip(
        "Exported: compiled-" scriptName ".js`n" .
        "Size: " StrLen(fullOutput) " chars`n" .
        "Saved to: logs\compiled-" scriptName ".js`n" .
        "Also copied to clipboard — paste into DevTools Console to test.",
        "Automator - JS Export",
        1
    )

    InfoLog("SaveCompiledJS completed for [" scriptName "]")
    return true
}

; ============================================
; ExportComboJS - Export combo.js with all placeholders resolved
; Calls BuildComboJS() (defined in Combo.ahk) then saves via SaveCompiledJS.
; ============================================
ExportComboJS() {
    InfoLog("ExportComboJS called from tray menu")
    try {
        compiledJs := BuildComboJS("down")
        isSuccess := SaveCompiledJS("combo", compiledJs, "combo.js")
        if !isSuccess {
            ErrorLog("ExportComboJS: SaveCompiledJS returned false")
        }
    } catch as err {
        ErrorLog("ExportComboJS FAILED: " err.Message)
        TrayTip("Export combo.js failed: " err.Message, "Automator Error", 3)
    }
}

; ============================================
; ExportMacroLoopJS - Export macro-looping.js with all placeholders resolved
; Calls BuildMacroLoopJS() (defined in MacroLoop/Embed.ahk) then saves via SaveCompiledJS.
; ============================================
ExportMacroLoopJS() {
    InfoLog("ExportMacroLoopJS called from tray menu")
    try {
        compiledJs := BuildMacroLoopJS()
        isSuccess := SaveCompiledJS("macro-looping", compiledJs, "macro-looping.js")
        if !isSuccess {
            ErrorLog("ExportMacroLoopJS: SaveCompiledJS returned false")
        }
    } catch as err {
        ErrorLog("ExportMacroLoopJS FAILED: " err.Message)
        TrayTip("Export macro-looping.js failed: " err.Message, "Automator Error", 3)
    }
}
