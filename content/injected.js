// content/injected.js
// 运行在主世界(MAIN world)，与页面共享同一个 window/JS 环境，
// 因此可以直接覆写 window.fetch 和 XMLHttpRequest，从而在请求真正发出前修改请求体。
//
// 局限性说明（请在使用前了解）：
// 1) Manifest V3 下 chrome.webRequest 的"阻塞式"修改能力已被大幅取消，
//    无法在网络层直接篡改请求体，因此本方案改为在页面 JS 层拦截 fetch / XHR。
// 2) 这意味着：只能修改"页面脚本自己发起"的请求（网页/SPA 的 API 调用等），
//    无法修改浏览器自身发起的请求（如地址栏输入、书签、<img>/<form> 原生提交、
//    Service Worker 里的 fetch、扩展间的请求等）。
// 3) 对于 <form> 的原生同步提交(非 JS 拦截的情况)不生效；如需支持，请自行改造为拦截 submit 事件。

(function () {
  const BP_SOURCE_IN = 'headerpilot-bridge';
  const BP_SOURCE_OUT = 'headerpilot-injected';

  let RULES = [];

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.source === BP_SOURCE_IN && data.type === 'RULES_UPDATE') {
      RULES = Array.isArray(data.rules) ? data.rules : [];
    }
  });

  function reportHit(rule) {
    try {
      window.postMessage({ source: BP_SOURCE_OUT, type: 'BODY_RULE_HIT', rule: rule.name || rule.id }, '*');
    } catch (e) {}
  }

  function urlMatches(url, pattern, matchType) {
    if (!pattern) return true;
    try {
      if (matchType === 'regex') {
        return new RegExp(pattern).test(url);
      }
      if (matchType === 'wildcard') {
        const escaped = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*');
        return new RegExp('^' + escaped + '$').test(url);
      }
      // 默认: contains 子串匹配
      return url.includes(pattern);
    } catch (e) {
      return false;
    }
  }

  function methodMatches(method, ruleMethod) {
    if (!ruleMethod || ruleMethod === 'ANY') return true;
    return (method || 'GET').toUpperCase() === ruleMethod.toUpperCase();
  }

  function findMatchingRule(url, method) {
    for (const rule of RULES) {
      if (!rule.enabled) continue;
      if (!methodMatches(method, rule.method)) continue;
      if (!urlMatches(url, rule.urlFilter, rule.matchType)) continue;
      return rule;
    }
    return null;
  }

  function getByPath(obj, path) {
    const parts = String(path).split('.').filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function setByPath(obj, path, value) {
    const parts = String(path).split('.').filter(Boolean);
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== 'object' || cur[p] === null) {
        cur[p] = {};
      }
      cur = cur[p];
    }
    if (parts.length > 0) {
      cur[parts[parts.length - 1]] = value;
    }
    return obj;
  }

  function tryParseValue(raw) {
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (trimmed === '') return raw;
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return raw; // 不是合法 JSON 字面量，就当普通字符串
    }
  }

  // 对字符串类型的请求体应用规则
  function transformStringBody(bodyText, rule) {
    switch (rule.action) {
      case 'replace': {
        return rule.value ?? '';
      }
      case 'findReplace': {
        try {
          const flags = rule.flags || 'g';
          const re = rule.matchAsRegex
            ? new RegExp(rule.find, flags)
            : new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
          return bodyText.replace(re, rule.replaceWith ?? '');
        } catch (e) {
          console.warn('[BodyPilot] findReplace 规则出错:', e);
          return bodyText;
        }
      }
      case 'jsonSet': {
        try {
          const json = JSON.parse(bodyText);
          setByPath(json, rule.path, tryParseValue(rule.value));
          return JSON.stringify(json);
        } catch (e) {
          console.warn('[BodyPilot] jsonSet 需要合法 JSON 请求体，已跳过:', e);
          return bodyText;
        }
      }
      default:
        return bodyText;
    }
  }

  // 对 FormData 类型请求体应用规则（仅支持 jsonSet：把 path 当作字段名）
  function transformFormData(formData, rule) {
    if (rule.action === 'jsonSet' && rule.path) {
      try {
        formData.set(rule.path, String(rule.value ?? ''));
      } catch (e) {
        console.warn('[BodyPilot] FormData 字段设置失败:', e);
      }
    }
    return formData;
  }

  async function transformBody(body, rule) {
    if (body == null) return body;

    if (typeof body === 'string') {
      return transformStringBody(body, rule);
    }
    if (body instanceof URLSearchParams) {
      const asString = body.toString();
      const result = transformStringBody(asString, rule);
      return result;
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return transformFormData(body, rule);
    }
    if (body instanceof Blob) {
      try {
        const text = await body.text();
        const result = transformStringBody(text, rule);
        return new Blob([result], { type: body.type });
      } catch (e) {
        return body;
      }
    }
    // ArrayBuffer / TypedArray 等二进制类型暂不支持文本级修改，原样返回
    return body;
  }

  // ---------- fetch 拦截 ----------
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      let url, method, body, isRequestObj = false;

      if (input instanceof Request) {
        isRequestObj = true;
        url = input.url;
        method = (init && init.method) || input.method || 'GET';
        if (init && 'body' in init) {
          body = init.body;
        } else if (input.body) {
          // 需要克隆一份读取，避免消耗原始 Request 的 body 流
          const clone = input.clone();
          body = await clone.text().catch(() => undefined);
        }
      } else {
        url = String(input);
        method = (init && init.method) || 'GET';
        body = init && init.body;
      }

      const rule = findMatchingRule(url, method);
      if (rule && body !== undefined && body !== null) {
        const newBody = await transformBody(body, rule);
        reportHit(rule);
        if (isRequestObj) {
          input = new Request(input, { body: newBody });
        } else {
          init = Object.assign({}, init, { body: newBody });
        }
      }
    } catch (e) {
      console.warn('[BodyPilot] fetch 拦截处理出错，已回退为原始请求:', e);
    }
    return originalFetch.call(this, input, init);
  };

  // ---------- XMLHttpRequest 拦截 ----------
  const OriginalOpen = XMLHttpRequest.prototype.open;
  const OriginalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__bp_method = method;
    this.__bp_url = url;
    return OriginalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      const rule = findMatchingRule(this.__bp_url, this.__bp_method);
      if (rule && body !== undefined && body !== null) {
        // XHR 的 body 变换是同步接口，这里用一个简化的同步路径
        // （字符串/FormData 走同步逻辑；Blob 场景下无法同步读取文本，直接放行）
        if (typeof body === 'string' || body instanceof URLSearchParams) {
          const text = typeof body === 'string' ? body : body.toString();
          body = transformStringBody(text, rule);
          reportHit(rule);
        } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
          body = transformFormData(body, rule);
          reportHit(rule);
        }
      }
    } catch (e) {
      console.warn('[BodyPilot] XHR 拦截处理出错，已回退为原始请求体:', e);
    }
    return OriginalSend.call(this, body);
  };
})();
