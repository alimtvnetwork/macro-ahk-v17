# ============================================
# Automator v2 Setup (with lovable.dev + Execute button)
# ============================================

$outputDir = $PSScriptRoot
if (-not $outputDir) { $outputDir = Get-Location }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Automator v2 Setup (v4)" -ForegroundColor Cyan
Write-Host " Output directory: $outputDir" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1) config.ini
$configIni = @"
[Hotkeys]
ComboDown=^Down
ComboUp=^Up
GmailUnread=^+F9
MacroUp=^+!Up
MacroDown=^+!Down

[ComboSwitch]
TransferButtonXPath=/html/body/div[2]/div/div/div/div/div/div/div[1]/div/div/div[3]/div[6]/div[2]/button
Combo1XPath=/html/body/div[5]/div[2]/div[1]/div/p
Combo2ButtonXPath=/html/body/div[5]/div[2]/div[2]/button
OptionsContainerXPath=/html/body/div[6]/div
ConfirmButtonXPath=/html/body/div[5]/div[3]/button[2]

[Gmail]
URL=https://mail.google.com
SearchQuery=is:unread

[General]
BrowserExe=chrome.exe
ConsoleDelay=800
PasteDelay=200

[Macro]
ToolButtonXPath=/html/body/div[2]/div/div[2]/nav/div/div/div/div[1]/div[1]/button/div/div/svg
ProgressXPath=/html/body/div[4]/div/div[2]/div[2]/div/div[2]/div/div[2]
SuggestionsAllXPath=/html/body/div[2]/div/div[2]/main/div/div/div[1]/div/div[2]/div/div[1]/div[1]
FirstSuggestionXPath=/html/body/div[2]/div/div[2]/main/div/div/div[1]/div/div[2]/div/div[1]/div[1]/div[1]
IntervalMs=15000
ExecuteButtonXPath=/html/body/div[2]/div/div[2]/main/div/div/div[1]/div/div[2]/div/form/div[3]/div/button[2]
"@

Set-Content -Path (Join-Path $outputDir "config.ini") -Value $configIni -Encoding UTF8
Write-Host "[OK] config.ini" -ForegroundColor Green

# 2) combo.js (same as before)
$comboJs = @"
(function() {
  console.log("%c[ComboSwitch] Started, direction: __DIRECTION__", "color: cyan; font-weight: bold;");

  function getNodeByXPath(xpath) {
    return document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }

  function waitForElement(xpath, description, callback, maxAttempts) {
    var attempts = 0;
    var max = maxAttempts || 20;
    var interval = setInterval(function() {
      attempts++;
      var el = getNodeByXPath(xpath);
      if (el) {
        clearInterval(interval);
        console.log("%c[ComboSwitch] " + description + " FOUND (attempt " + attempts + ")", "color: lime;");
        callback(el);
      } else if (attempts >= max) {
        clearInterval(interval);
        console.error("[ComboSwitch] " + description + " NOT FOUND after " + max + " attempts");
        alert("[ComboSwitch] FAILED: " + description + " not found.");
      }
    }, 300);
  }

  var transferBtn = getNodeByXPath("__TRANSFER_XPATH__");
  if (transferBtn) {
    console.log("%c[ComboSwitch] Transfer button FOUND, clicking...", "color: lime;");
    transferBtn.click();
  } else {
    console.error("[ComboSwitch] Transfer button NOT FOUND");
    alert("[ComboSwitch] FAILED: Transfer button not found.");
    return;
  }

  waitForElement("__COMBO1_XPATH__", "Combo 1 text", function(combo1) {
    var sourceText = combo1.textContent.trim();
    console.log("%c[ComboSwitch] Combo 1 text = '" + sourceText + "'", "color: lime;");

    waitForElement("__COMBO2_XPATH__", "Combo 2 button", function(combo2Btn) {
      combo2Btn.click();

      var openAttempts = 0;
      var openInterval = setInterval(function() {
        openAttempts++;
        var openTrigger = document.querySelector("button[data-state='open']");
        if (openTrigger) {
          clearInterval(openInterval);
          console.log("%c[ComboSwitch] Combo 2 is OPEN", "color: lime;");

          waitForElement("__OPTIONS_XPATH__", "Options container", function(listRoot) {
            var options = Array.from(listRoot.querySelectorAll("div[role='option']"));
            console.log("%c[ComboSwitch] Found " + options.length + " options", "color: lime;");

            var labels = options.map(function(opt) {
              var p = opt.querySelector("p.min-w-0.truncate");
              return p ? p.textContent.trim() : opt.textContent.trim();
            });
            console.log("[ComboSwitch] All labels:", labels);

            var currentIndex = -1;
            for (var i = 0; i < labels.length; i++) {
              if (labels[i] === sourceText) { currentIndex = i; break; }
            }

            if (currentIndex === -1) {
              for (var j = 0; j < labels.length; j++) {
                if (labels[j].indexOf(sourceText) !== -1 || sourceText.indexOf(labels[j]) !== -1) {
                  currentIndex = j;
                  break;
                }
              }
            }

            if (currentIndex === -1) {
              console.error("[ComboSwitch] '" + sourceText + "' NOT FOUND");
              alert("[ComboSwitch] FAILED: Could not match '" + sourceText + "'");
              return;
            }

            var targetIndex;
            if ("__DIRECTION__" === "up") {
              targetIndex = (currentIndex - 1 >= 0) ? currentIndex - 1 : options.length - 1;
            } else {
              targetIndex = (currentIndex + 1 < options.length) ? currentIndex + 1 : 0;
            }

            console.log("%c[ComboSwitch] Selecting '" + labels[targetIndex] + "' (__DIRECTION__)", "color: yellow; font-weight: bold;");
            options[targetIndex].click();

            waitForElement("__CONFIRM_XPATH__", "Confirm button", function(finalBtn) {
              finalBtn.click();
              console.log("%c[ComboSwitch] DONE!", "color: cyan; font-weight: bold; font-size: 14px;");
            });
          });
        } else if (openAttempts >= 20) {
          clearInterval(openInterval);
          alert("[ComboSwitch] FAILED: Combo 2 did not open.");
        }
      }, 300);
    });
  });
})();
"@

Set-Content -Path (Join-Path $outputDir "combo.js") -Value $comboJs -Encoding UTF8
Write-Host "[OK] combo.js" -ForegroundColor Green

# 3) Automator.ahk with domain guard + execute button
$automatorAhk = @"
#Requires AutoHotkey >=2.0
#SingleInstance Force

configFile := A_ScriptDir "\config.ini"

comboDownHotkey   := IniRead(configFile, "Hotkeys", "ComboDown", "^Down")
comboUpHotkey     := IniRead(configFile, "Hotkeys", "ComboUp", "^Up")
gmailUnreadHotkey := IniRead(configFile, "Hotkeys", "GmailUnread", "^+F9")
macroUpHotkey     := IniRead(configFile, "Hotkeys", "MacroUp", "^+!Up")
macroDownHotkey   := IniRead(configFile, "Hotkeys", "MacroDown", "^+!Down")

transferXPath := IniRead(configFile, "ComboSwitch", "TransferButtonXPath")
combo1XPath   := IniRead(configFile, "ComboSwitch", "Combo1XPath")
combo2XPath   := IniRead(configFile, "ComboSwitch", "Combo2ButtonXPath")
optionsXPath  := IniRead(configFile, "ComboSwitch", "OptionsContainerXPath")
confirmXPath  := IniRead(configFile, "ComboSwitch", "ConfirmButtonXPath")

gmailUrl    := IniRead(configFile, "Gmail", "URL", "https://mail.google.com")
gmailSearch := IniRead(configFile, "Gmail", "SearchQuery", "is:unread")

browserExe   := IniRead(configFile, "General", "BrowserExe", "chrome.exe")
consoleDelay := Integer(IniRead(configFile, "General", "ConsoleDelay", "800"))
pasteDelay   := Integer(IniRead(configFile, "General", "PasteDelay", "200"))

toolButtonXPath      := IniRead(configFile, "Macro", "ToolButtonXPath")
progressXPath        := IniRead(configFile, "Macro", "ProgressXPath")
suggestionsAllXPath  := IniRead(configFile, "Macro", "SuggestionsAllXPath")
firstSuggestionXPath := IniRead(configFile, "Macro", "FirstSuggestionXPath")
macroIntervalMs      := Integer(IniRead(configFile, "Macro", "IntervalMs", "15000"))
executeButtonXPath   := IniRead(configFile, "Macro", "ExecuteButtonXPath")

global isMacroRunning := false
global macroDirection := "down"

Hotkey(comboDownHotkey,  (*) => RunCombo("down"))
Hotkey(comboUpHotkey,    (*) => RunCombo("up"))
Hotkey(gmailUnreadHotkey,(*) => RunGmail())
Hotkey(macroUpHotkey,    (*) => ToggleMacro("up"))
Hotkey(macroDownHotkey,  (*) => ToggleMacro("down"))

TrayTip("Automator v2 loaded (v4).", "Automator v2", 1)

A_TrayMenu.Add("Settings (edit config.ini manually in this version)")
A_TrayMenu.Add()
A_TrayMenu.Default := "Settings (edit config.ini manually in this version)"

RunCombo(direction) {
    js := ""
    try js := FileRead(A_ScriptDir "\combo.js")
    catch {
        MsgBox("Could not read combo.js", "Automator v2")
        return
    }

    js := StrReplace(js, "__DIRECTION__", direction)
    js := StrReplace(js, "__TRANSFER_XPATH__", transferXPath)
    js := StrReplace(js, "__COMBO1_XPATH__", combo1XPath)
    js := StrReplace(js, "__COMBO2_XPATH__", combo2XPath)
    js := StrReplace(js, "__OPTIONS_XPATH__", optionsXPath)
    js := StrReplace(js, "__CONFIRM_XPATH__", confirmXPath)

    InjectJS(js)
}

RunGmail() {
    Run(browserExe " " gmailUrl)
    if WinWait("ahk_exe " browserExe,, 10) {
        WinActivate("ahk_exe " browserExe)
    }
    Sleep(3000)
    Send("/")
    Sleep(500)
    SendText(gmailSearch)
    Sleep(300)
    Send("{Enter}")
}

ToggleMacro(direction) {
    global isMacroRunning, macroDirection, macroIntervalMs

    ; Domain guard: only run on https://lovable.dev/
    currentUrl := InjectJSGet("(function(){return window.location.href;})();")
    if !(SubStr(currentUrl, 1, 21) = "https://lovable.dev/") {
        MsgBox("Macro can only run on https://lovable.dev/ pages.", "Automator v2")
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
    js :=
    (
    (function(){
      function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}
      var btn=x("X_TOOLBTN_X");
      if(btn){console.log("[Macro] Tool button click");btn.click();}
    })();
    )
    js := StrReplace(js, "X_TOOLBTN_X", toolButtonXPath)
    InjectJS(js)
}

CheckProgressBar() {
    global progressXPath
    js :=
    (
    (function(){
      function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}
      var pr=x("X_PROGRESS_X");
      return pr ? "busy" : "idle";
    })();
    )
    js := StrReplace(js, "X_PROGRESS_X", progressXPath)
    state := InjectJSGet(js)
    return (state = "busy")
}

HandleBusyState() {
    global suggestionsAllXPath

    js :=
    (
    (function(){
      function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}
      var c=x("X_SUGALL_X");
      if(!c) return "nosuggestions";
      var items=Array.from(c.querySelectorAll("div"));
      for(var i=0;i<items.length;i++){
        var t=(items[i].textContent||"").trim();
        var l=t.toLowerCase();
        if(t && l.indexOf("verify")===-1){
          items[i].click();
          return "clicked";
        }
      }
      return "skipped";
    })();
    )
    js := StrReplace(js, "X_SUGALL_X", suggestionsAllXPath)
    result := InjectJSGet(js)

    if (result = "clicked") {
        ClickExecuteButton()
    }
}

ClickExecuteButton() {
    global executeButtonXPath

    js :=
    (
    (function(){
      function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}
      var btn=x("X_EXECBTN_X");
      if(btn){
        console.log("[Macro] Execute button click");
        btn.click();
        return "ok";
      }
      console.log("[Macro] Execute button not found");
      return "missing";
    })();
    )
    js := StrReplace(js, "X_EXECBTN_X", executeButtonXPath)
    InjectJS(js)
}

HandleIdleState() {
    global macroDirection, transferXPath, combo1XPath, combo2XPath, optionsXPath, confirmXPath

    currentUrl := InjectJSGet("(function(){return window.location.href;})();")
    if (currentUrl = "") {
        return
    }

    jsBuild :=
    "(function(u){try{var url=new URL(u);return url.origin+url.pathname+\"/settings?tab=project\";}catch(e){return u+\"/settings?tab=project\";}})(""" currentUrl """);"
    settingsUrl := InjectJSGet(jsBuild)

    Send("^l")
    Sleep(150)
    SendText(settingsUrl)
    Sleep(150)
    Send("{Enter}")
    Sleep(2500)

    RunCombo(macroDirection)

    jsMark :=
    (
    (function(){
      function x(p){return document.evaluate(p,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;}
      var btn=x("X_TRANSFER_X");
      if(!btn)return "nolabel";
      var id="ahk-macro-done-label";
      var e=document.getElementById(id);
      if(e){e.textContent=" DONE";return "updated";}
      var s=document.createElement("span");
      s.id=id;s.textContent=" DONE";s.style.marginLeft="8px";s.style.color="#22c55e";s.style.fontWeight="bold";
      btn.parentNode.appendChild(s);return "added";
    })();
    )
    jsMark := StrReplace(jsMark, "X_TRANSFER_X", transferXPath)
    InjectJSGet(jsMark)

    Send("!{Left}")
    Sleep(2000)
}

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
    wrapped := "(function(){var __r=(function(){ " js " })();try{prompt('AHK_RESULT',__r);}catch(e){prompt('AHK_RESULT',String(__r));}})();"
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

Esc::ExitApp()
"@

Set-Content -Path (Join-Path $outputDir "Automator.ahk") -Value $automatorAhk -Encoding UTF8
Write-Host "[OK] Automator.ahk" -ForegroundColor Green

Write-Host ""
Write-Host "Done. Files created: config.ini, combo.js, Automator.ahk" -ForegroundColor Cyan
Write-Host "Run Automator.ahk with AutoHotkey v2." -ForegroundColor Yellow
