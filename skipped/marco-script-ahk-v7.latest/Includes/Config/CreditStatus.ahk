; Includes\Config\CreditStatus.ahk - Load [CreditStatus.*] sections

LoadCreditStatus(file) {
    InfoLog("Loading CreditStatus sections")

    ; === API ===
    global creditApiBaseUrl       := IniRead(file, Sec.CR_API, CreditKey.API_BASE_URL, CreditDef.API_BASE_URL)
    global creditAuthMode         := IniRead(file, Sec.CR_API, CreditKey.AUTH_MODE, CreditDef.AUTH_MODE)
    global creditBearerToken      := IniRead(file, Sec.CR_API, CreditKey.BEARER_TOKEN, CreditDef.BEARER_TOKEN)

    ; === Timing ===
    global creditAutoCheckEnabled := IniRead(file, Sec.CR_TIMING, CreditKey.AUTO_CHECK_ENABLED, CreditDef.AUTO_CHECK_ENABLED)
    global creditAutoCheckInterval := IniRead(file, Sec.CR_TIMING, CreditKey.AUTO_CHECK_INTERVAL, CreditDef.AUTO_CHECK_INTERVAL)
    global creditCacheTtl         := IniRead(file, Sec.CR_TIMING, CreditKey.CACHE_TTL, CreditDef.CACHE_TTL)

    ; === Retry ===
    global creditMaxRetries       := IniRead(file, Sec.CR_RETRY, CreditKey.MAX_RETRIES, CreditDef.MAX_RETRIES)
    global creditRetryBackoff     := IniRead(file, Sec.CR_RETRY, CreditKey.RETRY_BACKOFF, CreditDef.RETRY_BACKOFF)

    ; === XPaths ===
    global creditPlansXPath       := IniRead(file, Sec.CR_XPATHS, CreditKey.PLANS_XPATH, CommonDef.EMPTY)
    global creditFreeXPath        := IniRead(file, Sec.CR_XPATHS, CreditKey.FREE_XPATH, CommonDef.EMPTY)
    global creditTotalXPath       := IniRead(file, Sec.CR_XPATHS, CreditKey.TOTAL_XPATH, CommonDef.EMPTY)

    ; === Element IDs ===
    global creditStatusId         := IniRead(file, Sec.CR_ELEMENT_IDS, CreditKey.STATUS_ID, CreditDef.STATUS_ID)
    global creditStatusBtnId      := IniRead(file, Sec.CR_ELEMENT_IDS, CreditKey.STATUS_BTN_ID, CreditDef.STATUS_BTN_ID)
    SubLog("CreditAuth: " creditAuthMode ", AutoCheck: " creditAutoCheckEnabled ", Interval: " creditAutoCheckInterval "s")
}
