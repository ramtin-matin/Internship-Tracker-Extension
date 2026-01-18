// ==============================
// storage (chrome.storage.local)
// ==============================

const STORAGE_KEY = "internships";

async function getAllInternships() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return result[STORAGE_KEY] || {};
}

async function saveInternship(entry) {
  const all = await getAllInternships();

  const url = entry.url;
  if (!url) throw new Error("Missing entry.url");

  const duplicate = Boolean(all[url]);
  if (duplicate) return { saved: false, duplicate: true };

  entry.createdAt = Date.now(); // set once only
  all[url] = entry;

  await chrome.storage.local.set({ [STORAGE_KEY]: all });

  return { saved: true, duplicate: false };
}

async function deleteInternship(url) {
  const all = await getAllInternships();
  delete all[url];

  await chrome.storage.local.set({ [STORAGE_KEY]: all });

  return all;
}

// update internship fields
async function updateInternship(url, patch) {
  const all = await getAllInternships();
  if (!all[url]) return false;

  all[url] = { ...all[url], ...patch };

  await chrome.storage.local.set({ [STORAGE_KEY]: all });
  return true;
}

// ==============================
// chrome helpers
// ==============================

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// ==============================
// extraction (runs in job page)
// ==============================

function extractJobInfoFromPage() {
  const url = window.location.href;
  const { hostname, pathname } = window.location;

  // ROLE
  const h1 = document.querySelector("h1");
  const roleFromH1 = h1 ? h1.innerText.trim() : "";
  const role = roleFromH1 || document.title.trim();

  // COMPANY
  let company = "";
  const firstPathSegment = pathname.split("/").filter(Boolean)[0] || "";

  if (hostname.includes("jobs.lever.co")) company = firstPathSegment;
  else if (hostname.includes("boards.greenhouse.io"))
    company = firstPathSegment;
  else if (hostname.includes("jobs.ashbyhq.com")) company = firstPathSegment;
  else {
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

  company = company ? company[0].toUpperCase() + company.slice(1) : "";

  return { role, company, url };
}

// ==============================
// utils
// ==============================

function getTodayYYYYMMDD() {
  return new Date().toISOString().split("T")[0];
}

function cleanTSVField(value) {
  return String(value || "")
    .replace(/\t/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

function normalizeUrl(url) {
  if (!url) return "";

  url = url.split("#")[0];

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

function buildAllTSV(entries) {
  return entries.map(buildTSVRow).join("\n");
}

// ==============================
// rendering
// ==============================

function sortNewestFirst(entries) {
  const key = (e) => e.createdAt || 0;
  return entries.sort((a, b) => key(b) - key(a));
}

function renderHistory(internships) {
  const historyEl = document.getElementById("history");
  if (!historyEl) return;

  const entries = sortNewestFirst(Object.values(internships));
  const lastFive = entries.slice(0, 5);

  if (lastFive.length === 0) {
    historyEl.innerHTML = `<p class="muted">No saved internships yet.</p>`;
    return;
  }

  historyEl.innerHTML = lastFive
    .map(
      (e) => `
      <div class="history-item">
        <div class="history-content edit-card" data-url="${e.url}">
          <div class="history-company">${e.company}</div>
          <div class="history-role">${e.role}</div>
        </div>
        <button class="delete-btn" data-url="${e.url}">Delete</button>
      </div>
    `,
    )
    .join("");
}

function renderAll(internships, searchTerm = "") {
  const manageList = document.getElementById("manageList");
  if (!manageList) return;

  let entries = sortNewestFirst(Object.values(internships));

  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    entries = entries.filter((e) => {
      const blob =
        `${e.company} ${e.role} ${e.location} ${e.status} ${e.url}`.toLowerCase();
      return blob.includes(q);
    });
  }

  if (entries.length === 0) {
    manageList.innerHTML = `<p class="muted">No matching internships.</p>`;
    return;
  }

  manageList.innerHTML = entries
    .map(
      (e) => `
      <div class="history-item">
        <div class="history-content edit-card" data-url="${e.url}">
          <div class="history-company">${e.company}</div>
          <div class="history-role">${e.role}</div>
        </div>
        <button class="delete-btn" data-url="${e.url}">Delete</button>
      </div>
    `,
    )
    .join("");
}

function renderEditScreen(entry) {
  const renderEdit = document.getElementById("render-edit");
  if (!renderEdit) return;

  const statuses = [
    "Applied",
    "Under Consideration",
    "Rejected",
    "Interviewing",
    "Offer",
  ];

  renderEdit.innerHTML = `
    <label class="label">Company</label>
    <input id="editCompany" class="input" type="text" value="${entry.company || ""}" />

    <label class="label">Role</label>
    <input id="editRole" class="input" type="text" value="${entry.role || ""}" />

    <label class="label">Location</label>
    <input id="editLocation" class="input" type="text" value="${entry.location || ""}" />

    <label class="label">Status</label>
    <select id="editStatus" class="input">
      ${statuses
        .map(
          (s) =>
            `<option value="${s}" ${entry.status === s ? "selected" : ""}>${s}</option>`,
        )
        .join("")}
    </select>

    <label class="label">Application Date</label>
    <input id="editDate" class="input" type="date" value="${entry.dateAdded || ""}" />

    <label class="label">URL</label>
    <input id="editUrl" class="input" type="text" value="${entry.url || ""}" disabled />
  `;
}

// ==============================
// ui flow
// ==============================

function showView(id) {
  const ids = ["view-main", "view-manage", "view-edit"];
  for (const vid of ids) {
    const el = document.getElementById(vid);
    if (el) el.style.display = "none";
  }

  const active = document.getElementById(id);
  if (active) active.style.display = "block";
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
    copyTsvBtn: document.getElementById("copyTsvBtn"),

    msg: document.getElementById("msg"),

    manageBtn: document.getElementById("manageBtn"),
    backToMainBtn: document.getElementById("backToMainBtn"),
    backToManageBtn: document.getElementById("backToManageBtn"),
    saveEditBtn: document.getElementById("saveEditBtn"),
    searchManage: document.getElementById("searchManage"),
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
    company: els.company.value.trim(),
    role: els.role.value.trim(),
    location: els.location.value.trim(),
    url: normalizeUrl(els.url.value.trim()),
    dateAdded: (els.date.value || getTodayYYYYMMDD()).trim(),
    status: els.status.value.trim(),
  };
}

async function refreshAllUi(searchTerm = "") {
  const all = await getAllInternships();
  renderHistory(all);
  renderAll(all, searchTerm);
}

// ==============================
// disable buttons until valid
// ==============================

function setButtonEnabled(btn, enabled) {
  if (!btn) return;
  btn.disabled = !enabled;
}

async function updateSaveButtonState(els) {
  const company = els.company?.value.trim();
  const role = els.role?.value.trim();
  const url = normalizeUrl(els.url?.value.trim());

  const hasRequired = Boolean(company && role && url);

  if (!hasRequired) {
    setButtonEnabled(els.saveBtn, false);
    return;
  }

  // disable if already saved
  const all = await getAllInternships();
  const duplicate = Boolean(all[url]);

  setButtonEnabled(els.saveBtn, !duplicate);
}

function computeEditPatchFromDom() {
  return {
    company: document.getElementById("editCompany")?.value.trim() || "",
    role: document.getElementById("editRole")?.value.trim() || "",
    location: document.getElementById("editLocation")?.value.trim() || "",
    status: document.getElementById("editStatus")?.value.trim() || "",
    dateAdded: document.getElementById("editDate")?.value.trim() || "",
  };
}

function isPatchDifferentFromEntry(entry, patch) {
  return (
    (entry.company || "") !== patch.company ||
    (entry.role || "") !== patch.role ||
    (entry.location || "") !== patch.location ||
    (entry.status || "") !== patch.status ||
    (entry.dateAdded || "") !== patch.dateAdded
  );
}

function wireEditDisableUntilChange(entry, els) {
  // start disabled
  setButtonEnabled(els.saveEditBtn, false);

  const handler = () => {
    const patch = computeEditPatchFromDom();
    const changed = isPatchDifferentFromEntry(entry, patch);
    setButtonEnabled(els.saveEditBtn, changed);
  };

  ["editCompany", "editRole", "editLocation", "editStatus", "editDate"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    },
  );

  // initial check
  handler();
}

// ==============================
// init
// ==============================

async function init() {
  const els = getEls();
  let selectedUrl = null;

  await autofillFromPage(els);
  await refreshAllUi();

  if (els.msg)
    els.msg.textContent = "Company + Role + Application Date + URL loaded";

  // disable save until valid
  setButtonEnabled(els.saveBtn, false);
  await updateSaveButtonState(els);

  // re-check save button state on input
  [els.company, els.role, els.url].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", async () => {
      await updateSaveButtonState(els);
    });
  });

  // navigate views
  els.manageBtn?.addEventListener("click", () => showView("view-manage"));
  els.backToMainBtn?.addEventListener("click", () => showView("view-main"));
  els.backToManageBtn?.addEventListener("click", () => showView("view-manage"));

  // search filter manage view
  els.searchManage?.addEventListener("input", async () => {
    await refreshAllUi(els.searchManage.value);
  });

  // last 5 list: delete + edit handler
  const historyEl = document.getElementById("history");
  historyEl?.addEventListener("click", async (e) => {
    // delete
    const deleteBtn = e.target.closest(".delete-btn");
    if (deleteBtn) {
      const url = deleteBtn.dataset.url;
      await deleteInternship(url);

      await refreshAllUi(els.searchManage?.value || "");
      await updateSaveButtonState(els);

      if (els.msg) els.msg.textContent = "Deleted ✅";
      return;
    }

    // edit
    const card = e.target.closest(".edit-card");
    if (!card) return;

    selectedUrl = card.dataset.url;

    const all = await getAllInternships();
    const entry = all[selectedUrl];
    if (!entry) return;

    renderEditScreen(entry);
    showView("view-edit");

    // disable save changes until something changes
    wireEditDisableUntilChange(entry, els);
  });

  // manage list: delete + edit click
  const manageList = document.getElementById("manageList");
  manageList?.addEventListener("click", async (e) => {
    // delete
    const deleteBtn = e.target.closest(".delete-btn");
    if (deleteBtn) {
      const url = deleteBtn.dataset.url;
      await deleteInternship(url);

      await refreshAllUi(els.searchManage?.value || "");
      await updateSaveButtonState(els);

      if (els.msg) els.msg.textContent = "Deleted ✅";
      return;
    }

    // edit
    const card = e.target.closest(".edit-card");
    if (!card) return;

    selectedUrl = card.dataset.url;

    const all = await getAllInternships();
    const entry = all[selectedUrl];
    if (!entry) return;

    renderEditScreen(entry);
    showView("view-edit");

    // disable save changes until something changes
    wireEditDisableUntilChange(entry, els);
  });

  // save edit
  els.saveEditBtn?.addEventListener("click", async () => {
    if (!selectedUrl) return;

    const patch = computeEditPatchFromDom();

    await updateInternship(selectedUrl, patch);

    await refreshAllUi(els.searchManage?.value || "");
    await updateSaveButtonState(els);

    if (els.msg) els.msg.textContent = "Updated ✅";

    showView("view-manage");
  });

  // copy all TSV
  els.copyTsvBtn?.addEventListener("click", async () => {
    const all = await getAllInternships();
    const entries = sortNewestFirst(Object.values(all));

    if (entries.length === 0) {
      if (els.msg) els.msg.textContent = "No internships saved yet.";
      return;
    }

    const allTsv = buildAllTSV(entries);
    await navigator.clipboard.writeText(allTsv);

    if (els.msg) els.msg.textContent = `Copied ${entries.length} rows ✅`;
  });

  // save + copy single
  els.saveBtn?.addEventListener("click", async () => {
    const entry = buildEntryFromInputs(els);

    if (!entry.company || !entry.role || !entry.url) {
      if (els.msg) els.msg.textContent = "Missing Company, Role, or URL.";
      return;
    }

    const saveResult = await saveInternship(entry);

    const tsvRow = buildTSVRow(entry);
    await navigator.clipboard.writeText(tsvRow);

    await refreshAllUi(els.searchManage?.value || "");
    await updateSaveButtonState(els);

    if (els.msg) {
      els.msg.textContent = saveResult.duplicate
        ? "Already saved — copied again ✅"
        : "Saved and copied ✅";
    }
  });
}

init();
