// ==============================
// storage (chrome.storage.local)
// ==============================

const STORAGE_KEY = "internships";

// get saved internships dictionary (keyed by url)
async function getAllInternships() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || {};
}

// save a new internship (dedupe by url)
async function saveInternship(entry) {
  const all = await getAllInternships();

  const url = entry.url;
  if (!url) throw new Error("Missing entry.url");

  const duplicate = Boolean(all[url]);
  if (duplicate) return { saved: false, duplicate: true };

  all[url] = entry;

  await chrome.storage.local.set({
    [STORAGE_KEY]: all,
  });

  return { saved: true, duplicate: false };
}

// delete internship by url
async function deleteInternship(url) {
  const all = await getAllInternships();
  delete all[url];

  await chrome.storage.local.set({
    [STORAGE_KEY]: all,
  });

  return all;
}

// ==============================
// chrome helpers
// ==============================

// get the currently active browser tab
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// ==============================
// extraction (runs in job page)
// ==============================

// extract role + company from job posting page
function extractJobInfoFromPage() {
  const url = window.location.href;
  const { hostname, pathname } = window.location;

  // role: prefer h1, fallback to page title
  const h1 = document.querySelector("h1");
  const roleFromH1 = h1 ? h1.innerText.trim() : "";
  const role = roleFromH1 || document.title.trim();

  // company: detect common job boards by url pattern
  let company = "";
  const firstPathSegment = pathname.split("/").filter(Boolean)[0] || "";

  if (hostname.includes("jobs.lever.co")) company = firstPathSegment;
  else if (hostname.includes("boards.greenhouse.io"))
    company = firstPathSegment;
  else if (hostname.includes("jobs.ashbyhq.com")) company = firstPathSegment;
  else {
    // fallback: derive company name from hostname
    const pieces = hostname.split(".").filter(Boolean);

    const blacklist = new Set([
      "www",
      "jobs",
      "careers",
      "job",
      "apply",
      "boards",
    ]);
    const filtered = pieces.filter((p) => !blacklist.has(p.toLowerCase()));

    company = filtered[0] || pieces[0] || "";
  }

  // basic formatting
  company = company ? company[0].toUpperCase() + company.slice(1) : "";

  return { role, company, url };
}

// ==============================
// utils (formatting / exporting)
// ==============================

// current date in yyyy-mm-dd
function getTodayYYYYMMDD() {
  return new Date().toISOString().split("T")[0];
}

// make a value safe for tsv (no tabs/newlines)
function cleanTSVField(value) {
  return String(value || "")
    .replace(/\t/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

// remove tracking bits from url to improve duplicate detection
function normalizeUrl(url) {
  if (!url) return "";

  // remove hash (#something)
  url = url.split("#")[0];

  // remove utm_* tracking params
  const [base, query] = url.split("?");
  if (!query) return base;

  const keptParams = query
    .split("&")
    .filter((p) => !p.toLowerCase().startsWith("utm_"));

  return keptParams.length ? `${base}?${keptParams.join("&")}` : base;
}

// build one spreadsheet-ready tsv row
function buildTSVRow({ company, role, location, url, dateAdded, status }) {
  const cols = [
    cleanTSVField(company),
    cleanTSVField(role),
    cleanTSVField(dateAdded),
    cleanTSVField(location),
    cleanTSVField(url),
    cleanTSVField(status),
  ];
  return cols.join("\t");
}

// build multiline tsv (one row per line)
function buildAllTSV(entries) {
  return entries.map(buildTSVRow).join("\n");
}

// ==============================
// popup ui helpers
// ==============================

// grab popup elements once
function getEls() {
  return {
    company: document.getElementById("company"),
    role: document.getElementById("role"),
    location: document.getElementById("location"),
    date: document.getElementById("date"),
    status: document.getElementById("statusSelect"),
    url: document.getElementById("url"),
    saveBtn: document.getElementById("saveCopyBtn"),
    msg: document.getElementById("msg"),
    copyTsvBtn: document.getElementById("copyTsvBtn"),
  };
}

// render last 5 saved internships in the popup
function renderHistory(internships) {
  const historyEl = document.getElementById("history");

  const entries = Object.values(internships);

  const getDate = (e) => e.dateAdded || "0000-00-00";

  // sort newest first
  entries.sort((a, b) => getDate(b).localeCompare(getDate(a)));

  const lastFive = entries.slice(0, 5);

  if (lastFive.length === 0) {
    historyEl.innerHTML = `<p class="muted">No saved internships yet.</p>`;
    return;
  }

  historyEl.innerHTML = lastFive
    .map((e) => {
      return `
        <div class="history-item">
          <div>
            <div class="history-company">${e.company}</div>
            <div class="history-role">${e.role}</div>
          </div>
          <button class="delete-btn" data-url="${e.url}">Delete</button>
        </div>
      `;
    })
    .join("");
}

// autofill company/role/url from the active tab
async function autofillFromPage(els) {
  const tab = await getActiveTab();
  els.url.value = tab.url;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractJobInfoFromPage,
  });

  const info = results?.[0]?.result || {};

  els.company.value = info.company || "";
  els.role.value = info.role || "";
  els.date.value = getTodayYYYYMMDD();
  els.url.value = info.url || tab.url;
}

// read inputs and build entry object
function buildEntryFromInputs(els) {
  return {
    company: els.company.value.trim(),
    role: els.role.value.trim(),
    location: els.location.value.trim(),
    url: normalizeUrl(els.url.value.trim()),
    dateAdded: (els.date.value || getTodayYYYYMMDD()).trim(),
    status: els.status.value.trim(),
  };
}

// refresh popup history ui
async function refreshHistory() {
  const all = await getAllInternships();
  renderHistory(all);
}

// ==============================
// init + event handlers
// ==============================

async function init() {
  const els = getEls();

  await autofillFromPage(els);
  await refreshHistory();

  els.msg.textContent = "Company + Role + Application Date + URL loaded";

  const historyEl = document.getElementById("history");

  // delete button handler (event delegation)
  historyEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const url = btn.dataset.url;

    const all = await deleteInternship(url);
    renderHistory(all);

    els.msg.textContent = "Deleted ✅";
  });

  // copy all tsv handler
  els.copyTsvBtn.addEventListener("click", async () => {
    const all = await getAllInternships();
    const entries = Object.values(all);

    if (entries.length === 0) {
      els.msg.textContent = "No internships saved yet.";
      return;
    }

    // sort newest first
    const getDate = (e) => e.dateAdded || "0000-00-00";
    entries.sort((a, b) => getDate(b).localeCompare(getDate(a)));

    const allTsv = buildAllTSV(entries);
    await navigator.clipboard.writeText(allTsv);

    els.msg.textContent = `Copied ${entries.length} rows ✅`;
  });

  // save + copy handler
  els.saveBtn.addEventListener("click", async () => {
    const entry = buildEntryFromInputs(els);

    if (!entry.company || !entry.role || !entry.url) {
      els.msg.textContent = "Missing Company, Role, or URL.";
      return;
    }

    const saveResult = await saveInternship(entry);

    const tsvRow = buildTSVRow(entry);
    await navigator.clipboard.writeText(tsvRow);

    await refreshHistory();

    els.msg.textContent = saveResult.duplicate
      ? "Already saved — copied again ✅"
      : "Saved and copied ✅";
  });
}

init();
