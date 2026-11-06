const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const port = Number(process.env.WORKLIFE_PORT) || 4318;
const localUrl = `http://127.0.0.1:${port}`;
const appRoot = app.getAppPath();
const iconPath = path.join(appRoot, "public", "app-icon.png");

let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;

app.setAppUserModelId("com.local.worklife");

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
}

function apiReady() {
  return new Promise((resolve) => {
    const request = http.get(
      `${localUrl}/api/status`,
      { timeout: 700 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

async function ensureServer() {
  if (await apiReady()) {
    return;
  }

  const serverFile = path.join(appRoot, "server", "index.js");
  serverProcess = spawn(process.execPath, [serverFile, "--no-open"], {
    cwd: appRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      WORKLIFE_PORT: String(port),
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (chunk) =>
    console.log(`[server] ${chunk.toString().trim()}`),
  );
  serverProcess.stderr.on("data", (chunk) =>
    console.error(`[server] ${chunk.toString().trim()}`),
  );

  for (let attempt = 0; attempt < 80; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (await apiReady()) {
      return;
    }
  }
  throw new Error("本地后台启动超时");
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

async function createWindow() {
  await ensureServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    title: "日序",
    icon: iconPath,
    backgroundColor: "#fbfbf8",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  const targetUrl = new URL(process.env.WORKLIFE_DEV_URL || localUrl);
  targetUrl.searchParams.set("desktop", "1");
  mainWindow.loadURL(targetUrl.toString());
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://rixu-app.pages.dev")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith(localUrl) &&
      !url.startsWith("https://rixu-app.pages.dev")
    ) {
      event.preventDefault();
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  const trayImage = nativeImage.createFromPath(iconPath).resize({
    width: 18,
    height: 18,
  });
  tray = new Tray(trayImage);
  tray.setToolTip("日序");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开日序", click: showWindow },
      {
        label: "打开数据目录",
        click: () => {
          const localAppData =
            process.env.LOCALAPPDATA ||
            path.join(require("node:os").homedir(), "AppData", "Local");
          void shell.openPath(path.join(localAppData, "WorkLifeManager"));
        },
      },
      { type: "separator" },
      {
        label: "退出日序",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", showWindow);
}

app.on("second-instance", showWindow);

app.whenReady().then(async () => {
  try {
    await createWindow();
    createTray();
  } catch (error) {
    console.error(error);
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    showWindow();
  } else {
    void createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  tray?.destroy();
  tray = null;
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
