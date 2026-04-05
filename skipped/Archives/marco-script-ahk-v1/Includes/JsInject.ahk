; Includes\JsInject.ahk - JS injection helpers

InjectJS(js) {
    global browserExe, consoleDelay, pasteDelay
    oldClip := ClipboardAll()
    A_Clipboard := js
    WinActivate("ahk_exe " browserExe)
    Sleep(100)
    Send("^+j")
    Sleep(consoleDelay)
    Send("{F6}")
    Sleep(pasteDelay)
    Send("^v")
    Sleep(pasteDelay)
    Send("{Enter}")
    Sleep(200)
    A_Clipboard := oldClip
}

InjectJSGet(js) {
    global browserExe, consoleDelay, pasteDelay

    wrapped := "
    (
    (function(){
      var __r = (function(){ " js " })();
      try {
        prompt('AHK_RESULT', __r);
      } catch(e) {
        prompt('AHK_RESULT', String(__r));
      }
    })();
    )"

    oldClip := ClipboardAll()
    A_Clipboard := wrapped
    WinActivate("ahk_exe " browserExe)
    Sleep(100)
    Send("^+j")
    Sleep(consoleDelay)
    Send("{F6}")
    Sleep(pasteDelay)
    Send("^v")
    Sleep(pasteDelay)
    Send("{Enter}")
    Sleep(300)
    result := ""
    if WinWaitActive("AHK_RESULT",,1) {
        ControlGetText(&result,"Edit1","AHK_RESULT")
        Send("{Enter}")
    }
    A_Clipboard := oldClip
    return result
}
