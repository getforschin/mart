import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });
import { initializeDatabase, closeDatabase } from './database/sqlite-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { syncDaemon } from './sync/sync-daemon';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Mart POS Terminal',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[Main] did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5175').catch((error: unknown) => {
      console.error('[Main] loadURL failed', error);
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return mainWindow;
}

app.whenReady().then(() => {
  try {
    initializeDatabase();
    registerIpcHandlers();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Main] Startup failed:', message);
    const errorWindow = new BrowserWindow({ width: 720, height: 360, title: 'Mart POS Error' });
    void errorWindow.loadURL(
      `data:text/html,<h2 style="font-family:sans-serif;padding:24px">POS failed to start</h2><pre style="padding:0 24px;white-space:pre-wrap">${message.replace(/[<>&]/g, '')}</pre>`,
    );
    return;
  }

  const mainWindow = createMainWindow();
  syncDaemon.start(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createMainWindow();
      syncDaemon.start(newWindow);
    }
  });
});

app.on('window-all-closed', () => {
  syncDaemon.stop();
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  syncDaemon.stop();
  closeDatabase();
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Main Process] Uncaught exception:', error.message, error.stack);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Main Process] Unhandled rejection:', reason);
});
