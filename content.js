(() => {
  if (window.__circleToFixApp) {
    window.__circleToFixApp.activate();
    return;
  }

  const api = window.__circleToFix || {};
  const records = [];
  let overlay = null;
  let activeRecord = -1;

  function announce(message, isError = false) {
    if (!overlay) {
      return;
    }
    const status = overlay.notePanel.querySelector(".ctf-status");
    if (status) {
      status.textContent = message;
      status.classList.toggle("is-error", isError);
    }
  }

  function makeFilename(index) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `circle-to-fix-${index + 1}-${timestamp}.png`;
  }

  function safePageUrl() {
    try {
      const url = new URL(location.href);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return location.origin + location.pathname;
    }
  }

  function requestScreenshot() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CTF_CAPTURE" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response?.ok) {
          reject(new Error(response?.error || "Screenshot capture failed."));
        } else {
          resolve(response.dataUrl);
        }
      });
    });
  }

  async function captureForRecord(index) {
    const record = records[index];
    if (!record) {
      return;
    }
    announce("Capturing marked page locally...");
    const hiddenElements = [overlay.notePanel, overlay.toolbar, overlay.shadow.querySelector(".ctf-history")];
    hiddenElements.forEach((element) => {
      element.dataset.previousVisibility = element.style.visibility;
      element.style.visibility = "hidden";
    });
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      record.screenshot = await requestScreenshot();
      renderRecord(index);
      announce("Screenshot ready. It stays on this device until you save it.");
    } catch (error) {
      announce(`Screenshot failed: ${error.message}`, true);
    } finally {
      hiddenElements.forEach((element) => {
        element.style.visibility = element.dataset.previousVisibility || "";
        delete element.dataset.previousVisibility;
      });
    }
  }

  function detailsMarkup(record) {
    const element = record.element;
    const summary = element
      ? `${element.tag}${element.id ? `#${element.id}` : ""}${element.classes.length ? `.${element.classes.slice(0, 3).join(".")}` : ""}`
      : "No page element found at the mark";
    return `<div class="ctf-selected"><span class="ctf-eyebrow">SELECTED ELEMENT</span><strong>${escapeHtml(summary)}</strong><small>${escapeHtml(element?.selector || "Not available")}</small></div>
      <div class="ctf-screenshot">${record.screenshot ? `<img alt="Screenshot with the annotation" src="${record.screenshot}">` : '<div class="ctf-placeholder">Screenshot not captured</div>'}</div>
      <div class="ctf-note-fields"><label for="ctf-note">What needs to be fixed?</label><textarea id="ctf-note" rows="3" placeholder="Describe the change you want...">${escapeHtml(record.note || "")}</textarea></div>
      <div class="ctf-prompt-wrap">${record.prompt ? `<label for="ctf-prompt">Generated coding-agent prompt</label><textarea id="ctf-prompt" rows="8">${escapeHtml(record.prompt)}</textarea>` : ""}</div>
      <div class="ctf-note-actions">
        <button type="button" data-action="generate" class="ctf-primary">${record.prompt ? "Update Prompt" : "Generate Prompt"}</button>
        ${record.prompt ? '<button type="button" data-action="copy" class="ctf-primary ctf-copy">Copy Coding Prompt</button>' : ""}
        <button type="button" data-action="save">Save Screenshot</button>
        <button type="button" data-action="recapture">Recapture</button>
        <button type="button" data-action="remove" class="ctf-danger">Remove</button>
        <button type="button" data-action="close">Close</button>
      </div>
      <p class="ctf-status" role="status"></p>
      <p class="ctf-privacy">Only the selected element details, your note, and the marked screenshot are included. Nothing is uploaded.</p>`;
  }

  function renderRecord(index) {
    if (!overlay || !records[index]) {
      return;
    }
    activeRecord = index;
    const record = records[index];
    overlay.notePanel.innerHTML = `<header class="ctf-panel-header"><div><span class="ctf-eyebrow">${escapeHtml(record.drawing.type.toUpperCase())} ANNOTATION</span><h2>What needs to be fixed?</h2></div><button type="button" data-action="close" class="ctf-close" aria-label="Close details">x</button></header>${detailsMarkup(record)}`;
    overlay.notePanel.classList.add("is-open");
    overlay.notePanel.addEventListener("click", handlePanelClick);
  }

  function handlePanelClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || activeRecord < 0) {
      return;
    }
    const action = button.dataset.action;
    const record = records[activeRecord];
    if (!record) {
      return;
    }
    if (action === "close") {
      overlay.notePanel.classList.remove("is-open");
      return;
    }
    if (action === "generate") {
      record.note = overlay.notePanel.querySelector("#ctf-note").value.trim();
      record.prompt = api.generatePrompt(record);
      renderRecord(activeRecord);
      announce("Prompt generated. You can edit it before copying.");
      return;
    }
    if (action === "copy") {
      const prompt = overlay.notePanel.querySelector("#ctf-prompt").value;
      record.prompt = prompt;
      copyText(prompt).then(() => announce("Coding prompt copied. Attach the saved PNG separately."))
        .catch((error) => announce(`Could not copy prompt: ${error.message}`, true));
      return;
    }
    if (action === "save") {
      saveScreenshot(record);
      return;
    }
    if (action === "recapture") {
      captureForRecord(activeRecord);
      return;
    }
    if (action === "remove") {
      records.splice(activeRecord, 1);
      overlay.state.drawings.splice(activeRecord, 1);
      overlay.render();
      activeRecord = -1;
      overlay.notePanel.classList.remove("is-open");
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) {
        throw error;
      }
    }
  }

  function saveScreenshot(record) {
    if (!record.screenshot) {
      announce("Capture a screenshot before saving it.", true);
      return;
    }
    chrome.runtime.sendMessage({
      type: "CTF_DOWNLOAD",
      dataUrl: record.screenshot,
      filename: record.filename
    }, (response) => {
      if (chrome.runtime.lastError) {
        announce(`Download failed: ${chrome.runtime.lastError.message}`, true);
      } else if (!response?.ok) {
        announce(`Download failed: ${response?.error || "Unknown error"}`, true);
      } else {
        announce("Screenshot save started. Attach the downloaded PNG to your coding agent.");
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function handleOverlayAction(action) {
    if (action.type === "exit") {
      deactivate();
    } else if (action.type === "clear") {
      records.splice(0, records.length);
      activeRecord = -1;
      overlay.notePanel.classList.remove("is-open");
    } else if (action.type === "undo") {
      records.pop();
      activeRecord = -1;
      overlay.notePanel.classList.remove("is-open");
    } else if (action.type === "open-record") {
      renderRecord(action.index);
    } else if (action.type === "annotation-created") {
      identifyAnnotation(action.drawing, action.index);
    }
  }

  async function identifyAnnotation(drawing, index) {
    if (!overlay) {
      return;
    }
    const host = overlay.host;
    host.style.visibility = "hidden";
    const element = api.inspectElement(drawing.center.x, drawing.center.y);
    host.style.visibility = "";
    const record = {
      drawing,
      element,
      note: "",
      prompt: "",
      screenshot: "",
      url: safePageUrl(),
      filename: makeFilename(index)
    };
    records[index] = record;
    renderRecord(index);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await captureForRecord(index);
  }

  function onKeydown(event) {
    if (event.key === "Escape" && overlay) {
      event.preventDefault();
      deactivate();
    }
  }

  function activate() {
    if (overlay) {
      return;
    }
    if (!api.createOverlay || !api.inspectElement || !api.generatePrompt) {
      console.error("Circle to Fix could not initialize. Reload the page and try again.");
      return;
    }
    overlay = api.createOverlay(handleOverlayAction);
    document.addEventListener("keydown", onKeydown, true);
    overlay.notePanel.addEventListener("click", handlePanelClick);
  }

  function deactivate() {
    if (!overlay) {
      return;
    }
    document.removeEventListener("keydown", onKeydown, true);
    overlay.destroy();
    overlay = null;
    records.splice(0, records.length);
    activeRecord = -1;
  }

  window.__circleToFixApp = { activate, deactivate };
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CTF_START") {
      activate();
    }
  });
  activate();
})();
