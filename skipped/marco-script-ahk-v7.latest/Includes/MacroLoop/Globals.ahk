; MacroLoop\Globals.ahk - Global state variables for MacroLoop module

global macroLoopRunning := false
global macroLoopDirection := "down"
global clipboardPollTimerId := 0
global isHandlingDelegate := false
global consecutiveDelegateFailures := 0
global MAX_DELEGATE_FAILURES := 3
