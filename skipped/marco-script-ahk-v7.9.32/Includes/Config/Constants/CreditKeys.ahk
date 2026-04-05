; Config\Constants\CreditKeys.ahk - [CreditStatus.*] key names

class CreditKey {
    ; API
    static API_BASE_URL          := "LovableApiBaseUrl"
    static AUTH_MODE             := "LovableAuthMode"
    static BEARER_TOKEN          := "LovableBearerToken"

    ; Timing
    static AUTO_CHECK_ENABLED    := "AutoCheckEnabled"
    static AUTO_CHECK_INTERVAL   := "AutoCheckIntervalSeconds"
    static CACHE_TTL             := "CacheTtlSeconds"

    ; Retry
    static MAX_RETRIES           := "MaxRetries"
    static RETRY_BACKOFF         := "RetryBackoffMs"

    ; XPaths
    static PLANS_XPATH           := "PlansButtonXPath"
    static FREE_XPATH            := "FreeProgressBarXPath"
    static TOTAL_XPATH           := "TotalCreditsXPath"

    ; ElementIDs
    static STATUS_ID             := "CreditStatusId"
    static STATUS_BTN_ID         := "CreditStatusBtnId"
}
