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
