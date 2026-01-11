// Popup = UI layer

// "brain" of the popup UI

const STORAGE_KEY = "internships";

async function getAllInternships() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || {};
}

async function isDuplicate(url) {
  const all = await getAllInternships();
  return Boolean(all[url]);
}

async function saveInternship(entry) {
  const all = await getAllInternships();

  const url = entry.url;
  if (!url) throw new Error("Missing entry.url");

  const duplicate = Boolean(all[url]);
  if (duplicate) {
    return { saved: false, duplicate: true };
  }

  all[url] = entry;

  await chrome.storage.local.set({
    [STORAGE_KEY]: all,
  });

  return { saved: true, duplicate: false };
}

async function debugPrintStorage() {
  const all = await getAllInternships();
  console.log("internships storage:", all);
}

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

  // make company look nicer (capitalize first letter)
  company = company ? company[0].toUpperCase() + company.slice(1) : "";

  return { role, company, url };
}

// application date
function getTodayYYYYMMDD() {
  return new Date().toISOString().split("T")[0];
}

// clean up value for TSV
function cleanTSVField(value) {
  return String(value || "")
    .replace(/\t/g, " ") // remove tabs
    .replace(/\n/g, " ") // remove newlines
    .trim();
}

// build TSV row using all values
function buildTSVRow({ company, role, location, url, dateAdded, status }) {
  const cols = [
    cleanTSVField(company),
    cleanTSVField(role),
    cleanTSVField(location),
    cleanTSVField(url),
    cleanTSVField(dateAdded),
    cleanTSVField(status),
  ];
  return cols.join("\t");
}

async function init() {
  const companyInput = document.getElementById("company");
  const roleInput = document.getElementById("role");
  const dateInput = document.getElementById("date");
  const statusSelect = document.getElementById("statusSelect");
  const saveCopyBtn = document.getElementById("saveCopyBtn");
  const locationInput = document.getElementById("location");
  const urlInput = document.getElementById("url");
  const msg = document.getElementById("msg");

  const tab = await getActiveTab();
  urlInput.value = tab.url;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractJobInfoFromPage,
  });

  const info = results?.[0]?.result || {};

  companyInput.value = info.company || "";
  roleInput.value = info.role || "";
  dateInput.value = getTodayYYYYMMDD();
  // statusSelect.value = info.date || "";
  urlInput.value = info.url || tab.url;

  msg.textContent = "Company + Role + Application Date + URL loaded ";

  saveCopyBtn.addEventListener("click", async () => {
    const entry = {
      company: companyInput.value,
      role: roleInput.value,
      location: locationInput.value,
      url: urlInput.value,
      dateAdded: dateInput.value || getTodayYYYYMMDD(),
      status: statusSelect.value,
    };

    // basic validation
    if (!entry.company || !entry.role || !entry.url) {
      msg.textContent = "Missing Company, Role, or URL.";
      return;
    }

    const saveResult = await saveInternship(entry);
    const tsvRow = buildTSVRow(entry);
    await navigator.clipboard.writeText(tsvRow);
    await debugPrintStorage();

    msg.textContent = saveResult.duplicate
      ? "Already saved — copied again ✅"
      : "Saved ✅ Copied ✅";
  });
}

init();
