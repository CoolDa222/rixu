import { chromium } from "playwright-core";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_URL || "http://127.0.0.1:4318";
const testTitle = "自动验收学习计划";
const editedTitle = "自动验收学习计划（已修改）";
const memoText = `备忘持久化验收 ${Date.now()}`;

const stateResponse = await fetch(`${baseUrl}/api/state`);
const original = (await stateResponse.json()).state;

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${baseUrl}/#/home`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "新建计划" }).click();
  await page.getByLabel("计划标题").fill(testTitle);
  await page.getByLabel("课程或领域").fill("自动化验收");
  await page.getByLabel("本次学习内容").fill("创建、编辑、删除与持久化");
  await page.getByRole("button", { name: "按周重复" }).click();
  await page.getByRole("button", { name: "创建计划" }).click();
  await page.getByText("计划已创建").waitFor();

  await page.goto(`${baseUrl}/#/today`, { waitUntil: "networkidle" });
  await page.getByText(testTitle, { exact: true }).waitFor();
  await page.getByTitle(`编辑：${testTitle}`).click();
  await page.getByLabel("计划标题").fill(editedTitle);
  await page.getByRole("button", { name: "保存修改" }).click();
  await page.getByText("计划已更新").waitFor();
  await page.getByText(editedTitle, { exact: true }).waitFor();

  await page.getByTitle(`编辑：${editedTitle}`).click();
  await page.getByRole("button", { name: "删除计划" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await page.getByText("计划已删除").waitFor();

  await page.goto(`${baseUrl}/#/home`, { waitUntil: "networkidle" });
  const memo = page.getByLabel("快速备忘");
  await memo.fill(memoText);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("快速备忘").waitFor();
  const persistedMemo = await page.getByLabel("快速备忘").inputValue();

  if (persistedMemo !== memoText) {
    throw new Error("快速备忘未在刷新后保留");
  }

  await fetch(`${baseUrl}/api/memo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quickMemo: original.quickMemo }),
  });

  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        createdEditedDeleted: true,
        memoPersisted: true,
        errors,
      },
      null,
      2,
    ),
  );

  if (errors.length) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
