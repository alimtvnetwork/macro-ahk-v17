; Includes\Gmail.ahk

RunGmail() {
    global browserExe, gmailUrl
    global gmailOpenDelayMs

    if IsBrowserOnGmail() {
        GmailSearchCurrentTab()
        return
    }

    ; Not in Gmail: open Gmail, then run search after configurable delay
    Run Format('"{1}" "{2}"', browserExe, gmailUrl)
    Sleep gmailOpenDelayMs
    GmailSearchCurrentTab()
}

IsBrowserOnGmail() {
    global browserExe

    exeName := StrLower(Trim(browserExe))
    if InStr(exeName, "\") {
        exeName := StrLower(RegExReplace(exeName, ".*\\", ""))
    }

    try
        activeProc := StrLower(WinGetProcessName("A"))
    catch
        activeProc := ""

    if (activeProc != exeName)
        return false

    title := StrLower(WinGetTitle("A"))
    return InStr(title, "gmail") > 0
}

GmailSearchCurrentTab() {
    global gmailSearch
    global gmailSlashDelayMs, gmailTypeDelayMs, gmailEnterDelayMs

    Sleep gmailSlashDelayMs
    Send "/"
    Sleep gmailTypeDelayMs
    SendText gmailSearch
    Sleep gmailEnterDelayMs
    Send "{Enter}"
}
