// Popup = UI layer

// "brain" of the popup UI

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function extractRoleFromPage() {
  const h1 = document.querySelector("h1"); // many job pages keep job title in an <h1>
  const roleFromH1 = h1 ? h1.innerText.trim() : "";
  return roleFromH1 || document.title.trim();
}

async function init() {
  const roleInput = document.getElementById("role");
  const urlInput = document.getElementById("url");
  const statusEl = document.getElementById("status");

  const tab = await getActiveTab();
  urlInput.value = tab.url;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractRoleFromPage,
  });

  roleInput.value = results?.[0]?.result || ""; // use empty string if no results
  statusEl.textContent = "URL loaded.";
}

init();
