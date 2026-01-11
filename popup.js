// Popup = UI layer

// "brain" of the popup UI
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function init() {
  const urlInput = document.getElementById("url");
  const statusEl = document.getElementById("status");

  const tab = await getActiveTab();
  urlInput.value = tab.url;

  statusEl.textContent = "URL loaded!!!";
}

init();
