; Includes\WebsiteCheck.ahk
; Generic helpers to detect the current website by URL substring.

; Get the current browser URL by simulating Ctrl+L / Ctrl+C
GetCurrentUrl() {
    oldClip := A_Clipboard
    A_Clipboard := ""

    ; Focus address bar and copy URL
    Send "^l"
    Sleep 80
    Send "^c"
    ClipWait 0.5
    url := A_Clipboard

    A_Clipboard := oldClip
    return Trim(url)
}

; Generic website check: returns true if current URL contains the given marker
IsOnWebsite(marker) {
    if !marker
        return false
    url := GetCurrentUrl()
    if !url
        return false

    url := StrLower(url)
    marker := StrLower(marker)
    return InStr(url, marker) > 0
}
