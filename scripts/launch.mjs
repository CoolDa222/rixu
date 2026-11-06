import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const port = Number(process.env.WORKLIFE_PORT) || 4318;
const url = `http://127.0.0.1:${port}`;

async function serverReady() {
  try {
    const response = await fetch(`${url}/api/status`, {
      signal: AbortSignal.timeout(700),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureBuild() {
  try {
    await fs.access(path.join(appRoot, "dist", "index.html"));
  } catch {
    console.log("首次启动，正在构建界面...");
    const viteBin = path.join(appRoot, "node_modules", "vite", "bin", "vite.js");
    await new Promise((resolve, reject) => {
      const build = spawn(process.execPath, [viteBin, "build"], {
        cwd: appRoot,
        stdio: "inherit",
      });
      build.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("界面构建失败")),
      );
    });
  }
}

function openBrowser() {
  if (process.platform === "win32") {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

await ensureBuild();

if (!(await serverReady())) {
  const serverFile = path.join(appRoot, "server", "index.js");
  const child = spawn(process.execPath, [serverFile, "--no-open"], {
    cwd: appRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (await serverReady()) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error("后台服务启动失败。请运行 npm run server 查看错误。");
    process.exit(1);
  }
}

openBrowser();
console.log(`日序已启动：${url}`);
console.log("关闭浏览器不会停止后台提醒。");
