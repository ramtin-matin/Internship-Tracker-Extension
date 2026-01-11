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
    cleanTSVField(dateAdded),
    cleanTSVField(location),
    cleanTSVField(url),
    cleanTSVField(status),
  ];
  return cols.join("\t");
}

function renderHistory(internships) {
  const historyEl = document.getElementById("history");

  const entries = Object.values(internships);

  const getDate = (e) => e.dateAdded || "0000-00-00";

  // sort oldest to newest and then reverse so newest is on top
  entries.sort((a, b) => getDate(b).localeCompare(getDate(a)));
  entries.reverse();

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

async function deleteInternship(url) {
  const all = await getAllInternships();
  delete all[url];

  await chrome.storage.local.set({
    [STORAGE_KEY]: all,
  });

  return all;
}

async function copyAllTsv() {
  const all = (await chrome.storage.local.get([STORAGE_KEY]))
    ? result[STORAGE_KEY]
    : {};

  const tsvRow = buildTSVRow(all);
  await navigator.clipboard.writeText(tsvRow);

  els.msg.textContent = "copied ✅";
}

function buildAllTSV(entries) {
  return entries.map(buildTSVRow).join("\n\n");
}

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

function buildEntryFromInputs(els) {
  return {
    company: els.company.value,
    role: els.role.value,
    location: els.location.value,
    url: els.url.value,
    dateAdded: els.date.value || getTodayYYYYMMDD(),
    status: els.status.value,
  };
}

async function refreshHistory() {
  const all = await getAllInternships();
  renderHistory(all);
  console.log("internships storage:", all);
}

async function init() {
  const els = getEls();

  await autofillFromPage(els);
  await refreshHistory();

  els.msg.textContent = "Company + Role + Application Date + URL loaded";

  const historyEl = document.getElementById("history");

  historyEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const url = btn.dataset.url;

    const all = await deleteInternship(url);
    renderHistory(all);

    els.msg.textContent = "Deleted ✅";
  });

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
