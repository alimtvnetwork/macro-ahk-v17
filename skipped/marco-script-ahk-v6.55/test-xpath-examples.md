# XPath Test Utilities - Examples

## Available Functions

All functions are exposed on `window.XPathUtils` when either **MacroLoop** or **ComboSwitch** controller is injected.

### `XPathUtils.findByXPath(xpath)`
Finds an element, highlights it green for 2s, logs details.

```js
// Find a button by text
XPathUtils.findByXPath("//button[contains(text(),'Submit')]")

// Find the project button in Lovable sidebar
XPathUtils.findByXPath("//button[@role='tab' and contains(.,'Project')]")

// Find a progress bar
XPathUtils.findByXPath("//div[@role='progressbar']")

// Find by data attribute
XPathUtils.findByXPath("//div[@data-testid='sidebar']")

// Find an input by placeholder
XPathUtils.findByXPath("//input[@placeholder='Search...']")
```

### `XPathUtils.clickByXPath(xpath)`
Finds + clicks an element, highlights it cyan. Returns `true`/`false`.

```js
// Click the settings tab
XPathUtils.clickByXPath("//a[contains(@href,'/settings')]")

// Click a dropdown option
XPathUtils.clickByXPath("//div[@role='option' and contains(.,'Monthly')]")

// Click a close button
XPathUtils.clickByXPath("//button[@aria-label='Close']")
```

### `XPathUtils.findAndClick(xpath)`
Combined: find, log details, then click. Returns `{ found, clicked, element }`.

```js
// Find and click in one call
var result = XPathUtils.findAndClick("//button[contains(text(),'Save')]")
console.log(result)
// { found: true, clicked: true, element: <button> }

// Chain with conditional
var r = XPathUtils.findAndClick("//div[@role='dialog']//button[contains(.,'Confirm')]")
if (!r.found) console.log('Dialog not open yet')
```

### `XPathUtils.fireAll(xpath)`
Full interaction sequence: focus (for form elements) → pointerdown → mousedown → pointerup → mouseup → click → blur (for form elements). Logs pre/post state changes.

```js
// Simulate full user interaction on a form input
XPathUtils.fireAll("//input[@id='name']")

// Fire all events on a dropdown trigger
XPathUtils.fireAll("//button[@aria-haspopup='listbox']")

// Test a checkbox with full event sequence
XPathUtils.fireAll("//input[@type='checkbox' and @name='agree']")
```

### `XPathUtils.reactClick(xpath)`
Dispatches the 5-event sequence (pointerdown → mousedown → pointerup → mouseup → click) to trigger React synthetic event handlers.

```js
// Click a React-managed button
XPathUtils.reactClick("//button[contains(.,'Save')]")
```

## UI Tester (in Controller Panel)

Both **MacroLoop** and **ComboSwitch** controllers have an **XPath Tester** section at the bottom:

1. Paste an XPath into the input field
2. Click **Find** → highlights the element green, shows tag + text
3. Click **Click** → finds and clicks the element, highlights cyan
4. Click **Fire All** → dispatches full interaction sequence (focus → pointerdown → mousedown → pointerup → mouseup → click → blur), highlights green. For form elements (`input`, `textarea`, `select`, `contenteditable`), includes focus/blur phases. Shows `(focus+click+blur)` or `(click only)` in the result. Requires `XPathUtils.fireAll()` to be available.

## Common Lovable XPaths

```js
// Project button (sidebar)
XPathUtils.findByXPath("//button[@role='tab' and contains(.,'Project')]")

// Progress bar (free credits)
XPathUtils.findByXPath("//div[@role='progressbar']")

// Chat input
XPathUtils.findByXPath("//textarea[@placeholder]")

// Send button
XPathUtils.findByXPath("//button[@type='submit']")

// Workspace name
XPathUtils.findByXPath("//span[contains(@class,'truncate')]")
```

## Debugging Tips

```js
// Check if element exists before automation step
var el = XPathUtils.findByXPath("//div[@role='progressbar']")
if (el) {
  console.log('Width:', el.style.width)
  console.log('aria-valuenow:', el.getAttribute('aria-valuenow'))
}

// Test multiple XPaths to find the right one
var xpaths = [
  "//button[contains(.,'Project')]",
  "//button[@role='tab'][1]",
  "//nav//button[1]"
]
xpaths.forEach(function(x) { XPathUtils.findByXPath(x) })

// Full interaction test on a form element
XPathUtils.fireAll("//input[@placeholder='Search...']")
```

## Diagnostic Tools

```js
// Check if an overlay is blocking the target element
XPathUtils.checkOverlay("//button[contains(.,'Submit')]")

// Probe if the site uses isTrusted anti-automation checks
XPathUtils.probeIsTrusted("//button[contains(.,'Send')]")

// Inspect ARIA states and DOM details
XPathUtils.logDomElement("//div[@role='dialog']")
```
