const { app, BrowserWindow, shell } = require("electron");
const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");

function readBuildInfo() {
  const candidates = [
    path.join(__dirname, "build-info.json"),
    path.join(process.resourcesPath || "", "app", "build-info.json"),
  ];

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return JSON.parse(fs.readFileSync(candidate, "utf8"));
      }
    } catch {
      // ignored
    }
  }

  return {
    date: "unknown",
    commit: "unknown",
    version: app.getVersion()
  };
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, "assets", "icon.png"),
    path.join(process.resourcesPath || "", "app", "assets", "icon.png"),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

app.disableHardwareAcceleration();

let server;
let localOrigin;

function getBuildPath() {
  const candidates = [
    path.join(__dirname, "build"),
    path.join(process.resourcesPath || "", "app", "build"),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  throw new Error(`Cannot find Docusaurus build/index.html. Tried:\n${candidates.join("\n")}`);
}

function startStaticServer() {
  const expressApp = express();
  const buildPath = getBuildPath();

  expressApp.disable("x-powered-by");

  expressApp.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self' http://127.0.0.1:*",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:*",
        "style-src 'self' 'unsafe-inline' http://127.0.0.1:*",
        "img-src 'self' data: blob: http://127.0.0.1:*",
        "font-src 'self' data: http://127.0.0.1:*",
        "connect-src 'self' http://127.0.0.1:*",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
      ].join("; ")
    );
    next();
  });

  expressApp.use(
    express.static(buildPath, {
      dotfiles: "deny",
      index: "index.html",
      fallthrough: true,
      setHeaders(res) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    })
  );

  // Docusaurus SPA fallback.
  expressApp.use((req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(buildPath, "index.html"));
  });

  return new Promise((resolve, reject) => {
    server = http.createServer(expressApp);

    server.on("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      localOrigin = `http://127.0.0.1:${address.port}`;
      resolve(localOrigin);
    });
  });
}

function isAllowedLocalUrl(url) {
  return typeof url === "string" && localOrigin && url.startsWith(localOrigin);
}

function createWindow(localUrl) {
    const buildInfo = readBuildInfo();
    const title = `Avalonia Docs Offline — ${buildInfo.date} — ${buildInfo.commit}`;
    const icon = getAppIconPath();

    const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title,
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedLocalUrl(url)) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedLocalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.on("will-redirect", (event, url) => {
    if (!isAllowedLocalUrl(url)) {
      event.preventDefault();
    }
  });

  return win.loadURL(localUrl);
}

app.whenReady().then(async () => {
  const localUrl = await startStaticServer();
  await createWindow(localUrl);
}).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("web-contents-created", (_, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  contents.on("select-bluetooth-device", (event) => {
    event.preventDefault();
  });
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
    server = undefined;
  }

  app.quit();
});
