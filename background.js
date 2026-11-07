const CONTENT_FILES = [
  "element-inspector.js",
  "prompt-generator.js",
  "overlay.js",
  "content.js"
];

const RESTRICTED_URLS = /^(chrome|edge|about|devtools|view-source):/i;

function getCompatibilityError(url) {
  if (!url || RESTRICTED_URLS.test(url) || /chromewebstore\.google\.com|chrome\.google\.com\/webstore/i.test(url)) {
    return "Circle to Fix cannot run on this browser page. Open a regular website and try again.";
  }
  return null;
}

async function activateTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active browser tab was found.");
  }

  const compatibilityError = getCompatibilityError(tab.url);
  if (compatibilityError) {
    throw new Error(compatibilityError);
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: CONTENT_FILES
  });
  await chrome.tabs.sendMessage(tab.id, { type: "CTF_START" });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "activate-drawing") {
    return;
  }
  try {
    await activateTab(await getActiveTab());
  } catch (error) {
    console.warn("Circle to Fix could not activate:", error.message);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CTF_START") {
    (async () => {
      try {
        await activateTab(await getActiveTab());
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message?.type === "CTF_CAPTURE") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || typeof tab.windowId !== "number") {
          throw new Error("No active tab is available for screenshot capture.");
        }
        const compatibilityError = getCompatibilityError(tab.url);
        if (compatibilityError) {
          throw new Error(compatibilityError);
        }
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
        sendResponse({ ok: true, dataUrl });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message?.type === "CTF_DOWNLOAD") {
    (async () => {
      try {
        if (typeof message.dataUrl !== "string" || !message.dataUrl.startsWith("data:image/png;base64,")) {
          throw new Error("The screenshot data is invalid.");
        }
        const filename = String(message.filename || "circle-to-fix.png")
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
          .slice(0, 120);
        const downloadId = await chrome.downloads.download({
          url: message.dataUrl,
          filename: `Circle to Fix/${filename}`,
          saveAs: true
        });
        sendResponse({ ok: true, downloadId });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  return false;
});
