import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerTopicHandlers } from './main/ipc/topicHandlers';
import { registerStep2Handlers } from './main/ipc/step2Handlers';
import { registerStep3Handlers } from './main/ipc/step3Handlers';
import { registerStep4Handlers } from './main/ipc/step4Handlers';
import { registerStep5Handlers } from './main/ipc/step5Handlers';
import { closeDatabase } from './main/database/db';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 개발 모드에서는 개발자 도구 자동 열기
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadFile('index.html');
}

// 앱 준비 완료
app.whenReady().then(() => {
  // IPC 핸들러 등록
  registerTopicHandlers();
  registerStep2Handlers();
  registerStep3Handlers();
  registerStep4Handlers();
  registerStep5Handlers();

  createWindow();
});

// 모든 창이 닫힘
app.on('window-all-closed', () => {
  // macOS가 아니면 앱 종료
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱 활성화 (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 앱 종료 시 DB 연결 닫기
app.on('quit', () => {
  closeDatabase();
});
