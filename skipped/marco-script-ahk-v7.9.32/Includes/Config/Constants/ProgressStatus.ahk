; Config\Constants\ProgressStatus.ahk - Enum-like static class for progress status values
; Used by combo.js polling (clipboard-based status communication)

class ProgressStatus {
    static IDLE        := "idle"
    static IN_PROGRESS := "in_progress"
    static DONE        := "done"
    static ERROR       := "error"
    static TIMEOUT     := "timeout"
}
