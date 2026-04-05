; Includes\Config\Watcher.ahk - Config hot-reload via file modification watching
; WARNING: Re-reads ALL config values on change.
;   Does NOT re-register hotkeys (requires script reload).

global configLastModified := ""
global configWatcherRunning := false

StartConfigWatcher() {
    global configFile, configWatchIntervalMs, configLastModified, configWatcherRunning

    isDisabled := configWatchIntervalMs <= 0
    if isDisabled {
        InfoLog("Config watcher disabled (interval: 0)")
        return
    }

    ; Record initial modification time
    configLastModified := FileGetTime(configFile, "M")
    configWatcherRunning := true
    InfoLog("Config watcher started, interval: " configWatchIntervalMs "ms, timestamp: " configLastModified)
    SetTimer(CheckConfigModified, configWatchIntervalMs)
}

StopConfigWatcher() {
    global configWatcherRunning
    isRunning := !!configWatcherRunning
    if isRunning {
        SetTimer(CheckConfigModified, 0)
        configWatcherRunning := false
        InfoLog("Config watcher stopped")
    }
}

CheckConfigModified() {
    global configFile, configLastModified

    try {
        currentModified := FileGetTime(configFile, "M")
    } catch {
        return
    }

    hasChanged := currentModified != configLastModified
    if !hasChanged
        return

    InfoLog("Config changed, previous: " configLastModified ", current: " currentModified)
    configLastModified := currentModified

    ; Reload config values (non-hotkey values only — hotkeys need script reload)
    try {
        LoadConfig()
        InfoLog("Config hot-reloaded successfully")
        ShowTooltip("Config reloaded", 1500)
        TrayTip("config.ini reloaded.`nNote: Hotkey changes require script reload.", "Config Hot-Reload", 1)
    } catch as err {
        ErrorLog("Config hot-reload FAILED: " err.Message)
        TrayTip("config.ini reload failed: " err.Message, "Config Error", 3)
    }
}