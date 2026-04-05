; Includes\MacroLoop.ahk - MacroLoop Orchestrator
; v7.2: Refactored into modular subfiles under MacroLoop/ directory.
;
; WARNING: This module sends many keyboard shortcuts to the browser:
;   Ctrl+L -> Focus address bar
;   Ctrl+C -> Copy URL
;   Escape -> Close address bar / dismiss dialogs
;   Ctrl+Tab / Ctrl+Shift+Tab -> Switch browser tabs
;   Ctrl+T -> Open new tab
;   Ctrl+V -> Paste URL
;   Enter -> Navigate / Execute
;   Ctrl+Up / Ctrl+Down -> Trigger combo hotkeys
;   Also calls InjectJS which sends Ctrl+Shift+J, F6, Ctrl+V, Enter.
; JS writes DELEGATE_UP/DELEGATE_DOWN to clipboard, AHK polls and acts.

; === Module includes (order matters) ===
#Include *i MacroLoop\Globals.ahk            ; Global state variables
#Include *i MacroLoop\ForceDelegateLog.ahk   ; Dedicated force_delegate.log logging
#Include *i MacroLoop\Helpers.ahk            ; ExtractProjectId, CallLoopFunction, OpenDevToolsIfNeeded
#Include *i MacroLoop\TabSearch.ahk     ; GetTabInfoFromTitle
#Include *i MacroLoop\Routing.ahk       ; HandleSmartShortcut, GetCurrentUrl
#Include *i MacroLoop\Embed.ahk         ; EmbedMacroLoopScript
#Include *i MacroLoop\SignalPoll.ahk    ; CheckClipboardForDelegate
#Include *i MacroLoop\Delegate.ahk      ; HandleDelegate + sub-functions
#Include *i MacroLoop\Lifecycle.ahk     ; ToggleMacroLoop, StopMacroLoop, AdjustLoopInterval
