(function () {
  console.log(
    "%c[ComboSwitch] Script started, direction: __DIRECTION__",
    "color: cyan; font-weight: bold;"
  );

  // These placeholders are replaced from config.ini:
  var POLL_INTERVAL_MS = __COMBO_POLL_INTERVAL_MS__;
  var OPEN_MAX_ATTEMPTS = __COMBO_OPEN_MAX_ATTEMPTS__;
  var WAIT_MAX_ATTEMPTS = __COMBO_WAIT_MAX_ATTEMPTS__;

  // --- Helpers ----------------------------------------------------

  function getNodeByXPath(xpath) {
    if (!xpath || !xpath.trim()) {
      console.error("[ComboSwitch] getNodeByXPath: EMPTY xpath");
      return null;
    }

    try {
      return document
        .evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        )
        .singleNodeValue;
    } catch (e) {
      console.error(
        "[ComboSwitch] getNodeByXPath: INVALID xpath:\n  " +
          xpath +
          "\nError: " +
          e
      );
      return null;
    }
  }

  function waitForElement(xpath, description, callback, maxAttempts) {
    if (!xpath || !xpath.trim()) {
      console.error(
        "[ComboSwitch] waitForElement: EMPTY xpath for " + description
      );
      alert(
        "[ComboSwitch] FAILED: XPath for " + description + " is EMPTY."
      );
      return;
    }

    var attempts = 0;
    var max = maxAttempts || WAIT_MAX_ATTEMPTS;

    var interval = setInterval(function () {
      attempts++;

      var el = getNodeByXPath(xpath);
      if (el) {
        clearInterval(interval);
        console.log(
          "%c[ComboSwitch] " +
            description +
            " FOUND (attempt " +
            attempts +
            ")",
          "color: lime;"
        );
        callback(el);
      } else if (attempts >= max) {
        clearInterval(interval);
        console.error(
          "[ComboSwitch] " +
            description +
            " NOT FOUND after " +
            max +
            " attempts.\nXPath used:\n  " +
            xpath
        );
        alert(
          "[ComboSwitch] FAILED: " +
            description +
            " not found.\nXPath:\n" +
            xpath
        );
      } else {
        console.log(
          "[ComboSwitch] Waiting for " +
            description +
            "... (" +
            attempts +
            "/" +
            max +
            "), xpath: " +
            xpath
        );
      }
    }, POLL_INTERVAL_MS);
  }

  // --- Step 1: click Transfer button ------------------------------

  console.log(
    "[ComboSwitch] Using TransferButtonXPath:",
    "__TRANSFER_XPATH__"
  );
  var transferBtn = getNodeByXPath("__TRANSFER_XPATH__");
  if (transferBtn) {
    console.log(
      "%c[ComboSwitch] Step 1: Transfer button FOUND, clicking...",
      "color: lime;"
    );
    transferBtn.click();
  } else {
    console.error(
      "[ComboSwitch] Step 1: Transfer button NOT FOUND.\nXPath used:\n  __TRANSFER_XPATH__"
    );
    alert(
      "[ComboSwitch] FAILED: Transfer button not found.\nXPath:\n__TRANSFER_XPATH__"
    );
    return;
  }

  // --- Step 2: wait for Combo 1 text ------------------------------

  console.log(
    "[ComboSwitch] Using Combo1XPath:",
    "__COMBO1_XPATH__"
  );
  waitForElement(
    "__COMBO1_XPATH__",
    "Combo 1 text",
    function (combo1) {
      var sourceText = (combo1.textContent || "").trim();
      console.log(
        "%c[ComboSwitch] Step 2: Combo 1 text = '" +
          sourceText +
          "'",
        "color: lime;"
      );

      // --- Step 3: wait for Combo 2 button ------------------------

      console.log(
        "[ComboSwitch] Using Combo2ButtonXPath:",
        "__COMBO2_XPATH__"
      );
      waitForElement(
        "__COMBO2_XPATH__",
        "Combo 2 button",
        function (combo2Btn) {
          console.log(
            "%c[ComboSwitch] Step 3: Combo 2 button FOUND, clicking...",
            "color: lime;"
          );
          combo2Btn.click();

          // --- Step 4: wait for combo dropdown to open ------------

          var openAttempts = 0;
          var openInterval = setInterval(function () {
            openAttempts++;

            var openTrigger = document.querySelector(
              "button[data-state='open']"
            );
            if (openTrigger) {
              clearInterval(openInterval);
              console.log(
                "%c[ComboSwitch] Step 4: Combo 2 is OPEN (attempt " +
                  openAttempts +
                  ")",
                "color: lime;"
              );

              // --- Step 5: wait for options container -------------

              console.log(
                "[ComboSwitch] Using OptionsContainerXPath:",
                "__OPTIONS_XPATH__"
              );
              waitForElement(
                "__OPTIONS_XPATH__",
                "Options container",
                function (listRoot) {
                  var options = Array.from(
                    listRoot.querySelectorAll(
                      "div[role='option']"
                    )
                  );
                  console.log(
                    "%c[ComboSwitch] Step 5: Found " +
                      options.length +
                      " options",
                    "color: lime;"
                  );

                  var labels = options.map(function (opt) {
                    var p = opt.querySelector(
                      "p.min-w-0.truncate"
                    );
                    return p
                      ? p.textContent.trim()
                      : (opt.textContent || "").trim();
                  });
                  console.log(
                    "[ComboSwitch] All labels:",
                    labels
                  );

                  // --- Step 6: find current index -----------------

                  var currentIndex = -1;
                  for (var i = 0; i < labels.length; i++) {
                    if (labels[i] === sourceText) {
                      currentIndex = i;
                      break;
                    }
                  }
                  if (currentIndex === -1) {
                    console.log(
                      "[ComboSwitch] Exact match failed, trying partial..."
                    );
                    for (
                      var j = 0;
                      j < labels.length;
                      j++
                    ) {
                      if (
                        labels[j].indexOf(sourceText) !==
                          -1 ||
                        sourceText.indexOf(labels[j]) !==
                          -1
                      ) {
                        currentIndex = j;
                        break;
                      }
                    }
                  }
                  if (currentIndex === -1) {
                    console.error(
                      "[ComboSwitch] Step 6: '" +
                        sourceText +
                        "' NOT FOUND in options.\nLabels:\n" +
                        labels.join("\n")
                    );
                    alert(
                      "[ComboSwitch] FAILED: Could not find '" +
                        sourceText +
                        "' in Combo 2."
                    );
                    return;
                  }

                  console.log(
                    "%c[ComboSwitch] Step 6: Match at index " +
                      currentIndex +
                      ": '" +
                      labels[currentIndex] +
                      "'",
                    "color: lime;"
                  );

                  // --- Step 7: next / previous --------------------

                  var targetIndex;
                  if ("__DIRECTION__" === "up") {
                    targetIndex =
                      currentIndex - 1 >= 0
                        ? currentIndex - 1
                        : options.length - 1;
                  } else {
                    targetIndex =
                      currentIndex + 1 < options.length
                        ? currentIndex + 1
                        : 0;
                  }

                  console.log(
                    "%c[ComboSwitch] Step 7: Selecting '" +
                      labels[targetIndex] +
                      "' (__DIRECTION__)",
                    "color: yellow; font-weight: bold;"
                  );
                  options[targetIndex].click();

                  // --- Step 8: confirm ----------------------------

                  console.log(
                    "[ComboSwitch] Using ConfirmButtonXPath:",
                    "__CONFIRM_XPATH__"
                  );
                  waitForElement(
                    "__CONFIRM_XPATH__",
                    "Confirm button",
                    function (finalBtn) {
                      console.log(
                        "%c[ComboSwitch] Step 8: Confirm clicked!",
                        "color: lime;"
                      );
                      finalBtn.click();
                      console.log(
                        "%c[ComboSwitch] DONE! Moved __DIRECTION__ to: '" +
                          labels[targetIndex] +
                          "'",
                        "color: cyan; font-weight: bold; font-size: 14px;"
                      );
                    }
                  );
                }
              );
            } else if (
              openAttempts >= OPEN_MAX_ATTEMPTS
            ) {
              clearInterval(openInterval);
              console.error(
                "[ComboSwitch] Step 4: Combo 2 did not open after " +
                  OPEN_MAX_ATTEMPTS +
                  " attempts"
              );
              alert(
                "[ComboSwitch] FAILED: Combo 2 did not open."
              );
            } else {
              console.log(
                "[ComboSwitch] Waiting for Combo 2 open... (" +
                  openAttempts +
                  "/" +
                  OPEN_MAX_ATTEMPTS +
                  ")"
              );
            }
          }, POLL_INTERVAL_MS);
        }
      );
    }
  );
})();
