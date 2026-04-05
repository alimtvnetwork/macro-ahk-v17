; Includes\Config\Gmail.ahk - Load [Gmail] section

LoadGmail(file) {
    InfoLog("Loading Gmail section")
    global gmailUrl          := IniRead(file, Sec.GMAIL, GmailKey.URL, GmailDef.URL)
    global gmailSearch       := IniRead(file, Sec.GMAIL, GmailKey.SEARCH_QUERY, GmailDef.SEARCH_QUERY)
    global gmailOpenDelayMs  := IniReadInt(file, Sec.GMAIL, GmailKey.OPEN_DELAY, GmailDef.OPEN_DELAY)
    global gmailSlashDelayMs := IniReadInt(file, Sec.GMAIL, GmailKey.SLASH_DELAY, GmailDef.SLASH_DELAY)
    global gmailTypeDelayMs  := IniReadInt(file, Sec.GMAIL, GmailKey.TYPE_DELAY, GmailDef.TYPE_DELAY)
    global gmailEnterDelayMs := IniReadInt(file, Sec.GMAIL, GmailKey.ENTER_DELAY, GmailDef.ENTER_DELAY)
    SubLog("Gmail URL: " gmailUrl)
}
