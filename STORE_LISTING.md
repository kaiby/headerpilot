# HeaderPilot 上架文案

## 商店名称
HeaderPilot - HTTP Header Editor

## 简短描述（132 字符以内，商店列表页展示）
中文：一键设置、追加或删除 HTTP 请求头/响应头，支持按网址规则精准匹配，API 调试与前后端联调必备工具。
英文：Set, append, or remove HTTP request & response headers with URL-based rules. A lightweight companion for API debugging.

## 详细描述（商店详情页）

### 中文版
HeaderPilot 是一款轻量、专注的 HTTP 请求头/响应头编辑工具，帮助开发者、测试工程师在浏览器中快速调试接口，无需修改后端代码或依赖抓包工具。

**核心功能**
✅ 支持请求头（Request Headers）与响应头（Response Headers）双向编辑
✅ 三种操作模式：设置（Set）/ 追加（Append）/ 删除（Remove）
✅ 按网址规则精准匹配，支持通配符（如 *://*.example.com/*）
✅ 每条规则独立开关，也可一键总开关全部生效/失效
✅ 规则支持导出/导入 JSON，方便团队共享配置或多设备同步
✅ 基于 Manifest V3 声明式 API 实现，不监听或读取请求内容，隐私更安全，性能更稳定

**适用场景**
- 联调环境切换：临时修改 Authorization、Cookie、X-Env 等请求头，无需切换账号或环境
- 跨域调试：临时添加 Access-Control-Allow-Origin 等响应头进行前端联调
- 灰度测试：通过自定义请求头触发后端灰度策略
- API 测试：模拟不同的 User-Agent、Referer 等请求场景

HeaderPilot 不会收集、上传任何浏览数据，所有规则仅保存在本地浏览器存储中。

### 英文版
HeaderPilot is a lightweight, focused HTTP header editor that lets developers and QA engineers debug APIs directly in the browser — no backend changes or packet-capturing tools required.

**Key Features**
✅ Edit both Request Headers and Response Headers
✅ Three operations: Set / Append / Remove
✅ URL-based rule matching with wildcard support (e.g. *://*.example.com/*)
✅ Per-rule enable/disable toggle plus a master switch for all rules
✅ Export/import rules as JSON for team sharing or multi-device sync
✅ Built on Manifest V3's declarative API — no request content is read or intercepted, keeping it private and performant

**Use Cases**
- Switch environments on the fly by overriding Authorization, Cookie, or custom env headers
- Debug CORS issues by injecting Access-Control-Allow-Origin during frontend development
- Trigger backend canary/gray-release logic via custom headers
- Simulate different User-Agent / Referer scenarios for testing

HeaderPilot never collects or uploads browsing data. All rules are stored locally in your browser.

## 分类建议
开发者工具 / Developer Tools

## 权限说明（商店审核时需要解释为何需要这些权限）
- declarativeNetRequest / declarativeNetRequestFeedback：用于声明式地修改请求头/响应头，这是实现核心功能的必需权限
- storage：保存用户配置的规则
- host_permissions (<all_urls>)：因为用户可能需要对任意网址设置规则，故需要全站权限；扩展本身不会读取或上传页面内容

## 隐私政策要点（商店要求填写隐私政策链接，可基于此撰写单独页面）
1. 本扩展不收集任何用户个人信息
2. 所有规则数据仅存储在用户本地浏览器（chrome.storage.local），不会上传至任何服务器
3. 本扩展不含任何第三方分析、广告或跟踪代码
