import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const outputDir =
  process.env.WORKLIFE_ANDROID_SHOTS ||
  path.join(os.tmpdir(), "worklife-android-device-shots");
await fs.mkdir(outputDir, { recursive: true });

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((item) => item.type === "page");
if (!target?.webSocketDebuggerUrl) {
  throw new Error("没有找到 Android WebView 页面，请先执行 adb forward");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data);
  if (!payload.id || !pending.has(payload.id)) return;
  const { resolve, reject } = pending.get(payload.id);
  pending.delete(payload.id);
  if (payload.error) {
    reject(new Error(payload.error.message));
  } else {
    resolve(payload.result);
  }
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

async function waitFor(expression, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`等待页面状态超时：${expression}`);
}

await cdp("Runtime.enable");
await cdp("Page.enable");
await waitFor("Boolean(document.querySelector('.app-shell'))", 12000);

const clickButton = (text) =>
  evaluate(`(() => {
    const button = [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.includes(${JSON.stringify(text)})
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);

const setField = (label, value) =>
  evaluate(`(() => {
    const fieldLabel = [...document.querySelectorAll("label")].find(
      (item) => item.textContent?.includes(${JSON.stringify(label)})
    );
    const field = fieldLabel?.querySelector("input, textarea");
    if (!field) return false;
    const prototype = field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    setter.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);

const suffix = new Date().toTimeString().slice(0, 5).replace(":", "");
const title = `定时通知验收 ${suffix}`;
const scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
const scheduledTime = `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(
  scheduledAt.getMinutes(),
).padStart(2, "0")}`;
await evaluate('window.location.hash = "/home"; true');
await waitFor(
  "Boolean([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('新建计划')))",
);
await clickButton("新建计划");
await waitFor("Boolean(document.querySelector('[role=dialog]'))");
await setField("计划标题", title);
await setField("课程或领域", "Android 原生验收");
await setField("开始时间", scheduledTime);
await clickButton("创建计划");
await waitFor("document.body.textContent.includes('计划已创建')");

await evaluate('window.location.hash = "/settings"; true');
await waitFor(
  "document.body.textContent.includes('登录网站账号') || document.body.textContent.includes('手机与网站同步')",
);
await clickButton("测试通知");
try {
  await waitFor("document.body.textContent.includes('测试通知已发送')");
} catch (error) {
  const bodyText = await evaluate("document.body.innerText");
  const failedScreenshot = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await fs.writeFile(
    path.join(outputDir, "android-notification-error.png"),
    Buffer.from(failedScreenshot.data, "base64"),
  );
  throw new Error(`${error.message}\n页面内容：\n${bodyText}`);
}
await new Promise((resolve) => setTimeout(resolve, 1500));

const screenshot = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await fs.writeFile(
  path.join(outputDir, "android-settings.png"),
  Buffer.from(screenshot.data, "base64"),
);

await evaluate('window.location.hash = "/today"; true');
await waitFor(`document.body.textContent.includes(${JSON.stringify(title)})`);
const localState = await evaluate(
  'JSON.parse(localStorage.getItem("worklife.android.state.v1") || "{}")',
);
await evaluate('window.location.hash = "/calendar"; true');
await waitFor(`document.body.textContent.includes(${JSON.stringify(title)})`);
const calendarScreenshot = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await fs.writeFile(
  path.join(outputDir, "android-calendar.png"),
  Buffer.from(calendarScreenshot.data, "base64"),
);
await evaluate('window.location.hash = "/feedback"; true');
await waitFor("document.body.textContent.includes('你的想法')");
const feedbackVisible = await evaluate(
  "document.body.textContent.includes('发送建议')",
);

const response = {
  outputDir,
  planVisible: true,
  planPersisted: localState.plans?.some((plan) => plan.title === title),
  calendarVisible: true,
  feedbackVisible,
  scheduledTime,
  title,
  testNotificationUi: true,
};
console.log(JSON.stringify(response, null, 2));
socket.close();

if (!response.planPersisted || !feedbackVisible) {
  process.exitCode = 1;
}
