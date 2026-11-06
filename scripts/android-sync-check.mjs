import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.WORKLIFE_URL || "http://127.0.0.1:4318";
const status = await (await fetch(`${baseUrl}/api/status`)).json();
const outputDir =
  process.env.WORKLIFE_ANDROID_SHOTS ||
  path.join(os.tmpdir(), "worklife-android-device-shots");
await fs.mkdir(outputDir, { recursive: true });

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) {
  throw new Error("没有找到 Android WebView 页面");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (!payload.id || !pending.has(payload.id)) return;
  const request = pending.get(payload.id);
  pending.delete(payload.id);
  payload.error ? request.reject(new Error(payload.error.message)) : request.resolve(payload.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function cdp(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "页面脚本执行失败");
  }
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`同步等待超时：${expression}`);
}

const setField = (label, value) =>
  evaluate(`(() => {
    const fieldLabel = [...document.querySelectorAll("label")].find(
      (item) => item.textContent?.includes(${JSON.stringify(label)})
    );
    const field = fieldLabel?.querySelector("input, textarea");
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);

await cdp("Runtime.enable");
await waitFor("Boolean(document.querySelector('.app-shell'))");
await evaluate('window.location.hash = "/settings"; true');
await waitFor("document.body.textContent.includes('与电脑同步')");
await setField("电脑同步地址", status.sync.serverUrl);
await setField("电脑端配对码", status.sync.token);
await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent?.includes("立即同步")
  );
  button?.click();
  return Boolean(button);
})()`);

let syncResult = "timeout";
try {
  await waitFor(
    "Boolean(document.querySelector('.toast')) && !document.querySelector('.toast').textContent.includes('设置已更新')",
    15000,
  );
  syncResult = await evaluate("document.querySelector('.toast')?.textContent || ''");
} catch (error) {
  const bodyText = await evaluate("document.body.innerText");
  console.error(bodyText);
  throw error;
}

const mobileSync = await evaluate(
  'JSON.parse(localStorage.getItem("worklife.android.sync.v1") || "{}")',
);
const mobileState = await evaluate(
  'JSON.parse(localStorage.getItem("worklife.android.state.v1") || "{}")',
);
const desktopState = (await (await fetch(`${baseUrl}/api/state`)).json()).state;

const response = {
  ok: Boolean(mobileSync.lastSyncAt),
  syncResult,
  mobilePlans: mobileState.plans?.length || 0,
  desktopPlans: desktopState.plans?.length || 0,
  serverUrl: status.sync.serverUrl,
};
console.log(JSON.stringify(response, null, 2));
socket.close();

if (!response.ok || !mobileSync.lastSyncAt || response.desktopPlans === 0) {
  process.exitCode = 1;
}
