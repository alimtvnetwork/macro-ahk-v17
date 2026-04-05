(function() {
  // NOTE: 'use strict' removed to allow arguments.callee for sessionStorage caching

  // Support recovery from sessionStorage: window.__comboRecoverDirection overrides the baked-in direction
  var DIRECTION = window.__comboRecoverDirection || '__DIRECTION__';
  if (window.__comboRecoverDirection) {
    delete window.__comboRecoverDirection;
  }
  var VERSION = '__SCRIPT_VERSION__';

  var ID = {
    SCRIPT_MARKER: '__SCRIPT_MARKER_ID__',
    CONTAINER: '__BUTTON_CONTAINER_ID__',
    BTN_UP: '__BUTTON_UP_ID__',
    BTN_DOWN: '__BUTTON_DOWN_ID__'
  };

  var TIMING = {
    POLL_MS: __COMBO_POLL_INTERVAL_MS__,
    OPEN_MAX: __COMBO_OPEN_MAX_ATTEMPTS__,
    WAIT_MAX: __COMBO_WAIT_MAX_ATTEMPTS__,
    RETRY_COUNT: __COMBO_RETRY_COUNT__,
    RETRY_DELAY_MS: __COMBO_RETRY_DELAY_MS__,
    CONFIRM_DELAY_MS: __COMBO_CONFIRM_DELAY_MS__
  };

  // Credit Status config
  var CREDIT_CFG = {
    API_BASE: '__LOVABLE_API_BASE_URL__',
    AUTH_MODE: '__LOVABLE_AUTH_MODE__',
    BEARER_TOKEN: '__LOVABLE_BEARER_TOKEN__',
    AUTO_CHECK: '__CREDITS_AUTO_CHECK_ENABLED__' === '1',
    INTERVAL_S: parseInt('__CREDITS_AUTO_CHECK_INTERVAL_S__', 10) || 60,
    CACHE_TTL_S: parseInt('__CREDITS_CACHE_TTL_S__', 10) || 30,
    MAX_RETRIES: parseInt('__CREDITS_MAX_RETRIES__', 10) || 2,
    RETRY_BACKOFF: parseInt('__CREDITS_RETRY_BACKOFF_MS__', 10) || 1000,
    PLANS_XPATH: '__PLANS_BUTTON_XPATH__',
    FREE_XPATH: '__FREE_PROGRESS_XPATH__',
    CREDITS_XPATH: '__TOTAL_CREDITS_XPATH__'
  };

  // ============================================
  // XPathUtils integration: delegate reactClick & findByXPath to shared module
  // XPathUtils.js MUST be injected by AHK before combo.js
  // ============================================
  var hasXPathUtils = typeof window.XPathUtils !== 'undefined';
  if (hasXPathUtils) {
    // Route XPathUtils logs into combo's localStorage log system
    window.XPathUtils.setLogger(
      function(fn, msg) { logEntry(fn, msg); },
      function(fn, msg) { logSub(fn, msg); },
      function(fn, msg) { logWarn(fn, msg); }
    );
  }

  // React-compatible click: delegates to XPathUtils if available, fallback inline
  function reactClick(el, callerXpath) {
    if (hasXPathUtils) {
      window.XPathUtils.reactClick(el, callerXpath);
      return;
    }
    // Fallback: inline implementation (only if XPathUtils not loaded)
    var fn = 'reactClick';
    var tag = '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '>';
    logEntry(fn, 'Clicking ' + tag + ' | XPath: ' + (callerXpath || '(no xpath)') + ' [FALLBACK]');
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var opts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy };
    var pointerOpts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', pointerOpts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', pointerOpts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    logSub(fn, 'All 5 events dispatched [FALLBACK]');
  }

  var creditState = {
    lastCheckedAt: null,
    freeTierAvailable: null,
    totalCreditsText: '',
    perWorkspace: [],
    source: null,
    autoTimerId: null
  };

  var XPATH = {
    TRANSFER: "__TRANSFER_XPATH__",
    COMBO1: "__COMBO1_XPATH__",
    COMBO2: "__COMBO2_XPATH__",
    OPTIONS: "__OPTIONS_XPATH__",
    CONFIRM: "__CONFIRM_XPATH__"
  };

  var COLOR = {
    CYAN: 'color: cyan; font-weight: bold;',
    CYAN_LG: 'color: cyan; font-weight: bold; font-size: 14px;',
    LIME: 'color: lime;',
    LIME_BOLD: 'color: lime; font-weight: bold;',
    YELLOW: 'color: yellow; font-weight: bold;',
    GRAY: 'color: gray;',
    RED: 'color: #ef4444; font-weight: bold;',
    ORANGE: 'color: orange;'
  };

  var PREFIX = '[ComboSwitch]';

  // ============================================
  // localStorage logging system
  // ============================================
  var LOG_STORAGE_KEY = 'ahk_combo_logs';
  var LOG_MAX_ENTRIES = 500;

  function getLogStorageKey() {
    var url = window.location.href;
    var projectMatch = url.match(/\/projects\/([a-f0-9-]+)/);
    var projectId = projectMatch ? projectMatch[1].substring(0, 8) : 'unknown';
    return LOG_STORAGE_KEY + '_' + projectId;
  }

  function persistLog(level, funcName, message) {
    try {
      var key = getLogStorageKey();
      var logs = JSON.parse(localStorage.getItem(key) || '[]');
      var now = new Date();
      var timestamp = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logs.push({
        t: timestamp,
        l: level,
        f: funcName,
        m: message,
        url: window.location.pathname
      });
      if (logs.length > LOG_MAX_ENTRIES) {
        logs = logs.slice(logs.length - LOG_MAX_ENTRIES);
      }
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (e) { /* storage full or unavailable */ }
  }

  function getAllLogs() {
    try {
      var key = getLogStorageKey();
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { return []; }
  }

  function clearLogs() {
    try {
      var key = getLogStorageKey();
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  function formatLogsForExport() {
    var logs = getAllLogs();
    var lines = [];
    lines.push('=== ComboSwitch Logs ===');
    lines.push('Project URL: ' + window.location.href);
    lines.push('Exported at: ' + new Date().toISOString());
    lines.push('Total entries: ' + logs.length);
    lines.push('---');
    for (var i = 0; i < logs.length; i++) {
      var e = logs[i];
      lines.push('[' + e.t + '] [' + e.l + '] [' + e.f + '] ' + e.m);
    }
    return lines.join('\n');
  }

  function copyLogsToClipboard() {
    var text = formatLogsForExport();
    navigator.clipboard.writeText(text).then(function() {
      logEntry('copyLogs', 'Copied ' + getAllLogs().length + ' log entries to clipboard');
    }).catch(function(err) {
      logWarn('copyLogs', 'Clipboard copy failed: ' + err.message);
    });
  }

  function downloadLogs() {
    var text = formatLogsForExport();
    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'comboswitch-logs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logEntry('downloadLogs', 'Downloaded logs file');
  }

  window.__comboLogs = { copy: copyLogsToClipboard, download: downloadLogs, get: getAllLogs, clear: clearLogs, format: formatLogsForExport };

  function logEntry(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] ' + message, COLOR.LIME);
    persistLog('INFO', funcName, message);
  }

  function logSub(funcName, message, indent) {
    var level = indent || 1;
    var pad = '';
    for (var p = 0; p < level; p++) pad += '  ';
    console.log('%c' + PREFIX + pad + funcName + ': ' + message, COLOR.GRAY);
    persistLog('SUB', funcName, pad + message);
  }

  function logStep(funcName, stepNum, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] Step ' + stepNum + ': ' + message, COLOR.LIME);
    persistLog('STEP', funcName, 'Step ' + stepNum + ': ' + message);
  }

  function logInfo(funcName, message) {
    console.log(PREFIX + ' [' + funcName + '] ' + message);
    persistLog('INFO', funcName, message);
  }

  function logBanner(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] ' + message, COLOR.CYAN_LG);
    persistLog('BANNER', funcName, message);
  }

  function logHighlight(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] ' + message, COLOR.YELLOW);
    persistLog('HIGHLIGHT', funcName, message);
  }

  function logWarn(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] WARN: ' + message, COLOR.ORANGE);
    persistLog('WARN', funcName, message);
  }

  function logError(funcName, step, message, xpath) {
    var msg = PREFIX + ' [' + funcName + '] Step ' + step + ': ERROR - ' + message;
    if (xpath) msg += ' XPath: ' + xpath;
    console.error(msg);
    persistLog('ERROR', funcName, 'Step ' + step + ': ' + message + (xpath ? ' XPath: ' + xpath : ''));
  }

  // findByXPath: delegates to XPathUtils if available
  function findByXPath(xpath) {
    if (hasXPathUtils) {
      return window.XPathUtils.findByXPath(xpath);
    }
    // Fallback
    var fn = 'findByXPath';
    var isXPathEmpty = isEmptyString(xpath);
    if (isXPathEmpty) {
      logWarn(fn, 'XPath is empty, returning null');
      return null;
    }
    try {
      var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      var isFound = !!result;
      logSub(fn, 'XPath ' + (isFound ? 'FOUND' : 'NOT FOUND') + ': ' + xpath);
      return result;
    } catch (e) {
      console.error(PREFIX + ' [' + fn + '] Invalid XPath: ' + xpath, e);
      return null;
    }
  }

  // ============================================
  // S-001: Generic findElement() with multi-method fallback
  // descriptor: { name, xpath, textMatch, tag, selector, role, ariaLabel, headingSearch }
  // ============================================
  function findElement(descriptor) {
    var fn = 'findElement';
    var name = descriptor.name || 'unknown';
    logEntry(fn, 'Searching for "' + name + '"');

    // Method 1: Configured XPath
    if (descriptor.xpath) {
      logSub(fn, 'Method 1 (XPath) for ' + name + ': ' + descriptor.xpath);
      var xpathResult = findByXPath(descriptor.xpath);
      if (xpathResult) {
        logSub(fn, name + ' FOUND via XPath: ' + descriptor.xpath);
        return xpathResult;
      }
      logWarn(fn, name + ' XPath failed: ' + descriptor.xpath + ' — trying fallbacks');
    }

    // Method 2: Text-based scan (scan tags for matching text)
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
          } else {
            logSub(fn, 'No match for selector: ' + selectors[s]);
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

    // Method 5: Heading proximity search (walk up from heading to find nearest element)
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

    // Log full summary of what was tried
    logWarn(fn, 'All methods failed for "' + name + '"');
    if (descriptor.xpath) logError(fn, '~', 'Failed XPath: ' + descriptor.xpath);
    if (descriptor.selector) {
      var sels = Array.isArray(descriptor.selector) ? descriptor.selector : [descriptor.selector];
      logError(fn, '~', 'Failed selectors: ' + sels.join(' | '));
    }
    return null;
  }

  // ============================================
  // S-001: Element descriptors for all XPath-dependent elements
  // ============================================
  var ELEMENTS = {
    TRANSFER: {
      name: 'Transfer button',
      xpath: XPATH.TRANSFER,
      textMatch: ['Transfer', 'Transfer project'],
      tag: 'button',
      ariaLabel: ['Transfer'],
      headingSearch: 'transfer'
    },
    COMBO1: {
      name: 'Combo 1 text (current project)',
      xpath: XPATH.COMBO1,
      selector: [
        'div[role="dialog"] p.min-w-0.truncate',
        'div[role="dialog"] p.truncate',
        'div[role="dialog"] p',
        '[data-radix-popper-content-wrapper] p',
        'div[role="alertdialog"] p.truncate',
        'div[role="alertdialog"] p',
        '[class*="DialogContent"] p.truncate',
        '[class*="DialogContent"] p'
      ],
      tag: 'p'
    },
    COMBO2: {
      name: 'Combo 2 button (project dropdown)',
      xpath: XPATH.COMBO2,
      selector: ['div[role="dialog"] button[role="combobox"]', 'div[role="dialog"] button:not(:last-child)'],
      role: 'combobox',
      tag: 'button'
    },
    OPTIONS: {
      name: 'Options container',
      xpath: XPATH.OPTIONS,
      selector: ['[role="listbox"]', '[data-radix-popper-content-wrapper] > div', '[cmdk-list]'],
      role: 'listbox'
    },
    CONFIRM: {
      name: 'Confirm button',
      xpath: XPATH.CONFIRM,
      textMatch: ['Confirm', 'Confirm transfer', 'Save'],
      tag: 'button',
      selector: ['div[role="dialog"] button:last-child', 'div[role="alertdialog"] button:last-child', 'div[role="dialog"] button[type="submit"]']
    }
  };

  function isEmptyString(value) {
    return !value || !value.trim();
  }

  function isAlreadyEmbedded() {
    var isEmbedded = !!document.getElementById(ID.SCRIPT_MARKER);
    logSub('isAlreadyEmbedded', 'marker=' + ID.SCRIPT_MARKER + ', embedded=' + isEmbedded);
    return isEmbedded;
  }

  function hasContainerUI() {
    var hasUI = !!document.getElementById(ID.CONTAINER);
    logSub('hasContainerUI', 'container=' + ID.CONTAINER + ', exists=' + hasUI);
    return hasUI;
  }

  // S-001: pollForElement now uses findElement() with descriptor fallback
  // S-005: Added onFail callback for retry support
  // Can accept either (xpath, desc, onFound, max, onFail) or (descriptor, desc, onFound, max, onFail)
  function pollForElement(xpathOrDescriptor, description, onFound, maxAttempts, onFail) {
    var fn = 'pollForElement';
    var attempts = 0;
    var max = maxAttempts || TIMING.WAIT_MAX;
    var isDescriptor = typeof xpathOrDescriptor === 'object' && xpathOrDescriptor !== null;
    var desc = isDescriptor ? xpathOrDescriptor.name || description : description;
    logEntry(fn, 'Polling for "' + desc + '" (max=' + max + ', interval=' + TIMING.POLL_MS + 'ms, mode=' + (isDescriptor ? 'multi-method' : 'xpath-only') + ')');

    var interval = setInterval(function() {
      attempts++;
      var el = isDescriptor ? findElement(xpathOrDescriptor) : findByXPath(xpathOrDescriptor);

      var isFound = !!el;
      if (isFound) {
        clearInterval(interval);
        logStep(fn, '~', desc + ' FOUND (attempt ' + attempts + ')');
        onFound(el);
        return;
      }

      var isMaxReached = attempts >= max;
      if (isMaxReached) {
        clearInterval(interval);
        logError(fn, '~', desc + ' NOT FOUND after ' + max + ' attempts', isDescriptor ? xpathOrDescriptor.xpath : xpathOrDescriptor);
        // S-005: Call onFail if provided
        if (typeof onFail === 'function') {
          onFail(desc);
        }
        return;
      }

      var shouldLogProgress = attempts <= 3 || attempts % 5 === 0;
      if (shouldLogProgress) {
        logSub(fn, 'Waiting for ' + desc + '... (' + attempts + '/' + max + ')');
      }
    }, TIMING.POLL_MS);
  }

  function extractOptionLabels(options) {
    var fn = 'extractOptionLabels';
    logEntry(fn, 'Extracting labels from ' + options.length + ' options');
    var labels = options.map(function(opt) {
      var labelEl = opt.querySelector('p.min-w-0.truncate');
      return labelEl ? labelEl.textContent.trim() : (opt.textContent || '').trim();
    });
    logSub(fn, 'Labels: [' + labels.join(', ') + ']');
    return labels;
  }

  // ============================================
  // Save workspace names to shared localStorage for MacroLoop
  // Key: ml_known_workspaces — shared across both scripts (same origin)
  // ============================================
  var WS_SHARED_KEY = 'ml_known_workspaces';

  function saveKnownWorkspaces(labels) {
    var fn = 'saveKnownWorkspaces';
    try {
      var existing = JSON.parse(localStorage.getItem(WS_SHARED_KEY) || '[]');
      var merged = existing.slice();
      var added = 0;
      for (var i = 0; i < labels.length; i++) {
        if (labels[i] && merged.indexOf(labels[i]) === -1) {
          merged.push(labels[i]);
          added++;
        }
      }
      if (added > 0) {
        localStorage.setItem(WS_SHARED_KEY, JSON.stringify(merged));
        logEntry(fn, 'Saved ' + added + ' new workspaces to shared storage (total: ' + merged.length + ')');
      } else {
        logSub(fn, 'No new workspaces to add (all ' + labels.length + ' already known)');
      }
    } catch (e) {
      logWarn(fn, 'Failed to save workspaces: ' + e.message);
    }
  }

  function findExactMatchIndex(labels, text) {
    var fn = 'findExactMatchIndex';
    for (var i = 0; i < labels.length; i++) {
      var isExactMatch = labels[i] === text;
      if (isExactMatch) {
        logSub(fn, 'Exact match at index ' + i + ': "' + labels[i] + '"');
        return i;
      }
    }
    logSub(fn, 'No exact match for "' + text + '"');
    return -1;
  }

  function findPartialMatchIndex(labels, text) {
    var fn = 'findPartialMatchIndex';
    for (var i = 0; i < labels.length; i++) {
      var hasForwardMatch = labels[i].indexOf(text) !== -1;
      var hasReverseMatch = text.indexOf(labels[i]) !== -1;
      var isPartialMatch = hasForwardMatch || hasReverseMatch;
      if (isPartialMatch) {
        logSub(fn, 'Partial match at index ' + i + ': "' + labels[i] + '" (forward=' + hasForwardMatch + ', reverse=' + hasReverseMatch + ')');
        return i;
      }
    }
    logSub(fn, 'No partial match for "' + text + '"');
    return -1;
  }

  function findMatchingIndex(labels, sourceText) {
    var fn = 'findMatchingIndex';
    logEntry(fn, 'Searching for "' + sourceText + '" in ' + labels.length + ' labels: [' + labels.join(', ') + ']');

    var exactIndex = findExactMatchIndex(labels, sourceText);
    var isExactFound = exactIndex !== -1;
    if (isExactFound) {
      logSub(fn, 'Using exact match at index ' + exactIndex);
      return exactIndex;
    }

    logWarn(fn, 'Exact match not found for "' + sourceText + '", trying partial...');
    var partialIndex = findPartialMatchIndex(labels, sourceText);
    if (partialIndex === -1) {
      logError(fn, '~', 'No match found. Source: "' + sourceText + '" | Labels: [' + labels.join(', ') + ']');
    }
    logSub(fn, 'Partial match result: ' + partialIndex);
    return partialIndex;
  }

  function calculateTargetIndex(currentIndex, totalOptions, direction) {
    var fn = 'calculateTargetIndex';
    var targetIndex;
    var isDirectionUp = direction === 'up';
    if (isDirectionUp) {
      var isAtStart = currentIndex === 0;
      targetIndex = isAtStart ? totalOptions - 1 : currentIndex - 1;
    } else {
      var isAtEnd = currentIndex === totalOptions - 1;
      targetIndex = isAtEnd ? 0 : currentIndex + 1;
    }
    logSub(fn, 'current=' + currentIndex + ', total=' + totalOptions + ', direction=' + direction + ', target=' + targetIndex);
    return targetIndex;
  }

  // S-001: findTransferButton now delegates to generic findElement
  function findTransferButton() {
    return findElement(ELEMENTS.TRANSFER);
  }

  // S-005: Retry state
  var retryState = {
    attempt: 0,
    maxRetries: TIMING.RETRY_COUNT,
    retryDelayMs: TIMING.RETRY_DELAY_MS
  };

  // S-005: Called when any step fails — triggers retry if attempts remain
  function handleStepFailure(stepName, direction) {
    var fn = 'handleStepFailure';
    retryState.attempt++;
    var hasRetriesLeft = retryState.attempt <= retryState.maxRetries;

    if (hasRetriesLeft) {
      logWarn(fn, 'Step "' + stepName + '" failed (attempt ' + retryState.attempt + '/' + retryState.maxRetries + '), retrying in ' + retryState.retryDelayMs + 'ms...');
      setTimeout(function() {
        logBanner(fn, '========== RETRY #' + retryState.attempt + ': ' + direction.toUpperCase() + ' ==========');
        clickTransferButton(direction);
      }, retryState.retryDelayMs);
    } else {
      logError(fn, '~', 'All ' + retryState.maxRetries + ' retries exhausted for step "' + stepName + '"');
      resetButtonHighlight(false);
      // Signal failure to AHK via title marker (NO alert — design rule)
      document.title = '__AHK_COMBO_FAILED__' + stepName + '__' + document.title;
      // Update status display with error
      var statusEl = document.getElementById('ahk-combo-status');
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#ef4444;font-weight:600;">FAILED</span>'
          + '<span style="color:#94a3b8;font-size:10px;margin-left:6px;">Step: ' + stepName + ' after ' + retryState.maxRetries + ' retries</span>';
      }
    }
  }

  function clickTransferButton(direction) {
    var fn = 'clickTransferButton';
    logEntry(fn, 'Looking for transfer button');

    var transferBtn = findTransferButton();
    var isTransferFound = !!transferBtn;

     if (isTransferFound) {
      logStep(fn, 1, 'Transfer button FOUND, clicking');
      logSub(fn, 'Element tag=' + transferBtn.tagName + ', text="' + (transferBtn.textContent || '').trim().substring(0, 40) + '"');
      setButtonStep(1);
      // Scroll Transfer button into view first (prevents off-screen/overlay issues)
      try { transferBtn.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { /* ignore */ }
      // Use native .click() for Transfer button (consistent with option/confirm fix - avoids overlay warnings)
      transferBtn.click();
      logSub(fn, 'Transfer button clicked (native .click()), proceeding to waitForCombo1Text');
      waitForCombo1Text(direction);
    } else {
      logError(fn, 1, 'Transfer button NOT FOUND after all methods', XPATH.TRANSFER);
      handleStepFailure('Transfer button', direction);
    }
  }

  function waitForCombo1Text(direction) {
    var fn = 'waitForCombo1Text';
    logEntry(fn, 'Waiting for combo 1 text element');
    pollForElement(ELEMENTS.COMBO1, 'Combo 1 text', function(combo1) {
      var sourceText = (combo1.textContent || '').trim();
      logStep(fn, 2, 'Source project = "' + sourceText + '"');
      setButtonStep(2);
      logSub(fn, 'Proceeding to waitForCombo2Button');
      waitForCombo2Button(direction, sourceText);
    }, null, function() { handleStepFailure('Combo1 text', direction); });
  }

  function waitForCombo2Button(direction, sourceText) {
    var fn = 'waitForCombo2Button';
    logEntry(fn, 'Waiting for combo 2 button');
    pollForElement(ELEMENTS.COMBO2, 'Combo 2 button', function(combo2Btn) {
      logStep(fn, 3, 'Combo 2 button FOUND, clicking');
      setButtonStep(3);
      try { combo2Btn.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { /* ignore */ }
      combo2Btn.click();
      logSub(fn, 'Combo 2 button clicked (native .click()), proceeding to waitForDropdownOpen');
      waitForDropdownOpen(direction, sourceText);
    }, null, function() { handleStepFailure('Combo2 button', direction); });
  }

  function waitForDropdownOpen(direction, sourceText) {
    var fn = 'waitForDropdownOpen';
    var attempts = 0;
    logEntry(fn, 'Waiting for dropdown to open (max=' + TIMING.OPEN_MAX + ')');

    var interval = setInterval(function() {
      attempts++;
      var openTrigger = document.querySelector("button[data-state='open']");
      var isDropdownOpen = !!openTrigger;

      if (isDropdownOpen) {
        clearInterval(interval);
        logStep(fn, 4, 'Dropdown OPENED (attempt ' + attempts + ')');
        setButtonStep(4);
        logSub(fn, 'Proceeding to waitForOptions');
        waitForOptions(direction, sourceText);
        return;
      }

      var isMaxReached = attempts >= TIMING.OPEN_MAX;
      if (isMaxReached) {
        clearInterval(interval);
        logError(fn, 4, 'Dropdown did not open after ' + TIMING.OPEN_MAX + ' attempts');
        handleStepFailure('Dropdown open', direction);
      }
    }, TIMING.POLL_MS);
  }

  function waitForOptions(direction, sourceText) {
    var fn = 'waitForOptions';
    logEntry(fn, 'Waiting for options container with actual options');
    var attempts = 0;
    var max = TIMING.WAIT_MAX;

    var interval = setInterval(function() {
      attempts++;

      // Try 1: configured XPath
      var listRoot = findByXPath(XPATH.OPTIONS);
      var options = listRoot ? Array.from(listRoot.querySelectorAll("div[role='option']")) : [];

      // Try 2: if XPath container found but has 0 options, try CSS fallbacks
      if (options.length === 0) {
        var fallbackSelectors = ['[role="listbox"]', '[cmdk-list]', '[data-radix-popper-content-wrapper] > div'];
        for (var i = 0; i < fallbackSelectors.length; i++) {
          try {
            var fallback = document.querySelector(fallbackSelectors[i]);
            if (fallback) {
              var fallbackOpts = Array.from(fallback.querySelectorAll("div[role='option']"));
              if (fallbackOpts.length > 0) {
                logSub(fn, 'XPath container had 0 options, fallback "' + fallbackSelectors[i] + '" found ' + fallbackOpts.length + ' options');
                listRoot = fallback;
                options = fallbackOpts;
                break;
              }
            }
          } catch (e) { /* ignore */ }
        }
      }

      if (options.length > 0) {
        clearInterval(interval);
        logStep(fn, 5, 'Found ' + options.length + ' options (attempt ' + attempts + ')');
        setButtonStep(5);
        var labels = extractOptionLabels(options);
        // Save all workspace names to shared localStorage for MacroLoop
        saveKnownWorkspaces(labels);
        logSub(fn, 'Proceeding to selectTargetOption');
        selectTargetOption(direction, sourceText, options, labels);
        return;
      }

      if (attempts >= max) {
        clearInterval(interval);
        logError(fn, 5, 'Options container with options NOT FOUND after ' + max + ' attempts', XPATH.OPTIONS);
        handleStepFailure('Options container', direction);
        return;
      }

      if (attempts <= 3 || attempts % 5 === 0) {
        logSub(fn, 'Waiting for options... (' + attempts + '/' + max + '), XPath=' + XPATH.OPTIONS);
      }
    }, TIMING.POLL_MS);
  }

  function selectTargetOption(direction, sourceText, options, labels) {
    var fn = 'selectTargetOption';
    logEntry(fn, 'Finding target option for direction=' + direction);

    var currentIndex = findMatchingIndex(labels, sourceText);
    var isMatchFound = currentIndex !== -1;

    if (isMatchFound) {
      logStep(fn, 6, 'Current match at index ' + currentIndex + ' ("' + labels[currentIndex] + '")');
      setButtonStep(6);
      var targetIndex = calculateTargetIndex(currentIndex, options.length, direction);
      // Calculate the opposite direction target for status display
      var oppositeDir = direction === 'up' ? 'down' : 'up';
      var oppositeIndex = calculateTargetIndex(currentIndex, options.length, oppositeDir);
      logHighlight(fn, 'Step 7: Selecting "' + labels[targetIndex] + '" (index ' + targetIndex + ')');
      setButtonStep(7);
      // Scroll option into view first (critical for off-screen items in scrollable dropdown)
      try { options[targetIndex].scrollIntoView({ block: 'nearest', behavior: 'instant' }); } catch (e) { /* ignore */ }
      // Use native .click() for options (v1-proven: works regardless of scroll position)
      // reactClick fails for off-screen items because synthetic events use invalid viewport coordinates
      options[targetIndex].click();
      logSub(fn, 'Option clicked (native .click()), waiting ' + TIMING.CONFIRM_DELAY_MS + 'ms before polling for confirm button');

      // Update status display with both directions
      updateStatusDisplay(labels[currentIndex], labels[targetIndex], direction, labels[oppositeIndex]);

      // Delay before polling for confirm to allow DOM to settle
      setTimeout(function() {
        logSub(fn, 'Delay complete, proceeding to waitForConfirmButton');
        waitForConfirmButton(direction, labels[targetIndex]);
      }, TIMING.CONFIRM_DELAY_MS);
    } else {
      logError(fn, 6, '"' + sourceText + '" NOT FOUND in options');
      handleStepFailure('Select option', direction);
    }
  }

  function waitForConfirmButton(direction, targetLabel) {
    var fn = 'waitForConfirmButton';
    logEntry(fn, 'Waiting for confirm button');
    pollForElement(ELEMENTS.CONFIRM, 'Confirm button', function(confirmBtn) {
      logStep(fn, 8, 'Confirm button FOUND, clicking');
      setButtonStep(8);
       // Use native .click() for confirm button (consistent with option click fix - avoids overlay warnings from synthetic events)
       confirmBtn.click();
      // S-005: Reset retry state on success
      retryState.attempt = 0;
      logBanner(fn, 'DONE! ' + direction + ' -> "' + targetLabel + '"');
      addHistoryEntry(direction, targetLabel);
      resetButtonHighlight(true);
      flashStatus();
    }, null, function() { handleStepFailure('Confirm button', direction); });
  }

  function runComboSwitch(direction) {
    var fn = 'runComboSwitch';
    // S-005: Reset retry state at start of each new combo invocation
    retryState.attempt = 0;
    logBanner(fn, '========== START: ' + direction.toUpperCase() + ' ==========');
    logInfo(fn, 'Version=' + VERSION + ', PollMs=' + TIMING.POLL_MS + ', OpenMax=' + TIMING.OPEN_MAX + ', WaitMax=' + TIMING.WAIT_MAX + ', Retries=' + TIMING.RETRY_COUNT);
    highlightButton(direction);
    clickTransferButton(direction);
  }

  window.__comboSwitch = runComboSwitch;

  // ============================================
  // Credit Status Checker
  // ============================================
  function generateCorrelationId() {
    return 'cs-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  }

  function isCacheValid() {
    if (!creditState.lastCheckedAt) return false;
    var elapsed = (Date.now() - creditState.lastCheckedAt) / 1000;
    return elapsed < CREDIT_CFG.CACHE_TTL_S;
  }

  function updateCreditDisplay() {
    var el = document.getElementById('ahk-credit-display');
    if (!el) return;
    if (!creditState.lastCheckedAt) {
      el.innerHTML = '<span style="color:#64748b;">No credit data yet. Click Status.</span>';
      return;
    }
    var freeColor = creditState.freeTierAvailable ? '#22c55e' : '#ef4444';
    var freeText = creditState.freeTierAvailable ? 'Yes' : 'No';
    var timeStr = new Date(creditState.lastCheckedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var src = creditState.source || '?';

    var html = '<div style="display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;">';
    html += '<span style="color:#e2e8f0;font-size:11px;">' + creditState.totalCreditsText + '</span>';
    html += '<span style="color:' + freeColor + ';font-size:11px;font-weight:600;">Free: ' + freeText + '</span>';
    html += '</div>';

    // Per-workspace breakdown
    if (creditState.perWorkspace.length > 0) {
      html += '<div style="margin-top:3px;display:flex;flex-wrap:wrap;gap:3px 8px;max-height:60px;overflow-y:auto;">';
      for (var i = 0; i < creditState.perWorkspace.length; i++) {
        var ws = creditState.perWorkspace[i];
        html += '<span style="color:#94a3b8;font-size:10px;">' + ws.name + ': ' + ws.used + '/' + ws.limit + '</span>';
      }
      html += '</div>';
    }

    html += '<div style="color:#64748b;font-size:9px;margin-top:2px;">Last: ' + timeStr + ' (' + src + ')</div>';
    el.innerHTML = html;
  }

  function parseApiResponse(data) {
    var fn = 'parseApiResponse';
    var workspaces = data.workspaces || data || [];
    if (!Array.isArray(workspaces)) {
      logWarn(fn, 'Unexpected response shape');
      return false;
    }

    var totalBillingUsed = 0;
    var totalBillingLimit = 0;
    var totalDailyUsed = 0;
    var totalDailyLimit = 0;
    var freeAvailable = false;
    var perWs = [];

    for (var i = 0; i < workspaces.length; i++) {
      var ws = workspaces[i];
      var bUsed = ws.billing_period_credits_used || 0;
      var bLimit = ws.billing_period_credits_limit || 0;
      var dUsed = ws.daily_credits_used || 0;
      var dLimit = ws.daily_credits_limit || 0;
      totalBillingUsed += bUsed;
      totalBillingLimit += bLimit;
      totalDailyUsed += dUsed;
      totalDailyLimit += dLimit;

      // Free tier detection
      var hasGranted = (ws.credits_granted || 0) > 0 && (ws.credits_used || 0) < (ws.credits_granted || 0);
      var now = new Date();
      var currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      var hasTrialPeriod = ws.last_trial_credit_period && ws.last_trial_credit_period.indexOf(currentMonth) === 0;
      if (hasGranted || hasTrialPeriod) freeAvailable = true;

      var shortName = (ws.name || 'WS' + i).substring(0, 12);
      perWs.push({ name: shortName, used: bUsed, limit: bLimit });
    }

    creditState.freeTierAvailable = freeAvailable;
    creditState.totalCreditsText = totalBillingUsed + '/' + totalBillingLimit + ' | Daily: ' + totalDailyUsed + '/' + totalDailyLimit;
    creditState.perWorkspace = perWs;
    logSub(fn, 'Parsed ' + workspaces.length + ' workspaces, free=' + freeAvailable);
    return true;
  }

  function singleApiFetch(url, headers, correlationId) {
    logSub('singleApiFetch', 'Fetching URL: ' + url + ' [' + correlationId + ']');
    return fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include',
      mode: 'cors'
    }).then(function(resp) {
      logSub('singleApiFetch', 'Response status=' + resp.status + ' statusText=' + resp.statusText + ' [' + correlationId + ']');
      if (!resp.ok) {
        return resp.text().then(function(body) {
          logError('singleApiFetch', '~', 'HTTP ' + resp.status + ' ' + resp.statusText + ' | URL: ' + url + ' | Body: ' + body.substring(0, 200));
          throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
        });
      }
      return resp.json();
    }).then(function(data) {
      var parsed = parseApiResponse(data);
      if (!parsed) throw new Error('Parse failed');
      return true;
    }).catch(function(err) {
      logError('singleApiFetch', '~', 'Fetch error: ' + err.message + ' | URL: ' + url + ' [' + correlationId + ']');
      throw err;
    });
  }

  function checkCreditsViaApi(correlationId, triggerSource) {
    var fn = 'checkCreditsViaApi';
    var url = CREDIT_CFG.API_BASE + '/user/workspaces';
    var headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

    if (CREDIT_CFG.AUTH_MODE === 'token' && CREDIT_CFG.BEARER_TOKEN && CREDIT_CFG.BEARER_TOKEN !== '__LOVABLE_BEARER_TOKEN__') {
      headers['Authorization'] = 'Bearer ' + CREDIT_CFG.BEARER_TOKEN;
      logSub(fn, 'Using token auth (token=***REDACTED***)');
    } else {
      logSub(fn, 'Using cookie session auth');
    }

    var maxRetries = CREDIT_CFG.MAX_RETRIES;
    var baseBackoff = CREDIT_CFG.RETRY_BACKOFF;
    logEntry(fn, 'Fetching ' + url + ' [' + correlationId + '] trigger=' + triggerSource + ' maxRetries=' + maxRetries + ' backoff=' + baseBackoff + 'ms');

    function attemptFetch(attempt) {
      return singleApiFetch(url, headers, correlationId).then(function(success) {
        creditState.source = 'api';
        creditState.lastCheckedAt = Date.now();
        updateCreditDisplay();
        logHighlight(fn, 'Credit status updated via API [' + correlationId + '] attempt=' + (attempt + 1));
        return true;
      }).catch(function(err) {
        var hasRetriesLeft = attempt < maxRetries;
        if (hasRetriesLeft) {
          var nextAttempt = attempt + 1;
          var delayMs = baseBackoff * Math.pow(2, attempt);
          logWarn(fn, 'Attempt ' + (nextAttempt) + ' failed: ' + err.message + ', retrying in ' + delayMs + 'ms [' + correlationId + ']');
          // Update credit display with retry indicator
          var el = document.getElementById('ahk-credit-display');
          if (el) {
            el.innerHTML = '<span style="color:#facc15;">Retrying (' + (nextAttempt) + '/' + (maxRetries + 1) + ')...</span>'
              + '<span style="color:#64748b;font-size:10px;margin-left:6px;">' + err.message + ' &middot; next in ' + (delayMs / 1000) + 's</span>';
          }
          return new Promise(function(resolve) {
            setTimeout(function() {
              resolve(attemptFetch(nextAttempt));
            }, delayMs);
          });
        }
        logWarn(fn, 'All ' + (maxRetries + 1) + ' attempts failed: ' + err.message + ' [' + correlationId + ']');
        return false;
      });
    }

    return attemptFetch(0);
  }

  function checkCreditsViaDom(correlationId) {
    var fn = 'checkCreditsViaDom';
    logEntry(fn, 'Starting DOM fallback [' + correlationId + ']');

    // Click Plans and Credits button
    var plansBtn = findByXPath(CREDIT_CFG.PLANS_XPATH);
    if (!plansBtn) {
      logError(fn, 'E013', 'Plans and Credits button not found', CREDIT_CFG.PLANS_XPATH);
      return;
    }
    reactClick(plansBtn, CREDIT_CFG.PLANS_XPATH);
    logSub(fn, 'Plans button clicked, waiting for credits element');

    // Poll for Total Credits element
    var attempts = 0;
    var maxAttempts = 20;
    var pollInterval = 300;

    var interval = setInterval(function() {
      attempts++;
      var creditsEl = findByXPath(CREDIT_CFG.CREDITS_XPATH);
      if (creditsEl) {
        clearInterval(interval);
        var rawText = (creditsEl.innerText || creditsEl.textContent || '').trim();
        logSub(fn, 'Credits text found: "' + rawText + '"');

        // Check free progress bar
        var freeBar = findByXPath(CREDIT_CFG.FREE_XPATH);
        creditState.freeTierAvailable = !!freeBar;
        creditState.totalCreditsText = rawText;
        creditState.source = 'dom';
        creditState.lastCheckedAt = Date.now();
        creditState.perWorkspace = [];
        updateCreditDisplay();
        logHighlight(fn, 'Credit status updated via DOM [' + correlationId + '] free=' + !!freeBar);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        logError(fn, 'E014', 'Total Credits element not visible after ' + maxAttempts + ' attempts', CREDIT_CFG.CREDITS_XPATH);
      }
    }, pollInterval);
  }

  function checkCreditsStatus(triggerSource) {
    var fn = 'checkCreditsStatus';
    triggerSource = triggerSource || 'onDemand';

    if (isCacheValid()) {
      logSub(fn, 'Cache still valid, skipping fetch');
      return;
    }

    var corrId = generateCorrelationId();
    logBanner(fn, '========== CREDIT CHECK [' + corrId + '] ' + triggerSource + ' ==========');

    // Update display to show loading
    var el = document.getElementById('ahk-credit-display');
    if (el) el.innerHTML = '<span style="color:#facc15;">Checking credits...</span>';

    checkCreditsViaApi(corrId, triggerSource).then(function(success) {
      if (!success) {
        logSub(fn, 'API path failed, falling back to DOM');
        checkCreditsViaDom(corrId);
      }
    });
  }

  window.__checkCredits = checkCreditsStatus;

  // Auto-refresh timer
  function startAutoRefresh() {
    if (!CREDIT_CFG.AUTO_CHECK) return;
    if (creditState.autoTimerId) clearInterval(creditState.autoTimerId);
    var intervalMs = CREDIT_CFG.INTERVAL_S * 1000;
    logEntry('autoRefresh', 'Starting auto-refresh every ' + CREDIT_CFG.INTERVAL_S + 's');
    creditState.autoTimerId = setInterval(function() {
      if (document.visibilityState === 'hidden') return;
      checkCreditsStatus('auto');
    }, intervalMs);
  }

  // ============================================
  // ============================================
  // Button highlight during combo execution
  // ============================================
  var activeButtonState = {
    direction: null,
    originalStyle: null,
    pulseInterval: null,
    stepLabel: null
  };

  var BUTTON_STYLES = {
    up: 'background:#3b82f6;color:#fff;',
    down: 'background:#1f2937;color:#fff;border:1px solid #374151;'
  };

  function highlightButton(direction) {
    var fn = 'highlightButton';
    var btnId = direction === 'up' ? ID.BTN_UP : ID.BTN_DOWN;
    var btn = document.getElementById(btnId);
    if (!btn) return;
    logSub(fn, 'Highlighting ' + direction + ' button');

    activeButtonState.direction = direction;
    activeButtonState.originalStyle = btn.style.cssText;

    // Add step label overlay
    var label = document.createElement('span');
    label.id = 'ahk-step-label';
    label.style.cssText = 'position:absolute;top:-8px;right:-8px;background:#facc15;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;pointer-events:none;z-index:1;';
    label.textContent = '1/8';
    btn.style.position = 'relative';
    btn.appendChild(label);
    activeButtonState.stepLabel = label;

    // Pulsing glow effect
    var glowOn = true;
    var glowColor = direction === 'up' ? '59,130,246' : '250,204,21';
    activeButtonState.pulseInterval = setInterval(function() {
      if (!document.getElementById(btnId)) {
        clearInterval(activeButtonState.pulseInterval);
        return;
      }
      if (glowOn) {
        btn.style.boxShadow = '0 0 12px 3px rgba(' + glowColor + ',0.6)';
      } else {
        btn.style.boxShadow = '0 0 4px 1px rgba(' + glowColor + ',0.3)';
      }
      glowOn = !glowOn;
    }, 500);
  }

  function setButtonStep(stepNum) {
    if (activeButtonState.stepLabel) {
      activeButtonState.stepLabel.textContent = stepNum + '/8';
    }
  }

  function resetButtonHighlight(success) {
    var fn = 'resetButtonHighlight';
    if (!activeButtonState.direction) return;

    var btnId = activeButtonState.direction === 'up' ? ID.BTN_UP : ID.BTN_DOWN;
    var btn = document.getElementById(btnId);

    if (activeButtonState.pulseInterval) {
      clearInterval(activeButtonState.pulseInterval);
      activeButtonState.pulseInterval = null;
    }

    if (activeButtonState.stepLabel && activeButtonState.stepLabel.parentNode) {
      activeButtonState.stepLabel.parentNode.removeChild(activeButtonState.stepLabel);
      activeButtonState.stepLabel = null;
    }

    if (btn) {
      var baseBtnStyle = 'padding:8px 16px;border:none;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.15s;';
      var dirStyle = BUTTON_STYLES[activeButtonState.direction] || '';
      btn.style.cssText = baseBtnStyle + dirStyle;

      // Brief green or red flash to indicate result
      var flashColor = success ? '0 0 12px 3px rgba(34,197,94,0.7)' : '0 0 12px 3px rgba(239,68,68,0.7)';
      btn.style.boxShadow = flashColor;
      setTimeout(function() {
        btn.style.boxShadow = 'none';
      }, 600);
    }

    logSub(fn, 'Reset ' + activeButtonState.direction + ' button (success=' + success + ')');
    activeButtonState.direction = null;
    activeButtonState.originalStyle = null;
  }

  // ============================================
  // Flash/pulse animation on successful combo
  // ============================================
  function flashStatus() {
    var el = document.getElementById('ahk-combo-status');
    if (!el) return;
    el.style.transition = 'none';
    el.style.boxShadow = '0 0 12px 2px rgba(250,204,21,0.6), inset 0 0 8px rgba(250,204,21,0.15)';
    el.style.borderColor = '#facc15';
    el.style.background = '#1a1a0a';
    setTimeout(function() {
      el.style.transition = 'all 1.2s ease-out';
      el.style.boxShadow = 'none';
      el.style.borderColor = '#1e293b';
      el.style.background = '#0f172a';
    }, 80);
  }
  // ============================================
  // History log: last 5 combo actions
  // ============================================
  var comboHistory = [];

  function addHistoryEntry(direction, targetLabel) {
    var fn = 'addHistoryEntry';
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var entry = { time: timeStr, direction: direction, target: targetLabel };
    comboHistory.unshift(entry);
    if (comboHistory.length > 5) comboHistory.pop();
    logSub(fn, 'History updated: ' + comboHistory.length + ' entries');
    renderHistory();
  }

  function renderHistory() {
    var el = document.getElementById('ahk-combo-history');
    if (!el) return;
    if (comboHistory.length === 0) {
      el.innerHTML = '<span style="color:#64748b;">No actions yet</span>';
      return;
    }
    var html = '';
    for (var i = 0; i < comboHistory.length; i++) {
      var e = comboHistory[i];
      var arrow = e.direction === 'up' ? '&uarr;' : '&darr;';
      var dirColor = e.direction === 'up' ? '#3b82f6' : '#f59e0b';
      html += '<div style="display:flex;gap:6px;align-items:center;padding:2px 0;' + (i > 0 ? 'border-top:1px solid #1e293b;' : '') + '">'
        + '<span style="color:#64748b;font-size:10px;min-width:72px;">' + e.time + '</span>'
        + '<span style="color:' + dirColor + ';font-size:11px;">' + arrow + '</span>'
        + '<span style="color:#e2e8f0;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + e.target + '</span>'
        + '</div>';
    }
    el.innerHTML = html;
  }

  // ============================================
  // Status display update function
  // ============================================
  function updateStatusDisplay(currentItem, targetItem, direction, oppositeItem) {
    var fn = 'updateStatusDisplay';
    var statusEl = document.getElementById('ahk-combo-status');
    if (!statusEl) {
      logWarn(fn, 'Status element not found');
      return;
    }
    var isUp = direction === 'up';
    var upLabel = isUp ? targetItem : (oppositeItem || '-');
    var downLabel = isUp ? (oppositeItem || '-') : targetItem;
    var upColor = isUp ? '#facc15' : '#64748b';
    var downColor = isUp ? '#64748b' : '#facc15';
    var upWeight = isUp ? 'font-weight:700;' : '';
    var downWeight = isUp ? '' : 'font-weight:700;';

    statusEl.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      + '<span style="color:#94a3b8;font-size:10px;">NOW:</span>'
      + '<span style="color:#22c55e;font-weight:700;font-size:12px;">' + (currentItem || '-') + '</span>'
      + '<span style="color:#334155;">|</span>'
      + '<span style="color:' + upColor + ';font-size:11px;' + upWeight + '">&uarr; ' + upLabel + '</span>'
      + '<span style="color:#334155;">&middot;</span>'
      + '<span style="color:' + downColor + ';font-size:11px;' + downWeight + '">&darr; ' + downLabel + '</span>'
      + '</div>';
    logSub(fn, 'Status updated: current=' + currentItem + ', direction=' + direction + ', up=' + upLabel + ', down=' + downLabel);
  }

  // ============================================
  // JS Executor History
  // ============================================
  var jsHistory = [];
  var jsHistoryIndex = -1;
  var JS_HISTORY_MAX = 20;

  function addJsHistoryEntry(code, success, resultText) {
    var fn = 'addJsHistoryEntry';
    var now = new Date();
    var timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var entry = { time: timeStr, code: code, success: success, result: resultText };
    // Avoid consecutive duplicates
    var isDuplicate = jsHistory.length > 0 && jsHistory[0].code === code;
    if (!isDuplicate) {
      jsHistory.unshift(entry);
      if (jsHistory.length > JS_HISTORY_MAX) jsHistory.pop();
      logSub(fn, 'JS history updated: ' + jsHistory.length + ' entries');
    }
    jsHistoryIndex = -1;
    renderJsHistory();
  }

  function renderJsHistory() {
    var el = document.getElementById('ahk-js-history');
    if (!el) return;
    if (jsHistory.length === 0) {
      el.innerHTML = '<span style="color:#64748b;">No commands yet</span>';
      return;
    }
    var html = '';
    for (var i = 0; i < jsHistory.length; i++) {
      var e = jsHistory[i];
      var statusColor = e.success ? '#22c55e' : '#ef4444';
      var statusIcon = e.success ? '&check;' : '&times;';
      var truncCode = e.code.length > 50 ? e.code.substring(0, 50) + '...' : e.code;
      html += '<div style="display:flex;gap:6px;align-items:center;padding:2px 0;cursor:pointer;'
        + (i > 0 ? 'border-top:1px solid #1e293b;' : '') + '"'
        + ' data-js-hist-idx="' + i + '">'
        + '<span style="color:#64748b;font-size:10px;min-width:56px;">' + e.time + '</span>'
        + '<span style="color:' + statusColor + ';font-size:10px;">' + statusIcon + '</span>'
        + '<span style="color:#e2e8f0;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-family:monospace;" title="' + e.code.replace(/"/g, '&quot;') + '">' + truncCode + '</span>'
        + '</div>';
    }
    el.innerHTML = html;

    // Click to recall command into textbox
    var items = el.querySelectorAll('[data-js-hist-idx]');
    for (var j = 0; j < items.length; j++) {
      items[j].onclick = (function(idx) {
        return function() {
          var ta = document.getElementById('__JS_EXECUTOR_ID__');
          if (ta && jsHistory[idx]) {
            ta.value = jsHistory[idx].code;
            ta.focus();
            logSub('jsHistoryClick', 'Recalled command #' + idx);
          }
        };
      })(j);
    }
  }

  function navigateJsHistory(direction) {
    var ta = document.getElementById('__JS_EXECUTOR_ID__');
    if (!ta || jsHistory.length === 0) return;
    var isUp = direction === 'up';
    if (isUp) {
      var canGoUp = jsHistoryIndex < jsHistory.length - 1;
      if (canGoUp) {
        jsHistoryIndex++;
        ta.value = jsHistory[jsHistoryIndex].code;
      }
    } else {
      var canGoDown = jsHistoryIndex > 0;
      if (canGoDown) {
        jsHistoryIndex--;
        ta.value = jsHistory[jsHistoryIndex].code;
      } else {
        jsHistoryIndex = -1;
        ta.value = '';
      }
    }
  }

  // ============================================
  // JS Executor: execute code from textbox
  // ============================================
  function executeJsFromTextbox() {
    var fn = 'executeJsFromTextbox';
    var textarea = document.getElementById('__JS_EXECUTOR_ID__');
    if (!textarea) {
      logError(fn, '~', 'JS Executor textbox not found (E011)');
      return;
    }
    var code = textarea.value.trim();
    if (!code) {
      logWarn(fn, 'Empty code, nothing to execute');
      return;
    }
    logEntry(fn, 'Executing: ' + code.substring(0, 80) + (code.length > 80 ? '...' : ''));
    try {
      var result = eval(code);
      var resultStr = String(result);
      logHighlight(fn, 'Result: ' + resultStr);
      addJsHistoryEntry(code, true, resultStr.substring(0, 100));
    } catch (e) {
      logError(fn, '~', 'Execution error: ' + e.message);
      addJsHistoryEntry(code, false, e.message);
    }
  }

  window.__executeJs = executeJsFromTextbox;

  function createControllerUI() {
    var fn = 'createControllerUI';
    logEntry(fn, 'Checking if UI should be created');

    var isUIPresent = hasContainerUI();
    if (isUIPresent) {
      logSub(fn, 'UI already exists, skipping creation');
      return;
    }

    var transferBtn = findTransferButton();
    var isTransferFound = !!transferBtn;
    if (isTransferFound) {
      logSub(fn, 'Transfer button found, will attach UI after it');
    } else {
      logWarn(fn, 'Transfer button not found via all methods, skipping UI creation');
      return;
    }

    var parent = transferBtn.parentNode;
    var hasValidParent = parent && parent.parentNode;
    if (hasValidParent) {
      logSub(fn, 'Valid parent found for UI insertion');
    } else {
      logWarn(fn, 'No valid parent for UI insertion');
      return;
    }

    var uiState = 'expanded';

    var wrapper = document.createElement('div');
    wrapper.id = ID.CONTAINER;
    wrapper.style.cssText = 'margin-top:12px;position:relative;cursor:default;';

    var header = buildHeader();
    var body = buildBody();

    var isDragging = false;
    var dragOffsetX = 0;
    var dragOffsetY = 0;
    var isFloating = false;

    function enableFloating() {
      var fn2 = 'enableFloating';
      if (isFloating) return;
      logEntry(fn2, 'Switching ComboSwitch panel to floating mode');
      isFloating = true;
      wrapper.style.position = 'fixed';
      wrapper.style.zIndex = '99998';
      wrapper.style.width = '320px';
      wrapper.style.top = '80px';
      wrapper.style.right = '20px';
      wrapper.style.left = 'auto';
      wrapper.style.marginTop = '0';
      wrapper.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
    }

    function startDrag(e) {
      var isHideClick = e.target.title === 'Hide panel (Ctrl+Alt+H to show)';
      if (isHideClick) return;
      isDragging = true;
      var rect = wrapper.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      enableFloating();
      e.preventDefault();
    }

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      wrapper.style.left = (e.clientX - dragOffsetX) + 'px';
      wrapper.style.top = (e.clientY - dragOffsetY) + 'px';
      wrapper.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
    });

    function buildHeader() {
      logSub(fn, 'Building header element');
      var el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:grab;padding:6px 10px;background:#1e293b;border-radius:6px 6px 0 0;border:1px solid #334155;user-select:none;';
      el.title = 'Drag to move, click to minimize/expand';

      var label = document.createElement('span');
      label.style.cssText = 'font-size:12px;font-weight:600;color:#94a3b8;flex:1;';
      label.textContent = 'ComboSwitch v' + VERSION;

      var toggle = document.createElement('span');
      toggle.id = 'ahk-combo-toggle';
      toggle.style.cssText = 'font-size:10px;color:#64748b;';
      toggle.textContent = '[ - ]';

      var hide = document.createElement('span');
      hide.style.cssText = 'font-size:10px;color:#64748b;cursor:pointer;margin-left:4px;';
      hide.textContent = '[ x ]';
      hide.title = 'Hide panel (Ctrl+Alt+H to show)';

      hide.onclick = function(e) {
        e.stopPropagation();
        logEntry('hidePanel', 'Panel hidden by user');
        wrapper.style.display = 'none';
        uiState = 'hidden';
      };

      var dragStartPos = { x: 0, y: 0 };

      el.onmousedown = function(e) {
        var isHideClick = e.target === hide;
        if (isHideClick) return;
        dragStartPos.x = e.clientX;
        dragStartPos.y = e.clientY;
        startDrag(e);
      };

      el.onmouseup = function(e) {
        var isHideClick = e.target === hide;
        if (isHideClick) return;
        var dx = Math.abs(e.clientX - dragStartPos.x);
        var dy = Math.abs(e.clientY - dragStartPos.y);
        var isClick = dx < 5 && dy < 5;
        if (isClick) {
          toggleMinimize();
        }
      };

      el.appendChild(label);
      el.appendChild(toggle);
      el.appendChild(hide);
      return el;
    }

    function buildBody() {
      logSub(fn, 'Building body element');
      var el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:10px;background:#111827;border-radius:0 0 6px 6px;border:1px solid #334155;border-top:none;';

      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;';

      var baseBtnStyle = 'padding:8px 16px;border:none;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.15s;';

      var upBtn = document.createElement('button');
      upBtn.id = ID.BTN_UP;
      upBtn.textContent = 'Up';
      upBtn.title = 'Switch to previous project (Ctrl+Alt+Up)';
      upBtn.style.cssText = baseBtnStyle + 'background:#3b82f6;color:#fff;';
      upBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      upBtn.onmouseout = function() { this.style.opacity = '1'; };
      upBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('upBtn.onclick', 'Up button clicked by user');
        window.__comboSwitch('up');
      };

      var downBtn = document.createElement('button');
      downBtn.id = ID.BTN_DOWN;
      downBtn.textContent = 'Down';
      downBtn.title = 'Switch to next project (Ctrl+Alt+Down)';
      downBtn.style.cssText = baseBtnStyle + 'background:#1f2937;color:#fff;border:1px solid #374151;';
      downBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      downBtn.onmouseout = function() { this.style.opacity = '1'; };
      downBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('downBtn.onclick', 'Down button clicked by user');
        window.__comboSwitch('down');
      };

      // Status button
      var statusBtn = document.createElement('button');
      statusBtn.id = 'ahk-credit-status-btn';
      statusBtn.textContent = 'Status';
      statusBtn.title = 'Check credit status (Ctrl+Alt+S)';
      statusBtn.style.cssText = baseBtnStyle + 'background:#7c3aed;color:#fff;';
      statusBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      statusBtn.onmouseout = function() { this.style.opacity = '1'; };
      statusBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('statusBtn.onclick', 'Status button clicked');
        window.__checkCredits('onDemand');
      };

      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:10px;color:#64748b;';
      hint.textContent = 'Ctrl+Alt+Up / Down / Ctrl+Alt+S';

      btnRow.appendChild(upBtn);
      btnRow.appendChild(downBtn);
      btnRow.appendChild(statusBtn);
      el.appendChild(btnRow);
      el.appendChild(hint);

      // === Credit status display ===
      var creditDisplay = document.createElement('div');
      creditDisplay.id = 'ahk-credit-display';
      creditDisplay.style.cssText = 'font-size:11px;line-height:1.5;padding:6px 8px;background:#0f172a;border-radius:4px;border:1px solid #1e293b;color:#94a3b8;';
      creditDisplay.innerHTML = '<span style="color:#64748b;">No credit data yet. Click Status.</span>';
      el.appendChild(creditDisplay);

      // === Status display ===
      var statusBox = document.createElement('div');
      statusBox.id = 'ahk-combo-status';
      statusBox.style.cssText = 'font-size:11px;line-height:1.6;padding:6px 8px;background:#0f172a;border-radius:4px;border:1px solid #1e293b;color:#94a3b8;';
      statusBox.innerHTML = '<span style="color:#64748b;">Waiting for combo action...</span>';
      el.appendChild(statusBox);

      // === JS Executor textbox ===
      var jsLabel = document.createElement('div');
      jsLabel.style.cssText = 'font-size:10px;color:#64748b;margin-top:4px;';
      jsLabel.textContent = 'JS Executor (Ctrl+/ to focus, Ctrl+Enter to run)';
      el.appendChild(jsLabel);

      var jsRow = document.createElement('div');
      jsRow.style.cssText = 'display:flex;gap:6px;align-items:stretch;';

      var textarea = document.createElement('textarea');
      textarea.id = '__JS_EXECUTOR_ID__';
      textarea.placeholder = 'Enter JavaScript code here...';
      textarea.style.cssText = 'flex:1;min-height:48px;max-height:120px;padding:6px 8px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;font-family:monospace;font-size:12px;resize:vertical;outline:none;';
      textarea.onfocus = function() { this.style.borderColor = '#3b82f6'; };
      textarea.onblur = function() { this.style.borderColor = '#334155'; };
      textarea.onkeydown = function(e) {
        // Ctrl+Enter to execute
        if (e.ctrlKey && e.key === 'Enter') {
          e.preventDefault();
          window.__executeJs();
          return;
        }
        // Up/Down arrow to navigate JS history (only when textarea is single-line or empty)
        var isSingleLine = this.value.indexOf('\n') === -1;
        if (e.key === 'ArrowUp' && isSingleLine) {
          e.preventDefault();
          navigateJsHistory('up');
          return;
        }
        if (e.key === 'ArrowDown' && isSingleLine) {
          e.preventDefault();
          navigateJsHistory('down');
          return;
        }
      };

      var runBtn = document.createElement('button');
      runBtn.id = '__JS_EXECUTE_BTN_ID__';
      runBtn.textContent = '▶ Run';
      runBtn.style.cssText = 'padding:6px 12px;background:#059669;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;';
      runBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      runBtn.onmouseout = function() { this.style.opacity = '1'; };
      runBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        window.__executeJs();
      };

      jsRow.appendChild(textarea);
      jsRow.appendChild(runBtn);
      el.appendChild(jsRow);

      // === History panel ===
      var histLabel = document.createElement('div');
      histLabel.style.cssText = 'font-size:10px;color:#64748b;margin-top:4px;';
      histLabel.textContent = 'Recent Actions';
      el.appendChild(histLabel);

      var histBox = document.createElement('div');
      histBox.id = 'ahk-combo-history';
      histBox.style.cssText = 'font-size:11px;padding:6px 8px;background:#0f172a;border-radius:4px;border:1px solid #1e293b;max-height:100px;overflow-y:auto;';
      histBox.innerHTML = '<span style="color:#64748b;">No actions yet</span>';
      el.appendChild(histBox);

      // === JS Command History ===
      var jsHistLabel = document.createElement('div');
      jsHistLabel.style.cssText = 'font-size:10px;color:#64748b;margin-top:4px;';
      jsHistLabel.textContent = 'JS Command History (click to recall, Up/Down arrows in textbox)';
      el.appendChild(jsHistLabel);

      var jsHistBox = document.createElement('div');
      jsHistBox.id = 'ahk-js-history';
      jsHistBox.style.cssText = 'font-size:10px;padding:6px 8px;background:#0f172a;border-radius:4px;border:1px solid #1e293b;max-height:80px;overflow-y:auto;';
      jsHistBox.innerHTML = '<span style="color:#64748b;">No commands yet</span>';
      el.appendChild(jsHistBox);

      // === Log Export Buttons ===
      var logExportRow = document.createElement('div');
      logExportRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;align-items:center;';

      var logLabel = document.createElement('span');
      logLabel.style.cssText = 'font-size:10px;color:#64748b;flex:1;';
      logLabel.textContent = 'JS Logs (' + getAllLogs().length + ' entries)';
      logLabel.id = 'ahk-log-count';

      var copyLogBtn = document.createElement('button');
      copyLogBtn.textContent = 'Copy Logs';
      copyLogBtn.style.cssText = 'padding:4px 8px;background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:3px;font-size:10px;cursor:pointer;';
      copyLogBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        copyLogsToClipboard();
        var countEl = document.getElementById('ahk-log-count');
        if (countEl) countEl.textContent = 'Copied! (' + getAllLogs().length + ' entries)';
        setTimeout(function() {
          if (countEl) countEl.textContent = 'JS Logs (' + getAllLogs().length + ' entries)';
        }, 2000);
      };

      var downloadLogBtn = document.createElement('button');
      downloadLogBtn.textContent = 'Download';
      downloadLogBtn.style.cssText = 'padding:4px 8px;background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:3px;font-size:10px;cursor:pointer;';
      downloadLogBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); downloadLogs(); };

      var clearLogBtn = document.createElement('button');
      clearLogBtn.textContent = 'Clear';
      clearLogBtn.style.cssText = 'padding:4px 8px;background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:3px;font-size:10px;cursor:pointer;';
      clearLogBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        clearLogs();
        var countEl = document.getElementById('ahk-log-count');
        if (countEl) countEl.textContent = 'JS Logs (0 entries)';
      };

      logExportRow.appendChild(logLabel);
      logExportRow.appendChild(copyLogBtn);
      logExportRow.appendChild(downloadLogBtn);
      logExportRow.appendChild(clearLogBtn);
      el.appendChild(logExportRow);

      // ============================================
      // XPath Tester Section
      // ============================================
      var xpathTestSection = document.createElement('div');
      xpathTestSection.style.cssText = 'margin-top:6px;padding:8px;background:rgba(30,27,75,.6);border:1px solid #6d28d9;border-radius:4px;';

      var xpathTestTitle = document.createElement('div');
      xpathTestTitle.style.cssText = 'font-size:11px;color:#c4b5fd;font-weight:bold;margin-bottom:6px;';
      xpathTestTitle.textContent = 'XPath Tester';

      var xpathTestInput = document.createElement('input');
      xpathTestInput.type = 'text';
      xpathTestInput.id = 'combo-xpath-test-input';
      xpathTestInput.placeholder = '//button[contains(text(),"Submit")]';
      xpathTestInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #6d28d9;border-radius:4px;background:#1e1b4b;color:#e0e7ff;font-family:monospace;font-size:10px;margin-bottom:6px;box-sizing:border-box;';

      var xpathTestResult = document.createElement('div');
      xpathTestResult.id = 'combo-xpath-test-result';
      xpathTestResult.style.cssText = 'font-size:10px;color:#a5b4fc;margin-bottom:6px;min-height:14px;word-break:break-all;';

      var xpathTestBtnRow = document.createElement('div');
      xpathTestBtnRow.style.cssText = 'display:flex;gap:6px;';

      var xpFindBtn = document.createElement('button');
      xpFindBtn.textContent = 'Find';
      xpFindBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#4c1d95;color:#c4b5fd;font-size:11px;cursor:pointer;';
      xpFindBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var xpath = document.getElementById('combo-xpath-test-input').value.trim();
        var resEl = document.getElementById('combo-xpath-test-result');
        if (!xpath) { resEl.textContent = 'Enter an XPath first'; resEl.style.color = '#fbbf24'; return; }
        try {
          var r = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          var found = r.singleNodeValue;
          if (found) {
            resEl.style.color = '#4ade80';
            resEl.textContent = 'FOUND: <' + found.tagName.toLowerCase() + '> text="' + (found.textContent || '').substring(0, 60) + '"';
            found.style.outline = '3px solid lime';
            setTimeout(function() { found.style.outline = ''; }, 2500);
          } else {
            resEl.style.color = '#ef4444';
            resEl.textContent = 'NOT FOUND';
          }
        } catch (err) {
          resEl.style.color = '#ef4444';
          resEl.textContent = 'ERROR: ' + err.message;
        }
      };

      var xpClickBtn = document.createElement('button');
      xpClickBtn.textContent = 'Click';
      xpClickBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#7c2d12;color:#fdba74;font-size:11px;cursor:pointer;';
      xpClickBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var xpath = document.getElementById('combo-xpath-test-input').value.trim();
        var resEl = document.getElementById('combo-xpath-test-result');
        if (!xpath) { resEl.textContent = 'Enter an XPath first'; resEl.style.color = '#fbbf24'; return; }
        try {
          var r = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          var found = r.singleNodeValue;
          if (found) {
            var rect = found.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var opts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy };
            found.dispatchEvent(new MouseEvent('mousedown', opts));
            found.dispatchEvent(new MouseEvent('mouseup', opts));
            found.dispatchEvent(new MouseEvent('click', opts));
            resEl.style.color = '#22d3ee';
            resEl.textContent = 'CLICKED: <' + found.tagName.toLowerCase() + '>';
            found.style.outline = '3px solid cyan';
            setTimeout(function() { found.style.outline = ''; }, 1500);
          } else {
            resEl.style.color = '#ef4444';
            resEl.textContent = 'NOT FOUND - cannot click';
          }
        } catch (err) {
          resEl.style.color = '#ef4444';
          resEl.textContent = 'ERROR: ' + err.message;
        }
      };

      var xpFireAllBtn = document.createElement('button');
      xpFireAllBtn.textContent = 'Fire All';
      xpFireAllBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#065f46;color:#6ee7b7;font-size:11px;cursor:pointer;';
      xpFireAllBtn.title = 'Focus + Click sequence + Blur (for form elements)';
      xpFireAllBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var xpath = document.getElementById('combo-xpath-test-input').value.trim();
        var resEl = document.getElementById('combo-xpath-test-result');
        if (!xpath) { resEl.textContent = 'Enter an XPath first'; resEl.style.color = '#fbbf24'; return; }
        if (hasXPathUtils && typeof window.XPathUtils.fireAll === 'function') {
          var result = window.XPathUtils.fireAll(xpath);
          if (result && result.found) {
            resEl.style.color = '#6ee7b7';
            resEl.textContent = 'FIRE ALL: <' + result.element.tagName.toLowerCase() + '> ' + (result.isForm ? '(focus+click+blur)' : '(click only)');
            result.element.style.outline = '3px solid #6ee7b7';
            setTimeout(function() { result.element.style.outline = ''; }, 2000);
          } else {
            resEl.style.color = '#ef4444';
            resEl.textContent = 'NOT FOUND - cannot fire';
          }
        } else {
          resEl.style.color = '#fbbf24';
          resEl.textContent = 'XPathUtils.fireAll not available';
        }
      };

      xpathTestBtnRow.appendChild(xpFindBtn);
      xpathTestBtnRow.appendChild(xpClickBtn);
      xpathTestBtnRow.appendChild(xpFireAllBtn);
      xpathTestSection.appendChild(xpathTestTitle);
      xpathTestSection.appendChild(xpathTestInput);
      xpathTestSection.appendChild(xpathTestResult);
      xpathTestSection.appendChild(xpathTestBtnRow);
      el.appendChild(xpathTestSection);

      return el;
    }

    function toggleMinimize() {
      var toggle = document.getElementById('ahk-combo-toggle');
      var isExpanded = uiState === 'expanded';

      if (isExpanded) {
        logEntry('toggleMinimize', 'Minimizing panel');
        body.style.display = 'none';
        toggle.textContent = '[ + ]';
        header.style.borderRadius = '6px';
        uiState = 'minimized';
      } else {
        logEntry('toggleMinimize', 'Expanding panel');
        body.style.display = '';
        toggle.textContent = '[ - ]';
        header.style.borderRadius = '6px 6px 0 0';
        uiState = 'expanded';
      }
    }

    function restorePanel() {
      logEntry('restorePanel', 'Restoring hidden panel');
      wrapper.style.display = '';
      body.style.display = '';
      var toggle = document.getElementById('ahk-combo-toggle');
      toggle.textContent = '[ - ]';
      header.style.borderRadius = '6px 6px 0 0';
      uiState = 'expanded';
    }

    // S-003: Page-awareness check - only handle Ctrl+Alt+Up/Down on settings pages
    function isOnSettingsPage() {
      var url = window.location.href;
      var isSettings = url.indexOf('/settings') !== -1;
      return isSettings;
    }

    document.addEventListener('keydown', function(e) {
      // Ctrl+/ to focus JS executor textbox
      if (e.ctrlKey && !e.altKey && e.key === '/') {
        e.preventDefault();
        var ta = document.getElementById('__JS_EXECUTOR_ID__');
        if (ta) {
          logEntry('keydown', 'Ctrl+/ pressed, focusing JS executor');
          ta.focus();
        }
        return;
      }

      var isCtrlAlt = e.ctrlKey && e.altKey;
      if (!isCtrlAlt) return;

      var key = e.key.toLowerCase();

      // Ctrl+Alt+S -> Credit Status
      var isStatusKey = key === 's';
      if (isStatusKey) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+S pressed -> Credit Status check');
        window.__checkCredits('onDemand');
        return;
      }

      var isToggleHide = key === 'h';
      if (isToggleHide) {
        e.preventDefault();
        var isHidden = wrapper.style.display === 'none';
        logEntry('keydown', 'Ctrl+Alt+H pressed, isHidden=' + isHidden);
        if (isHidden) restorePanel();
        return;
      }

      // S-003: Only process Up/Down on settings pages to avoid conflict with MacroLoop
      var isSettingsContext = isOnSettingsPage();
      if (!isSettingsContext) {
        logSub('keydown', 'Not on settings page, skipping ComboSwitch shortcut (letting MacroLoop handle it)');
        return;
      }

      var isUpArrow = e.key === 'ArrowUp';
      if (isUpArrow) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+Up pressed on settings page -> ComboSwitch');
        window.__comboSwitch('up');
        return;
      }

      var isDownArrow = e.key === 'ArrowDown';
      if (isDownArrow) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+Down pressed on settings page -> ComboSwitch');
        window.__comboSwitch('down');
        return;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    parent.parentNode.insertBefore(wrapper, parent.nextSibling);
    logEntry(fn, 'UI created and inserted into DOM');

    // Start auto-refresh for credit status
    startAutoRefresh();
  }

  function placeMarker() {
    var fn = 'placeMarker';
    logEntry(fn, 'Placing script marker: ' + ID.SCRIPT_MARKER);
    var marker = document.createElement('div');
    marker.id = ID.SCRIPT_MARKER;
    marker.style.display = 'none';
    document.body.appendChild(marker);
    logSub(fn, 'Marker placed');
  }

  var isFirstLoad = !isAlreadyEmbedded();
  if (!isFirstLoad) {
    logInfo('init', 'Previous instance detected - tearing down for fresh injection');
    // Stop any running combo from previous instance
    if (typeof window.__comboStop === 'function') {
      try { window.__comboStop(); } catch (e) { /* ignore */ }
    }
    // Remove old marker and UI container
    var oldMarker = document.getElementById(ID.SCRIPT_MARKER);
    if (oldMarker) oldMarker.remove();
    var oldContainer = document.getElementById(ID.CONTAINER);
    if (oldContainer) oldContainer.remove();
    logInfo('init', 'Old instance removed, proceeding with fresh injection');
  }
  logInfo('init', isFirstLoad ? 'First load detected, embedding UI' : 'Re-embedding UI after teardown');
  placeMarker();
  createControllerUI();

  // ============================================
  // S-002: MutationObserver to persist UI across SPA navigation
  // Watches for removal of marker/container and re-injects
  // ============================================
  (function setupPersistence() {
    var fn = 'persistence';
    var reinjectDebounce = null;
    var REINJECT_DELAY_MS = 500;

    function tryReinject() {
      var hasMarker = !!document.getElementById(ID.SCRIPT_MARKER);
      var hasContainer = !!document.getElementById(ID.CONTAINER);

      if (!hasMarker) {
        logWarn(fn, 'Marker removed by SPA navigation, re-placing');
        placeMarker();
      }

      if (!hasContainer) {
        logWarn(fn, 'UI container removed by SPA navigation, re-creating');
        createControllerUI();
      }
    }

    var observer = new MutationObserver(function(mutations) {
      var hasRemovals = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].removedNodes.length > 0) {
          hasRemovals = true;
          break;
        }
      }
      if (!hasRemovals) return;

      // Check if our elements were removed
      var markerGone = !document.getElementById(ID.SCRIPT_MARKER);
      var containerGone = !document.getElementById(ID.CONTAINER);

      if (markerGone || containerGone) {
        // Debounce to avoid rapid re-injection during navigation
        if (reinjectDebounce) clearTimeout(reinjectDebounce);
        reinjectDebounce = setTimeout(function() {
          logEntry(fn, 'SPA navigation detected - checking UI state');
          tryReinject();
        }, REINJECT_DELAY_MS);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    logEntry(fn, 'MutationObserver installed for UI persistence');
  })();

  // Cache compiled script in sessionStorage for fast recovery after page refresh
  try {
    sessionStorage.setItem('__combo_src__', '(' + arguments.callee.toString() + ')()');
    logInfo('init', 'Script cached in sessionStorage (' + sessionStorage.getItem('__combo_src__').length + ' chars)');
  } catch (e) {
    logWarn('init', 'sessionStorage caching failed: ' + e.message);
  }

  // XPathUtils integration — no individual globals exposed (use XPathUtils.* in console)
  if (hasXPathUtils) {
    logInfo('init', 'XPathUtils v' + window.XPathUtils.version + ' detected — use XPathUtils.findByXPath(), XPathUtils.clickByXPath(), etc.');
  } else {
    logWarn('init', 'XPathUtils NOT found — XPath console helpers unavailable. Inject xpath-utils.js first.');
  }

  logBanner('init', 'Running combo: ' + DIRECTION);
  logInfo('init', 'XPath: use XPathUtils.findByXPath(x), XPathUtils.clickByXPath(x), XPathUtils.fireAll(x)');
  runComboSwitch(DIRECTION);
})();
