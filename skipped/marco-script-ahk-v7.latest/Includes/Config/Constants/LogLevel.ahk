; Config\Constants\LogLevel.ahk - Enum-like static class for log severity levels
; Used by Utils.ahk logging framework (WriteLog, InfoLog, WarnLog, etc.)

class LogLevel {
    static INFO  := "INFO"
    static WARN  := "WARN"
    static ERROR := "ERROR"
    static DEBUG := "DEBUG"
}
