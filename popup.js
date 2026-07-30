const STORAGE_KEY = "headerRules";
const MASTER_SWITCH_KEY = "masterEnabled";

const ruleListEl = document.getElementById("ruleList");
const ruleTemplate = document.getElementById("ruleTemplate");
const addRuleBtn = document.getElementById("addRuleBtn");
const masterSwitch = document.getElementById("masterSwitch");
const errorBanner = document.getElementById("errorBanner");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

let rules = [];
let saveTimer = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultRule() {
  return {
    id: uid(),
    enabled: true,
    type: "request",
    action: "set",
    headerName: "",
    headerValue: "",
    urlFilter: ""
  };
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    // 通知 background 立即同步（storage.onChanged 也会触发，这里是兜底）
    chrome.runtime.sendMessage({ type: "REQUEST_SYNC" }, () => {
      if (chrome.runtime.lastError) { /* 忽略，service worker 可能刚好在处理 */ }
    });
  }, 200);
}

function renderRules() {
  ruleListEl.innerHTML = "";

  if (rules.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = "还没有规则，点击下方“添加规则”开始";
    ruleListEl.appendChild(hint);
    return;
  }

  rules.forEach((rule) => {
    const node = ruleTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = rule.id;
    if (!rule.enabled) node.classList.add("disabled");

    const enabledEl = node.querySelector(".rule-enabled");
    const typeEl = node.querySelector(".rule-type");
    const actionEl = node.querySelector(".rule-action");
    const nameEl = node.querySelector(".rule-name");
    const valueEl = node.querySelector(".rule-value");
    const valueRow = node.querySelector(".value-row");
    const urlFilterEl = node.querySelector(".rule-urlfilter");
    const deleteBtn = node.querySelector(".delete-btn");

    enabledEl.checked = rule.enabled;
    typeEl.value = rule.type;
    actionEl.value = rule.action;
    nameEl.value = rule.headerName;
    valueEl.value = rule.headerValue;
    urlFilterEl.value = rule.urlFilter;
    valueRow.style.display = rule.action === "remove" ? "none" : "flex";

    enabledEl.addEventListener("change", () => {
      rule.enabled = enabledEl.checked;
      node.classList.toggle("disabled", !rule.enabled);
      scheduleSave();
    });
    typeEl.addEventListener("change", () => { rule.type = typeEl.value; scheduleSave(); });
    actionEl.addEventListener("change", () => {
      rule.action = actionEl.value;
      valueRow.style.display = rule.action === "remove" ? "none" : "flex";
      scheduleSave();
    });
    nameEl.addEventListener("input", () => { rule.headerName = nameEl.value; scheduleSave(); });
    valueEl.addEventListener("input", () => { rule.headerValue = valueEl.value; scheduleSave(); });
    urlFilterEl.addEventListener("input", () => { rule.urlFilter = urlFilterEl.value; scheduleSave(); });
    deleteBtn.addEventListener("click", () => {
      rules = rules.filter(r => r.id !== rule.id);
      renderRules();
      scheduleSave();
    });

    ruleListEl.appendChild(node);
  });
}

async function loadState() {
  const data = await chrome.storage.local.get([STORAGE_KEY, MASTER_SWITCH_KEY, "lastSyncError"]);
  rules = data[STORAGE_KEY] || [];
  masterSwitch.checked = data[MASTER_SWITCH_KEY] !== false;
  if (data.lastSyncError) {
    errorBanner.hidden = false;
    errorBanner.textContent = "同步规则时出错: " + data.lastSyncError;
  } else {
    errorBanner.hidden = true;
  }
  renderRules();
}

addRuleBtn.addEventListener("click", () => {
  rules.push(defaultRule());
  renderRules();
  scheduleSave();
});

masterSwitch.addEventListener("change", async () => {
  await chrome.storage.local.set({ [MASTER_SWITCH_KEY]: masterSwitch.checked });
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads
    ? chrome.downloads.download({ url, filename: "headerpilot-rules.json" })
    : (() => {
        const a = document.createElement("a");
        a.href = url; a.download = "headerpilot-rules.json"; a.click();
      })();
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("文件格式不正确");
    // 简单校验并补全字段，同时生成新 id 避免冲突
    rules = imported.map(r => ({
      id: uid(),
      enabled: r.enabled !== false,
      type: r.type === "response" ? "response" : "request",
      action: ["set", "append", "remove"].includes(r.action) ? r.action : "set",
      headerName: r.headerName || "",
      headerValue: r.headerValue || "",
      urlFilter: r.urlFilter || ""
    }));
    renderRules();
    scheduleSave();
  } catch (e) {
    errorBanner.hidden = false;
    errorBanner.textContent = "导入失败: " + e.message;
  } finally {
    importFile.value = "";
  }
});

loadState();

// ==================== Tab 切换 ====================

const tabBtns = document.querySelectorAll(".tab-btn");
const panels = {
  header: document.getElementById("panel-header"),
  body: document.getElementById("panel-body"),
};

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(panels).forEach((p) => p.classList.remove("active"));
    panels[btn.dataset.tab].classList.add("active");
  });
});

// ==================== 请求体规则管理 ====================

const BODY_STORAGE_KEY = "bodyRules";

const bEls = {
  list: document.getElementById("bodyRuleList"),
  addBtn: document.getElementById("addBodyRuleBtn"),
  form: document.getElementById("bodyRuleForm"),
  formTitle: document.getElementById("bodyFormTitle"),
  saveBtn: document.getElementById("bf-save"),
  cancelBtn: document.getElementById("bf-cancel"),
  name: document.getElementById("bf-name"),
  matchType: document.getElementById("bf-matchType"),
  urlFilter: document.getElementById("bf-urlFilter"),
  method: document.getElementById("bf-method"),
  action: document.getElementById("bf-action"),
  path: document.getElementById("bf-path"),
  value: document.getElementById("bf-value"),
  find: document.getElementById("bf-find"),
  matchAsRegex: document.getElementById("bf-matchAsRegex"),
  replaceWith: document.getElementById("bf-replaceWith"),
  replaceValue: document.getElementById("bf-replaceValue"),
  exportBtn: document.getElementById("bodyExportBtn"),
  importBtn: document.getElementById("bodyImportBtn"),
  importFile: document.getElementById("bodyImportFile"),
};

let bodyEditingId = null;

function getBodyRules() {
  return chrome.storage.local.get(BODY_STORAGE_KEY).then((d) => d[BODY_STORAGE_KEY] || []);
}
function setBodyRules(rules) {
  return chrome.storage.local.set({ [BODY_STORAGE_KEY]: rules });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function bodyActionLabel(rule) {
  if (rule.action === "jsonSet") return `JSON 赋值: ${rule.path} = ${rule.value}`;
  if (rule.action === "findReplace") return `查找替换: "${rule.find}" → "${rule.replaceWith}"`;
  if (rule.action === "replace") return "完整替换请求体";
  return rule.action;
}

async function renderBodyList() {
  const rules = await getBodyRules();
  bEls.list.innerHTML = "";
  if (rules.length === 0) {
    bEls.list.innerHTML = '<div class="empty-hint">还没有请求体规则，点击下方"添加请求体规则"开始</div>';
    return;
  }
  for (const rule of rules) {
    const card = document.createElement("div");
    card.className = "rule-card" + (rule.enabled ? "" : " disabled");
    card.innerHTML = `
      <div class="rule-row">
        <input type="checkbox" data-toggle="${rule.id}" ${rule.enabled ? "checked" : ""}>
        <span style="font-weight:600;flex:1;">${escapeHtml(rule.name || "(未命名)")}</span>
        <button class="btn icon" data-delete="${rule.id}" title="删除">✕</button>
      </div>
      <div class="rule-row" style="font-size:11px;color:#666;">[${rule.method}] ${escapeHtml(rule.urlFilter || "(任意 URL)")}</div>
      <div class="rule-row" style="font-size:11px;color:#666;">${escapeHtml(bodyActionLabel(rule))}</div>
      <div class="rule-row">
        <button class="btn ghost" data-edit="${rule.id}" style="flex:1;">编辑</button>
      </div>
    `;
    bEls.list.appendChild(card);
  }
}

function showBodyForm(rule) {
  bodyEditingId = rule ? rule.id : null;
  bEls.formTitle.textContent = rule ? "编辑请求体规则" : "新建请求体规则";
  bEls.name.value = rule?.name || "";
  bEls.matchType.value = rule?.matchType || "contains";
  bEls.urlFilter.value = rule?.urlFilter || "";
  bEls.method.value = rule?.method || "ANY";
  bEls.action.value = rule?.action || "jsonSet";
  bEls.path.value = rule?.path || "";
  bEls.value.value = rule?.value ?? "";
  bEls.find.value = rule?.find || "";
  bEls.matchAsRegex.checked = !!rule?.matchAsRegex;
  bEls.replaceWith.value = rule?.replaceWith || "";
  bEls.replaceValue.value = rule?.action === "replace" ? (rule?.value ?? "") : "";
  updateBodyActionFieldsVisibility();
  bEls.form.classList.remove("hidden");
}

function hideBodyForm() {
  bEls.form.classList.add("hidden");
  bodyEditingId = null;
}

function updateBodyActionFieldsVisibility() {
  const a = bEls.action.value;
  document.getElementById("bf-fields-jsonSet").classList.toggle("hidden", a !== "jsonSet");
  document.getElementById("bf-fields-findReplace").classList.toggle("hidden", a !== "findReplace");
  document.getElementById("bf-fields-replace").classList.toggle("hidden", a !== "replace");
}

bEls.action.addEventListener("change", updateBodyActionFieldsVisibility);
bEls.addBtn.addEventListener("click", () => showBodyForm(null));
bEls.cancelBtn.addEventListener("click", hideBodyForm);

bEls.saveBtn.addEventListener("click", async () => {
  const action = bEls.action.value;
  const rule = {
    id: bodyEditingId || uid(),
    enabled: true,
    name: bEls.name.value.trim(),
    matchType: bEls.matchType.value,
    urlFilter: bEls.urlFilter.value.trim(),
    method: bEls.method.value,
    action,
  };
  if (action === "jsonSet") {
    rule.path = bEls.path.value.trim();
    rule.value = bEls.value.value;
  } else if (action === "findReplace") {
    rule.find = bEls.find.value;
    rule.matchAsRegex = bEls.matchAsRegex.checked;
    rule.replaceWith = bEls.replaceWith.value;
  } else if (action === "replace") {
    rule.value = bEls.replaceValue.value;
  }
  if (!rule.name) rule.name = rule.urlFilter || "(未命名规则)";

  const rules = await getBodyRules();
  const existing = rules.find((r) => r.id === rule.id);
  if (existing) {
    rule.enabled = existing.enabled;
    Object.assign(existing, rule);
  } else {
    rules.push(rule);
  }
  await setBodyRules(rules);
  hideBodyForm();
  renderBodyList();
});

bEls.list.addEventListener("click", async (e) => {
  const editId = e.target.getAttribute("data-edit");
  const deleteId = e.target.getAttribute("data-delete");
  if (editId) {
    const rules = await getBodyRules();
    const rule = rules.find((r) => r.id === editId);
    if (rule) showBodyForm(rule);
  } else if (deleteId) {
    if (!confirm("确定删除这条请求体规则吗？")) return;
    const rules = await getBodyRules();
    await setBodyRules(rules.filter((r) => r.id !== deleteId));
    renderBodyList();
  }
});

bEls.list.addEventListener("change", async (e) => {
  const toggleId = e.target.getAttribute("data-toggle");
  if (toggleId) {
    const rules = await getBodyRules();
    const rule = rules.find((r) => r.id === toggleId);
    if (rule) {
      rule.enabled = e.target.checked;
      await setBodyRules(rules);
    }
  }
});

bEls.exportBtn.addEventListener("click", async () => {
  const rules = await getBodyRules();
  const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  chrome.downloads
    ? chrome.downloads.download({ url, filename: "headerpilot-body-rules.json" })
    : (() => {
        const a = document.createElement("a");
        a.href = url; a.download = "headerpilot-body-rules.json"; a.click();
      })();
});

bEls.importBtn.addEventListener("click", () => bEls.importFile.click());
bEls.importFile.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("格式不正确，应为规则数组");
    const rules = imported.map((r) => ({
      id: uid(),
      enabled: r.enabled !== false,
      name: r.name || "",
      matchType: ["contains", "wildcard", "regex"].includes(r.matchType) ? r.matchType : "contains",
      urlFilter: r.urlFilter || "",
      method: r.method || "ANY",
      action: ["jsonSet", "findReplace", "replace"].includes(r.action) ? r.action : "jsonSet",
      path: r.path || "",
      value: r.value ?? "",
      find: r.find || "",
      matchAsRegex: !!r.matchAsRegex,
      replaceWith: r.replaceWith || "",
    }));
    await setBodyRules(rules);
    renderBodyList();
  } catch (err) {
    alert("导入失败：" + err.message);
  } finally {
    e.target.value = "";
  }
});

renderBodyList();
