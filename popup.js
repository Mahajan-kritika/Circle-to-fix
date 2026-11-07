const activateButton = document.querySelector("#activate");
const statusElement = document.querySelector("#status");

activateButton.addEventListener("click", () => {
  activateButton.disabled = true;
  statusElement.textContent = "Starting drawing mode...";
  statusElement.classList.remove("is-error");

  chrome.runtime.sendMessage({ type: "CTF_START" }, (response) => {
    activateButton.disabled = false;
    if (chrome.runtime.lastError) {
      statusElement.textContent = `Could not start: ${chrome.runtime.lastError.message}`;
      statusElement.classList.add("is-error");
    } else if (!response?.ok) {
      statusElement.textContent = response?.error || "Could not start drawing mode.";
      statusElement.classList.add("is-error");
    } else {
      statusElement.textContent = "Drawing mode is active on this page.";
    }
  });
});
