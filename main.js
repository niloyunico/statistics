/* UNICO Statistics Suite — Electron main process (offline desktop app) */
const { app, BrowserWindow, Menu, shell, protocol, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const RENDERER = path.join(__dirname, 'renderer');
const SCHEME = 'app';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------------------
// On-disk database. All app state lives in a single JSON file in userData,
// written atomically (temp + rename) so a crash can't corrupt it. The renderer
// mirrors localStorage into it on every change and hydrates from it at startup.
// ---------------------------------------------------------------------------
function dbPath() { return path.join(app.getPath('userData'), 'unico-database.json'); }

function readDB() {
  try {
    const raw = fs.readFileSync(dbPath(), 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (e) {
    return {};
  }
}

function writeDB(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid db payload');
  const file = dbPath();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
  fs.renameSync(tmp, file); // atomic replace on the same volume
  return true;
}

function registerDbIpc() {
  // Synchronous load — preload calls this at document-start to hydrate.
  ipcMain.on('db:loadSync', (event) => { event.returnValue = readDB(); });

  ipcMain.handle('db:persist', (e, data) => {
    try { writeDB(data); return { ok: true }; }
    catch (err) { return { ok: false, error: String(err) }; }
  });

  ipcMain.handle('db:path', () => dbPath());

  ipcMain.handle('db:backup', async (e, data) => {
    if (data && typeof data === 'object') { try { writeDB(data); } catch (_) {} }
    const stamp = new Date().toISOString().slice(0, 10);
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Back up all UNICO data',
      defaultPath: `UNICO-Backup-${stamp}.unicobak`,
      filters: [{ name: 'UNICO Backup', extensions: ['unicobak', 'json'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    try {
      fs.copyFileSync(dbPath(), res.filePath);
      return { ok: true, path: res.filePath };
    } catch (err) {
      // DB file may not exist yet — write the provided data directly.
      try { fs.writeFileSync(res.filePath, JSON.stringify(data || readDB()), 'utf8'); return { ok: true, path: res.filePath }; }
      catch (e2) { return { ok: false, error: String(e2) }; }
    }
  });

  ipcMain.handle('db:restore', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore UNICO data from backup',
      properties: ['openFile'],
      filters: [{ name: 'UNICO Backup', extensions: ['unicobak', 'json'] }, { name: 'All files', extensions: ['*'] }],
    });
    if (res.canceled || !res.filePaths || !res.filePaths[0]) return { ok: false, canceled: true };
    try {
      const raw = fs.readFileSync(res.filePaths[0], 'utf8');
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Not a valid UNICO backup file');
      writeDB(obj);
      return { ok: true, path: res.filePaths[0], data: obj };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

// Sizes Chromium's Page.printToPDF accepts as named strings.
const PDF_PAGE_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Legal', 'Letter', 'Tabloid', 'Ledger'];

function registerPdfIpc() {
  // Render the requesting page to a real PDF, prompt for a location, save, open.
  // The renderer drives layout via `@media print` (only #pdf-root is captured),
  // so the file matches the report — not the dark app chrome.
  ipcMain.handle('pdf:export', async (event, opts = {}) => {
    const wc = event.sender;
    const win = BrowserWindow.fromWebContents(wc) || mainWindow;
    try {
      const pageSize = PDF_PAGE_SIZES.includes(opts.pageSize) ? opts.pageSize : 'A4';
      const data = await wc.printToPDF({
        pageSize,
        landscape: !!opts.landscape,
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }, // whitespace comes from .pdf-page padding
        preferCSSPageSize: false,
      });

      const base = String(opts.defaultName || 'UNICO-Report').replace(/[^\w.\- ]+/g, '_').trim() || 'UNICO-Report';
      const stamp = new Date().toISOString().slice(0, 10);
      const defaultName = /\.pdf$/i.test(base) ? base : `${base}-${stamp}.pdf`;

      const res = await dialog.showSaveDialog(win, {
        title: 'Export report as PDF',
        defaultPath: defaultName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (res.canceled || !res.filePath) return { ok: false, canceled: true };

      fs.writeFileSync(res.filePath, data);
      shell.openPath(res.filePath); // open in the system PDF viewer
      return { ok: true, path: res.filePath };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

// Serve the renderer from a stable, secure custom origin (app://unico/...).
// A real origin (vs file://) makes localStorage and other web storage persist
// reliably across launches — the whole suite relies on it.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

let mainWindow = null;

function resolveRequest(reqUrl) {
  // app://unico/index.html  -> renderer/index.html
  const u = new URL(reqUrl);
  let rel = decodeURIComponent(u.pathname);
  if (!rel || rel === '/') rel = '/index.html';
  // Prevent path traversal outside the renderer dir.
  const target = path.normalize(path.join(RENDERER, rel));
  if (!target.startsWith(RENDERER)) return path.join(RENDERER, 'index.html');
  return target;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b1220',
    show: false,
    autoHideMenuBar: true,
    title: 'UNICO Statistics Suite',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Clean, app-like: no menu bar; keep a few power-user accelerators.
  Menu.setApplicationMenu(null);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    if (key === 'f11') { mainWindow.setFullScreen(!mainWindow.isFullScreen()); event.preventDefault(); }
    else if (input.control && key === 'r') { mainWindow.webContents.reload(); event.preventDefault(); }
    else if (input.control && input.shift && key === 'i') { mainWindow.webContents.toggleDevTools(); event.preventDefault(); }
    else if (input.control && (key === '=' || key === '+')) { mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5); event.preventDefault(); }
    else if (input.control && key === '-') { mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5); event.preventDefault(); }
    else if (input.control && key === '0') { mainWindow.webContents.setZoomLevel(0); event.preventDefault(); }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Open external links (if any) in the system browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.loadURL(`${SCHEME}://unico/index.html`);
}

// Single-instance: focus the existing window instead of opening a second.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerDbIpc(); // before any window loads, so preload's sync load works
    registerPdfIpc();

    // Serve renderer files via fs (asar-aware) with explicit MIME types.
    protocol.handle(SCHEME, async (request) => {
      const filePath = resolveRequest(request.url);
      try {
        const data = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        return new Response(data, {
          status: 200,
          headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
        });
      } catch (err) {
        return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
