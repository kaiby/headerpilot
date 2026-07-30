// background.js — 将用户配置的规则同步为 chrome.declarativeNetRequest 动态规则

const STORAGE_KEY = "headerRules";
const MASTER_SWITCH_KEY = "masterEnabled";

// 支持的资源类型（默认全选，避免遗漏 xhr/fetch/document 等）
const ALL_RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image",
  "font", "object", "xmlhttprequest", "ping", "csp_report",
  "media", "websocket", "other"
];

const ICONS_ON = { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" };
const ICONS_OFF = { "16": "icons/icon16-off.png", "48": "icons/icon48-off.png", "128": "icons/icon128-off.png" };

async function updateActionIcon(masterEnabled) {
  try {
    await chrome.action.setIcon({ path: masterEnabled ? ICONS_ON : ICONS_OFF });
    await chrome.action.setTitle({
      title: masterEnabled ? "HeaderPilot（已开启）" : "HeaderPilot（已关闭）"
    });
  } catch (err) {
    console.error("更新图标失败:", err);
  }
}

function buildDnrRule(rule, ruleIdCounter) {
  const condition = {
    resourceTypes: ALL_RESOURCE_TYPES
  };

  // urlFilter 为空或 "*" 时不加过滤条件，代表匹配所有网址
  if (rule.urlFilter && rule.urlFilter.trim() && rule.urlFilter.trim() !== "*") {
    condition.urlFilter = rule.urlFilter.trim();
  } else {
    condition.urlFilter = "*://*/*";
  }

  const headerEntry = {
    header: rule.headerName,
    operation: rule.action === "remove" ? "remove" : (rule.action === "append" ? "append" : "set")
  };
  if (rule.action !== "remove") {
    headerEntry.value = rule.headerValue ?? "";
  }

  const actionObj = { type: "modifyHeaders" };
  if (rule.type === "response") {
    actionObj.responseHeaders = [headerEntry];
  } else {
    actionObj.requestHeaders = [headerEntry];
  }

  return {
    id: ruleIdCounter,
    priority: 1,
    condition,
    action: actionObj
  };
}

async function syncRulesToBrowser() {
  const data = await chrome.storage.local.get([STORAGE_KEY, MASTER_SWITCH_KEY]);
  const rules = data[STORAGE_KEY] || [];
  const masterEnabled = data[MASTER_SWITCH_KEY] !== false; // 默认开启

  await updateActionIcon(masterEnabled);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map(r => r.id);

  let dnrRules = [];
  if (masterEnabled) {
    let idCounter = 1;
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (!rule.headerName) continue;
      dnrRules.push(buildDnrRule(rule, idCounter));
      idCounter++;
    }
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: dnrRules
    });
    await chrome.storage.local.set({ lastSyncError: null, lastSyncCount: dnrRules.length });
  } catch (err) {
    console.error("同步规则失败:", err);
    await chrome.storage.local.set({ lastSyncError: String(err && err.message ? err.message : err) });
  }
}

// 串行化队列：防止 storage.onChanged 与 popup 的 REQUEST_SYNC 消息
// 几乎同时触发时并发执行 syncRulesToBrowser，导致两次调用读到同一份旧的
// dynamic rules 快照、都尝试添加相同 id 的规则，从而报错
// "Rule with id N does not have a unique ID"。
let syncChain = Promise.resolve();
function queueSync() {
  syncChain = syncChain.then(() => syncRulesToBrowser()).catch((err) => {
    console.error("同步队列出错:", err);
  });
  return syncChain;
}

chrome.runtime.onInstalled.addListener(() => {
  queueSync();
});

chrome.runtime.onStartup.addListener(() => {
  queueSync();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes[STORAGE_KEY] || changes[MASTER_SWITCH_KEY])) {
    queueSync();
  }
});

// popup 打开时也做一次兜底同步（service worker 可能刚被唤醒）
// 同时处理来自 content script 的"请求体规则命中"上报，用于角标计数提示
const bodyHitCountByTab = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "REQUEST_SYNC") {
    queueSync().then(() => sendResponse({ ok: true }));
    return true; // 异步响应
  }
  if (msg && msg.type === "BODY_RULE_HIT" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    const count = (bodyHitCountByTab.get(tabId) || 0) + 1;
    bodyHitCountByTab.set(tabId, count);
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#4361ee" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => bodyHitCountByTab.delete(tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    bodyHitCountByTab.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});
