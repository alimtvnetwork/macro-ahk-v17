; Config\Constants\CreditDefaults.ahk - [CreditStatus.*] default values

class CreditDef {
    ; API
    static API_BASE_URL          := "https://api.lovable.dev"
    static AUTH_MODE             := AuthMode.COOKIE_SESSION
    static BEARER_TOKEN          := ""

    ; Timing
    static AUTO_CHECK_ENABLED    := "1"
    static AUTO_CHECK_INTERVAL   := "60"
    static CACHE_TTL             := "30"

    ; Retry
    static MAX_RETRIES           := "2"
    static RETRY_BACKOFF         := "1000"

    ; ElementIDs
    static STATUS_ID             := "ahk-credit-status"
    static STATUS_BTN_ID         := "ahk-credit-status-btn"
}
