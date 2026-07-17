<div align="center">

# ⚡ HeaderPilot

**Set, append, or remove HTTP request & response headers — right from your browser.**
**一键设置、追加或删除 HTTP 请求头/响应头 —— 无需切换环境或依赖抓包工具。**

[English](#english) · [中文](#中文)

</div>

---

<a name="english"></a>
## English

HeaderPilot is a lightweight Manifest V3 browser extension for editing HTTP request and response headers. It's built for developers and QA engineers who need to debug APIs, test cross-origin scenarios, or switch environments without touching backend code.

### Features

- **Request & Response headers** — edit either direction
- **Three operations** — `Set` / `Append` / `Remove`
- **URL-based rules** — match specific sites with wildcard patterns (e.g. `*://*.example.com/*`), or leave blank to match everything
- **Per-rule toggle + master switch** — disable a single rule or all rules at once; the toolbar icon changes color to reflect the current state
- **Import / Export** — save your rule set as JSON to share with teammates or sync across machines
- **Privacy-first** — built on `declarativeNetRequest` (Manifest V3's declarative API), so the extension never reads or intercepts request/response bodies. Nothing is uploaded anywhere.

### Installation (development mode)

1. Clone or download this repository
2. Open `chrome://extensions` (or the equivalent in any Chromium-based browser)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder

### Usage

1. Click the HeaderPilot icon in the toolbar
2. Click **+ Add rule**
3. Choose `Request` or `Response`, an operation, a header name/value, and an optional URL filter
4. Toggle the rule on, or use the master switch to enable/disable everything at once

### Project structure

```
.
├── manifest.json          # Manifest V3 config
├── background.js          # Service worker — syncs rules to declarativeNetRequest, updates the icon
├── popup.html / .css / .js
├── icons/                 # Toolbar icons (on/off states)
├── privacy-policy.html    # Standalone privacy policy page (hostable on GitHub Pages)
└── STORE_LISTING.md        # Chrome Web Store listing copy (EN/ZH) and permission rationale
```

### Permissions

| Permission | Why it's needed |
|---|---|
| `declarativeNetRequest` / `declarativeNetRequestFeedback` | Core mechanism for modifying headers |
| `storage` | Persists your rules locally |
| `host_permissions` (`<all_urls>`) | Lets rules apply to any site you target — the extension never reads page content |

### Privacy

HeaderPilot collects nothing and uploads nothing. All rules are stored locally via `chrome.storage.local`. See [`privacy-policy.html`](./privacy-policy.html) for the full policy (bilingual, ready to host as-is).

### License

[MIT](./LICENSE)

---

<a name="中文"></a>
## 中文

HeaderPilot 是一款基于 Manifest V3 的轻量级浏览器扩展，用于编辑 HTTP 请求头与响应头。专为需要调试接口、测试跨域场景、或在不修改后端代码的情况下切换环境的开发者与测试工程师打造。

### 功能特性

- **请求头 & 响应头双向编辑**
- **三种操作模式** —— 设置（Set）/ 追加（Append）/ 删除（Remove）
- **按网址规则匹配** —— 支持通配符（如 `*://*.example.com/*`），留空则匹配所有网址
- **单条规则开关 + 总开关** —— 可单独禁用某条规则，也可一键全部生效/失效；工具栏图标会随总开关状态变色
- **导入 / 导出** —— 将规则集导出为 JSON，方便团队共享或多设备同步
- **隐私优先** —— 基于 `declarativeNetRequest`（Manifest V3 的声明式 API）实现，扩展本身不会读取或拦截请求/响应正文，不上传任何数据

### 安装方式（开发者模式）

1. 克隆或下载本仓库
2. 打开 `chrome://extensions`（或其他 Chromium 内核浏览器的对应页面）
3. 打开右上角的**开发者模式**
4. 点击**加载已解压的扩展程序**，选择本项目文件夹

### 使用方法

1. 点击工具栏中的 HeaderPilot 图标
2. 点击 **+ 添加规则**
3. 选择请求头/响应头、操作类型、Header 名称与值，以及可选的网址匹配规则
4. 开启该条规则，或使用总开关一次性控制所有规则

### 项目结构

```
.
├── manifest.json          # Manifest V3 配置
├── background.js          # 后台 Service Worker —— 同步规则到 declarativeNetRequest，更新图标状态
├── popup.html / .css / .js
├── icons/                 # 工具栏图标（开启/关闭两种状态）
├── privacy-policy.html    # 独立隐私政策页面（可直接托管于 GitHub Pages）
└── STORE_LISTING.md        # Chrome 应用商店上架文案（中英双语）及权限说明
```

### 所需权限

| 权限 | 用途 |
|---|---|
| `declarativeNetRequest` / `declarativeNetRequestFeedback` | 修改请求头/响应头的核心机制 |
| `storage` | 在本地保存用户配置的规则 |
| `host_permissions`（`<all_urls>`） | 允许规则应用于任意目标网址；扩展不会借此读取页面内容 |

### 隐私说明

HeaderPilot 不收集、不上传任何数据，所有规则均通过 `chrome.storage.local` 保存在本地。完整政策见 [`privacy-policy.html`](./privacy-policy.html)（中英双语，可直接托管使用）。

### 许可证

[MIT](./LICENSE)
