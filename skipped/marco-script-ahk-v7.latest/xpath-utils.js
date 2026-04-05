// ============================================
// XPathUtils - Shared XPath & React Click Utilities
// Version: 2.0
// Injected by AHK BEFORE combo.js / macro-looping.js
// Exposes ONLY window.XPathUtils (no individual globals to avoid namespace collisions)
// Logger integration: call XPathUtils.setLogger(logFn, logSubFn, logWarnFn) to route logs into the calling script's storage
// ============================================

(function() {
  'use strict';

  var VERSION = '2.1';
  var PREFIX = '[XPathUtils]';

  // ============================================
  // Console colors
  // ============================================
  var COLOR = {
    FOUND: 'color: lime; font-weight: bold;',
    NOT_FOUND: 'color: #ef4444; font-weight: bold;',
    DETAIL: 'color: #a5b4fc;',
    CLICK: 'color: cyan; font-weight: bold;',
    WARN: 'color: orange; font-weight: bold;',
    BANNER: 'color: yellow; font-weight: bold;',
    INFO: 'color: #8b5cf6; font-weight: bold;',
    GRAY: 'color: gray;'
  };

  // ============================================
  // Logger integration
  // By default, logs go to console only.
  // Calling scripts (combo.js, macro-looping.js) call setLogger()
  // to route logs into their own localStorage log system.
  // ============================================
  var externalLog = null;
  var externalLogSub = null;
  var externalLogWarn = null;

  function setLogger(logFn, logSubFn, logWarnFn) {
    externalLog = logFn || null;
    externalLogSub = logSubFn || null;
    externalLogWarn = logWarnFn || null;
  }

  // Internal log helpers that route to external logger if set
  function log(funcName, message, style) {
    console.log('%c' + PREFIX + ' [' + funcName + '] ' + message, style || COLOR.DETAIL);
    if (externalLog) {
      try { externalLog(funcName, message); } catch (e) { /* ignore */ }
    }
  }

  function logSub(funcName, message) {
    console.log('%c' + PREFIX + '  ' + funcName + ': ' + message, COLOR.GRAY);
    if (externalLogSub) {
      try { externalLogSub(funcName, message); } catch (e) { /* ignore */ }
    }
  }

  function logWarn(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] WARN: ' + message, COLOR.WARN);
    if (externalLogWarn) {
      try { externalLogWarn(funcName, message); } catch (e) { /* ignore */ }
    }
  }

  // ============================================
  // logDomElement(el, label)
  // Logs comprehensive DOM details about an element.
  // ============================================
  function logDomElement(el, label) {
    label = label || 'Element';
    var fn = 'logDomElement';
    var tag = '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '>';

    console.groupCollapsed('%c' + PREFIX + ' DOM: ' + label + ' ' + tag, COLOR.DETAIL);
    console.log('  Tag:', tag);
    console.log('  ID:', el.id || '(none)');
    console.log('  Classes:', el.className || '(none)');
    console.log('  Text:', (el.textContent || '').substring(0, 100));
    console.log('  Type:', el.getAttribute('type') || '(none)');
    console.log('  Role:', el.getAttribute('role') || '(none)');
    console.log('  aria-label:', el.getAttribute('aria-label') || '(none)');
    console.log('  aria-expanded:', el.getAttribute('aria-expanded'));
    console.log('  aria-haspopup:', el.getAttribute('aria-haspopup'));
    console.log('  disabled:', el.disabled || el.getAttribute('aria-disabled'));
    console.log('  data-state:', el.getAttribute('data-state'));

    // Visibility
    var rect = el.getBoundingClientRect();
    var isVisible = el.offsetParent !== null || el.offsetWidth > 0;
    console.log('  Visible:', isVisible);
    console.log('  BoundingRect:', JSON.stringify({ x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }));

    // Parent chain (3 levels)
    var parent = el.parentElement;
    var chain = [];
    for (var p = 0; p < 3 && parent; p++) {
      chain.push('<' + parent.tagName.toLowerCase() + (parent.id ? '#' + parent.id : '') + '>');
      parent = parent.parentElement;
    }
    console.log('  Parent chain:', chain.join(' → '));
    console.groupEnd();

    // Route summary to external logger
    log(fn, label + ' ' + tag + ' role=' + (el.getAttribute('role') || 'none') + ' visible=' + isVisible, COLOR.DETAIL);
  }

  // ============================================
  // checkOverlay(el)
  // Checks if another element is covering the target at its center point.
  // Returns { isCovered, coveringElement }
  // ============================================
  function checkOverlay(el) {
    var fn = 'checkOverlay';
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var topEl = document.elementFromPoint(cx, cy);

    if (!topEl) {
      logWarn(fn, 'elementFromPoint returned null (off-screen?)');
      return { isCovered: true, coveringElement: null };
    }

    var isSameOrChild = el === topEl || el.contains(topEl) || topEl.contains(el);
    if (!isSameOrChild) {
      var coverTag = '<' + topEl.tagName.toLowerCase() + (topEl.id ? '#' + topEl.id : '') + '>';
      logWarn(fn, 'OVERLAY DETECTED: ' + coverTag + ' covers target at (' + Math.round(cx) + ',' + Math.round(cy) + ')');
      logDomElement(topEl, 'Covering element');
      return { isCovered: true, coveringElement: topEl };
    }

    logSub(fn, 'No overlay — target is clear');
    return { isCovered: false, coveringElement: null };
  }

  // ============================================
  // reactClick(el, xpath)
  // Enhanced: Dispatches pointer + mouse events, logs every step, checks overlay, tracks aria-expanded.
  // ============================================
  function reactClick(el, xpath) {
    var fn = 'reactClick';
    xpath = xpath || '(direct call)';
    var tag = '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '>';

    log(fn, '=== React Click Start ===', COLOR.BANNER);
    log(fn, 'Target: ' + tag + ' | XPath: ' + xpath, COLOR.BANNER);
    logDomElement(el, 'Click target');

    // Pre-click state
    var preExpanded = el.getAttribute('aria-expanded');
    var preState = el.getAttribute('data-state');
    logSub(fn, 'Pre-click: aria-expanded=' + preExpanded + ', data-state=' + preState);

    // Overlay check
    var overlay = checkOverlay(el);
    if (overlay.isCovered) {
      logWarn(fn, 'Element may be covered by overlay — click might not reach target!');
    }

    // Coordinates
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    logSub(fn, 'Coords: (' + Math.round(cx) + ', ' + Math.round(cy) + '), size: ' + Math.round(rect.width) + 'x' + Math.round(rect.height));

    var opts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy };
    var pointerOpts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true };

    // Dispatch full event sequence
    var events = [
      { type: 'pointerdown', cls: PointerEvent, o: pointerOpts },
      { type: 'mousedown',   cls: MouseEvent,   o: opts },
      { type: 'pointerup',   cls: PointerEvent, o: pointerOpts },
      { type: 'mouseup',     cls: MouseEvent,   o: opts },
      { type: 'click',       cls: MouseEvent,   o: opts }
    ];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var dispatched = el.dispatchEvent(new ev.cls(ev.type, ev.o));
      logSub(fn, '→ ' + ev.type + ' dispatched (defaultPrevented=' + !dispatched + ')');
    }

    // Post-click state check (after microtask)
    setTimeout(function() {
      var postExpanded = el.getAttribute('aria-expanded');
      var postState = el.getAttribute('data-state');
      var expandedChanged = preExpanded !== postExpanded;
      var stateChanged = preState !== postState;

      if (expandedChanged || stateChanged) {
        log(fn, 'Post-click: aria-expanded=' + postExpanded + ' (' + (expandedChanged ? 'CHANGED ✓' : 'unchanged') + '), data-state=' + postState + ' (' + (stateChanged ? 'CHANGED ✓' : 'unchanged') + ')', COLOR.FOUND);
      } else {
        logWarn(fn, 'No state change detected — click may not have worked. Check isTrusted or overlay.');
        logSub(fn, 'Post-click: aria-expanded=' + postExpanded + ', data-state=' + postState);
      }
    }, 50);
  }

  // ============================================
  // findByXPath(xpath)
  // Enhanced: logs full DOM details for found elements.
  // ============================================
  function findByXPath(xpath) {
    var fn = 'findByXPath';
    if (!xpath || !xpath.trim()) {
      logWarn(fn, 'XPath is empty, returning null');
      return null;
    }
    try {
      var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (result) {
        log(fn, 'FOUND: ' + xpath, COLOR.FOUND);
        logDomElement(result, 'Found element');
        // Highlight briefly
        var origOutline = result.style.outline;
        result.style.outline = '3px solid lime';
        setTimeout(function() { result.style.outline = origOutline; }, 2000);
        return result;
      } else {
        logSub(fn, 'NOT FOUND: ' + xpath);
        return null;
      }
    } catch (e) {
      logWarn(fn, 'Invalid XPath: ' + xpath + ' — ' + e.message);
      return null;
    }
  }

  // ============================================
  // findElement(descriptor) - Multi-method element finder
  // descriptor: { name, xpath, textMatch, tag, selector, role, ariaLabel, headingSearch }
  // ============================================
  function findElement(descriptor) {
    var fn = 'findElement';
    var name = descriptor.name || 'unknown';
    log(fn, 'Searching for "' + name + '"', COLOR.DETAIL);

    // Method 1: Configured XPath
    if (descriptor.xpath) {
      logSub(fn, 'Method 1 (XPath) for ' + name + ': ' + descriptor.xpath);
      var xpathResult = findByXPath(descriptor.xpath);
      if (xpathResult) {
        logSub(fn, name + ' FOUND via XPath');
        return xpathResult;
      }
      logWarn(fn, name + ' XPath failed — trying fallbacks');
    }

    // Method 2: Text-based scan
    if (descriptor.textMatch) {
      var tag = descriptor.tag || 'button';
      var texts = Array.isArray(descriptor.textMatch) ? descriptor.textMatch : [descriptor.textMatch];
      logSub(fn, 'Method 2 (text scan): looking for ' + JSON.stringify(texts) + ' in <' + tag + '>');
      var allTags = document.querySelectorAll(tag);
      for (var t = 0; t < allTags.length; t++) {
        var elText = (allTags[t].textContent || '').trim();
        for (var m = 0; m < texts.length; m++) {
          var isMatch = elText === texts[m] || elText.indexOf(texts[m]) !== -1;
          if (isMatch) {
            logSub(fn, name + ' FOUND via text scan: "' + elText.substring(0, 40) + '"');
            return allTags[t];
          }
        }
      }
      logSub(fn, 'No text match found');
    }

    // Method 3: CSS selector
    if (descriptor.selector) {
      var selectors = Array.isArray(descriptor.selector) ? descriptor.selector : [descriptor.selector];
      logSub(fn, 'Method 3 (CSS selector): trying ' + selectors.length + ' selectors');
      for (var s = 0; s < selectors.length; s++) {
        try {
          var selectorResult = document.querySelector(selectors[s]);
          if (selectorResult) {
            logSub(fn, name + ' FOUND via selector: ' + selectors[s]);
            return selectorResult;
          }
        } catch (e) {
          logWarn(fn, 'Invalid selector: ' + selectors[s]);
        }
      }
      logSub(fn, 'No CSS selector match');
    }

    // Method 4: ARIA/role attributes
    if (descriptor.ariaLabel || descriptor.role) {
      logSub(fn, 'Method 4 (ARIA/role)');
      if (descriptor.ariaLabel) {
        var ariaLabels = Array.isArray(descriptor.ariaLabel) ? descriptor.ariaLabel : [descriptor.ariaLabel];
        for (var a = 0; a < ariaLabels.length; a++) {
          var ariaSelector = '[aria-label*="' + ariaLabels[a] + '" i], [title*="' + ariaLabels[a] + '" i]';
          try {
            var ariaResult = document.querySelector(ariaSelector);
            if (ariaResult) {
              logSub(fn, name + ' FOUND via ARIA label: ' + ariaLabels[a]);
              return ariaResult;
            }
          } catch (e) { /* ignore */ }
        }
      }
      if (descriptor.role) {
        var roleSelector = '[role="' + descriptor.role + '"]';
        var roleResult = document.querySelector(roleSelector);
        if (roleResult) {
          logSub(fn, name + ' FOUND via role: ' + descriptor.role);
          return roleResult;
        }
      }
      logSub(fn, 'No ARIA/role match');
    }

    // Method 5: Heading proximity search
    if (descriptor.headingSearch) {
      logSub(fn, 'Method 5 (heading proximity): looking for heading with "' + descriptor.headingSearch + '"');
      var headings = document.querySelectorAll('h2, h3, h4, div[class*="heading"], div[class*="title"]');
      for (var h = 0; h < headings.length; h++) {
        var headingText = (headings[h].textContent || '').trim().toLowerCase();
        var isHeadingMatch = headingText.indexOf(descriptor.headingSearch.toLowerCase()) !== -1;
        if (isHeadingMatch) {
          var parent = headings[h].closest('div');
          var walkNode = parent;
          var walkTag = descriptor.tag || 'button';
          var maxWalk = 5;
          var walkCount = 0;
          while (walkNode && walkCount < maxWalk) {
            var nearbyEl = walkNode.querySelector(walkTag);
            if (nearbyEl) {
              logSub(fn, name + ' FOUND near heading "' + headingText.substring(0, 30) + '" at walk level ' + walkCount);
              return nearbyEl;
            }
            walkNode = walkNode.parentElement;
            walkCount++;
          }
        }
      }
      logSub(fn, 'No heading proximity match');
    }

    // All methods failed
    logWarn(fn, 'All methods failed for "' + name + '"');
    return null;
  }

  // ============================================
  // clickByXPath(xpath) - Find + click
  // ============================================
  function clickByXPath(xpath) {
    var el = findByXPath(xpath);
    if (el) {
      reactClick(el, xpath);
      log('clickByXPath', 'CLICKED: ' + xpath, COLOR.CLICK);
      return true;
    }
    return false;
  }

  // ============================================
  // findAndClick(xpath) - Find + overlay check + click
  // ============================================
  function findAndClick(xpath) {
    var fn = 'findAndClick';
    log(fn, '=== Find & Click ===', COLOR.BANNER);
    logSub(fn, 'Target: ' + xpath);
    var el = findByXPath(xpath);
    var result = { found: !!el, clicked: false, element: el, overlay: null };
    if (el) {
      result.overlay = checkOverlay(el);
      try {
        reactClick(el, xpath);
        result.clicked = true;
        log(fn, 'SUCCESS', COLOR.FOUND);
      } catch (e) {
        logWarn(fn, 'CLICK FAILED: ' + e.message);
      }
    } else {
      logWarn(fn, 'Element not found');
    }
    return result;
  }

  // ============================================
  // probeIsTrusted(xpath) - Diagnose isTrusted issues
  // ============================================
  function probeIsTrusted(xpath) {
    var fn = 'probeIsTrusted';
    log(fn, '=== isTrusted Probe ===', COLOR.BANNER);
    logSub(fn, 'Will click: ' + xpath);

    var eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    var listeners = [];

    function makeListener(type) {
      var handler = function(e) {
        console.log('%c' + PREFIX + ' [Probe] ' + type + ': target=<' + e.target.tagName.toLowerCase() + (e.target.id ? '#' + e.target.id : '') + '>, isTrusted=' + e.isTrusted + ', bubbles=' + e.bubbles, e.isTrusted ? COLOR.FOUND : COLOR.WARN);
      };
      document.addEventListener(type, handler, true);
      listeners.push({ type: type, handler: handler });
    }

    for (var i = 0; i < eventTypes.length; i++) {
      makeListener(eventTypes[i]);
    }

    clickByXPath(xpath);

    setTimeout(function() {
      for (var j = 0; j < listeners.length; j++) {
        document.removeEventListener(listeners[j].type, listeners[j].handler, true);
      }
      logSub(fn, 'Listeners removed. Check results above.');
    }, 500);
  }

  // ============================================
  // inspectListeners(xpath) - Show event listeners + React handlers
  // ============================================
  function inspectListeners(xpath) {
    var fn = 'inspectListeners';
    var el = findByXPath(xpath);
    if (!el) return;
    log(fn, '=== Event Listener Inspection ===', COLOR.BANNER);

    if (typeof getEventListeners === 'function') {
      var listeners = getEventListeners(el);
      console.log(PREFIX + ' Listeners on element:', listeners);
    } else {
      logSub(fn, 'getEventListeners not available (only in Chrome DevTools console)');
      var props = ['onclick', 'onmousedown', 'onmouseup', 'onpointerdown', 'onpointerup'];
      for (var i = 0; i < props.length; i++) {
        if (el[props[i]]) {
          logSub(fn, props[i] + ': ' + (typeof el[props[i]]));
        }
      }
      // Check React fiber
      var fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'); });
      if (fiberKey) {
        logSub(fn, 'React fiber found: ' + fiberKey);
        var propsKey = Object.keys(el).find(function(k) { return k.startsWith('__reactProps'); });
        if (propsKey) {
          var reactProps = el[propsKey];
          var handlerKeys = Object.keys(reactProps).filter(function(k) { return k.startsWith('on'); });
          logSub(fn, 'React event handlers: ' + (handlerKeys.length > 0 ? handlerKeys.join(', ') : '(none)'));
        }
      } else {
        logSub(fn, 'No React fiber found on element');
      }
    }
  }

  // ============================================
  // fireAll(xpath) - Ultimate interaction simulator
  // Focus + pointer/mouse sequence + blur for form elements
  // ============================================
  function fireAll(xpath) {
    var fn = 'fireAll';
    log(fn, '=== Fire All Events ===', COLOR.BANNER);
    logSub(fn, 'XPath: ' + xpath);

    var el = findByXPath(xpath);
    if (!el) {
      logWarn(fn, 'Element not found — aborting');
      return { found: false, element: null, isFormElement: false };
    }

    logDomElement(el, 'fireAll target');

    // Detect form elements
    var tag = el.tagName.toLowerCase();
    var isFormElement = (tag === 'input' || tag === 'textarea' || tag === 'select' ||
                         el.getAttribute('contenteditable') === 'true' ||
                         el.getAttribute('role') === 'textbox' ||
                         el.getAttribute('role') === 'combobox' ||
                         el.getAttribute('role') === 'listbox');

    logSub(fn, 'isFormElement=' + isFormElement + ' (tag=' + tag + ')');

    // Overlay check
    var overlay = checkOverlay(el);
    if (overlay.isCovered) {
      logWarn(fn, 'Overlay detected — events may not reach target');
    }

    // Pre-interaction state
    var preExpanded = el.getAttribute('aria-expanded');
    var preState = el.getAttribute('data-state');
    var preValue = el.value !== undefined ? el.value : null;
    var activeBeforeClick = document.activeElement;
    logSub(fn, 'Pre-state: aria-expanded=' + preExpanded + ', data-state=' + preState + ', value=' + (preValue !== null ? '"' + String(preValue).substring(0, 30) + '"' : 'N/A'));

    // Coordinates
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var coordOpts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy };
    var pointerOpts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true };

    // Phase 1: Focus (form elements only)
    if (isFormElement) {
      logSub(fn, 'Phase 1: Dispatching focus events');
      el.dispatchEvent(new FocusEvent('focusin', { bubbles: true, cancelable: false, relatedTarget: activeBeforeClick }));
      logSub(fn, '→ focusin dispatched');
      el.dispatchEvent(new FocusEvent('focus', { bubbles: false, cancelable: false, relatedTarget: activeBeforeClick }));
      logSub(fn, '→ focus dispatched');
      try { el.focus(); } catch (e) { /* some elements reject focus */ }
      logSub(fn, '→ el.focus() called (activeElement=' + document.activeElement.tagName.toLowerCase() + ')');
    }

    // Phase 2: Pointer + Mouse sequence
    logSub(fn, 'Phase 2: Dispatching pointer + mouse events at (' + Math.round(cx) + ',' + Math.round(cy) + ')');
    var events = [
      { type: 'pointerdown', cls: PointerEvent, o: pointerOpts },
      { type: 'mousedown',   cls: MouseEvent,   o: coordOpts },
      { type: 'pointerup',   cls: PointerEvent, o: pointerOpts },
      { type: 'mouseup',     cls: MouseEvent,   o: coordOpts },
      { type: 'click',       cls: MouseEvent,   o: coordOpts }
    ];

    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var dispatched = el.dispatchEvent(new ev.cls(ev.type, ev.o));
      logSub(fn, '→ ' + ev.type + ' dispatched (defaultPrevented=' + !dispatched + ')');
    }

    // Phase 3: Blur (form elements, after delay)
    if (isFormElement) {
      setTimeout(function() {
        logSub(fn, 'Phase 3: Dispatching blur events');
        el.dispatchEvent(new FocusEvent('focusout', { bubbles: true, cancelable: false, relatedTarget: null }));
        logSub(fn, '→ focusout dispatched');
        el.dispatchEvent(new FocusEvent('blur', { bubbles: false, cancelable: false, relatedTarget: null }));
        logSub(fn, '→ blur dispatched');
      }, 100);
    }

    // Phase 4: Post-interaction state check
    setTimeout(function() {
      var postExpanded = el.getAttribute('aria-expanded');
      var postState = el.getAttribute('data-state');
      var postValue = el.value !== undefined ? el.value : null;
      var expandedChanged = preExpanded !== postExpanded;
      var stateChanged = preState !== postState;
      var valueChanged = preValue !== null && postValue !== null && preValue !== postValue;
      var anyChange = expandedChanged || stateChanged || valueChanged;

      if (anyChange) {
        log(fn, 'Post-state: expanded=' + (expandedChanged ? 'CHANGED ✓' : 'same') + ', state=' + (stateChanged ? 'CHANGED ✓' : 'same') + (preValue !== null ? ', value=' + (valueChanged ? 'CHANGED ✓' : 'same') : ''), COLOR.FOUND);
      } else {
        logWarn(fn, 'No state change detected — interaction may not have worked.');
      }
      log(fn, '=== Fire All Complete ===', COLOR.BANNER);
    }, 150);

    return { found: true, element: el, isFormElement: isFormElement };
  }

  // ============================================
  // Expose ONLY as window.XPathUtils — no individual globals
  // ============================================
  window.XPathUtils = {
    version: VERSION,
    setLogger: setLogger,
    reactClick: reactClick,
    findByXPath: findByXPath,
    findElement: findElement,
    clickByXPath: clickByXPath,
    findAndClick: findAndClick,
    fireAll: fireAll,
    checkOverlay: checkOverlay,
    logDomElement: logDomElement,
    probeIsTrusted: probeIsTrusted,
    inspectListeners: inspectListeners
  };

  console.log('%c' + PREFIX + ' v' + VERSION + ' loaded — access via window.XPathUtils only', COLOR.INFO);
  console.log('%c  XPathUtils.reactClick(el, xpath?)      — Full 5-event sequence with logging', COLOR.GRAY);
  console.log('%c  XPathUtils.findByXPath(xpath)           — Find & log DOM element details', COLOR.GRAY);
  console.log('%c  XPathUtils.findElement(descriptor)      — Multi-method element finder', COLOR.GRAY);
  console.log('%c  XPathUtils.clickByXPath(xpath)          — Find + click', COLOR.GRAY);
  console.log('%c  XPathUtils.findAndClick(xpath)          — Find + overlay check + click', COLOR.GRAY);
  console.log('%c  XPathUtils.fireAll(xpath)               — Focus + pointer/mouse + blur (form-aware)', COLOR.GRAY);
  console.log('%c  XPathUtils.probeIsTrusted(xpath)        — Click + log isTrusted', COLOR.GRAY);
  console.log('%c  XPathUtils.inspectListeners(xpath)      — Show event listeners + React', COLOR.GRAY);
  console.log('%c  XPathUtils.checkOverlay(el)             — Check if element is covered', COLOR.GRAY);
  console.log('%c  XPathUtils.logDomElement(el, label?)     — Log full DOM details', COLOR.GRAY);
  console.log('%c  XPathUtils.setLogger(logFn, logSubFn, logWarnFn) — Route logs to caller', COLOR.GRAY);

})();
