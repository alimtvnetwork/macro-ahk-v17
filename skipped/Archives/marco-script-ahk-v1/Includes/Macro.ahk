; Includes\Macro.ahk - Macro loop for Lovable.dev

global isMacroRunning := false
global macroDirection := "down"

; --- small helper: current page URL via JS (no Ctrl+L) ---
GetCurrentUrl() {
    try {
        return InjectJSGet("(function(){return window.location.href || '';})();")
    } catch {
        return ""
    }
}

; --- main toggle ---

ToggleMacro(direction) {
    global isMacroRunning, macroDirection, macroIntervalMs

    currentUrl := GetCurrentUrl()

    ; Relaxed check: any lovable.dev URL is allowed
    if !(InStr(currentUrl, "https://lovable.dev/")) {
        MsgBox(
            "Macro can only run on https://lovable.dev/ pages.`nCurrent: " currentUrl,
            "Automator v2"
        )
        return
    }

    if isMacroRunning {
        isMacroRunning := false
        SetTimer(MacroTick, 0)
        return
    }

    isMacroRunning := true
    macroDirection := direction
    SetTimer(MacroTick, macroIntervalMs)
}

MacroTick() {
    global isMacroRunning
    if isMacroRunning {
        MacroStep()
    }
}

MacroStep() {
    global browserExe
    WinActivate("ahk_exe " browserExe)
    Sleep(300)

    ClickToolButton()
    Sleep(1000)

    hasProgress := CheckProgressBar()
    if hasProgress {
        HandleBusyState()
    } else {
        HandleIdleState()
    }
}

ClickToolButton() {
    global toolButtonXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_TOOLBTN_X"");
      if (btn) {
        console.log(""[Macro] Tool button click"");
        btn.click();
      } else {
        console.log(""[Macro] Tool button NOT found"");
      }
    })();
    )"
    js := StrReplace(js, "X_TOOLBTN_X", toolButtonXPath)
    InjectJS(js)
}

CheckProgressBar() {
    global progressXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var pr = x(""X_PROGRESS_X"");
      if (pr) {
        console.log(""[Macro] Progress exists"");
        return ""busy"";
      }
      console.log(""[Macro] No progress bar"");
      return ""idle"";
    })();
    )"
    js := StrReplace(js, "X_PROGRESS_X", progressXPath)
    state := InjectJSGet(js)
    return (state = "busy")
}


HandleBusyState() {
    global suggestionsAllXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var container = x(""X_SUGALL_X"");
      if (!container) {
        console.log(""[Macro] Suggestions container not found"");
        return ""nosuggestions"";
      }
      var items = Array.from(container.querySelectorAll(""div""));
      console.log(""[Macro] Suggestions count: "" + items.length);
      for (var i = 0; i < items.length; i++) {
        var txt = (items[i].textContent || """").trim();
        var lower = txt.toLowerCase();
        if (txt && lower.indexOf(""verify"") === -1) {
          console.log(""[Macro] Clicking suggestion: "" + txt);
          items[i].click();
          return ""clicked"";
        }
      }
      console.log(""[Macro] No suitable suggestion (only verify/empty)"");
      return ""skipped"";
    })();
    )"
    js := StrReplace(js, "X_SUGALL_X", suggestionsAllXPath)
    result := InjectJSGet(js)

    if (result = "clicked") {
        ClickExecuteButton()
    }
}

ClickExecuteButton() {
    global executeButtonXPath

    js := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_EXECBTN_X"");
      if (btn) {
        console.log(""[Macro] Execute button click"");
        btn.click();
        return ""ok"";
      }
      console.log(""[Macro] Execute button not found"");
      return ""missing"";
    })();
    )"
    js := StrReplace(js, "X_EXECBTN_X", executeButtonXPath)
    InjectJS(js)
}

HandleIdleState() {
    global macroDirection, transferXPath

    currentUrl := GetCurrentUrl()
    if (currentUrl = "") {
        return
    }

    settingsUrl := currentUrl
    qPos := InStr(settingsUrl, "?")
    if (qPos)
        settingsUrl := SubStr(settingsUrl, 1, qPos - 1)
    hPos := InStr(settingsUrl, "#")
    if (hPos)
        settingsUrl := SubStr(settingsUrl, 1, hPos - 1)
    if (SubStr(settingsUrl, StrLen(settingsUrl), 1) = "/")
        settingsUrl := RTrim(settingsUrl, "/")
    settingsUrl := settingsUrl . "/settings?tab=project"

    Send("^l")
    Sleep(150)
    SendText(settingsUrl)
    Sleep(150)
    Send("{Enter}")
    Sleep(2500)

    RunCombo(macroDirection)

    jsMark := "
    (
    (function(){
      function x(p){
        return document.evaluate(p, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      var btn = x(""X_TRANSFER_X"");
      if (!btn) {
        console.log(""[Macro] Transfer button not found to label"");
        return ""nolabel"";
      }
      var id = ""ahk-macro-done-label"";
      var existing = document.getElementById(id);
      if (existing) {
        existing.textContent = "" DONE"";
        return ""updated"";
      }
      var span = document.createElement(""span"");
      span.id = id;
      span.textContent = "" DONE"";
      span.style.marginLeft = ""8px"";
      span.style.color = ""#22c55e"";
      span.style.fontWeight = ""bold"";
      btn.parentNode.appendChild(span);
      console.log(""[Macro] DONE label added"");
      return ""added"";
    })();
    )"
    jsMark := StrReplace(jsMark, "X_TRANSFER_X", transferXPath)
    InjectJSGet(jsMark)

    Send("!{Left}")
    Sleep(2000)
}
