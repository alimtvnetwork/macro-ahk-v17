(function() {
  // NOTE: 'use strict' removed to allow arguments.callee for sessionStorage caching

  // === Domain Guard: Prevent injection into DevTools or non-page contexts ===
  // When AHK injects via Ctrl+Shift+J, the code should run in the inspected page context.
  // However, if focus is wrong or DevTools is detached, it may run in the DevTools document.
  // Detect this and bail out immediately to avoid UI appearing in Network/Elements tabs.
  var currentHostname = window.location.hostname || '(empty)';
  var currentHref = window.location.href || '(empty)';
  var isPageContext = (
    currentHostname.indexOf('lovable.dev') !== -1 ||
    currentHostname.indexOf('lovable.app') !== -1 ||
    currentHostname === 'localhost'
  );
  if (!isPageContext) {
    console.warn(
      '[ComboSwitch] DOMAIN GUARD ABORT (line ~14)\n' +
      '  hostname: ' + currentHostname + '\n' +
      '  href: ' + currentHref + '\n' +
      '  expected: lovable.dev | lovable.app | localhost\n' +
      '  cause: Script executed in DevTools context instead of page context.\n' +
      '  fix: AHK InjectJS focus sequence may have lost page context (F12/Ctrl+Shift+J toggle issue).\n' +
      '  UI will NOT be injected here.'
    );
    return;
  }

  // Support recovery from sessionStorage: window.__comboRecoverDirection overrides the baked-in direction
  const DIRECTION = window.__comboRecoverDirection || '__DIRECTION__';
  if (window.__comboRecoverDirection) {
    delete window.__comboRecoverDirection;
  }
  const VERSION = '__SCRIPT_VERSION__';

  const ID = {
    SCRIPT_MARKER: '__SCRIPT_MARKER_ID__',
    CONTAINER: '__BUTTON_CONTAINER_ID__',
    BTN_UP: '__BUTTON_UP_ID__',
    BTN_DOWN: '__BUTTON_DOWN_ID__',
    PROGRESS_STATUS: '__combo_progress_status__'
  };

  const TIMING = {
    POLL_MS: __COMBO_POLL_INTERVAL_MS__,
    OPEN_MAX: __COMBO_OPEN_MAX_ATTEMPTS__,
    WAIT_MAX: __COMBO_WAIT_MAX_ATTEMPTS__,
    RETRY_COUNT: __COMBO_RETRY_COUNT__,
    RETRY_DELAY_MS: __COMBO_RETRY_DELAY_MS__,
    CONFIRM_DELAY_MS: __COMBO_CONFIRM_DELAY_MS__
  };

  // Credit Status config
  const CREDIT_CFG = {
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
    CREDITS_XPATH: '__TOTAL_CREDITS_XPATH__',
    PROJECT_BUTTON_XPATH: '__COMBO_PROJECT_BUTTON_XPATH__',
    WORKSPACE_XPATH: '__COMBO_WORKSPACE_XPATH__'
  };

  // ============================================
  // Style Constants — fonts, colors, sizes
  // ============================================
  const FONT = {
    HEADING: "'Ubuntu', 'Segoe UI', sans-serif",
    BODY: "'Poppins', 'Segoe UI', sans-serif",
    MONO: "'Fira Code', 'Consolas', monospace"
  };

  const THEME = {
    HEADING_SIZE: '16px',
    SUBHEADING_SIZE: '14px',
    BODY_SIZE: '12px',
    SMALL_SIZE: '10px',
    TINY_SIZE: '9px',
    // Colors
    CYAN: '#22d3ee',
    CYAN_LIGHT: '#67e8f9',
    CYAN_BG: 'rgba(6,182,212,0.08)',
    CYAN_BORDER: 'rgba(6,182,212,0.2)',
    CYAN_HIGHLIGHT_BG: 'rgba(6,182,212,0.15)',
    GREEN: '#22c55e',
    GREEN_LIGHT: '#4ade80',
    YELLOW: '#facc15',
    RED: '#ef4444',
    RED_LIGHT: '#f87171',
    ORANGE: '#f59e0b',
    PURPLE: '#a78bfa',
    PURPLE_LIGHT: '#c4b5fd',
    PURPLE_DARK: '#7c3aed',
    INDIGO: '#818cf8',
    INDIGO_BG: 'rgba(99,102,241,0.1)',
    INDIGO_BORDER: 'rgba(99,102,241,0.3)',
    SLATE_50: '#f8fafc',
    SLATE_200: '#e2e8f0',
    SLATE_300: '#cbd5e1',
    SLATE_400: '#94a3b8',
    SLATE_500: '#64748b',
    SLATE_600: '#475569',
    SLATE_700: '#334155',
    SLATE_800: '#1e293b',
    SLATE_900: '#0f172a',
    SLATE_950: '#111827',
    BG_DARK: '#0f172a',
    BG_DARKER: '#111827',
    MOVE_GREEN: '#059669',
    MOVE_GREEN_HOVER: '#047857',
    BTN_BLUE: '#3b82f6',
    BTN_DARK: '#1f2937',
    DANGER_BG: '#7f1d1d',
    DANGER_TEXT: '#fca5a5',
    DANGER_BORDER: '#991b1b'
  };

  // Inject Google Fonts (Ubuntu + Poppins) if not already loaded
  (function injectFonts() {
    if (document.getElementById('ahk-google-fonts')) return;
    const link = document.createElement('link');
    link.id = 'ahk-google-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&family=Poppins:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
  })();

  // ============================================
  // XPathUtils integration: delegate reactClick & findByXPath to shared module
  // XPathUtils.js MUST be injected by AHK before combo.js
  // ============================================
  let hasXPathUtils = typeof window.XPathUtils !== 'undefined';

  function bindXPathHelpers() {
    if (typeof window.XPathUtils !== 'undefined') {
      hasXPathUtils = true;
      window.XPathUtils.setLogger(
        function(fn, msg) { logEntry(fn, msg); },
        function(fn, msg) { logSub(fn, msg); },
        function(fn, msg) { logWarn(fn, msg); }
      );
    }
  }

  if (hasXPathUtils) {
    bindXPathHelpers();
  } else {
    setTimeout(function() {
      if (typeof window.XPathUtils !== 'undefined' && !hasXPathUtils) {
        logInfo('init', 'XPathUtils detected on deferred retry (500ms)');
        bindXPathHelpers();
      }
    }, 500);
  }

  // React-compatible click: delegates to XPathUtils if available, fallback inline
  function reactClick(el, callerXpath) {
    if (hasXPathUtils) {
      window.XPathUtils.reactClick(el, callerXpath);
      return;
    }
    const fn = 'reactClick';
    const tag = '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '>';
    logEntry(fn, 'Clicking ' + tag + ' | XPath: ' + (callerXpath || '(no xpath)') + ' [FALLBACK]');
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const opts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy };
    const pointerOpts = { view: window, bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', pointerOpts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', pointerOpts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    logSub(fn, 'All 5 events dispatched [FALLBACK]');
  }

  const creditState = {
    lastCheckedAt: null,
    freeTierAvailable: null,
    totalCreditsText: '',
    perWorkspace: [],
    source: null,
    autoTimerId: null,
    projectName: null  // populated from API workspace name
  };

  const XPATH = {
    TRANSFER: "__TRANSFER_XPATH__",
    COMBO1: "__COMBO1_XPATH__",
    COMBO2: "__COMBO2_XPATH__",
    OPTIONS: "__OPTIONS_XPATH__",
    CONFIRM: "__CONFIRM_XPATH__",
    PROJECT_NAME: "__PROJECT_NAME_XPATH__"
  };

  function splitPipe(str) {
    if (!str || str === '' || str.charAt(0) === '_') return null;
    const parts = str.split('|');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      const trimmed = parts[i].trim();
      if (trimmed) result.push(trimmed);
    }
    return result.length > 0 ? result : null;
  }

  function cfgStr(str) {
    if (!str || str === '' || str.charAt(0) === '_') return null;
    const trimmed = str.trim();
    return trimmed || null;
  }

  const COLOR = {
    CYAN: 'color: cyan; font-weight: bold;',
    CYAN_LG: 'color: cyan; font-weight: bold; font-size: 14px;',
    LIME: 'color: lime;',
    LIME_BOLD: 'color: lime; font-weight: bold;',
    YELLOW: 'color: yellow; font-weight: bold;',
    GRAY: 'color: gray;',
    RED: 'color: #ef4444; font-weight: bold;',
    ORANGE: 'color: orange;'
  };

  const PREFIX = '[ComboSwitch]';

  // ============================================
  // localStorage logging system
  // ============================================
  const LOG_STORAGE_KEY = 'ahk_combo_logs';
  const LOG_MAX_ENTRIES = 500;

  function getLogStorageKey() {
    const url = window.location.href;
    const projectMatch = url.match(/\/projects\/([a-f0-9-]+)/);
    const projectId = projectMatch ? projectMatch[1].substring(0, 8) : 'unknown';
    return LOG_STORAGE_KEY + '_' + projectId;
  }

  function persistLog(level, funcName, message) {
    try {
      const key = getLogStorageKey();
      let logs = JSON.parse(localStorage.getItem(key) || '[]');
      const now = new Date();
      const timestamp = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
      const key = getLogStorageKey();
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) { return []; }
  }

  function clearLogs() {
    try {
      const key = getLogStorageKey();
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
  }

  function formatLogsForExport() {
    const logs = getAllLogs();
    const lines = [];
    lines.push('=== ComboSwitch Logs ===');
    lines.push('Project URL: ' + window.location.href);
    lines.push('Exported at: ' + new Date().toISOString());
    lines.push('Total entries: ' + logs.length);
    lines.push('---');
    for (let i = 0; i < logs.length; i++) {
      const e = logs[i];
      lines.push('[' + e.t + '] [' + e.l + '] [' + e.f + '] ' + e.m);
    }
    return lines.join('\n');
  }

  function copyLogsToClipboard() {
    const text = formatLogsForExport();
    navigator.clipboard.writeText(text).then(function() {
      logEntry('copyLogs', 'Copied ' + getAllLogs().length + ' log entries to clipboard');
    }).catch(function(err) {
      logWarn('copyLogs', 'Clipboard copy failed: ' + err.message);
    });
  }

  function downloadLogs() {
    const text = formatLogsForExport();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comboswitch-logs-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    logEntry('downloadLogs', 'Downloaded logs file');
  }

  window.__comboLogs = { copy: copyLogsToClipboard, download: downloadLogs, get: getAllLogs, clear: clearLogs, format: formatLogsForExport };

  // ============================================
  // Bearer Token localStorage persistence
  // ============================================
  const BEARER_STORAGE_KEY = 'ahk_bearer_token';

  function getBearerStorageKey() {
    return BEARER_STORAGE_KEY;
  }

  // One-time migration: copy old project-scoped keys to the new domain-scoped key
  (function migrateBearerToken() {
    try {
      if (localStorage.getItem(BEARER_STORAGE_KEY)) return; // already migrated
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('ahk_bearer_') === 0 && k !== BEARER_STORAGE_KEY) {
          const val = localStorage.getItem(k);
          if (val) {
            localStorage.setItem(BEARER_STORAGE_KEY, val);
            logInfo('migrateBearerToken', 'Migrated token from ' + k + ' to ' + BEARER_STORAGE_KEY);
            break;
          }
        }
      }
    } catch (e) { /* ignore */ }
  })();

  function saveBearerTokenToStorage(token) {
    const fn = 'saveBearerToken';
    try {
      localStorage.setItem(BEARER_STORAGE_KEY, token);
      logEntry(fn, 'Bearer token saved to localStorage (key=' + BEARER_STORAGE_KEY + ', len=' + token.length + ')');
    } catch (e) {
      logWarn(fn, 'Failed to save bearer token: ' + e.message);
    }
  }

  // v7.9.31: Mark bearer token as expired — scoped to controller's own token title element
  // Also injects a visible "Paste Save" button next to the title for quick token replacement
  function markBearerTokenExpired(controller) {
    var inputId = controller === 'combo' ? 'ahk-bearer-token-input' : 'loop-bearer-input';
    var titleId = controller === 'combo' ? 'combo-bearer-title' : 'loop-bearer-title';
    var pasteBtnId = controller === 'combo' ? 'combo-quick-paste-btn' : 'loop-quick-paste-btn';
    var inp = document.getElementById(inputId);
    if (inp) {
      inp.style.borderColor = '#ef4444';
      inp.style.boxShadow = '0 0 4px rgba(239,68,68,0.5)';
    }
    var titleEl = document.getElementById(titleId);
    if (titleEl) {
      titleEl.textContent = 'Bearer Token 🔴 EXPIRED — replace token!';
      titleEl.style.color = '#fca5a5';
    }
    // v7.9.31: Show a quick "Paste Save" button next to the bearer title
    if (!document.getElementById(pasteBtnId)) {
      var headerParent = titleEl ? titleEl.parentElement : null;
      if (headerParent) {
        var quickPasteBtn = document.createElement('button');
        quickPasteBtn.id = pasteBtnId;
        quickPasteBtn.textContent = 'Paste  Save';
        quickPasteBtn.title = 'Paste token from clipboard and save immediately';
        quickPasteBtn.style.cssText = 'margin-left:auto;padding:3px 10px;background:#7c3aed;color:#e9d5ff;border:1px solid #6d28d9;border-radius:3px;font-size:10px;cursor:pointer;font-weight:bold;';
        quickPasteBtn.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          pasteAndVerifyToken(controller);
        };
        headerParent.appendChild(quickPasteBtn);
      }
    }
    logWarn('markBearerTokenExpired', '[' + controller + '] Bearer token marked as EXPIRED (401/403 received)');
  }

  function getBearerTokenFromStorage() {
    try {
      return localStorage.getItem(BEARER_STORAGE_KEY) || '';
    } catch (e) { return ''; }
  }

  // v7.9.31: Paste from clipboard, save, verify by querying workspaces, then detect workspace via XPath
  function pasteAndVerifyToken(controller) {
    var fn = 'pasteAndVerify';
    var titleId = controller === 'combo' ? 'combo-bearer-title' : 'loop-bearer-title';
    var inputId = controller === 'combo' ? 'ahk-bearer-token-input' : 'loop-bearer-input';
    var pasteBtnId = controller === 'combo' ? 'combo-quick-paste-btn' : 'loop-quick-paste-btn';
    var titleEl = document.getElementById(titleId);

    navigator.clipboard.readText().then(function(clipText) {
      var val = (clipText || '').trim();
      if (!val || val.length < 10) {
        logWarn(fn, 'Invalid clipboard content (len=' + (val ? val.length : 0) + ')');
        if (titleEl) { titleEl.textContent = 'Bearer Token ⚠️ invalid clipboard!'; titleEl.style.color = '#ef4444'; }
        setTimeout(function() { if (titleEl) { titleEl.style.color = ''; titleEl.textContent = 'Bearer Token ⚠️ (not set)'; } }, 2500);
        return;
      }
      var inp = document.getElementById(inputId);
      if (inp) {
        inp.value = val;
        inp.style.borderColor = '#0e7490';
        inp.style.boxShadow = 'none';
      }
      saveBearerTokenToStorage(val);
      logEntry(fn, 'Token saved (' + val.length + ' chars) — verifying...');
      if (titleEl) { titleEl.textContent = 'Bearer Token 🔄 Verifying...'; titleEl.style.color = THEME.YELLOW; }

      // Verify by querying workspaces API
      var url = CREDIT_CFG.API_BASE + '/user/workspaces';
      var headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + val };
      fetch(url, { method: 'GET', headers: headers, credentials: 'include' })
        .then(function(resp) {
          if (!resp.ok) {
            logWarn(fn, 'Token verification FAILED — HTTP ' + resp.status);
            if (titleEl) { titleEl.textContent = 'Bearer Token 🔴 INVALID (HTTP ' + resp.status + ')'; titleEl.style.color = THEME.RED; }
            setTimeout(function() { if (titleEl) { titleEl.style.color = ''; } }, 3000);
            return;
          }
          return resp.text().then(function(bodyText) {
            var data;
            try { data = JSON.parse(bodyText); } catch(e) { return; }
            logEntry(fn, '✅ Token is VALID — ' + (Array.isArray(data) ? data.length : '?') + ' workspaces returned');
            if (titleEl) { titleEl.textContent = 'Bearer Token ✅ Valid & saved (' + val.length + ' chars)'; titleEl.style.color = THEME.GREEN; }
            setTimeout(function() { if (titleEl) { titleEl.style.color = ''; } }, 3000);
            // Remove the quick paste button
            var quickBtn = document.getElementById(pasteBtnId);
            if (quickBtn) quickBtn.remove();
            // Parse and update workspace data
            parseApiResponse(data);
            // Detect workspace via XPath
            autoDetectCurrentWorkspace(val, 'token-verify-' + Date.now()).then(function() {
              updateCreditDisplay();
              logEntry(fn, 'Workspace detection complete after token refresh');
            });
          });
        })
        .catch(function(err) {
          logWarn(fn, 'Network error — ' + err.message);
          if (titleEl) { titleEl.textContent = 'Bearer Token ⚠️ network error'; titleEl.style.color = THEME.RED; }
        });
    }).catch(function(err) {
      logWarn(fn, 'Clipboard read failed — ' + err.message);
      if (titleEl) { titleEl.textContent = 'Bearer Token ⚠️ clipboard denied!'; titleEl.style.color = THEME.RED; }
    });
  }

    const fn = 'clearAllLocalStorage';
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.indexOf('ahk_') === 0 || key.indexOf('ml_') === 0)) {
          keysToRemove.push(key);
        }
      }
      for (let j = 0; j < keysToRemove.length; j++) {
        localStorage.removeItem(keysToRemove[j]);
      }
      logEntry(fn, 'Cleared ' + keysToRemove.length + ' localStorage keys (ahk_* and ml_*)');

      // Also clear in-memory history arrays and re-render
      if (typeof comboHistory !== 'undefined' && Array.isArray(comboHistory)) {
        comboHistory.length = 0;
      }
      if (typeof jsHistory !== 'undefined' && Array.isArray(jsHistory)) {
        jsHistory.length = 0;
        jsHistoryIndex = -1;
      }
      // Re-render history panels
      if (typeof renderHistory === 'function') renderHistory();
      if (typeof renderJsHistory === 'function') renderJsHistory();

      return keysToRemove.length;
    } catch (e) {
      logWarn(fn, 'Failed to clear localStorage: ' + e.message);
      return 0;
    }
  }

  window.__comboClearAll = clearAllLocalStorage;

  function logEntry(funcName, message) {
    console.log('%c' + PREFIX + ' [' + funcName + '] ' + message, COLOR.LIME);
    persistLog('INFO', funcName, message);
  }

  function logSub(funcName, message, indent) {
    const level = indent || 1;
    let pad = '';
    for (let p = 0; p < level; p++) pad += '  ';
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
    let msg = PREFIX + ' [' + funcName + '] Step ' + step + ': ERROR - ' + message;
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
    const fn = 'findByXPath';
    const isXPathEmpty = isEmptyString(xpath);
    if (isXPathEmpty) {
      logWarn(fn, 'XPath is empty, returning null');
      return null;
    }
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      const isFound = !!result;
      logSub(fn, 'XPath ' + (isFound ? 'FOUND' : 'NOT FOUND') + ': ' + xpath);
      return result;
    } catch (e) {
      console.error(PREFIX + ' [' + fn + '] Invalid XPath: ' + xpath, e);
      return null;
    }
  }

  // ============================================
  // S-001: Generic findElement() with multi-method fallback
  // descriptor: { name, xpath, textMatch, textMatchExact, tag, selector, role, ariaLabel, headingSearch }
  // ============================================
  function findElement(descriptor) {
    const fn = 'findElement';
    const name = descriptor.name || 'unknown';
    logEntry(fn, 'Searching for "' + name + '"');

    // Method 1: Configured XPath
    if (descriptor.xpath) {
      logSub(fn, 'Method 1 (XPath) for ' + name + ': ' + descriptor.xpath);
      const xpathResult = findByXPath(descriptor.xpath);
      if (xpathResult) {
        logSub(fn, name + ' FOUND via XPath: ' + descriptor.xpath);
        return xpathResult;
      }
      logWarn(fn, name + ' XPath failed: ' + descriptor.xpath + ' — trying fallbacks');
    }

    // Method 2: Text-based scan (scan tags for matching text)
    if (descriptor.textMatch) {
      const tag = descriptor.tag || 'button';
      const texts = Array.isArray(descriptor.textMatch) ? descriptor.textMatch : [descriptor.textMatch];
      const useExact = !!descriptor.textMatchExact;
      logSub(fn, 'Method 2 (text scan' + (useExact ? ', exact' : ', substring') + '): looking for ' + JSON.stringify(texts) + ' in <' + tag + '>');
      const allTags = document.querySelectorAll(tag);
      for (let t = 0; t < allTags.length; t++) {
        const elText = (allTags[t].textContent || '').trim();
        for (let m = 0; m < texts.length; m++) {
          const isMatch = useExact ? (elText === texts[m]) : (elText === texts[m] || elText.indexOf(texts[m]) !== -1);
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
      const selectors = Array.isArray(descriptor.selector) ? descriptor.selector : [descriptor.selector];
      logSub(fn, 'Method 3 (CSS selector): trying ' + selectors.length + ' selectors');
      for (let s = 0; s < selectors.length; s++) {
        try {
          const selectorResult = document.querySelector(selectors[s]);
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
        const ariaLabels = Array.isArray(descriptor.ariaLabel) ? descriptor.ariaLabel : [descriptor.ariaLabel];
        for (let a = 0; a < ariaLabels.length; a++) {
          const ariaSelector = '[aria-label*="' + ariaLabels[a] + '" i], [title*="' + ariaLabels[a] + '" i]';
          try {
            const ariaResult = document.querySelector(ariaSelector);
            if (ariaResult) {
              logSub(fn, name + ' FOUND via ARIA label: ' + ariaLabels[a]);
              return ariaResult;
            }
          } catch (e) { /* ignore */ }
        }
      }
      if (descriptor.role) {
        const roleSelector = '[role="' + descriptor.role + '"]';
        const roleResult = document.querySelector(roleSelector);
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
      const headings = document.querySelectorAll('h2, h3, h4, div[class*="heading"], div[class*="title"]');
      for (let h = 0; h < headings.length; h++) {
        const headingText = (headings[h].textContent || '').trim().toLowerCase();
        const isHeadingMatch = headingText.indexOf(descriptor.headingSearch.toLowerCase()) !== -1;
        if (isHeadingMatch) {
          const parent = headings[h].closest('div');
          let walkNode = parent;
          const walkTag = descriptor.tag || 'button';
          const maxWalk = 5;
          let walkCount = 0;
          while (walkNode && walkCount < maxWalk) {
            const nearbyEl = walkNode.querySelector(walkTag);
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
      const sels = Array.isArray(descriptor.selector) ? descriptor.selector : [descriptor.selector];
      logError(fn, '~', 'Failed selectors: ' + sels.join(' | '));
    }
    return null;
  }

  // ============================================
  // S-001: Element descriptors for all XPath-dependent elements
  // ============================================
  const ELEMENTS = {
    TRANSFER: {
      name: 'Transfer button',
      xpath: XPATH.TRANSFER,
      textMatch: splitPipe('__TRANSFER_TEXT_MATCH__') || ['Transfer project', 'Transfer'],
      textMatchExact: true,
      tag: cfgStr('__TRANSFER_TAG__') || 'button',
      selector: splitPipe('__TRANSFER_SELECTOR__'),
      ariaLabel: splitPipe('__TRANSFER_ARIA_LABEL__') || ['Transfer'],
      headingSearch: cfgStr('__TRANSFER_HEADING_SEARCH__') || 'transfer',
      role: cfgStr('__TRANSFER_ROLE__')
    },
    COMBO1: {
      name: 'Combo 1 text (current project)',
      xpath: XPATH.COMBO1,
      textMatch: splitPipe('__COMBO1_TEXT_MATCH__'),
      tag: cfgStr('__COMBO1_TAG__') || 'p',
      selector: splitPipe('__COMBO1_SELECTOR__') || [
        'div[role="dialog"] p.min-w-0.truncate',
        'div[role="dialog"] p.truncate',
        'div[role="dialog"] p',
        '[data-radix-popper-content-wrapper] p',
        'div[role="alertdialog"] p.truncate',
        'div[role="alertdialog"] p',
        '[class*="DialogContent"] p.truncate',
        '[class*="DialogContent"] p'
      ],
      ariaLabel: splitPipe('__COMBO1_ARIA_LABEL__'),
      headingSearch: cfgStr('__COMBO1_HEADING_SEARCH__'),
      role: cfgStr('__COMBO1_ROLE__')
    },
    COMBO2: {
      name: 'Combo 2 button (project dropdown)',
      xpath: XPATH.COMBO2,
      textMatch: splitPipe('__COMBO2_TEXT_MATCH__'),
      tag: cfgStr('__COMBO2_TAG__') || 'button',
      selector: splitPipe('__COMBO2_SELECTOR__') || ['div[role="dialog"] button[role="combobox"]', 'div[role="dialog"] button:not(:last-child)'],
      ariaLabel: splitPipe('__COMBO2_ARIA_LABEL__'),
      headingSearch: cfgStr('__COMBO2_HEADING_SEARCH__'),
      role: cfgStr('__COMBO2_ROLE__') || 'combobox'
    },
    OPTIONS: {
      name: 'Options container',
      xpath: XPATH.OPTIONS,
      textMatch: splitPipe('__OPTIONS_TEXT_MATCH__'),
      tag: cfgStr('__OPTIONS_TAG__'),
      selector: splitPipe('__OPTIONS_SELECTOR__') || ['[role="listbox"]', '[data-radix-popper-content-wrapper] > div', '[cmdk-list]'],
      ariaLabel: splitPipe('__OPTIONS_ARIA_LABEL__'),
      headingSearch: cfgStr('__OPTIONS_HEADING_SEARCH__'),
      role: cfgStr('__OPTIONS_ROLE__') || 'listbox'
    },
    CONFIRM: {
      name: 'Confirm button',
      xpath: XPATH.CONFIRM,
      textMatch: splitPipe('__CONFIRM_TEXT_MATCH__') || ['Confirm transfer', 'Confirm'],
      textMatchExact: true,
      tag: cfgStr('__CONFIRM_TAG__') || 'button',
      selector: splitPipe('__CONFIRM_SELECTOR__') || ['div[role="dialog"] button:last-child', 'div[role="alertdialog"] button:last-child', 'div[role="dialog"] button[type="submit"]'],
      ariaLabel: splitPipe('__CONFIRM_ARIA_LABEL__'),
      headingSearch: cfgStr('__CONFIRM_HEADING_SEARCH__'),
      role: cfgStr('__CONFIRM_ROLE__')
    }
  };

  function isEmptyString(value) {
    return !value || !value.trim();
  }

  function isAlreadyEmbedded() {
    const isEmbedded = !!document.getElementById(ID.SCRIPT_MARKER);
    logSub('isAlreadyEmbedded', 'marker=' + ID.SCRIPT_MARKER + ', embedded=' + isEmbedded);
    return isEmbedded;
  }

  function hasContainerUI() {
    const hasUI = !!document.getElementById(ID.CONTAINER);
    logSub('hasContainerUI', 'container=' + ID.CONTAINER + ', exists=' + hasUI);
    return hasUI;
  }

  // S-001: pollForElement now uses findElement() with descriptor fallback
  // S-005: Added onFail callback for retry support
  // Can accept either (xpath, desc, onFound, max, onFail) or (descriptor, desc, onFound, max, onFail)
  function pollForElement(xpathOrDescriptor, description, onFound, maxAttempts, onFail) {
    const fn = 'pollForElement';
    let attempts = 0;
    const max = maxAttempts || TIMING.WAIT_MAX;
    const isDescriptor = typeof xpathOrDescriptor === 'object' && xpathOrDescriptor !== null;
    const desc = isDescriptor ? xpathOrDescriptor.name || description : description;
    logEntry(fn, 'Polling for "' + desc + '" (max=' + max + ', interval=' + TIMING.POLL_MS + 'ms, mode=' + (isDescriptor ? 'multi-method' : 'xpath-only') + ')');

    const interval = setInterval(function() {
      attempts++;
      const el = isDescriptor ? findElement(xpathOrDescriptor) : findByXPath(xpathOrDescriptor);

      const isFound = !!el;
      if (isFound) {
        clearInterval(interval);
        logStep(fn, '~', desc + ' FOUND (attempt ' + attempts + ')');
        onFound(el);
        return;
      }

      const isMaxReached = attempts >= max;
      if (isMaxReached) {
        clearInterval(interval);
        logError(fn, '~', desc + ' NOT FOUND after ' + max + ' attempts', isDescriptor ? xpathOrDescriptor.xpath : xpathOrDescriptor);
        // S-005: Call onFail if provided
        if (typeof onFail === 'function') {
          onFail(desc);
        }
        return;
      }

      const shouldLogProgress = attempts <= 3 || attempts % 5 === 0;
      if (shouldLogProgress) {
        logSub(fn, 'Waiting for ' + desc + '... (' + attempts + '/' + max + ')');
      }
    }, TIMING.POLL_MS);
  }

  function extractOptionLabels(options) {
    const fn = 'extractOptionLabels';
    logEntry(fn, 'Extracting labels from ' + options.length + ' options');
    const labels = options.map(function(opt) {
      const labelEl = opt.querySelector('p.min-w-0.truncate');
      return labelEl ? labelEl.textContent.trim() : (opt.textContent || '').trim();
    });
    logSub(fn, 'Labels: [' + labels.join(', ') + ']');
    return labels;
  }

  // ============================================
  // Save workspace names to shared localStorage for MacroLoop
  // Key: ml_known_workspaces — shared across both scripts (same origin)
  // ============================================
  const WS_SHARED_KEY = 'ml_known_workspaces';

  function saveKnownWorkspaces(labels) {
    const fn = 'saveKnownWorkspaces';
    try {
      const existing = JSON.parse(localStorage.getItem(WS_SHARED_KEY) || '[]');
      const merged = existing.slice();
      let added = 0;
      for (let i = 0; i < labels.length; i++) {
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
    const fn = 'findExactMatchIndex';
    for (let i = 0; i < labels.length; i++) {
      const isExactMatch = labels[i] === text;
      if (isExactMatch) {
        logSub(fn, 'Exact match at index ' + i + ': "' + labels[i] + '"');
        return i;
      }
    }
    logSub(fn, 'No exact match for "' + text + '"');
    return -1;
  }

  function findPartialMatchIndex(labels, text) {
    const fn = 'findPartialMatchIndex';
    for (let i = 0; i < labels.length; i++) {
      const hasForwardMatch = labels[i].indexOf(text) !== -1;
      const hasReverseMatch = text.indexOf(labels[i]) !== -1;
      const isPartialMatch = hasForwardMatch || hasReverseMatch;
      if (isPartialMatch) {
        logSub(fn, 'Partial match at index ' + i + ': "' + labels[i] + '" (forward=' + hasForwardMatch + ', reverse=' + hasReverseMatch + ')');
        return i;
      }
    }
    logSub(fn, 'No partial match for "' + text + '"');
    return -1;
  }

  function findMatchingIndex(labels, sourceText) {
    const fn = 'findMatchingIndex';
    logEntry(fn, 'Searching for "' + sourceText + '" in ' + labels.length + ' labels: [' + labels.join(', ') + ']');

    const exactIndex = findExactMatchIndex(labels, sourceText);
    const isExactFound = exactIndex !== -1;
    if (isExactFound) {
      logSub(fn, 'Using exact match at index ' + exactIndex);
      return exactIndex;
    }

    logWarn(fn, 'Exact match not found for "' + sourceText + '", trying partial...');
    const partialIndex = findPartialMatchIndex(labels, sourceText);
    if (partialIndex === -1) {
      logError(fn, '~', 'No match found. Source: "' + sourceText + '" | Labels: [' + labels.join(', ') + ']');
    }
    logSub(fn, 'Partial match result: ' + partialIndex);
    return partialIndex;
  }

  function calculateTargetIndex(currentIndex, totalOptions, direction) {
    const fn = 'calculateTargetIndex';
    let targetIndex;
    const isDirectionUp = direction === 'up';
    if (isDirectionUp) {
      const isAtStart = currentIndex === 0;
      targetIndex = isAtStart ? totalOptions - 1 : currentIndex - 1;
    } else {
      const isAtEnd = currentIndex === totalOptions - 1;
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
  const retryState = {
    attempt: 0,
    maxRetries: TIMING.RETRY_COUNT,
    retryDelayMs: TIMING.RETRY_DELAY_MS
  };

  // S-005: Called when any step fails — triggers retry if attempts remain
  function handleStepFailure(stepName, direction) {
    const fn = 'handleStepFailure';
    retryState.attempt++;
    const hasRetriesLeft = retryState.attempt <= retryState.maxRetries;

    if (hasRetriesLeft) {
      logWarn(fn, 'Step "' + stepName + '" failed (attempt ' + retryState.attempt + '/' + retryState.maxRetries + '), retrying in ' + retryState.retryDelayMs + 'ms...');
      setTimeout(function() {
        logBanner(fn, '========== RETRY #' + retryState.attempt + ': ' + direction.toUpperCase() + ' ==========');
        clickTransferButton(direction);
      }, retryState.retryDelayMs);
    } else {
      logError(fn, '~', 'All ' + retryState.maxRetries + ' retries exhausted for step "' + stepName + '"');
      setProgressStatus('error');
      resetButtonHighlight(false);
      // Signal failure to AHK via title marker (NO alert — design rule)
      document.title = '__AHK_COMBO_FAILED__' + stepName + '__' + document.title;
      // Update status display with error
      const statusEl = document.getElementById('ahk-combo-status');
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#ef4444;font-weight:600;">FAILED</span>'
          + '<span style="color:#94a3b8;font-size:10px;margin-left:6px;">Step: ' + stepName + ' after ' + retryState.maxRetries + ' retries</span>';
      }
    }
  }

  function clickTransferButton(direction) {
    const fn = 'clickTransferButton';
    logEntry(fn, 'Looking for transfer button');

    const transferBtn = findTransferButton();
    const isTransferFound = !!transferBtn;

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
    const fn = 'waitForCombo1Text';
    logEntry(fn, 'Waiting for combo 1 text element');
    pollForElement(ELEMENTS.COMBO1, 'Combo 1 text', function(combo1) {
      const sourceText = (combo1.textContent || '').trim();
      logStep(fn, 2, 'Source project = "' + sourceText + '"');
      setButtonStep(2);
      // Ground truth: COMBO1 text IS the current workspace name (from Transfer dialog DOM)
      if (sourceText) {
        window.__wsCurrentName = sourceText;
        logSub(fn, 'Set __wsCurrentName from COMBO1 DOM: "' + sourceText + '"');
      }
      logSub(fn, 'Proceeding to waitForCombo2Button');
      waitForCombo2Button(direction, sourceText);
    }, null, function() { handleStepFailure('Combo1 text', direction); });
  }

  function waitForCombo2Button(direction, sourceText) {
    const fn = 'waitForCombo2Button';
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
    const fn = 'waitForDropdownOpen';
    let attempts = 0;
    logEntry(fn, 'Waiting for dropdown to open (max=' + TIMING.OPEN_MAX + ')');

    const interval = setInterval(function() {
      attempts++;
      const openTrigger = document.querySelector("button[data-state='open']");
      const isDropdownOpen = !!openTrigger;

      if (isDropdownOpen) {
        clearInterval(interval);
        logStep(fn, 4, 'Dropdown OPENED (attempt ' + attempts + ')');
        setButtonStep(4);
        logSub(fn, 'Proceeding to waitForOptions');
        waitForOptions(direction, sourceText);
        return;
      }

      const isMaxReached = attempts >= TIMING.OPEN_MAX;
      if (isMaxReached) {
        clearInterval(interval);
        logError(fn, 4, 'Dropdown did not open after ' + TIMING.OPEN_MAX + ' attempts');
        handleStepFailure('Dropdown open', direction);
      }
    }, TIMING.POLL_MS);
  }

  function waitForOptions(direction, sourceText) {
    const fn = 'waitForOptions';
    logEntry(fn, 'Waiting for options container with actual options');
    let attempts = 0;
    const max = TIMING.WAIT_MAX;

    const interval = setInterval(function() {
      attempts++;

      // Try 1: configured XPath
      let listRoot = findByXPath(XPATH.OPTIONS);
      let options = listRoot ? Array.from(listRoot.querySelectorAll("div[role='option']")) : [];

      // Try 2: if XPath container found but has 0 options, try CSS fallbacks
      if (options.length === 0) {
        const fallbackSelectors = ['[role="listbox"]', '[cmdk-list]', '[data-radix-popper-content-wrapper] > div'];
        for (let i = 0; i < fallbackSelectors.length; i++) {
          try {
            const fallback = document.querySelector(fallbackSelectors[i]);
            if (fallback) {
              const fallbackOpts = Array.from(fallback.querySelectorAll("div[role='option']"));
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
        const labels = extractOptionLabels(options);
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
    const fn = 'selectTargetOption';
    logEntry(fn, 'Finding target option for direction=' + direction);

    const currentIndex = findMatchingIndex(labels, sourceText);
    const isMatchFound = currentIndex !== -1;

    if (isMatchFound) {
      logStep(fn, 6, 'Current match at index ' + currentIndex + ' ("' + labels[currentIndex] + '")');
      setButtonStep(6);
      const targetIndex = calculateTargetIndex(currentIndex, options.length, direction);
      // Calculate the opposite direction target for status display
      const oppositeDir = direction === 'up' ? 'down' : 'up';
      const oppositeIndex = calculateTargetIndex(currentIndex, options.length, oppositeDir);
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
    const fn = 'waitForConfirmButton';
    logEntry(fn, 'Waiting for confirm button');
    pollForElement(ELEMENTS.CONFIRM, 'Confirm button', function(confirmBtn) {
      logStep(fn, 8, 'Confirm button FOUND, clicking');
      setButtonStep(8);
       // Use native .click() for confirm button (consistent with option click fix - avoids overlay warnings from synthetic events)
       confirmBtn.click();
      // S-005: Reset retry state on success
      retryState.attempt = 0;
      setProgressStatus('done');
      logBanner(fn, 'DONE! ' + direction + ' -> "' + targetLabel + '"');
      // After successful switch, project is now in the target workspace
      if (targetLabel) {
        window.__wsCurrentName = targetLabel;
        logSub(fn, 'Updated __wsCurrentName to target: "' + targetLabel + '"');
      }
      addHistoryEntry(direction, targetLabel);
      resetButtonHighlight(true);
      // Re-render status to show TARGET as NOW (the project is now in targetLabel's workspace)
      var statusEl = document.getElementById('ahk-combo-status');
      if (statusEl && targetLabel) {
        statusEl.innerHTML = ''
          + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
          + '<span style="color:' + THEME.SLATE_400 + ';font-size:11px;font-family:' + FONT.BODY + ';">NOW:</span>'
          + '<span style="color:' + THEME.CYAN + ';font-weight:800;font-size:' + THEME.SUBHEADING_SIZE + ';font-family:' + FONT.HEADING + ';">' + targetLabel + '</span>'
          + '<span style="color:' + THEME.GREEN + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';font-weight:600;"> ✅ DONE</span>'
          + '</div>';
      }
      // Immediately update header NOW section and workspace list to reflect new current
      updateCreditDisplay();
      var wsData = window.__wsDropdownData || [];
      var searchEl = document.getElementById('ahk-ws-search');
      var wsFilter = searchEl ? searchEl.value.trim() : '';
      renderWorkspaceList(wsData, window.__wsCurrentName, wsFilter);
      flashStatus();
      // Also refresh credits from API to get accurate data for the new workspace
      setTimeout(function() { checkCreditsStatus('comboSwitch'); }, 2000);
    }, null, function() { handleStepFailure('Confirm button', direction); });
  }

  // ============================================
  // Progress status element for AHK polling
  // States: idle, in_progress, done, error
  // v7.9: Title-based signaling — AHK reads WinGetTitle instead of clipboard.
  //   navigator.clipboard.writeText() is async (returns Promise) which caused
  //   AHK to read empty clipboard. Title markers are synchronous and reliable.
  // ============================================
  function setProgressStatus(status) {
    const fn = 'setProgressStatus';
    let el = document.getElementById(ID.PROGRESS_STATUS);
    if (!el) {
      // Create it if missing (e.g., SPA navigation removed it)
      el = document.createElement('div');
      el.id = ID.PROGRESS_STATUS;
      el.style.display = 'none';
      document.body.appendChild(el);
      logSub(fn, 'Progress status element re-created');
    }
    el.setAttribute('data-status', status);
    el.textContent = status;

    // v7.9: Signal AHK via document.title marker (synchronous, no clipboard Promise issue)
    // AHK polls WinGetTitle() — zero JS injection needed during polling
    var titleClean = document.title.replace(/__AHK_COMBO_\w+__/g, '');
    if (status === 'done') {
      document.title = '__AHK_COMBO_DONE__' + titleClean;
    } else if (status === 'error') {
      document.title = '__AHK_COMBO_ERROR__' + titleClean;
    } else {
      document.title = titleClean; // Clear markers for idle/in_progress
    }

    // v7.9: Update visible status badge in UI
    updateStatusBadge(status);

    logEntry(fn, 'Status → ' + status + ' (title marker set)');
  }

  function getProgressStatus() {
    const el = document.getElementById(ID.PROGRESS_STATUS);
    return el ? (el.getAttribute('data-status') || 'idle') : 'idle';
  }

  // v7.9: Update the visible status badge in the header
  function updateStatusBadge(status) {
    var badge = document.getElementById('ahk-status-badge');
    if (!badge) return;
    var colors = {
      'idle': { bg: THEME.SLATE_700, text: THEME.SLATE_400, label: '● IDLE' },
      'in_progress': { bg: 'rgba(250,204,21,0.2)', text: THEME.YELLOW, label: '◉ RUNNING' },
      'done': { bg: 'rgba(34,197,94,0.2)', text: THEME.GREEN, label: '✓ DONE' },
      'error': { bg: 'rgba(239,68,68,0.2)', text: THEME.RED, label: '✗ ERROR' }
    };
    var c = colors[status] || colors['idle'];
    badge.style.background = c.bg;
    badge.style.color = c.text;
    badge.textContent = c.label;
  }

  // Expose for AHK polling via getElementById + getAttribute
  window.__comboProgressStatus = getProgressStatus;
  window.__comboGetStatus = getProgressStatus;

  function runComboSwitch(direction) {
    const fn = 'runComboSwitch';
    // S-005: Reset retry state at start of each new combo invocation
    retryState.attempt = 0;
    setProgressStatus('in_progress');
    logBanner(fn, '========== START: ' + direction.toUpperCase() + ' ==========');
    logInfo(fn, 'Version=' + VERSION + ', PollMs=' + TIMING.POLL_MS + ', OpenMax=' + TIMING.OPEN_MAX + ', WaitMax=' + TIMING.WAIT_MAX + ', Retries=' + TIMING.RETRY_COUNT);
    highlightButton(direction);
    clickTransferButton(direction);
  }

  window.__comboSwitch = runComboSwitch;

  // ============================================
  // Direct Workspace Move via API
  // PUT /projects/{projectId}/move-to-workspace
  // ============================================
  function extractProjectIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/\/projects\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  function moveToWorkspace(targetWorkspaceId, targetWorkspaceName) {
    const fn = 'moveToWorkspace';
    const projectId = extractProjectIdFromUrl();
    if (!projectId) {
      logError(fn, '~', 'Cannot extract projectId from URL: ' + window.location.href);
      updateMoveStatus('error', 'No project ID in URL');
      return;
    }

    // Resolve bearer token
    let resolvedToken = CREDIT_CFG.BEARER_TOKEN;
    if (!resolvedToken || resolvedToken === '__LOVABLE_BEARER_TOKEN__' || resolvedToken === '') {
      resolvedToken = getBearerTokenFromStorage();
    }
    if (!resolvedToken) {
      logError(fn, '~', 'No bearer token available — cannot call move API');
      updateMoveStatus('error', 'No bearer token');
      return;
    }

    const url = CREDIT_CFG.API_BASE + '/projects/' + projectId + '/move-to-workspace';
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + resolvedToken
    };

    logBanner(fn, '========== MOVE TO WORKSPACE ==========');
    logEntry(fn, 'Target: ' + targetWorkspaceName + ' (id=' + targetWorkspaceId + ')');
    logEntry(fn, 'PUT ' + url);
    logSub(fn, 'Headers: ' + JSON.stringify(sanitizeHeaders(headers)));

    updateMoveStatus('loading', 'Moving to ' + targetWorkspaceName + '...');

    fetch(url, {
      method: 'PUT',
      headers: headers,
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({ workspace_id: targetWorkspaceId })
    }).then(function(resp) {
      logEntry(fn, 'Response: ' + resp.status + ' ' + resp.statusText);
      if (!resp.ok) {
        return resp.text().then(function(body) {
          logError(fn, '~', 'Move failed: HTTP ' + resp.status + ' | Body: ' + body.substring(0, 500));
          updateMoveStatus('error', 'HTTP ' + resp.status + ': ' + body.substring(0, 80));
          throw new Error('HTTP ' + resp.status);
        });
      }
      return resp.text();
    }).then(function(body) {
      logBanner(fn, 'MOVE SUCCESS -> ' + targetWorkspaceName);
      updateMoveStatus('success', 'Moved to ' + targetWorkspaceName);
      // Update current workspace name immediately
      window.__wsCurrentName = targetWorkspaceName;
      logSub(fn, 'Updated __wsCurrentName to: "' + targetWorkspaceName + '"');
      addHistoryEntry('move', targetWorkspaceName);
      // Immediately update all UI sections (header, status, workspace list)
      updateCreditDisplay();
      var wsData = window.__wsDropdownData || [];
      var searchEl = document.getElementById('ahk-ws-search');
      var wsFilter = searchEl ? searchEl.value.trim() : '';
      renderWorkspaceList(wsData, window.__wsCurrentName, wsFilter);
      // Also update status line
      var statusEl = document.getElementById('ahk-combo-status');
      if (statusEl) {
        statusEl.innerHTML = ''
          + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
          + '<span style="color:' + THEME.SLATE_400 + ';font-size:11px;font-family:' + FONT.BODY + ';">NOW:</span>'
          + '<span style="color:' + THEME.CYAN + ';font-weight:800;font-size:' + THEME.SUBHEADING_SIZE + ';font-family:' + FONT.HEADING + ';">' + targetWorkspaceName + '</span>'
          + '<span style="color:' + THEME.GREEN + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';font-weight:600;"> ✅ Moved</span>'
          + '</div>';
      }
      // v7.9.32: After move, state is already set authoritatively from API success.
      // Do NOT run XPath detection — the dialog may still show the old workspace.
      // Just refresh credits to get updated data, then sync UI.
      setTimeout(function() {
        checkCreditsStatus('auto');
      }, 2000);
    }).catch(function(err) {
      logError(fn, '~', 'Move error: ' + err.message);
      if (!document.getElementById('ahk-move-status')) return; // already updated
    });
  }

  function updateMoveStatus(state, message) {
    const el = document.getElementById('ahk-move-status');
    if (!el) return;
    const colors = { loading: THEME.YELLOW, success: THEME.GREEN, error: THEME.RED };
    el.style.color = colors[state] || '#94a3b8';
    el.textContent = message;
    if (state === 'success') {
      setTimeout(function() { el.textContent = ''; }, 5000);
    }
  }

  window.__moveToWorkspace = moveToWorkspace;

  // v7.9.27: Move to adjacent workspace in the loaded list (API-based, used by Ctrl+Up/Down)
  function moveToAdjacentWorkspaceCombo(direction) {
    const fn = 'moveToAdjacentWsCombo';
    const workspaces = creditState.perWorkspace || [];
    if (workspaces.length === 0) {
      logWarn(fn, 'No workspaces loaded — click Status first');
      updateMoveStatus('error', 'Load workspaces first');
      return;
    }
    const currentName = window.__wsCurrentName || '';
    let currentIdx = -1;
    // Exact match first
    for (let i = 0; i < workspaces.length; i++) {
      if (workspaces[i].fullName === currentName || workspaces[i].name === currentName) {
        currentIdx = i;
        break;
      }
    }
    // Partial match fallback
    if (currentIdx === -1 && currentName) {
      const lowerName = currentName.toLowerCase();
      for (let pi = 0; pi < workspaces.length; pi++) {
        if ((workspaces[pi].fullName || '').toLowerCase().indexOf(lowerName) !== -1 ||
            lowerName.indexOf((workspaces[pi].fullName || '').toLowerCase()) !== -1) {
          currentIdx = pi;
          break;
        }
      }
    }
    if (currentIdx === -1) {
      logWarn(fn, 'Current workspace "' + currentName + '" not found — using first');
      currentIdx = 0;
    }
    let targetIdx;
    if (direction === 'up') {
      targetIdx = currentIdx === 0 ? workspaces.length - 1 : currentIdx - 1;
    } else {
      targetIdx = currentIdx === workspaces.length - 1 ? 0 : currentIdx + 1;
    }
    const target = workspaces[targetIdx];
    const targetId = (target.raw && target.raw.id) || target.id || '';
    logEntry(fn, 'API Move ' + direction.toUpperCase() + ': "' + currentName + '" (#' + currentIdx + ') → "' + target.fullName + '" (#' + targetIdx + ')');
    moveToWorkspace(targetId, target.fullName);
  }

  window.__comboMoveAdjacent = moveToAdjacentWorkspaceCombo;

  // v7.9.32: Button click animation — brief scale pulse to confirm action
  function animateBtn(btn) {
    if (!btn) return;
    btn.style.transform = 'scale(0.85)';
    btn.style.opacity = '0.6';
    setTimeout(function() {
      btn.style.transform = 'scale(1.1)';
      btn.style.opacity = '1';
      setTimeout(function() {
        btn.style.transform = 'scale(1)';
      }, 120);
    }, 100);
  }

  // Move project from current UI selection (no confirmation dialog)
  function triggerMoveFromSelection() {
    const selectedEl = document.getElementById('ahk-ws-selected');
    const wsId = selectedEl ? selectedEl.getAttribute('data-selected-id') : '';
    const wsName = selectedEl ? selectedEl.getAttribute('data-selected-name') : '';
    if (!wsId) {
      logWarn('triggerMove', 'No workspace selected');
      updateMoveStatus('error', 'Select a workspace first');
      return;
    }
    logEntry('triggerMove', 'Moving project to workspace=' + wsId + ' (' + wsName + ')');
    window.__moveToWorkspace(wsId, wsName);
  }

  // ============================================
  // Workspace dropdown population
  // ============================================
  function getProjectNameFromUrl() {
    const url = window.location.href;
    const m = url.match(/\/projects\/([a-f0-9-]+)/);
    return m ? m[1].substring(0, 8) : '';
  }

  function getProjectNameFromDom() {
    // Try to read project name from DOM via configured XPath
    const xp = XPATH.PROJECT_NAME;
    if (xp && xp.charAt(0) !== '_') {
      const el = findByXPath(xp);
      if (el) {
        const text = (el.textContent || '').trim();
        if (text) return text;
      }
    }
    return null;
  }

  function getDisplayProjectName() {
    // Priority: DOM XPath > cached API name > document title > URL UUID
    const domName = getProjectNameFromDom();
    if (domName) {
      creditState.projectName = domName; // cache it
      return domName;
    }
    if (creditState.projectName) return creditState.projectName;
    const titleMatch = document.title.match(/^(.+?)\s*[-–—]\s*Lovable/);
    if (titleMatch) return titleMatch[1].trim();
    return getProjectNameFromUrl() || 'Unknown Project';
  }

  function getCurrentWorkspaceName() {
    // Priority 1: Already detected (from COMBO1 DOM during combo switch, or API)
    if (window.__wsCurrentName) return window.__wsCurrentName;
    // Priority 2: Try reading from Transfer dialog DOM if it happens to be open
    // XPath: /html/body/div[7]/div[2]/div[1]/div/p (user-provided)
    // Also try COMBO1 selectors
    try {
      var selectors = [
        'div[role="dialog"] p.min-w-0.truncate',
        'div[role="dialog"] p.truncate'
      ];
      for (var s = 0; s < selectors.length; s++) {
        var el = document.querySelector(selectors[s]);
        if (el) {
          var text = (el.textContent || '').trim();
          if (text) {
            window.__wsCurrentName = text;
            logEntry('getCurrentWorkspaceName', 'Read from DOM selector: "' + text + '"');
            return text;
          }
        }
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  function populateWorkspaceDropdown() {
    const fn = 'populateWorkspaceDropdown';
    const container = document.getElementById('ahk-ws-dropdown-container');
    if (!container) return;
    const workspaces = creditState.perWorkspace || [];
    if (workspaces.length === 0) {
      container.innerHTML = '<div style="padding:8px;color:#64748b;font-size:12px;">📭 No workspaces loaded. Click Status.</div>';
      return;
    }
    const currentName = getCurrentWorkspaceName();

    // Store workspaces data for search filtering
    window.__wsDropdownData = workspaces;
    window.__wsCurrentName = currentName;

    // Clear search on refresh
    const searchEl = document.getElementById('ahk-ws-search');
    const filter = searchEl ? searchEl.value.trim() : '';
    renderWorkspaceList(workspaces, currentName, filter);

    // Always auto-scroll to current workspace after populating
    setTimeout(function() {
      scrollToCurrentWorkspace();
      // Also auto-select the current workspace if nothing is selected yet
      const selectedEl = document.getElementById('ahk-ws-selected');
      const hasSelection = selectedEl && selectedEl.getAttribute('data-selected-id');
      if (!hasSelection && currentName) {
        const listEl = document.getElementById('ahk-ws-list');
        if (listEl) {
          const items = listEl.querySelectorAll('.ahk-ws-item');
          for (let ci = 0; ci < items.length; ci++) {
            if (items[ci].getAttribute('data-ws-current') === 'true') {
              setWsNavIndex(ci);
              break;
            }
          }
        }
      }
    }, 100);

    logSub(fn, 'Custom dropdown populated with ' + workspaces.length + ' workspaces');
  }

  // Workspace keyboard nav state
  let wsNavIndex = -1;

  function scrollToCurrentWorkspace() {
    const listEl = document.getElementById('ahk-ws-list');
    if (!listEl) return;
    const currentItem = listEl.querySelector('.ahk-ws-item[data-ws-current="true"]');
    if (currentItem) {
      currentItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function setWsNavIndex(idx) {
    wsNavIndex = idx;
    const listEl = document.getElementById('ahk-ws-list');
    if (!listEl) return;
    const items = listEl.querySelectorAll('.ahk-ws-item');
    for (let i = 0; i < items.length; i++) {
      const isCurrent = items[i].getAttribute('data-ws-current') === 'true';
      if (i === idx) {
        items[i].style.background = 'rgba(99,102,241,0.25)';
        items[i].style.outline = '1px solid #818cf8';
        items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        // Update selected state
        const wsId = items[i].getAttribute('data-ws-id');
        const wsName = items[i].getAttribute('data-ws-name');
        const selectedEl = document.getElementById('ahk-ws-selected');
        if (selectedEl) {
          selectedEl.setAttribute('data-selected-id', wsId);
          selectedEl.setAttribute('data-selected-name', wsName);
          selectedEl.textContent = '✅ ' + wsName;
          selectedEl.style.color = '#22c55e';
        }
      } else {
        items[i].style.outline = 'none';
        items[i].style.background = isCurrent ? 'rgba(6,182,212,0.15)' : 'transparent';
      }
    }
  }

  function buildTooltipText(ws) {
    const lines = [];
    lines.push('━━━ ' + (ws.fullName || ws.name) + ' ━━━');
    lines.push('');
    lines.push('📊 CALCULATED:');
    lines.push('  🆓 Daily Free: ' + (ws.dailyFree || 0) + ' (' + ws.dailyLimit + ' - ' + ws.dailyUsed + ')');
    lines.push('  🔄 Rollover: ' + (ws.rollover || 0) + ' (' + ws.rolloverLimit + ' - ' + ws.rolloverUsed + ')');
    lines.push('  💰 Available: ' + (ws.available || 0) + ' (total:' + (ws.totalCredits || 0) + ' - rUsed:' + (ws.rolloverUsed || 0) + ' - dUsed:' + (ws.dailyUsed || 0) + ' - bUsed:' + (ws.used || 0) + ')');
    lines.push('  📦 Billing Only: ' + (ws.billingAvailable || 0) + ' (' + ws.limit + ' - ' + ws.used + ')');
    var _tc = ws.totalCredits || calcTotalCredits(ws.freeGranted, ws.dailyLimit, ws.limit, ws.topupLimit, ws.rolloverLimit);
    lines.push('  ⚡ Total Credits: ' + _tc + ' (granted:' + (ws.freeGranted||0) + ' + daily:' + (ws.dailyLimit||0) + ' + billing:' + (ws.limit||0) + ' + topup:' + (ws.topupLimit||0) + ' + rollover:' + (ws.rolloverLimit||0) + ')');
    lines.push('');
    lines.push('📋 RAW DATA:');
    lines.push('  ID: ' + ws.id);
    lines.push('  Billing: ' + ws.used + '/' + ws.limit + ' used');
    lines.push('  Rollover: ' + ws.rolloverUsed + '/' + ws.rolloverLimit + ' used');
    lines.push('  Daily: ' + ws.dailyUsed + '/' + ws.dailyLimit + ' used');
    if (ws.freeGranted > 0) {
      lines.push('  Trial: ' + ws.freeRemaining + '/' + ws.freeGranted + ' remaining');
    }
    lines.push('  Status: ' + (ws.subscriptionStatus || 'N/A'));
    lines.push('  Role: ' + (ws.role || 'N/A'));
    if (ws.raw) {
      const r = ws.raw;
      if (r.last_trial_credit_period) lines.push('  Trial Period: ' + r.last_trial_credit_period);
      if (r.subscription_status) lines.push('  Subscription: ' + r.subscription_status);
    }
    return lines.join('\n');
  }

  function renderWorkspaceList(workspaces, currentName, filter) {
    const listEl = document.getElementById('ahk-ws-list');
    if (!listEl) return;
    let html = '';
    let count = 0;
    let currentIdx = -1;
    const freeFilterBtn = document.getElementById('ahk-ws-free-filter');
    const freeOnly = freeFilterBtn && freeFilterBtn.getAttribute('data-active') === 'true';
    // Advanced filters
    const rolloverFilterBtn = document.getElementById('ahk-ws-rollover-filter');
    const rolloverOnly = rolloverFilterBtn && rolloverFilterBtn.getAttribute('data-active') === 'true';
    const billingFilterBtn = document.getElementById('ahk-ws-billing-filter');
    const billingOnly = billingFilterBtn && billingFilterBtn.getAttribute('data-active') === 'true';
    const minCreditsInput = document.getElementById('ahk-ws-min-credits');
    const minCredits = minCreditsInput ? parseInt(minCreditsInput.value, 10) || 0 : 0;
    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      let isCurrent = ws.fullName === currentName || ws.name === currentName;
      // Partial match fallback (case-insensitive contains)
      if (!isCurrent && currentName) {
        const lcn = currentName.toLowerCase();
        isCurrent = (ws.fullName || '').toLowerCase().indexOf(lcn) !== -1 ||
                    lcn.indexOf((ws.fullName || '').toLowerCase()) !== -1;
      }
      const matchesFilter = !filter || ws.fullName.toLowerCase().indexOf(filter.toLowerCase()) !== -1 || ws.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
      if (!matchesFilter) continue;
      if (freeOnly && (ws.dailyFree || 0) <= 0) continue;
      if (rolloverOnly && (ws.rollover || 0) <= 0) continue;
      if (billingOnly && (ws.billingAvailable || 0) <= 0) continue;
      if (minCredits > 0 && (ws.available || 0) < minCredits) continue;
      if (isCurrent) currentIdx = count;
      count++;
      const usedInt = ws.used;
      const limitInt = ws.limit;
      // Progress bar shows AVAILABLE (inverted: available/limit)
      const available = ws.available || 0;
      const billingAvail = ws.billingAvailable || 0;
      const billingAvailPct = limitInt > 0 ? Math.round((billingAvail / limitInt) * 100) : 0;
      const rollover = ws.rollover || 0;
      const rolloverLimit = ws.rolloverLimit || 0;
      const rolloverPct = rolloverLimit > 0 ? Math.round((rollover / rolloverLimit) * 100) : 0;
      const emoji = isCurrent ? '📍' : (available <= 0 ? '🔴' : available <= limitInt * 0.2 ? '🟡' : '🟢');
      const billingBarColor = billingAvailPct <= 10 ? THEME.RED : billingAvailPct <= 40 ? THEME.ORANGE : THEME.GREEN;
      const nameColor = isCurrent ? THEME.CYAN : THEME.SLATE_200;
      const nameBold = isCurrent ? 'font-weight:800;' : 'font-weight:500;';
      const nameSize = isCurrent ? 'font-size:14px;' : 'font-size:13px;';
      const bgStyle = isCurrent ? 'background:' + THEME.CYAN_HIGHLIGHT_BG + ';border-left:3px solid ' + THEME.CYAN + ';' : 'border-left:3px solid transparent;';

      // Daily free credits (for yellow bar)
      const dailyFree = ws.dailyFree || 0;
      const dailyLimit = ws.dailyLimit || 1;
      const dailyFreePct = dailyLimit > 0 ? Math.round((dailyFree / dailyLimit) * 100) : 0;
      const dailyFreeColor = dailyFree > 0 ? THEME.GREEN_LIGHT : THEME.RED_LIGHT;
      const rolloverColor = rollover > 0 ? THEME.PURPLE_LIGHT : THEME.RED_LIGHT;
      const availColor = available > 0 ? THEME.CYAN_LIGHT : THEME.RED_LIGHT;

      let freeHtml = '';
      if (ws.hasFree) {
        freeHtml = '<span style="color:' + THEME.GREEN_LIGHT + ';font-size:10px;font-weight:600;">🎁 ' + ws.freeRemaining + ' trial</span>';
      } else if (ws.freeGranted > 0) {
        freeHtml = '<span style="color:' + THEME.RED_LIGHT + ';font-size:10px;">🎁 0 trial</span>';
      }

      // Tooltip with full JSON info
      const tooltip = buildTooltipText(ws).replace(/"/g, '&quot;');

      html += '<div class="ahk-ws-item" data-ws-id="' + ws.id + '" data-ws-name="' + (ws.fullName || ws.name).replace(/"/g, '&quot;') + '" data-ws-current="' + isCurrent + '" data-ws-idx="' + (count - 1) + '"'
        + ' data-ws-has-free="' + (dailyFree > 0) + '"'
        + ' title="' + tooltip + '"'
        + ' style="display:flex;align-items:center;gap:8px;padding:7px 8px;cursor:' + (isCurrent ? 'default' : 'pointer') + ';border-bottom:1px solid ' + THEME.SLATE_800 + ';transition:background 0.15s;'
        + bgStyle + '"'
        + ' onmouseover="if(this.getAttribute(\'data-ws-current\')!==\'true\')this.style.background=\'rgba(59,130,246,0.15)\'"'
        + ' onmouseout="if(this.getAttribute(\'data-ws-current\')!==\'true\')this.style.background=\'transparent\'">'
        + '<span style="font-size:16px;">' + emoji + '</span>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="color:' + nameColor + ';' + nameSize + nameBold + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:' + FONT.HEADING + ';">' + (ws.fullName || ws.name) + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">'
        + '<span style="color:' + dailyFreeColor + ';font-size:10px;font-weight:700;font-family:' + FONT.BODY + ';">🆓 ' + dailyFree + ' free</span>'
        + '<span style="color:' + rolloverColor + ';font-size:10px;font-weight:600;font-family:' + FONT.BODY + ';">🔄 ' + rollover + ' rollover</span>'
        + '<span style="color:' + availColor + ';font-size:10px;font-weight:600;font-family:' + FONT.BODY + ';">💰 ' + available + ' avail</span>'
        + (freeHtml ? ' ' + freeHtml : '')
        + '</div>'
        // Stacked credit bar: full bar = total capacity, colored = available
         + (function() {
          // Total Credits = credits_granted + daily_credits_limit + billing_period_credits_limit + topup_credits_limit + rollover_credits_limit
          var _totalCapacity = ws.totalCredits || calcTotalCredits(ws.freeGranted, ws.dailyLimit, ws.limit, ws.topupLimit, ws.rolloverLimit);
          var _fr = ws.freeRemaining || 0;
          // Available segments as % of total capacity
          var _bp = _totalCapacity > 0 ? Math.max(billingAvail > 0 ? 2 : 0, Math.round(billingAvail / _totalCapacity * 100)) : 0;
          var _rp = _totalCapacity > 0 ? Math.max(rollover > 0 ? 2 : 0, Math.round(rollover / _totalCapacity * 100)) : 0;
          var _dp = _totalCapacity > 0 ? Math.max(dailyFree > 0 ? 2 : 0, Math.round(dailyFree / _totalCapacity * 100)) : 0;
          var _fp = _totalCapacity > 0 ? Math.max(_fr > 0 ? 2 : 0, Math.round(_fr / _totalCapacity * 100)) : 0;
          var _availTotal = ws.available || 0;
          return '<div style="display:flex;align-items:center;gap:8px;margin-top:3px;">'
            + '<div title="Available: ' + _availTotal + ' / Total: ' + _totalCapacity + ' (Used: ' + (ws.totalCreditsUsed || 0) + ')" style="flex:1;height:14px;background:rgba(239,68,68,0.25);border-radius:6px;overflow:hidden;display:flex;min-width:120px;max-width:300px;border:1px solid ' + THEME.SLATE_700 + ';box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);">'
            + (billingAvail > 0 ? '<div title="💰 Billing: ' + billingAvail + '/' + (ws.limit || 0) + '" style="width:' + _bp + '%;height:100%;background:linear-gradient(90deg,' + THEME.GREEN + ',' + THEME.GREEN_LIGHT + ');"></div>' : '')
            + (rollover > 0 ? '<div title="🔄 Rollover: ' + rollover + '/' + (ws.rolloverLimit || 0) + '" style="width:' + _rp + '%;height:100%;background:linear-gradient(90deg,' + THEME.PURPLE_DARK + ',' + THEME.PURPLE + ');"></div>' : '')
            + (dailyFree > 0 ? '<div title="📅 Daily Free: ' + dailyFree + '/' + (ws.dailyLimit || 0) + '" style="width:' + _dp + '%;height:100%;background:linear-gradient(90deg,#d97706,' + THEME.YELLOW + ');"></div>' : '')
            + (_fr > 0 ? '<div title="🎁 Granted: ' + _fr + '/' + (ws.freeGranted || 0) + '" style="width:' + _fp + '%;height:100%;background:linear-gradient(90deg,#f97316,#fb923c);"></div>' : '')
            + '</div>'
            + '<span style="font-size:10px;white-space:nowrap;font-family:' + FONT.MONO + ';line-height:1;">'
            + '<span style="color:' + THEME.GREEN_LIGHT + ';" title="💰 Billing = credits remaining in billing period">💰' + billingAvail + '</span> '
            + '<span style="color:' + THEME.PURPLE_LIGHT + ';" title="🔄 Rollover = unused credits carried from previous period">🔄' + rollover + '</span> '
            + '<span style="color:' + THEME.YELLOW + ';" title="📅 Daily Free = free credits refreshed daily">📅' + dailyFree + '</span> '
            + (_fr > 0 ? '<span style="color:#fb923c;" title="🎁 Granted = promotional credits remaining">🎁' + _fr + '</span> ' : '')
            + '<span style="color:' + THEME.CYAN + ';font-weight:700;" title="⚡ Available = Total - rolloverUsed - dailyUsed - billingUsed">⚡' + _availTotal + '</span>'
            + '<span style="color:' + THEME.SLATE_400 + ';font-size:9px;" title="Total Credits = granted + daily + billing + topup + rollover">/' + _totalCapacity + '</span>'
            + '</span></div>';
        })()
        + '</div>'
        + (isCurrent ? '<span style="font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.CYAN + ';background:rgba(6,182,212,0.25);padding:2px 6px;border-radius:4px;font-weight:700;font-family:' + FONT.HEADING + ';">CURRENT</span>' : '')
        + '</div>';
    }
    if (count === 0) {
      html = '<div style="padding:10px;color:' + THEME.SLATE_500 + ';font-size:' + THEME.BODY_SIZE + ';text-align:center;font-family:' + FONT.BODY + ';">🔍 No matches found</div>';
    }
    listEl.innerHTML = html;
    wsNavIndex = -1;

    // Bind click + double-click events
    const items = listEl.querySelectorAll('.ahk-ws-item');
    for (let j = 0; j < items.length; j++) {
      items[j].onclick = (function(item) {
        return function() {
          const wsId = item.getAttribute('data-ws-id');
          const wsName = item.getAttribute('data-ws-name');
          const idx = parseInt(item.getAttribute('data-ws-idx'), 10);
          setWsNavIndex(idx);
          logEntry('wsSelect', 'Selected workspace: ' + wsName + ' (id=' + wsId + ')');
        };
      })(items[j]);
      // Double-click: immediately move to workspace
      items[j].ondblclick = (function(item) {
        return function(e) {
          e.preventDefault();
          e.stopPropagation();
          const wsId = item.getAttribute('data-ws-id');
          const wsName = item.getAttribute('data-ws-name');
          const isCurrent = item.getAttribute('data-ws-current') === 'true';
          if (isCurrent) {
            logWarn('wsDblClick', 'Double-click on current workspace "' + wsName + '" — no move needed');
            return;
          }
          logBanner('wsDblClick', 'Double-click move -> ' + wsName + ' (id=' + wsId + ')');
          moveToWorkspace(wsId, wsName);
        };
      })(items[j]);
    }

    // Auto-scroll to current workspace
    if (currentIdx >= 0 && !filter) {
      setTimeout(function() { scrollToCurrentWorkspace(); }, 50);
    }
  }

  // ============================================
  // Credit Status Checker
  // ============================================
  function generateCorrelationId() {
    return 'cs-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  }

  function isCacheValid() {
    if (!creditState.lastCheckedAt) return false;
    const elapsed = (Date.now() - creditState.lastCheckedAt) / 1000;
    return elapsed < CREDIT_CFG.CACHE_TTL_S;
  }

  function updateCreditDisplay() {
    const el = document.getElementById('ahk-credit-display');
    if (!el) return;
    if (!creditState.lastCheckedAt) {
      el.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';">📊 No credit data yet. Click Status.</span>';
      return;
    }
    const freeEmoji = creditState.freeTierAvailable ? '✅' : '❌';
    const freeColor = creditState.freeTierAvailable ? THEME.GREEN : THEME.RED;
    const freeText = creditState.freeTierAvailable ? 'Available' : 'Exhausted';
    const timeStr = new Date(creditState.lastCheckedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const src = creditState.source || '?';

    // Calculate aggregated values across all workspaces
    let totalDailyFree = 0;
    let totalRollover = 0;
    let totalAvailable = 0;
    let totalFreeRemaining = 0;
    const perWs = creditState.perWorkspace || [];
    for (let f = 0; f < perWs.length; f++) {
      totalDailyFree += (perWs[f].dailyFree || 0);
      totalRollover += (perWs[f].rollover || 0);
      totalAvailable += (perWs[f].available || 0);
      totalFreeRemaining += (perWs[f].freeRemaining || 0);
    }

    const dailyFreeColor = totalDailyFree > 0 ? THEME.GREEN : THEME.RED;
    const rolloverColor = totalRollover > 0 ? THEME.PURPLE : THEME.RED;
    const availColor = totalAvailable > 0 ? THEME.CYAN : THEME.RED;

    // Calculated values on top
    let html = '<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:6px;">';
    html += '<span style="color:' + dailyFreeColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">🆓 ' + totalDailyFree + ' Free</span>';
    html += '<span style="color:' + rolloverColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">🔄 ' + totalRollover + ' Rollover</span>';
    html += '<span style="color:' + availColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">💰 ' + totalAvailable + ' Available</span>';
    if (totalFreeRemaining > 0) {
      html += '<span style="color:' + THEME.GREEN_LIGHT + ';font-size:' + THEME.BODY_SIZE + ';font-weight:600;font-family:' + FONT.BODY + ';">🎁 ' + totalFreeRemaining + ' trial</span>';
    }
    html += '</div>';
    // Billing details row
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;">';
    html += '<span style="font-size:13px;">📊</span>';
    html += '<span style="color:' + THEME.SLATE_200 + ';font-size:' + THEME.BODY_SIZE + ';font-weight:600;font-family:' + FONT.BODY + ';">' + creditState.totalCreditsText + '</span>';
    html += '<span style="color:' + freeColor + ';font-size:' + THEME.BODY_SIZE + ';font-weight:700;font-family:' + FONT.BODY + ';">' + freeEmoji + ' ' + freeText + '</span>';
    html += '</div>';
    html += '<div style="color:' + THEME.SLATE_500 + ';font-size:' + THEME.TINY_SIZE + ';margin-top:3px;font-family:' + FONT.BODY + ';">⏱ Last: ' + timeStr + ' (' + src + ')</div>';
    el.innerHTML = html;

    // Update NOW section with current workspace info
    const nowEl = document.getElementById('ahk-now-section');
    if (nowEl && perWs.length > 0) {
      const currentName = window.__wsCurrentName || '';
      let currentWs = null;
      for (let c = 0; c < perWs.length; c++) {
        if (perWs[c].fullName === currentName || perWs[c].name === currentName) {
          currentWs = perWs[c]; break;
        }
      }
      // Partial match fallback
      if (!currentWs && currentName) {
        const lcn = currentName.toLowerCase();
        for (let c = 0; c < perWs.length; c++) {
          if ((perWs[c].fullName || '').toLowerCase().indexOf(lcn) !== -1 ||
              lcn.indexOf((perWs[c].fullName || '').toLowerCase()) !== -1) {
            currentWs = perWs[c]; break;
          }
        }
      }
      if (currentWs) {
        const cDailyFree = currentWs.dailyFree || 0;
        const cRollover = currentWs.rollover || 0;
        const cAvailable = currentWs.available || 0;
        const cBillingAvail = currentWs.billingAvailable || 0;
        const cDailyFreeColor = cDailyFree > 0 ? THEME.GREEN : THEME.RED;
        const cRolloverColor = cRollover > 0 ? THEME.PURPLE : THEME.RED;
        const cAvailColor = cAvailable > 0 ? THEME.CYAN : THEME.RED;
        const cBillingAvailPct = currentWs.limit > 0 ? Math.round((cBillingAvail / currentWs.limit) * 100) : 0;
        const cBillingBarColor = cBillingAvailPct <= 10 ? THEME.RED : cBillingAvailPct <= 40 ? THEME.ORANGE : THEME.GREEN;
        const cDailyFreePct = currentWs.dailyLimit > 0 ? Math.round((cDailyFree / currentWs.dailyLimit) * 100) : 0;
        const cRolloverPct = currentWs.rolloverLimit > 0 ? Math.round((cRollover / currentWs.rolloverLimit) * 100) : 0;
        const projectName = getDisplayProjectName();

        let nowHtml = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
        nowHtml += '<span style="font-size:13px;">🚀</span>';
        nowHtml += '<span style="color:' + THEME.PURPLE + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:700;font-family:' + FONT.HEADING + ';">' + projectName + '</span>';
        nowHtml += '<span style="font-size:14px;">📍</span>';
        nowHtml += '<span style="color:' + THEME.CYAN + ';font-size:' + THEME.HEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">' + (currentWs.fullName || currentWs.name) + '</span>';
        nowHtml += '</div>';
        // Calculated values
        nowHtml += '<div style="display:flex;gap:10px;align-items:center;margin-top:5px;flex-wrap:wrap;">';
        nowHtml += '<span style="color:' + cDailyFreeColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">🆓 ' + cDailyFree + ' Free</span>';
        nowHtml += '<span style="color:' + cRolloverColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">🔄 ' + cRollover + ' Rollover</span>';
        nowHtml += '<span style="color:' + cAvailColor + ';font-size:' + THEME.SUBHEADING_SIZE + ';font-weight:800;font-family:' + FONT.HEADING + ';">💰 ' + cAvailable + ' Avail</span>';
        if (currentWs.hasFree) {
          nowHtml += '<span style="color:' + THEME.GREEN_LIGHT + ';font-size:11px;font-weight:600;font-family:' + FONT.BODY + ';">🎁 ' + currentWs.freeRemaining + ' trial</span>';
        }
        nowHtml += '</div>';
        // Stacked credit bar (yellow=daily, purple=rollover, green=billing)
        var _nowTotal = cDailyFree + cRollover + cBillingAvail;
        var _nowDp = _nowTotal > 0 ? Math.max(cDailyFree > 0 ? 3 : 0, Math.round(cDailyFree / _nowTotal * 100)) : 0;
        var _nowRp = _nowTotal > 0 ? Math.max(cRollover > 0 ? 3 : 0, Math.round(cRollover / _nowTotal * 100)) : 0;
        var _nowBp = _nowTotal > 0 ? Math.max(cBillingAvail > 0 ? 3 : 0, Math.round(cBillingAvail / _nowTotal * 100)) : 0;
        nowHtml += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">';
        nowHtml += '<div style="flex:1;height:6px;background:' + THEME.SLATE_800 + ';border-radius:3px;overflow:hidden;display:flex;max-width:140px;">';
        if (cBillingAvail > 0) nowHtml += '<div style="width:' + _nowBp + '%;height:100%;background:' + THEME.GREEN + ';"></div>';
        if (cRollover > 0) nowHtml += '<div style="width:' + _nowRp + '%;height:100%;background:' + THEME.PURPLE + ';"></div>';
        if (cDailyFree > 0) nowHtml += '<div style="width:' + _nowDp + '%;height:100%;background:' + THEME.YELLOW + ';"></div>';
        nowHtml += '</div>';
        nowHtml += '<span style="font-size:' + THEME.SMALL_SIZE + ';white-space:nowrap;font-family:' + FONT.BODY + ';">';
        nowHtml += '<span style="color:' + THEME.GREEN_LIGHT + ';">💰' + cBillingAvail + '</span> ';
        nowHtml += '<span style="color:' + THEME.PURPLE_LIGHT + ';">🔄' + cRollover + '</span> ';
        nowHtml += '<span style="color:' + THEME.YELLOW + ';">📅' + cDailyFree + '</span> ';
        nowHtml += '<span style="color:' + THEME.CYAN + ';font-weight:700;">⚡' + _nowTotal + '</span>';
        nowHtml += '</span></div>';
        nowEl.innerHTML = nowHtml;
      }
    }

    // Also update workspace dropdown
    populateWorkspaceDropdown();
  }

  // === Shared credit calculation helpers ===
  function calcTotalCredits(granted, dailyLimit, billingLimit, topupLimit, rolloverLimit) {
    return Math.round((granted || 0) + (dailyLimit || 0) + (billingLimit || 0) + (topupLimit || 0) + (rolloverLimit || 0));
  }
  function calcAvailableCredits(totalCredits, rolloverUsed, dailyUsed, billingUsed) {
    return Math.max(0, Math.round(totalCredits - (rolloverUsed || 0) - (dailyUsed || 0) - (billingUsed || 0)));
  }
  function calcFreeCreditAvailable(dailyLimit, dailyUsed) {
    return Math.max(0, Math.round((dailyLimit || 0) - (dailyUsed || 0)));
  }

  function parseApiResponse(data) {
    const fn = 'parseApiResponse';
    const workspaces = data.workspaces || data || [];
    if (!Array.isArray(workspaces)) {
      logWarn(fn, 'Unexpected response shape');
      return false;
    }

    // Store raw JSON schema for debugging/reference
    creditState.rawSchema = data;

    let totalBillingUsed = 0;
    let totalBillingLimit = 0;
    let totalDailyUsed = 0;
    let totalDailyLimit = 0;
    let freeAvailable = false;
    const perWs = [];

    for (let i = 0; i < workspaces.length; i++) {
      const rawWs = workspaces[i];
      const ws = rawWs.workspace || rawWs;
      const bUsed = ws.billing_period_credits_used || 0;
      const bLimit = ws.billing_period_credits_limit || 0;
      const dUsed = ws.daily_credits_used || 0;
      const dLimit = ws.daily_credits_limit || 0;
      const rUsed = ws.rollover_credits_used || 0;
      const rLimit = ws.rollover_credits_limit || 0;
      totalBillingUsed += bUsed;
      totalBillingLimit += bLimit;
      totalDailyUsed += dUsed;
      totalDailyLimit += dLimit;

      // Free tier detection
      const hasGranted = (ws.credits_granted || 0) > 0 && (ws.credits_used || 0) < (ws.credits_granted || 0);
      const now = new Date();
      const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const hasTrialPeriod = ws.last_trial_credit_period && ws.last_trial_credit_period.indexOf(currentMonth) === 0;
      if (hasGranted || hasTrialPeriod) freeAvailable = true;

      const shortName = (ws.name || 'WS' + i).substring(0, 12);
      const wsId = ws.id || '';
      const freeGranted = ws.credits_granted || 0;
      const freeUsed = ws.credits_used || 0;
      const freeRemaining = Math.max(0, Math.round(freeGranted - freeUsed));
      const wsHasFree = freeGranted > 0 && freeUsed < freeGranted;
      const subStatus = ws.subscription_status || '';
      const role = (ws.membership && ws.membership.role) || (rawWs.membership && rawWs.membership.role) || '';
      // Calculated fields using helper functions:
      const dailyFree = Math.max(0, Math.round(dLimit - dUsed));
      const rollover = Math.max(0, Math.round(rLimit - rUsed));
      const billingAvailable = Math.max(0, Math.round(bLimit - bUsed));
      const topupLimit = Math.round(ws.topup_credits_limit || 0);
      const totalCreditsUsed = Math.round(ws.total_credits_used || 0);
      // Total Credits = credits_granted + daily_credits_limit + billing_period_credits_limit + topup_credits_limit + rollover_credits_limit
      const totalCredits = calcTotalCredits(freeGranted, dLimit, bLimit, topupLimit, rLimit);
      // Available Credit = Total Credits - rollover_credits_used - daily_credits_used - billing_period_credits_used
      const available = calcAvailableCredits(totalCredits, rUsed, dUsed, bUsed);
      perWs.push({
        id: wsId, name: shortName, fullName: ws.name || 'WS' + i,
        used: Math.round(bUsed), limit: Math.round(bLimit),
        dailyUsed: Math.round(dUsed), dailyLimit: Math.round(dLimit),
        rolloverUsed: Math.round(rUsed), rolloverLimit: Math.round(rLimit),
        rollover: rollover, billingAvailable: billingAvailable,
        dailyFree: dailyFree, available: available,
        freeGranted: Math.round(freeGranted), freeRemaining: freeRemaining, hasFree: wsHasFree,
        topupLimit: topupLimit,
        totalCreditsUsed: totalCreditsUsed,
        totalCredits: totalCredits,
        subscriptionStatus: subStatus, role: role,
        raw: ws  // store raw workspace data for tooltip
      });
    }

    // Detect project name: find workspace that contains current project
    // Use the workspace name from the first workspace (or the one matching current context)
    if (perWs.length > 0 && !creditState.projectName) {
      // Try to detect from document title (Lovable shows "ProjectName - Lovable")
      const titleMatch = document.title.match(/^(.+?)\s*[-–—]\s*Lovable/);
      if (titleMatch) {
        creditState.projectName = titleMatch[1].trim();
      } else {
        // Fallback: use current workspace name
        creditState.projectName = perWs[0].fullName;
      }
      logSub(fn, 'Project name detected: ' + creditState.projectName);
    }

    creditState.freeTierAvailable = freeAvailable;
    creditState.totalCreditsText = Math.round(totalBillingUsed) + '/' + Math.round(totalBillingLimit) + ' | Daily: ' + Math.round(totalDailyUsed) + '/' + Math.round(totalDailyLimit);
    creditState.perWorkspace = perWs;

    // v7.9.20: Build wsById dictionary for O(1) lookup by workspace ID
    creditState.wsById = {};
    for (let w = 0; w < perWs.length; w++) {
      if (perWs[w].id) {
        creditState.wsById[perWs[w].id] = perWs[w];
      }
    }

    logSub(fn, 'Parsed ' + workspaces.length + ' workspaces, free=' + freeAvailable + ' | wsById keys=' + Object.keys(creditState.wsById).length);
    return true;
  }

  function sanitizeHeaders(headers) {
    const safe = {};
    for (const k in headers) {
      if (headers.hasOwnProperty(k)) {
        if (k.toLowerCase() === 'authorization') {
          safe[k] = headers[k].substring(0, 12) + '***REDACTED***';
        } else {
          safe[k] = headers[k];
        }
      }
    }
    return safe;
  }

  function singleApiFetch(url, headers, correlationId) {
    const fn = 'singleApiFetch';
    // Log full request details (headers sanitized)
    logEntry(fn, 'REQUEST [' + correlationId + ']');
    logSub(fn, 'Method: GET');
    logSub(fn, 'URL: ' + url);
    logSub(fn, 'Headers: ' + JSON.stringify(sanitizeHeaders(headers)));
    logSub(fn, 'Credentials: include | Mode: cors');

    return fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include',
      mode: 'cors'
    }).then(function(resp) {
      logEntry(fn, 'RESPONSE [' + correlationId + ']');
      logSub(fn, 'Status: ' + resp.status + ' ' + resp.statusText);
      logSub(fn, 'URL: ' + resp.url);
      logSub(fn, 'Type: ' + resp.type + ' | Redirected: ' + resp.redirected);
      // Log response headers
      const respHeaders = {};
      resp.headers.forEach(function(val, key) { respHeaders[key] = val; });
      logSub(fn, 'Response Headers: ' + JSON.stringify(respHeaders));

      // v7.9.27: Mark bearer token expired on 401/403
      if ((resp.status === 401 || resp.status === 403) && headers['Authorization']) {
        markBearerTokenExpired('combo');
      }

      if (!resp.ok) {
        return resp.text().then(function(body) {
          logError(fn, '~', 'HTTP ' + resp.status + ' ' + resp.statusText + ' | URL: ' + url);
          logSub(fn, 'Response Body: ' + body.substring(0, 500));
          throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
        });
      }
      return resp.json();
    }).then(function(data) {
      logSub(fn, 'Response JSON keys: ' + Object.keys(data).join(', '));
      logSub(fn, 'Response preview: ' + JSON.stringify(data).substring(0, 300));
      const parsed = parseApiResponse(data);
      if (!parsed) throw new Error('Parse failed');
      return true;
    }).catch(function(err) {
      logError(fn, '~', 'Fetch FAILED [' + correlationId + ']: ' + err.message);
      logSub(fn, 'Error stack: ' + (err.stack || 'N/A').substring(0, 200));
      throw err;
    });
  }

  // ============================================
  // v7.9.30: Auto-detect current workspace via XPath only
  // mark-viewed API removed — it returns nothing useful.
  // Goes directly to Project Dialog XPath detection.
  // Returns a Promise so callers (Focus Current) can await completion.
  // ============================================
  function autoDetectCurrentWorkspace(bearerToken, correlationId) {
    const fn = 'autoDetectCurrentWorkspace';
    const perWs = creditState.perWorkspace || [];
    const wsById = creditState.wsById || {};
    if (perWs.length === 0) {
      logWarn(fn, 'No workspaces loaded — cannot detect');
      return Promise.resolve();
    }
    if (perWs.length === 1) {
      window.__wsCurrentName = perWs[0].fullName || perWs[0].name;
      logEntry(fn, 'Single workspace detected: ' + window.__wsCurrentName);
      return Promise.resolve();
    }

    logEntry(fn, 'Detecting workspace via Project Dialog XPath... [' + (correlationId || '') + ']');
    return detectWorkspaceViaProjectDialogCombo(fn, perWs, wsById);
  }

  // v7.9.26: Detect workspace by clicking the Project Button → reading WorkspaceNameXPath
  // Tier 2 fallback — same approach as macro-looping.js detectWorkspaceViaProjectDialog
  // Flow: click ProjectButtonXPath → wait for dialog → read WorkspaceNameXPath → validate → close dialog
  function detectWorkspaceViaProjectDialogCombo(callerFn, perWs, wsById) {
    var fn = callerFn || 'detectWsViaDialogCombo';
    if (!perWs || perWs.length === 0) {
      logWarn(fn, 'No workspaces loaded — cannot detect');
      return Promise.resolve();
    }

    var projectBtnXPath = CREDIT_CFG.PROJECT_BUTTON_XPATH;
    var workspaceXPath = CREDIT_CFG.WORKSPACE_XPATH;

    if (!projectBtnXPath || projectBtnXPath.indexOf('__') === 0) {
      logWarn(fn, 'PROJECT_BUTTON_XPATH not configured — cannot use Tier 2');
      // Ultimate fallback: default to first workspace
      if (!window.__wsCurrentName) {
        window.__wsCurrentName = perWs[0].fullName || perWs[0].name;
        logSub(fn, 'Defaulted to first workspace: ' + window.__wsCurrentName);
      }
      updateCreditDisplay();
      return Promise.resolve();
    }

    logEntry(fn, 'Tier 2 — Opening project dialog to read workspace name...');
    logSub(fn, 'ProjectButtonXPath: ' + projectBtnXPath);
    logSub(fn, 'WorkspaceNameXPath: ' + workspaceXPath);

    // Step 1: Find and click the project button
    var btn = findByXPath(projectBtnXPath);
    if (!btn) {
      logWarn(fn, 'Project button NOT found — cannot open dialog. XPath=' + projectBtnXPath);
      if (!window.__wsCurrentName) {
        window.__wsCurrentName = perWs[0].fullName || perWs[0].name;
        logSub(fn, 'Defaulted to first workspace: ' + window.__wsCurrentName);
      }
      updateCreditDisplay();
      return Promise.resolve();
    }

    // Check if dialog is already open
    var isExpanded = btn.getAttribute('aria-expanded') === 'true' || btn.getAttribute('data-state') === 'open';
    if (!isExpanded) {
      logSub(fn, 'Dialog is closed — clicking project button to open');
      reactClick(btn, projectBtnXPath);
    } else {
      logSub(fn, 'Dialog is already open');
    }

    // Step 2: Wait for dialog to render, then read workspace name
    return new Promise(function(resolve) {
      var dialogWaitMs = 1500;
      var pollInterval = 300;
      var elapsed = 0;
      logSub(fn, 'Waiting up to ' + dialogWaitMs + 'ms for WorkspaceNameXPath to appear...');

      var pollTimer = setInterval(function() {
        elapsed += pollInterval;
        var wsEl = findByXPath(workspaceXPath);
        if (wsEl) {
          clearInterval(pollTimer);
          var rawName = (wsEl.textContent || '').trim();
          logSub(fn, 'WorkspaceNameXPath found after ' + elapsed + 'ms: "' + rawName + '"');

          if (!rawName) {
            logWarn(fn, 'Workspace XPath element found but text is empty');
            closeComboDialogAndDefault(fn, btn, perWs, resolve);
            return;
          }

          // Validate against known workspaces
          var matched = null;
          for (var i = 0; i < perWs.length; i++) {
            if (perWs[i].fullName === rawName || perWs[i].name === rawName) {
              matched = perWs[i];
              break;
            }
            // Partial match (case-insensitive)
            if (perWs[i].fullName && perWs[i].fullName.toLowerCase().indexOf(rawName.toLowerCase()) !== -1) {
              matched = perWs[i];
              break;
            }
            if (rawName.toLowerCase().indexOf(perWs[i].name.toLowerCase()) !== -1 && perWs[i].name.length >= 4) {
              matched = perWs[i];
              break;
            }
          }

          if (matched) {
            window.__wsCurrentName = matched.fullName || matched.name;
            logEntry(fn, '✅ Workspace detected from project dialog: "' + rawName + '" → ' + window.__wsCurrentName + ' (id=' + matched.id + ')');
          } else {
            logWarn(fn, 'XPath returned "' + rawName + '" — not a known workspace name (checked ' + perWs.length + ' workspaces)');
            if (!window.__wsCurrentName) {
              window.__wsCurrentName = perWs[0].fullName || perWs[0].name;
              logSub(fn, 'Defaulted to first workspace: ' + window.__wsCurrentName);
            }
          }

          // Close dialog after reading
          closeComboProjectDialogSafe(btn, projectBtnXPath);
          updateCreditDisplay();
          resolve();
          return;
        }

        if (elapsed >= dialogWaitMs) {
          clearInterval(pollTimer);
          logWarn(fn, 'WorkspaceNameXPath not found after ' + dialogWaitMs + 'ms — XPath may be stale: ' + workspaceXPath);
          closeComboDialogAndDefault(fn, btn, perWs, resolve);
        }
      }, pollInterval);
    });
  }

  function closeComboDialogAndDefault(fn, btn, perWs, resolve) {
    if (!window.__wsCurrentName) {
      window.__wsCurrentName = perWs[0].fullName || perWs[0].name;
      logSub(fn, 'Defaulted to first workspace: ' + window.__wsCurrentName);
    }
    closeComboProjectDialogSafe(btn, CREDIT_CFG.PROJECT_BUTTON_XPATH);
    updateCreditDisplay();
    resolve();
  }

  function closeComboProjectDialogSafe(btn, xpath) {
    try {
      var isExpanded = btn && (btn.getAttribute('aria-expanded') === 'true' || btn.getAttribute('data-state') === 'open');
      if (isExpanded) {
        logSub('closeComboProjectDialogSafe', 'Closing project dialog after workspace read');
        reactClick(btn, xpath);
      }
    } catch (e) {
      logSub('closeComboProjectDialogSafe', 'Error closing dialog: ' + e.message);
    }
  }

  // Legacy alias
  function detectWorkspaceFromDomCombo(callerFn, perWs) {
    return detectWorkspaceViaProjectDialogCombo(callerFn, perWs, creditState.wsById || {});
  }

  function checkCreditsViaApi(correlationId, triggerSource) {
    const fn = 'checkCreditsViaApi';
    const url = CREDIT_CFG.API_BASE + '/user/workspaces';
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };

    // Resolve bearer token: config > localStorage > none
    let resolvedToken = CREDIT_CFG.BEARER_TOKEN;
    if (!resolvedToken || resolvedToken === '__LOVABLE_BEARER_TOKEN__' || resolvedToken === '') {
      resolvedToken = getBearerTokenFromStorage();
    }

    if (CREDIT_CFG.AUTH_MODE === 'token' && resolvedToken) {
      headers['Authorization'] = 'Bearer ' + resolvedToken;
      logSub(fn, 'Using token auth (token=' + resolvedToken.substring(0, 8) + '***REDACTED***)');
    } else if (resolvedToken) {
      // If user provided a token via UI, use it even if auth mode isn't 'token'
      headers['Authorization'] = 'Bearer ' + resolvedToken;
      logSub(fn, 'Using user-provided bearer token (token=' + resolvedToken.substring(0, 8) + '***REDACTED***)');
    } else {
      logSub(fn, 'Using cookie session auth (no bearer token available)');
    }

    const maxRetries = CREDIT_CFG.MAX_RETRIES;
    const baseBackoff = CREDIT_CFG.RETRY_BACKOFF;
    logEntry(fn, 'Fetching ' + url + ' [' + correlationId + '] trigger=' + triggerSource + ' maxRetries=' + maxRetries + ' backoff=' + baseBackoff + 'ms');

    function attemptFetch(attempt) {
      return singleApiFetch(url, headers, correlationId).then(function(success) {
        creditState.source = 'api';
        creditState.lastCheckedAt = Date.now();
        // v7.9.3: Store token for Focus Current button, then auto-detect workspace
        window.__comboResolvedToken = resolvedToken;
        autoDetectCurrentWorkspace(resolvedToken, correlationId);
        updateCreditDisplay();
        logHighlight(fn, 'Credit status updated via API [' + correlationId + '] attempt=' + (attempt + 1));
        return true;
      }).catch(function(err) {
        const hasRetriesLeft = attempt < maxRetries;
        if (hasRetriesLeft) {
          const nextAttempt = attempt + 1;
          const delayMs = baseBackoff * Math.pow(2, attempt);
          logWarn(fn, 'Attempt ' + (nextAttempt) + ' failed: ' + err.message + ', retrying in ' + delayMs + 'ms [' + correlationId + ']');
          // Update credit display with retry indicator
          const el = document.getElementById('ahk-credit-display');
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
    const fn = 'checkCreditsViaDom';
    logEntry(fn, 'Starting DOM fallback [' + correlationId + ']');

    // Click Plans and Credits button
    const plansBtn = findByXPath(CREDIT_CFG.PLANS_XPATH);
    if (!plansBtn) {
      logError(fn, 'E013', 'Plans and Credits button not found', CREDIT_CFG.PLANS_XPATH);
      return;
    }
    reactClick(plansBtn, CREDIT_CFG.PLANS_XPATH);
    logSub(fn, 'Plans button clicked, waiting for credits element');

    // Poll for Total Credits element
    let attempts = 0;
    const maxAttempts = 20;
    const pollInterval = 300;

    const interval = setInterval(function() {
      attempts++;
      const creditsEl = findByXPath(CREDIT_CFG.CREDITS_XPATH);
      if (creditsEl) {
        clearInterval(interval);
        const rawText = (creditsEl.innerText || creditsEl.textContent || '').trim();
        logSub(fn, 'Credits text found: "' + rawText + '"');

        // Check free progress bar
        const freeBar = findByXPath(CREDIT_CFG.FREE_XPATH);
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
    const fn = 'checkCreditsStatus';
    triggerSource = triggerSource || 'onDemand';

    if (isCacheValid()) {
      logSub(fn, 'Cache still valid, skipping fetch');
      return;
    }

    const corrId = generateCorrelationId();
    logBanner(fn, '========== CREDIT CHECK [' + corrId + '] ' + triggerSource + ' ==========');

    // Update display to show loading
    const el = document.getElementById('ahk-credit-display');
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
  const comboHistory = [];

  function addHistoryEntry(direction, targetLabel) {
    const fn = 'addHistoryEntry';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time: timeStr, direction: direction, target: targetLabel };
    comboHistory.unshift(entry);
    if (comboHistory.length > 5) comboHistory.pop();
    logSub(fn, 'History updated: ' + comboHistory.length + ' entries');
    renderHistory();
  }

  function renderHistory() {
    const el = document.getElementById('ahk-combo-history');
    if (!el) return;
    if (comboHistory.length === 0) {
      el.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';">No actions yet</span>';
      return;
    }
    let html = '';
    for (let i = 0; i < comboHistory.length; i++) {
      const e = comboHistory[i];
      const arrow = e.direction === 'up' ? '&uarr;' : (e.direction === 'move' ? '&rArr;' : '&darr;');
      const dirColor = e.direction === 'up' ? THEME.BTN_BLUE : (e.direction === 'move' ? THEME.MOVE_GREEN : THEME.ORANGE);
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
    const fn = 'updateStatusDisplay';
    const statusEl = document.getElementById('ahk-combo-status');
    if (!statusEl) {
      logWarn(fn, 'Status element not found');
      return;
    }
    const isUp = direction === 'up';
    const upLabel = isUp ? targetItem : (oppositeItem || '-');
    const downLabel = isUp ? (oppositeItem || '-') : targetItem;
    const upColor = isUp ? THEME.YELLOW : THEME.SLATE_500;
    const downColor = isUp ? THEME.SLATE_500 : THEME.YELLOW;
    const upWeight = isUp ? 'font-weight:700;' : '';
    const downWeight = isUp ? '' : 'font-weight:700;';
    const projectName = getDisplayProjectName();

    // Match currentItem against perWorkspace to set __wsCurrentName for Focus Current
    if (currentItem) {
      var perWs = creditState.perWorkspace || [];
      var matched = false;
      // Exact match first
      for (var m = 0; m < perWs.length; m++) {
        if (perWs[m].fullName === currentItem || perWs[m].name === currentItem) {
          window.__wsCurrentName = perWs[m].fullName || perWs[m].name;
          matched = true;
          break;
        }
      }
      // Partial match fallback (contains, case-insensitive)
      if (!matched) {
        var lci = currentItem.toLowerCase();
        for (var p = 0; p < perWs.length; p++) {
          if ((perWs[p].fullName || '').toLowerCase().indexOf(lci) !== -1 ||
              lci.indexOf((perWs[p].fullName || '').toLowerCase()) !== -1) {
            window.__wsCurrentName = perWs[p].fullName || perWs[p].name;
            logSub(fn, 'Partial match: "' + currentItem + '" ~ "' + window.__wsCurrentName + '"');
            break;
          }
        }
      }
    }

    statusEl.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      + '<span style="color:' + THEME.SLATE_400 + ';font-size:11px;font-family:' + FONT.BODY + ';">NOW:</span>'
      + '<span style="color:' + THEME.CYAN + ';font-weight:800;font-size:' + THEME.SUBHEADING_SIZE + ';font-family:' + FONT.HEADING + ';">' + (currentItem || '-') + '</span>'
      + '<span style="color:' + THEME.SLATE_700 + ';">·</span>'
      + '<span style="color:' + upColor + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';' + upWeight + '">⬆ ' + upLabel + '</span>'
      + '<span style="color:' + THEME.SLATE_700 + ';">·</span>'
      + '<span style="color:' + downColor + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';' + downWeight + '">⬇ ' + downLabel + '</span>'
      + '</div>';
    logSub(fn, 'Status updated: current=' + currentItem + ', direction=' + direction + ', up=' + upLabel + ', down=' + downLabel);
  }

  // ============================================
  // JS Executor History
  // ============================================
  const jsHistory = [];
  let jsHistoryIndex = -1;
  const JS_HISTORY_MAX = 20;

  function addJsHistoryEntry(code, success, resultText) {
    const fn = 'addJsHistoryEntry';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = { time: timeStr, code: code, success: success, result: resultText };
    // Avoid consecutive duplicates
    const isDuplicate = jsHistory.length > 0 && jsHistory[0].code === code;
    if (!isDuplicate) {
      jsHistory.unshift(entry);
      if (jsHistory.length > JS_HISTORY_MAX) jsHistory.pop();
      logSub(fn, 'JS history updated: ' + jsHistory.length + ' entries');
    }
    jsHistoryIndex = -1;
    renderJsHistory();
  }

  function renderJsHistory() {
    const el = document.getElementById('ahk-js-history');
    if (!el) return;
    if (jsHistory.length === 0) {
      el.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';">No commands yet</span>';
      return;
    }
    let html = '';
    for (let i = 0; i < jsHistory.length; i++) {
      const e = jsHistory[i];
      const statusColor = e.success ? THEME.GREEN : THEME.RED;
      const statusIcon = e.success ? '&check;' : '&times;';
      const truncCode = e.code.length > 50 ? e.code.substring(0, 50) + '...' : e.code;
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
    const items = el.querySelectorAll('[data-js-hist-idx]');
    for (let j = 0; j < items.length; j++) {
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
    const ta = document.getElementById('__JS_EXECUTOR_ID__');
    if (!ta || jsHistory.length === 0) return;
    const isUp = direction === 'up';
    if (isUp) {
      const canGoUp = jsHistoryIndex < jsHistory.length - 1;
      if (canGoUp) {
        jsHistoryIndex++;
        ta.value = jsHistory[jsHistoryIndex].code;
      }
    } else {
      const canGoDown = jsHistoryIndex > 0;
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
    const fn = 'executeJsFromTextbox';
    const textarea = document.getElementById('__JS_EXECUTOR_ID__');
    if (!textarea) {
      logError(fn, '~', 'JS Executor textbox not found (E011)');
      return;
    }
    const code = textarea.value.trim();
    if (!code) {
      logWarn(fn, 'Empty code, nothing to execute');
      return;
    }
    logEntry(fn, 'Executing: ' + code.substring(0, 80) + (code.length > 80 ? '...' : ''));
    try {
      const result = eval(code);
      const resultStr = String(result);
      logHighlight(fn, 'Result: ' + resultStr);
      addJsHistoryEntry(code, true, resultStr.substring(0, 100));
    } catch (e) {
      logError(fn, '~', 'Execution error: ' + e.message);
      addJsHistoryEntry(code, false, e.message);
    }
  }

  window.__executeJs = executeJsFromTextbox;

  // S-003: Page-awareness check — hoisted to IIFE scope so it's available everywhere
  function isOnSettingsPage() {
    const url = window.location.href;
    const isSettings = url.indexOf('/settings') !== -1;
    return isSettings;
  }

  function createControllerUI() {
    const fn = 'createControllerUI';
    logEntry(fn, 'Checking if UI should be created');

    const isUIPresent = hasContainerUI();
    if (isUIPresent) {
      logSub(fn, 'UI already exists, skipping creation');
      return;
    }

    const transferBtn = findTransferButton();
    const isTransferFound = !!transferBtn;
    let useFloatingFallback = false;

    if (isTransferFound) {
      logSub(fn, 'Transfer button found, will attach UI after it');
    } else {
      logWarn(fn, 'Transfer button not found — using floating mode fallback');
      useFloatingFallback = true;
    }

    const parent = isTransferFound ? transferBtn.parentNode : null;
    const hasValidParent = parent && parent.parentNode;

    if (!isTransferFound || !hasValidParent) {
      useFloatingFallback = true;
      if (isTransferFound && !hasValidParent) {
        logWarn(fn, 'No valid parent for UI insertion — using floating mode fallback');
      }
    }

    var uiState = 'expanded';

    const wrapper = document.createElement('div');
    wrapper.id = ID.CONTAINER;
    wrapper.style.cssText = useFloatingFallback
      ? 'position:fixed;z-index:99998;width:320px;top:80px;right:20px;cursor:default;box-shadow:0 8px 32px rgba(0,0,0,0.4);'
      : 'margin-top:12px;position:relative;cursor:default;';

    const header = buildHeader();
    const body = buildBody();

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isFloating = false;

    function enableFloating() {
      const fn2 = 'enableFloating';
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
      const isHideClick = e.target.title === 'Hide panel (Ctrl+Alt+H to show)';
      if (isHideClick) return;
      isDragging = true;
      const rect = wrapper.getBoundingClientRect();
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
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:grab;padding:6px 10px;background:' + THEME.SLATE_800 + ';border-radius:6px 6px 0 0;border:1px solid ' + THEME.SLATE_700 + ';user-select:none;';
      el.title = 'Drag to move, click to minimize/expand';

      const label = document.createElement('span');
      label.style.cssText = 'font-size:13px;font-weight:700;color:' + THEME.CYAN_LIGHT + ';flex:1;font-family:' + FONT.HEADING + ';';
      label.textContent = 'ComboSwitch v' + VERSION;

      const toggle = document.createElement('span');
      toggle.id = 'ahk-combo-toggle';
      toggle.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';';
      toggle.textContent = '[ - ]';

      const hide = document.createElement('span');
      hide.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';cursor:pointer;margin-left:4px;';
      hide.textContent = '[ x ]';
      hide.title = 'Hide panel (Ctrl+Alt+H to show)';

      hide.onclick = function(e) {
        e.stopPropagation();
        logEntry('hidePanel', 'Panel hidden by user');
        wrapper.style.display = 'none';
        uiState = 'hidden';
      };

      const dragStartPos = { x: 0, y: 0 };

      el.onmousedown = function(e) {
        const isHideClick = e.target === hide;
        if (isHideClick) return;
        dragStartPos.x = e.clientX;
        dragStartPos.y = e.clientY;
        startDrag(e);
      };

      el.onmouseup = function(e) {
        const isHideClick = e.target === hide;
        if (isHideClick) return;
        const dx = Math.abs(e.clientX - dragStartPos.x);
        const dy = Math.abs(e.clientY - dragStartPos.y);
        const isClick = dx < 5 && dy < 5;
        if (isClick) {
          toggleMinimize();
        }
      };

      // v7.9: Status badge — visible indicator of combo progress (idle/running/done/error)
      const statusBadge = document.createElement('span');
      statusBadge.id = 'ahk-status-badge';
      statusBadge.style.cssText = 'font-size:' + THEME.TINY_SIZE + ';padding:2px 6px;border-radius:3px;background:' + THEME.SLATE_700 + ';color:' + THEME.SLATE_400 + ';font-family:' + FONT.MONO + ';font-weight:600;letter-spacing:0.5px;';
      statusBadge.textContent = '● IDLE';
      statusBadge.title = 'Combo progress status — AHK polls this via title marker';

      el.appendChild(label);
      el.appendChild(statusBadge);
      el.appendChild(toggle);
      el.appendChild(hide);
      return el;
    }

    function buildBody() {
      logSub(fn, 'Building body element');
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:10px;background:' + THEME.BG_DARKER + ';border-radius:0 0 6px 6px;border:1px solid ' + THEME.SLATE_700 + ';border-top:none;font-family:' + FONT.BODY + ';';

      // === NOW Section (project name + current workspace info — populated by updateCreditDisplay) ===
      const nowSection = document.createElement('div');
      nowSection.id = 'ahk-now-section';
      nowSection.style.cssText = 'padding:8px 10px;background:' + THEME.CYAN_BG + ';border-radius:5px;border:1px solid ' + THEME.CYAN_BORDER + ';';
      nowSection.innerHTML = '<span style="color:' + THEME.CYAN_LIGHT + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';">📍 Current workspace info loads after Status check</span>';
      el.appendChild(nowSection);

      // === Status display (NOW/NEXT with project name, current ws, next ws) ===
      const statusBox = document.createElement('div');
      statusBox.id = 'ahk-combo-status';
      statusBox.style.cssText = 'font-size:11px;line-height:1.6;padding:8px 10px;background:' + THEME.BG_DARK + ';border-radius:5px;border:1px solid ' + THEME.SLATE_800 + ';color:' + THEME.SLATE_400 + ';font-family:' + FONT.BODY + ';';
      statusBox.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';font-family:' + FONT.BODY + ';">Waiting for combo action...</span>';
      el.appendChild(statusBox);

      // === Credit status display ===
      const creditDisplay = document.createElement('div');
      creditDisplay.id = 'ahk-credit-display';
      creditDisplay.style.cssText = 'font-size:' + THEME.BODY_SIZE + ';line-height:1.5;padding:8px 10px;background:' + THEME.BG_DARK + ';border-radius:6px;border:1px solid ' + THEME.SLATE_800 + ';color:' + THEME.SLATE_400 + ';font-family:' + FONT.BODY + ';';
      creditDisplay.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';">📊 No credit data yet. Click Status.</span>';
      el.appendChild(creditDisplay);

      // === Button Row ===
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;';

      const baseBtnStyle = 'padding:8px 16px;border:none;border-radius:6px;font-weight:600;font-size:' + THEME.SUBHEADING_SIZE + ';cursor:pointer;transition:all 0.15s;font-family:' + FONT.HEADING + ';';

      const upBtn = document.createElement('button');
      upBtn.id = ID.BTN_UP;
      upBtn.textContent = 'Up';
      upBtn.title = 'Switch to previous project (Ctrl+Alt+Up)';
      upBtn.style.cssText = baseBtnStyle + 'background:' + THEME.BTN_BLUE + ';color:#fff;';
      upBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      upBtn.onmouseout = function() { this.style.opacity = '1'; };
      upBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('upBtn.onclick', 'Up button clicked by user');
        window.__comboSwitch('up');
      };

      const downBtn = document.createElement('button');
      downBtn.id = ID.BTN_DOWN;
      downBtn.textContent = 'Down';
      downBtn.title = 'Switch to next project (Ctrl+Alt+Down)';
      downBtn.style.cssText = baseBtnStyle + 'background:' + THEME.BTN_DARK + ';color:#fff;border:1px solid ' + THEME.SLATE_700 + ';';
      downBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      downBtn.onmouseout = function() { this.style.opacity = '1'; };
      downBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('downBtn.onclick', 'Down button clicked by user');
        window.__comboSwitch('down');
      };

      // Status button
      const statusBtn = document.createElement('button');
      statusBtn.id = 'ahk-credit-status-btn';
      statusBtn.textContent = 'Status';
      statusBtn.title = 'Check credit status (Ctrl+Alt+S)';
      statusBtn.style.cssText = baseBtnStyle + 'background:' + THEME.PURPLE_DARK + ';color:#fff;';
      statusBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      statusBtn.onmouseout = function() { this.style.opacity = '1'; };
      statusBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        logEntry('statusBtn.onclick', 'Status button clicked');
        window.__checkCredits('onDemand');
      };

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';font-family:' + FONT.BODY + ';';
      hint.textContent = 'Ctrl+Alt+Up / Down / Ctrl+Alt+S / Ctrl+Alt+M (Move)';

      btnRow.appendChild(upBtn);
      btnRow.appendChild(downBtn);
      btnRow.appendChild(statusBtn);
      el.appendChild(btnRow);
      el.appendChild(hint);

      // === Workspace Section (always visible) ===
      const wsSection = document.createElement('div');
      wsSection.style.cssText = 'margin-top:6px;padding:8px;background:rgba(15,23,42,0.9);border:1px solid ' + THEME.SLATE_700 + ';border-radius:6px;';

      const wsHeader = document.createElement('div');
      wsHeader.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
      wsHeader.innerHTML = '<span style="font-size:' + THEME.SUBHEADING_SIZE + ';">🏢</span><span style="font-size:' + THEME.SUBHEADING_SIZE + ';color:' + THEME.CYAN_LIGHT + ';font-weight:700;font-family:' + FONT.HEADING + ';">Workspaces</span>';

      // Focus on current button
      const focusCurrentBtn = document.createElement('button');
      focusCurrentBtn.textContent = '📍 Focus Current';
      focusCurrentBtn.style.cssText = 'margin-left:auto;padding:2px 8px;background:rgba(6,182,212,0.2);color:' + THEME.CYAN_LIGHT + ';border:1px solid rgba(6,182,212,0.4);border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      focusCurrentBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var currentName = getCurrentWorkspaceName(); // Uses DOM fallback if __wsCurrentName is empty
        logEntry('FocusCurrent', 'Looking for workspace: "' + currentName + '"');

        // If we already know the current workspace, just find & scroll — no API needed
        if (currentName) {
          var workspaces = window.__wsDropdownData || [];
          var searchEl = document.getElementById('ahk-ws-search');
          var filter = searchEl ? searchEl.value.trim() : '';
          renderWorkspaceList(workspaces, currentName, filter);
          var listEl = document.getElementById('ahk-ws-list');
          if (listEl) {
            var currentItem = listEl.querySelector('.ahk-ws-item[data-ws-current="true"]');
            if (currentItem) {
              currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
              var idx = parseInt(currentItem.getAttribute('data-ws-idx'), 10);
              if (!isNaN(idx)) setWsNavIndex(idx);
              logEntry('FocusCurrent', '✅ Focused & selected: ' + currentName);
            } else {
              logWarn('FocusCurrent', 'Name "' + currentName + '" not found in rendered list');
            }
          }
          return;
        }

        // Fallback: detect via API only if name is unknown
        logWarn('FocusCurrent', 'No current workspace name known — detecting via API');
        var token = window.__comboResolvedToken || getBearerTokenFromStorage() || '';
        var cid = 'focus-' + Date.now();
        autoDetectCurrentWorkspace(token, cid).then(function() {
          var workspaces = window.__wsDropdownData || [];
          var detectedName = window.__wsCurrentName || '';
          var searchEl = document.getElementById('ahk-ws-search');
          var filter = searchEl ? searchEl.value.trim() : '';
          renderWorkspaceList(workspaces, detectedName, filter);
          var listEl = document.getElementById('ahk-ws-list');
          if (!listEl) return;
          var currentItem = listEl.querySelector('.ahk-ws-item[data-ws-current="true"]');
          if (currentItem) {
            currentItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
            var idx = parseInt(currentItem.getAttribute('data-ws-idx'), 10);
            if (!isNaN(idx)) setWsNavIndex(idx);
            logEntry('FocusCurrent', '✅ Focused & selected: ' + detectedName);
          } else {
            logWarn('FocusCurrent', 'No current workspace item found after API detection');
          }
        });
      };
      wsHeader.appendChild(focusCurrentBtn);

      // Free credits filter toggle
      const freeFilterBtn = document.createElement('button');
      freeFilterBtn.id = 'ahk-ws-free-filter';
      freeFilterBtn.textContent = '🆓 Free Only';
      freeFilterBtn.style.cssText = 'padding:2px 8px;background:rgba(250,204,21,0.15);color:' + THEME.YELLOW + ';border:1px solid rgba(250,204,21,0.4);border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      freeFilterBtn.setAttribute('data-active', 'false');
      freeFilterBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        const isActive = this.getAttribute('data-active') === 'true';
        this.setAttribute('data-active', isActive ? 'false' : 'true');
        this.style.background = isActive ? 'rgba(250,204,21,0.15)' : 'rgba(250,204,21,0.4)';
        this.style.fontWeight = isActive ? 'normal' : '700';
        // Re-render with filter
        const searchEl = document.getElementById('ahk-ws-search');
        const filter = searchEl ? searchEl.value.trim() : '';
        const workspaces = window.__wsDropdownData || [];
        const currentName = window.__wsCurrentName || '';
        renderWorkspaceList(workspaces, currentName, filter);
      };
      wsHeader.appendChild(freeFilterBtn);

      // Rollover filter toggle
      const rolloverFilterBtn = document.createElement('button');
      rolloverFilterBtn.id = 'ahk-ws-rollover-filter';
      rolloverFilterBtn.textContent = '🔄 Rollover';
      rolloverFilterBtn.style.cssText = 'padding:2px 8px;background:rgba(167,139,250,0.15);color:' + THEME.PURPLE_LIGHT + ';border:1px solid rgba(167,139,250,0.4);border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      rolloverFilterBtn.setAttribute('data-active', 'false');
      rolloverFilterBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        const isActive = this.getAttribute('data-active') === 'true';
        this.setAttribute('data-active', isActive ? 'false' : 'true');
        this.style.background = isActive ? 'rgba(167,139,250,0.15)' : 'rgba(167,139,250,0.4)';
        this.style.fontWeight = isActive ? 'normal' : '700';
        const searchEl = document.getElementById('ahk-ws-search');
        const filter = searchEl ? searchEl.value.trim() : '';
        const workspaces = window.__wsDropdownData || [];
        const currentName = window.__wsCurrentName || '';
        renderWorkspaceList(workspaces, currentName, filter);
      };
      wsHeader.appendChild(rolloverFilterBtn);

      // Billing filter toggle
      const billingFilterBtn = document.createElement('button');
      billingFilterBtn.id = 'ahk-ws-billing-filter';
      billingFilterBtn.textContent = '💰 Billing';
      billingFilterBtn.style.cssText = 'padding:2px 8px;background:rgba(34,197,94,0.15);color:' + THEME.GREEN_LIGHT + ';border:1px solid rgba(34,197,94,0.4);border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      billingFilterBtn.setAttribute('data-active', 'false');
      billingFilterBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        const isActive = this.getAttribute('data-active') === 'true';
        this.setAttribute('data-active', isActive ? 'false' : 'true');
        this.style.background = isActive ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.4)';
        this.style.fontWeight = isActive ? 'normal' : '700';
        const searchEl = document.getElementById('ahk-ws-search');
        const filter = searchEl ? searchEl.value.trim() : '';
        const workspaces = window.__wsDropdownData || [];
        const currentName = window.__wsCurrentName || '';
        renderWorkspaceList(workspaces, currentName, filter);
      };
      wsHeader.appendChild(billingFilterBtn);

      // Min credits filter
      const minCreditsRow = document.createElement('div');
      minCreditsRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:2px;';
      const minCreditsLabel = document.createElement('span');
      minCreditsLabel.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_400 + ';font-family:' + FONT.BODY + ';';
      minCreditsLabel.textContent = 'Min ⚡:';
      const minCreditsInput = document.createElement('input');
      minCreditsInput.type = 'number';
      minCreditsInput.id = 'ahk-ws-min-credits';
      minCreditsInput.placeholder = '0';
      minCreditsInput.min = '0';
      minCreditsInput.style.cssText = 'width:50px;padding:2px 4px;border:1px solid ' + THEME.SLATE_700 + ';border-radius:3px;background:' + THEME.BG_DARK + ';color:' + THEME.CYAN + ';font-size:' + THEME.SMALL_SIZE + ';outline:none;font-family:' + FONT.MONO + ';';
      minCreditsInput.oninput = function() {
        const searchEl = document.getElementById('ahk-ws-search');
        const filter = searchEl ? searchEl.value.trim() : '';
        const workspaces = window.__wsDropdownData || [];
        const currentName = window.__wsCurrentName || '';
        renderWorkspaceList(workspaces, currentName, filter);
      };
      minCreditsRow.appendChild(minCreditsLabel);
      minCreditsRow.appendChild(minCreditsInput);
      wsHeader.appendChild(minCreditsRow);

      // Icon legend
      const legendRow = document.createElement('div');
      legendRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:4px 0;border-top:1px solid ' + THEME.SLATE_800 + ';margin-top:4px;';
      legendRow.innerHTML = ''
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.GREEN_LIGHT + ';font-family:' + FONT.BODY + ';" title="Billing credits available from subscription">💰 Billing</span>'
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.PURPLE_LIGHT + ';font-family:' + FONT.BODY + ';" title="Rollover credits carried from previous period">🔄 Rollover</span>'
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.YELLOW + ';font-family:' + FONT.BODY + ';" title="Daily free credits that reset each day">📅 Daily Free</span>'
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.CYAN + ';font-family:' + FONT.BODY + ';" title="Total available = Billing + Rollover + Daily Free">⚡ Total</span>'
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.GREEN_LIGHT + ';font-family:' + FONT.BODY + ';" title="Free trial credits (one-time grant)">🎁 Trial</span>'
        + '<span style="font-size:' + THEME.TINY_SIZE + ';color:' + THEME.SLATE_400 + ';font-family:' + FONT.BODY + ';" title="📍=Current 🟢=Available 🟡=Low 🔴=Empty">📍🟢🟡🔴 Status</span>';
      wsHeader.appendChild(legendRow);

      // Search input
      const wsSearch = document.createElement('input');
      wsSearch.type = 'text';
      wsSearch.id = 'ahk-ws-search';
      wsSearch.placeholder = '🔍 Search workspaces...';
      wsSearch.style.cssText = 'width:100%;padding:5px 8px;border:1px solid ' + THEME.SLATE_700 + ';border-radius:4px;background:' + THEME.BG_DARK + ';color:' + THEME.SLATE_200 + ';font-size:' + THEME.BODY_SIZE + ';outline:none;box-sizing:border-box;margin-bottom:6px;font-family:' + FONT.BODY + ';';
      wsSearch.onfocus = function() { this.style.borderColor = THEME.BTN_BLUE; };
      wsSearch.onblur = function() { this.style.borderColor = THEME.SLATE_700; };
      wsSearch.oninput = function() {
        const filter = this.value.trim();
        const workspaces = window.__wsDropdownData || [];
        const currentName = window.__wsCurrentName || '';
        renderWorkspaceList(workspaces, currentName, filter);
      };
      wsSearch.onkeydown = function(e) {
        const listEl = document.getElementById('ahk-ws-list');
        if (!listEl) return;
        const items = listEl.querySelectorAll('.ahk-ws-item');
        const totalItems = items.length;
        if (totalItems === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = wsNavIndex < totalItems - 1 ? wsNavIndex + 1 : 0;
          setWsNavIndex(nextIdx);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = wsNavIndex > 0 ? wsNavIndex - 1 : totalItems - 1;
          setWsNavIndex(prevIdx);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          triggerMoveFromSelection();
          return;
        }
      };

      // Custom dropdown container
      const wsDropdownContainer = document.createElement('div');
      wsDropdownContainer.id = 'ahk-ws-dropdown-container';

      const wsList = document.createElement('div');
      wsList.id = 'ahk-ws-list';
      wsList.style.cssText = 'max-height:220px;overflow-y:auto;border:1px solid ' + THEME.SLATE_800 + ';border-radius:4px;background:' + THEME.BG_DARK + ';';
      wsList.innerHTML = '<div style="padding:8px;color:' + THEME.SLATE_500 + ';font-size:' + THEME.BODY_SIZE + ';font-family:' + FONT.BODY + ';">📊 Click Status to load workspaces</div>';
      wsDropdownContainer.appendChild(wsList);

      // Selected indicator
      const wsSelected = document.createElement('div');
      wsSelected.id = 'ahk-ws-selected';
      wsSelected.style.cssText = 'font-size:11px;color:' + THEME.SLATE_400 + ';margin-top:4px;min-height:16px;font-family:' + FONT.BODY + ';';
      wsSelected.textContent = 'No workspace selected';

      // Move button row
      const wsMoveRow = document.createElement('div');
      wsMoveRow.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;';

      const moveBtn = document.createElement('button');
      moveBtn.id = 'ahk-move-btn';
      moveBtn.textContent = '🚀 Move Project';
      moveBtn.title = 'Move project to selected workspace (Ctrl+Alt+M)';
      moveBtn.style.cssText = 'flex:1;padding:6px 12px;background:' + THEME.MOVE_GREEN + ';color:#fff;border:none;border-radius:5px;font-size:' + THEME.BODY_SIZE + ';font-weight:700;cursor:pointer;transition:all 0.15s;font-family:' + FONT.HEADING + ';';
      moveBtn.onmouseover = function() { this.style.background = THEME.MOVE_GREEN_HOVER; };
      moveBtn.onmouseout = function() { this.style.background = THEME.MOVE_GREEN; };
      moveBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        triggerMoveFromSelection();
      };

      const moveStatus = document.createElement('div');
      moveStatus.id = 'ahk-move-status';
      moveStatus.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';min-height:14px;color:' + THEME.SLATE_400 + ';font-family:' + FONT.BODY + ';';

      // v7.9.32: Force Move Up/Down buttons — Alt+Up/Down shortcut, click animation
      const forceUpBtn = document.createElement('button');
      forceUpBtn.textContent = '⏫';
      forceUpBtn.title = 'Force move project to previous workspace via API (Alt+Up)';
      forceUpBtn.style.cssText = 'padding:6px 8px 5px 8px;background:#1d4ed8;color:#fff;border:none;border-radius:4px;font-size:' + THEME.BODY_SIZE + ';cursor:pointer;transition:all 0.15s;';
      forceUpBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      forceUpBtn.onmouseout = function() { this.style.opacity = '1'; };
      forceUpBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); animateBtn(forceUpBtn); moveToAdjacentWorkspaceCombo('up'); };

      const forceDownBtn = document.createElement('button');
      forceDownBtn.textContent = '⏬';
      forceDownBtn.title = 'Force move project to next workspace via API (Alt+Down)';
      forceDownBtn.style.cssText = 'padding:6px 8px 5px 8px;background:#7c2d12;color:#fff;border:none;border-radius:4px;font-size:' + THEME.BODY_SIZE + ';cursor:pointer;transition:all 0.15s;';
      forceDownBtn.onmouseover = function() { this.style.opacity = '0.8'; };
      forceDownBtn.onmouseout = function() { this.style.opacity = '1'; };
      forceDownBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); animateBtn(forceDownBtn); moveToAdjacentWorkspaceCombo('down'); };

      wsMoveRow.appendChild(forceUpBtn);
      wsMoveRow.appendChild(moveBtn);
      wsMoveRow.appendChild(forceDownBtn);
      wsMoveRow.appendChild(moveStatus);

      wsSection.appendChild(wsHeader);
      wsSection.appendChild(wsSearch);
      wsSection.appendChild(wsDropdownContainer);
      wsSection.appendChild(wsSelected);
      wsSection.appendChild(wsMoveRow);
      el.appendChild(wsSection);

      // === JS Executor textbox ===
      const jsLabel = document.createElement('div');
      jsLabel.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';margin-top:4px;font-family:' + FONT.BODY + ';';
      jsLabel.textContent = 'JS Executor (Ctrl+/ to focus, Ctrl+Enter to run)';
      el.appendChild(jsLabel);

      const jsRow = document.createElement('div');
      jsRow.style.cssText = 'display:flex;gap:6px;align-items:stretch;';

      const textarea = document.createElement('textarea');
      textarea.id = '__JS_EXECUTOR_ID__';
      textarea.placeholder = 'Enter JavaScript code here...';
      textarea.style.cssText = 'flex:1;min-height:48px;max-height:120px;padding:6px 8px;background:' + THEME.BG_DARK + ';color:' + THEME.SLATE_200 + ';border:1px solid ' + THEME.SLATE_700 + ';border-radius:4px;font-family:' + FONT.MONO + ';font-size:' + THEME.BODY_SIZE + ';resize:vertical;outline:none;';
      textarea.onfocus = function() { this.style.borderColor = THEME.BTN_BLUE; };
      textarea.onblur = function() { this.style.borderColor = THEME.SLATE_700; };
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

      const runBtn = document.createElement('button');
      runBtn.id = '__JS_EXECUTE_BTN_ID__';
      runBtn.textContent = '▶ Run';
      runBtn.style.cssText = 'padding:6px 12px;background:' + THEME.MOVE_GREEN + ';color:#fff;border:none;border-radius:4px;font-size:' + THEME.BODY_SIZE + ';font-weight:600;cursor:pointer;white-space:nowrap;font-family:' + FONT.HEADING + ';';
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
      const histLabel = document.createElement('div');
      histLabel.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';margin-top:4px;font-family:' + FONT.BODY + ';';
      histLabel.textContent = 'Recent Actions';
      el.appendChild(histLabel);

      const histBox = document.createElement('div');
      histBox.id = 'ahk-combo-history';
      histBox.style.cssText = 'font-size:11px;padding:6px 8px;background:' + THEME.BG_DARK + ';border-radius:4px;border:1px solid ' + THEME.SLATE_800 + ';max-height:100px;overflow-y:auto;font-family:' + FONT.BODY + ';';
      histBox.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';">No actions yet</span>';
      el.appendChild(histBox);

      // === JS Command History ===
      const jsHistLabel = document.createElement('div');
      jsHistLabel.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';margin-top:4px;font-family:' + FONT.BODY + ';';
      jsHistLabel.textContent = 'JS Command History (click to recall, Up/Down arrows in textbox)';
      el.appendChild(jsHistLabel);

      const jsHistBox = document.createElement('div');
      jsHistBox.id = 'ahk-js-history';
      jsHistBox.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';padding:6px 8px;background:' + THEME.BG_DARK + ';border-radius:4px;border:1px solid ' + THEME.SLATE_800 + ';max-height:80px;overflow-y:auto;font-family:' + FONT.MONO + ';';
      jsHistBox.innerHTML = '<span style="color:' + THEME.SLATE_500 + ';">No commands yet</span>';
      el.appendChild(jsHistBox);

      // === Log Export Buttons ===
      const logExportRow = document.createElement('div');
      logExportRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;align-items:center;';

      const logLabel = document.createElement('span');
      logLabel.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:' + THEME.SLATE_500 + ';flex:1;font-family:' + FONT.BODY + ';';
      logLabel.textContent = 'JS Logs (' + getAllLogs().length + ' entries)';
      logLabel.id = 'ahk-log-count';

      const copyLogBtn = document.createElement('button');
      copyLogBtn.textContent = 'Copy Logs';
      copyLogBtn.style.cssText = 'padding:4px 8px;background:' + THEME.SLATE_700 + ';color:' + THEME.SLATE_200 + ';border:1px solid ' + THEME.SLATE_600 + ';border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      copyLogBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        copyLogsToClipboard();
        var countEl = document.getElementById('ahk-log-count');
        if (countEl) countEl.textContent = 'Copied! (' + getAllLogs().length + ' entries)';
        setTimeout(function() {
          if (countEl) countEl.textContent = 'JS Logs (' + getAllLogs().length + ' entries)';
        }, 2000);
      };

      const downloadLogBtn = document.createElement('button');
      downloadLogBtn.textContent = 'Download';
      downloadLogBtn.style.cssText = 'padding:4px 8px;background:' + THEME.SLATE_700 + ';color:' + THEME.SLATE_200 + ';border:1px solid ' + THEME.SLATE_600 + ';border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      downloadLogBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); downloadLogs(); };

      const clearLogBtn = document.createElement('button');
      clearLogBtn.textContent = 'Clear';
      clearLogBtn.style.cssText = 'padding:4px 8px;background:' + THEME.DANGER_BG + ';color:' + THEME.DANGER_TEXT + ';border:1px solid ' + THEME.DANGER_BORDER + ';border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-family:' + FONT.BODY + ';';
      clearLogBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        clearLogs();
        // Also clear in-memory JS command history
        jsHistory.length = 0;
        jsHistoryIndex = -1;
        renderJsHistory();
        // Clear combo action history
        comboHistory.length = 0;
        renderHistory();
        var countEl = document.getElementById('ahk-log-count');
        if (countEl) countEl.textContent = 'JS Logs (0 entries)';
      };

      logExportRow.appendChild(logLabel);
      logExportRow.appendChild(copyLogBtn);
      logExportRow.appendChild(downloadLogBtn);
      logExportRow.appendChild(clearLogBtn);
      el.appendChild(logExportRow);

      // ============================================
      // Bearer Token Input Section
      // ============================================
      const tokenSection = document.createElement('div');
      tokenSection.style.cssText = 'margin-top:6px;padding:8px;background:rgba(30,58,75,.6);border:1px solid #0e7490;border-radius:4px;';

      const savedToken = getBearerTokenFromStorage();
      const tokenCollapsed = !!savedToken;

      const tokenTitle = document.createElement('div');
      tokenTitle.id = 'combo-bearer-title';
      tokenTitle.style.cssText = 'font-size:11px;color:' + THEME.CYAN_LIGHT + ';font-weight:bold;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:' + FONT.HEADING + ';';
      const tokenStatusEmoji = savedToken ? '🔑' : '⚠️';
      const tokenStatusText = savedToken ? ' (saved, ' + savedToken.length + ' chars)' : ' (not set)';
      tokenTitle.innerHTML = '<span>' + (tokenCollapsed ? '▶' : '▼') + '</span> Bearer Token ' + tokenStatusEmoji + '<span style="color:' + THEME.SLATE_400 + ';font-size:' + THEME.SMALL_SIZE + ';font-weight:normal;font-family:' + FONT.BODY + ';">' + tokenStatusText + '</span>';

      const tokenBody = document.createElement('div');
      tokenBody.id = 'ahk-token-body';
      tokenBody.style.cssText = tokenCollapsed ? 'display:none;margin-top:6px;' : 'display:block;margin-top:6px;';

      tokenTitle.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var body = document.getElementById('ahk-token-body');
        if (!body) return;
        var isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        tokenTitle.querySelector('span').textContent = isHidden ? '▼' : '▶';
      };

      const tokenInputRow = document.createElement('div');
      tokenInputRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;';

      const tokenInput = document.createElement('input');
      tokenInput.type = 'password';
      tokenInput.id = 'ahk-bearer-token-input';
      tokenInput.placeholder = 'Paste your bearer token here...';
      tokenInput.style.cssText = 'flex:1;padding:4px 6px;border:1px solid #0e7490;border-radius:4px;background:#0c4a6e;color:#e0f2fe;font-family:' + FONT.MONO + ';font-size:' + THEME.SMALL_SIZE + ';box-sizing:border-box;';
      // Pre-fill from localStorage (savedToken already declared above)
      if (savedToken) tokenInput.value = savedToken;

      const tokenToggleBtn = document.createElement('button');
      tokenToggleBtn.textContent = '👁';
      tokenToggleBtn.title = 'Show/Hide token';
      tokenToggleBtn.style.cssText = 'padding:4px 6px;border:none;border-radius:4px;background:#164e63;color:' + THEME.CYAN_LIGHT + ';font-size:' + THEME.BODY_SIZE + ';cursor:pointer;line-height:1;';
      tokenToggleBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var inp = document.getElementById('ahk-bearer-token-input');
        if (inp.type === 'password') {
          inp.type = 'text';
          tokenToggleBtn.textContent = '🔒';
          tokenToggleBtn.title = 'Hide token';
        } else {
          inp.type = 'password';
          tokenToggleBtn.textContent = '👁';
          tokenToggleBtn.title = 'Show token';
        }
      };

      tokenInputRow.appendChild(tokenInput);
      tokenInputRow.appendChild(tokenToggleBtn);

      const tokenBtnRow = document.createElement('div');
      tokenBtnRow.style.cssText = 'display:flex;gap:6px;';

      const tokenSaveBtn = document.createElement('button');
      tokenSaveBtn.textContent = 'Save Token';
      tokenSaveBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#0e7490;color:#ecfeff;font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
      tokenSaveBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var raw = document.getElementById('ahk-bearer-token-input').value;
        var val = raw.trim();
        if (!val) {
          logWarn('tokenSave', 'Rejected empty/whitespace-only token');
          tokenTitle.textContent = 'Bearer Token (⚠ empty!)';
          tokenTitle.style.color = '#fca5a5';
          setTimeout(function() { tokenTitle.textContent = 'Bearer Token'; tokenTitle.style.color = ''; }, 2500);
          return;
        }
        if (val.length < 10) {
          logWarn('tokenSave', 'Rejected short token (len=' + val.length + ')');
          tokenTitle.textContent = 'Bearer Token (⚠ too short!)';
          tokenTitle.style.color = '#fca5a5';
          setTimeout(function() { tokenTitle.textContent = 'Bearer Token'; tokenTitle.style.color = ''; }, 2500);
          return;
        }
        saveBearerTokenToStorage(val);
        tokenTitle.textContent = 'Bearer Token (saved!)';
        setTimeout(function() { tokenTitle.textContent = 'Bearer Token'; }, 2000);
      };

      const tokenClearBtn = document.createElement('button');
      tokenClearBtn.textContent = 'Clear Token';
      tokenClearBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:' + THEME.DANGER_BG + ';color:' + THEME.DANGER_TEXT + ';font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
      tokenClearBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        document.getElementById('ahk-bearer-token-input').value = '';
        try { localStorage.removeItem(getBearerStorageKey()); } catch (ex) {}
        logEntry('tokenClear', 'Bearer token cleared');
        tokenTitle.textContent = 'Bearer Token (cleared!)';
        setTimeout(function() { tokenTitle.textContent = 'Bearer Token'; }, 2000);
      };

      // v7.9.31: Paste+Save button — uses pasteAndVerifyToken for clipboard paste + API verification
      const tokenPasteBtn = document.createElement('button');
      tokenPasteBtn.textContent = '📋 Paste & Save';
      tokenPasteBtn.title = 'Paste from clipboard, save & verify token';
      tokenPasteBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#7c3aed;color:#e9d5ff;font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
      tokenPasteBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        pasteAndVerifyToken('combo');
      };

      tokenBtnRow.appendChild(tokenSaveBtn);
      tokenBtnRow.appendChild(tokenPasteBtn);
      tokenBtnRow.appendChild(tokenClearBtn);
      tokenBody.appendChild(tokenInputRow);
      tokenBody.appendChild(tokenBtnRow);
      tokenSection.appendChild(tokenTitle);
      tokenSection.appendChild(tokenBody);
      el.appendChild(tokenSection);

      // ============================================
      // Clear All Button
      // ============================================
      const clearAllRow = document.createElement('div');
      clearAllRow.style.cssText = 'margin-top:6px;display:flex;gap:6px;align-items:center;';

      const clearAllBtn = document.createElement('button');
      clearAllBtn.textContent = 'Clear All Data';
      clearAllBtn.style.cssText = 'padding:4px 10px;background:' + THEME.DANGER_BG + ';color:' + THEME.DANGER_TEXT + ';border:1px solid ' + THEME.DANGER_BORDER + ';border-radius:3px;font-size:' + THEME.SMALL_SIZE + ';cursor:pointer;font-weight:600;font-family:' + FONT.BODY + ';';
      clearAllBtn.title = 'Remove all ComboSwitch/MacroLoop localStorage data (logs, tokens, workspaces)';
      clearAllBtn.onclick = function(e) {
        e.preventDefault(); e.stopPropagation();
        var count = clearAllLocalStorage();
        logEntry('clearAll', 'Cleared ' + count + ' localStorage entries');
        // Reset UI elements
        document.getElementById('ahk-bearer-token-input').value = '';
        var countEl = document.getElementById('ahk-log-count');
        if (countEl) countEl.textContent = 'JS Logs (0 entries)';
        clearAllBtn.textContent = 'Cleared ' + count + ' items!';
        setTimeout(function() { clearAllBtn.textContent = 'Clear All Data'; }, 2000);
      };

      const clearAllHint = document.createElement('span');
      clearAllHint.style.cssText = 'font-size:' + THEME.TINY_SIZE + ';color:' + THEME.SLATE_500 + ';font-family:' + FONT.BODY + ';';
      clearAllHint.textContent = 'Removes all ahk_* and ml_* localStorage';

      clearAllRow.appendChild(clearAllBtn);
      clearAllRow.appendChild(clearAllHint);
      el.appendChild(clearAllRow);

      // ============================================
      // XPath Tester Section
      // ============================================
      const xpathTestSection = document.createElement('div');
      xpathTestSection.style.cssText = 'margin-top:6px;padding:8px;background:rgba(30,27,75,.6);border:1px solid #6d28d9;border-radius:4px;';

      const xpathTestTitle = document.createElement('div');
      xpathTestTitle.style.cssText = 'font-size:11px;color:#c4b5fd;font-weight:bold;margin-bottom:6px;font-family:' + FONT.HEADING + ';';
      xpathTestTitle.textContent = 'XPath Tester';

      const xpathTestInput = document.createElement('input');
      xpathTestInput.type = 'text';
      xpathTestInput.id = 'combo-xpath-test-input';
      xpathTestInput.placeholder = '//button[contains(text(),"Submit")]';
      xpathTestInput.style.cssText = 'width:100%;padding:4px 6px;border:1px solid #6d28d9;border-radius:4px;background:#1e1b4b;color:#e0e7ff;font-family:' + FONT.MONO + ';font-size:' + THEME.SMALL_SIZE + ';margin-bottom:6px;box-sizing:border-box;';

      const xpathTestResult = document.createElement('div');
      xpathTestResult.id = 'combo-xpath-test-result';
      xpathTestResult.style.cssText = 'font-size:' + THEME.SMALL_SIZE + ';color:#a5b4fc;margin-bottom:6px;min-height:14px;word-break:break-all;font-family:' + FONT.BODY + ';';

      const xpathTestBtnRow = document.createElement('div');
      xpathTestBtnRow.style.cssText = 'display:flex;gap:6px;';

      const xpFindBtn = document.createElement('button');
      xpFindBtn.textContent = 'Find';
      xpFindBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#4c1d95;color:#c4b5fd;font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
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

      const xpClickBtn = document.createElement('button');
      xpClickBtn.textContent = 'Click';
      xpClickBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#7c2d12;color:#fdba74;font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
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

      const xpFireAllBtn = document.createElement('button');
      xpFireAllBtn.textContent = 'Fire All';
      xpFireAllBtn.style.cssText = 'flex:1;padding:4px 8px;border:none;border-radius:4px;background:#065f46;color:#6ee7b7;font-size:11px;cursor:pointer;font-family:' + FONT.BODY + ';';
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
      const toggle = document.getElementById('ahk-combo-toggle');
      const isExpanded = uiState === 'expanded';

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
      const toggle = document.getElementById('ahk-combo-toggle');
      toggle.textContent = '[ - ]';
      header.style.borderRadius = '6px 6px 0 0';
      uiState = 'expanded';
    }

    // S-003: isOnSettingsPage is now hoisted to IIFE scope (available to both UI and init)

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

      const isCtrlAlt = e.ctrlKey && e.altKey;
      if (!isCtrlAlt) return;

      const key = e.key.toLowerCase();

      // Ctrl+Alt+S -> Credit Status
      const isStatusKey = key === 's';
      if (isStatusKey) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+S pressed -> Credit Status check');
        window.__checkCredits('onDemand');
        return;
      }

      // Ctrl+Alt+M -> Move project to selected workspace
      const isMoveKey = key === 'm';
      if (isMoveKey) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+M pressed -> Move project');
        triggerMoveFromSelection();
        return;
      }
      const isToggleHide = key === 'h';
      if (isToggleHide) {
        e.preventDefault();
        const isHidden = wrapper.style.display === 'none';
        logEntry('keydown', 'Ctrl+Alt+H pressed, isHidden=' + isHidden);
        if (isHidden) restorePanel();
        return;
      }

      // S-003: Only process Up/Down on settings pages to avoid conflict with MacroLoop
      const isSettingsContext = isOnSettingsPage();
      if (!isSettingsContext) {
        logSub('keydown', 'Not on settings page, skipping ComboSwitch shortcut (letting MacroLoop handle it)');
        return;
      }

      const isUpArrow = e.key === 'ArrowUp';
      if (isUpArrow) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+Up pressed on settings page -> ComboSwitch');
        window.__comboSwitch('up');
        return;
      }

      const isDownArrow = e.key === 'ArrowDown';
      if (isDownArrow) {
        e.preventDefault();
        logEntry('keydown', 'Ctrl+Alt+Down pressed on settings page -> ComboSwitch');
        window.__comboSwitch('down');
        return;
      }

      // v7.9.32: Alt+Up/Down for instant force move via API
      const isAltOnly = e.altKey && !e.shiftKey && !e.ctrlKey;
      if (isAltOnly && e.key === 'ArrowUp') {
        e.preventDefault();
        logEntry('keydown', 'Alt+Up → Force Move UP via API');
        moveToAdjacentWorkspaceCombo('up');
        return;
      }
      if (isAltOnly && e.key === 'ArrowDown') {
        e.preventDefault();
        logEntry('keydown', 'Alt+Down → Force Move DOWN via API');
        moveToAdjacentWorkspaceCombo('down');
        return;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);

    if (useFloatingFallback) {
      document.body.appendChild(wrapper);
      logEntry(fn, 'UI created in floating mode (appended to body)');
    } else {
      parent.parentNode.insertBefore(wrapper, parent.nextSibling);
      logEntry(fn, 'UI created and inserted after Transfer button');
    }

    // Start auto-refresh for credit status
    startAutoRefresh();
  }

  function placeMarker() {
    const fn = 'placeMarker';
    logEntry(fn, 'Placing script marker: ' + ID.SCRIPT_MARKER);
    const marker = document.createElement('div');
    marker.id = ID.SCRIPT_MARKER;
    marker.style.display = 'none';
    document.body.appendChild(marker);
    logSub(fn, 'Marker placed');

    // Place progress status element (for AHK polling)
    let progressEl = document.getElementById(ID.PROGRESS_STATUS);
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.id = ID.PROGRESS_STATUS;
      progressEl.style.display = 'none';
      progressEl.setAttribute('data-status', 'idle');
      progressEl.textContent = 'idle';
      document.body.appendChild(progressEl);
      logSub(fn, 'Progress status element placed (idle)');
    }
  }

  // ============================================
  // INIT: Idempotent — skip if already embedded
  // Flow: AHK checks marker first (Script 1), injects combo.js only if absent (Script 2),
  //       then calls __comboSwitch('up'/'down') separately (Script 3).
  // ============================================
  if (isAlreadyEmbedded()) {
    logInfo('init', 'Already embedded (marker=' + ID.SCRIPT_MARKER + ') — skipping injection, UI intact');
    // Only auto-run combo if on settings page (for cases where AHK re-injects after config change)
    if (isOnSettingsPage()) {
      logBanner('init', 'Re-run combo: ' + DIRECTION);
      runComboSwitch(DIRECTION);
    }
    return; // Exit IIFE — no teardown, no re-creation
  }

  // First load: place marker, create UI, setup persistence
  logInfo('init', 'First load — embedding UI');
  placeMarker();
  createControllerUI();

  // Auto-fetch credits on first load (cached, won't re-fetch if cache valid)
  setTimeout(function() {
    logEntry('init', 'Auto-fetching credit status on first load');
    checkCreditsStatus('init');
  }, 1000);

  // ============================================
  // S-002: MutationObserver to persist UI across SPA navigation
  // Watches for removal of marker/container and re-injects
  // ============================================
  (function setupPersistence() {
    const fn = 'persistence';
    let reinjectDebounce = null;
    const REINJECT_DELAY_MS = 500;

    function tryReinject() {
      // Clear cached project name so it re-reads from DOM on next access
      creditState.projectName = null;
      const hasMarker = !!document.getElementById(ID.SCRIPT_MARKER);
      const hasContainer = !!document.getElementById(ID.CONTAINER);

      if (!hasMarker) {
        logWarn(fn, 'Marker removed by SPA navigation, re-placing');
        placeMarker();
      }

      if (!hasContainer) {
        logWarn(fn, 'UI container removed by SPA navigation, re-creating');
        createControllerUI();
      }
    }

    const observer = new MutationObserver(function(mutations) {
      let hasRemovals = false;
      for (let i = 0; i < mutations.length; i++) {
        if (mutations[i].removedNodes.length > 0) {
          hasRemovals = true;
          break;
        }
      }
      if (!hasRemovals) return;

      // Check if our elements were removed
      const markerGone = !document.getElementById(ID.SCRIPT_MARKER);
      const containerGone = !document.getElementById(ID.CONTAINER);

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

  // Only auto-run combo if on a settings page — on other pages, just install the controller UI
  if (isOnSettingsPage()) {
    logBanner('init', 'Running combo: ' + DIRECTION);
    logInfo('init', 'XPath: use XPathUtils.findByXPath(x), XPathUtils.clickByXPath(x), XPathUtils.fireAll(x)');
    runComboSwitch(DIRECTION);
  } else {
    logWarn('init', 'Not on settings page — controller installed but combo NOT auto-run. Navigate to settings and use Ctrl+Alt+Up/Down.');
    setProgressStatus('idle');
  }
})();
