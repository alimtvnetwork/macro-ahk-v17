; Includes\Gmail.ahk - Gmail automation
; WARNING: RunGmail() opens Gmail or searches within it.
;   Sends keystrokes: "/", typed search query, Enter.
;   If not already on Gmail, launches the browser with the Gmail URL.

RunGmail() {
    global browserExe, gmailUrl
    global gmailOpenDelayMs

    InfoLog("RunGmail called")

    isBrowserOnGmail := IsBrowserOnGmail()
    if isBrowserOnGmail {
        InfoLog("  > Browser is already on Gmail, searching in current tab")
        GmailSearchCurrentTab()
        InfoLog("RunGmail completed (searched in existing tab)")
        return
    }

    InfoLog("  > Browser is NOT on Gmail, opening Gmail URL: " gmailUrl)
    Run Format('"{1}" "{2}"', browserExe, gmailUrl)
    SubLog("Gmail opened, waiting " gmailOpenDelayMs "ms for page load")
    Sleep gmailOpenDelayMs

    InfoLog("  > Running search in newly opened Gmail tab")
    GmailSearchCurrentTab()
    InfoLog("RunGmail completed (opened new tab and searched)")
}

; WARNING: Checks if the active window is a browser window with "gmail" in the title.
IsBrowserOnGmail() {
    global browserExe

    InfoLog("IsBrowserOnGmail checking active window")

    exeName := StrLower(Trim(browserExe))
    hasBackslash := InStr(exeName, "\")
    if hasBackslash {
        exeName := StrLower(RegExReplace(exeName, ".*\\", ""))
    }
    SubLog("Expected process name: " exeName)

    try
        activeProc := StrLower(WinGetProcessName("A"))
    catch
        activeProc := ""

    isProcessMatch := (activeProc = exeName)
    SubLog("Active process: " activeProc ", isMatch=" isProcessMatch)

    if isProcessMatch {
        title := StrLower(WinGetTitle("A"))
        hasGmailInTitle := InStr(title, "gmail") > 0
        SubLog("Window title: " title ", hasGmailInTitle=" hasGmailInTitle)
        return hasGmailInTitle
    }

    SubLog("Active process does not match browser, returning false")
    return false
}

; WARNING: Sends "/" to focus Gmail search, then types the search query, then Enter.
GmailSearchCurrentTab() {
    global gmailSearch
    global gmailSlashDelayMs, gmailTypeDelayMs, gmailEnterDelayMs

    InfoLog("GmailSearchCurrentTab called, query=" gmailSearch)

    SubLog("Waiting " gmailSlashDelayMs "ms before sending /")
    Sleep gmailSlashDelayMs

    LogKeyPress("/", "Focus Gmail search bar")
    Send "/"
    SubLog("Slash sent, waiting " gmailTypeDelayMs "ms")
    Sleep gmailTypeDelayMs

    InfoLog("  > Typing search query: " gmailSearch)
    SendText gmailSearch
    SubLog("Query typed, waiting " gmailEnterDelayMs "ms")
    Sleep gmailEnterDelayMs

    LogKeyPress("{Enter}", "Execute Gmail search")
    Send "{Enter}"
    InfoLog("GmailSearchCurrentTab completed")
}
