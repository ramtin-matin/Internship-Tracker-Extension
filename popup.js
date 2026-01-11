// Popup = UI layer

// "brain" of the popup UI

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function extractJobInfoFromPage() {
  const url = window.location.href;
  const { hostname, pathname } = window.location;

  // ROLE
  const h1 = document.querySelector("h1");
  const roleFromH1 = h1 ? h1.innerText.trim() : "";
  const role = roleFromH1 || document.title.trim();

  // COMPANY
  let company = "";

  // split URL into pieces and grab company name
  const firstPathSegment = pathname.split("/").filter(Boolean)[0] || "";

  // Lever: jobs.lever.co/<company>/<jobId>
  if (hostname.includes("jobs.lever.co")) {
    company = firstPathSegment;
  }

  // Greenhouse: boards.greenhouse.io/<company>/jobs/<id>
  else if (hostname.includes("boards.greenhouse.io")) {
    company = firstPathSegment;
  }

  // Ahsby: jobs.ashbyhq.com/<company>/<jobId>
  else if (hostname.includes("jobs.ashbyhq.com")) {
    company = firstPathSegment;
  }

  // Fallback: derive from hostname (careers.google.com -> google)
  else {
    const pieces = hostname.split(".").filter(Boolean);

    // remove common subdomains
    const blacklist = new Set([
      "www",
      "jobs",
      "careers",
      "job",
      "apply",
      "boards",
    ]);
    const filtered = pieces.filter((p) => !blacklist.has(p.toLowerCase()));

    // take first meaningful segment
    company = filtered[0] || pieces[0] || "";
  }

  // Make company look nicer (capitalize first letter)
  company = company ? company[0].toUpperCase() + company.slice(1) : "";

  return { role, company, url };
}

async function init() {
  const companyInput = document.getElementById("company");
  const roleInput = document.getElementById("role");
  const urlInput = document.getElementById("url");
  const statusEl = document.getElementById("status");

  const tab = await getActiveTab();
  urlInput.value = tab.url;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractJobInfoFromPage,
  });

  const info = results?.[0]?.result || {};

  companyInput.value = info.company || "";
  roleInput.value = info.role || "";
  urlInput.value = info.url || tab.url;

  statusEl.textContent = "Company + Role + URL loaded ";
}

init();
