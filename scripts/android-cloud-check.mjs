import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const email = process.env.WORKLIFE_MOBILE_EMAIL;
const password = process.env.WORKLIFE_MOBILE_PASSWORD;
if (!email || !password) {
  throw new Error("缺少 WORKLIFE_MOBILE_EMAIL 或 WORKLIFE_MOBILE_PASSWORD");
}

const outputDir = path.join(os.tmpdir(), "worklife-android-cloud-shots");
await fs.mkdir(outputDir, { recursive: true });
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) throw new Error("Android WebView 调试端口不可用");

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (!payload.id || !pending.has(payload.id)) return;
  const request = pending.get(payload.id);
  pending.delete(payload.id);
  payload.error
    ? request.reject(new Error(payload.error.message))
    : request.resolve(payload.result);
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`等待页面状态超时：${expression}`);
}

const setField = (label, value) =>
  evaluate(`(() => {
    const label = [...document.querySelectorAll("label")].find(
      (item) => item.textContent?.includes(${JSON.stringify(label)})
    );
    const input = label?.querySelector("input");
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);

const click = (text) =>
  evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.includes(${JSON.stringify(text)})
    );
    button?.click();
    return Boolean(button);
  })()`);

await cdp("Runtime.enable");
await cdp("Page.enable");
await waitFor("Boolean(document.querySelector('.app-shell'))");
await evaluate('window.location.hash = "/settings"; true');
await waitFor("document.body.textContent.includes('登录网站账号')");
await setField("邮箱", email);
await setField("密码", password);
await click("登录并同步");
await waitFor("document.body.textContent.includes('手机与网站同步')", 30000);

const config = await evaluate(
  'JSON.parse(localStorage.getItem("worklife.android.sync.v1") || "{}")',
);
const state = await evaluate(
  'JSON.parse(localStorage.getItem("worklife.android.state.v1") || "{}")',
);
const screenshot = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await fs.writeFile(
  path.join(outputDir, "android-cloud-settings.png"),
  Buffer.from(screenshot.data, "base64"),
);

const result = {
  ok: Boolean(config.cloudToken) && config.cloudEmail === email,
  email: config.cloudEmail,
  signedIn: Boolean(config.cloudToken),
  planCount: state.plans?.length || 0,
  lastSyncAt: config.cloudLastSyncAt || "",
  outputDir,
};
console.log(JSON.stringify(result, null, 2));
socket.close();
if (!result.ok) process.exitCode = 1;
