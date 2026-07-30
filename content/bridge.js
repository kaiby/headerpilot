// content/bridge.js
// 运行在隔离世界(ISOLATED world)，可以访问 chrome.* API，
// 但页面自身的 fetch/XHR 不在这个世界里，所以需要通过 window.postMessage
// 把请求体规则数据"桥接"给运行在主世界(MAIN world)的 injected.js。
//
// 请求体规则与请求头规则共用同一个"总开关"(masterEnabled)：
// 总开关关闭时，body 拦截也一并停用。

const BODY_STORAGE_KEY = 'bodyRules';
const MASTER_SWITCH_KEY = 'masterEnabled';
const BP_SOURCE = 'headerpilot-bridge';

function sendRules(rules, masterEnabled) {
  window.postMessage(
    { source: BP_SOURCE, type: 'RULES_UPDATE', rules: masterEnabled ? rules : [] },
    '*'
  );
}

function loadAndSend() {
  chrome.storage.local.get([BODY_STORAGE_KEY, MASTER_SWITCH_KEY], (data) => {
    const masterEnabled = data[MASTER_SWITCH_KEY] !== false; // 默认开启
    sendRules(data[BODY_STORAGE_KEY] || [], masterEnabled);
  });
}

// 初次加载
loadAndSend();

// 规则或总开关变化时，实时同步给主世界
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes[BODY_STORAGE_KEY] || changes[MASTER_SWITCH_KEY])) {
    loadAndSend();
  }
});

// 转发"命中规则"事件给 background，用于角标计数
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data && data.source === 'headerpilot-injected' && data.type === 'BODY_RULE_HIT') {
    chrome.runtime.sendMessage({ type: 'BODY_RULE_HIT', rule: data.rule }).catch(() => {});
  }
});
