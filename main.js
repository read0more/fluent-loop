const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Claude Code CLI 호출 핸들러
ipcMain.handle('ask-claude', async (event, question) => {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    console.log('Question:', question);

    // shell: true로 직접 실행
    const escapedQuestion = question.replace(/"/g, '\\"');
    const command = `claude -p "${escapedQuestion}" --model haiku`;

    console.log('Command:', command);

    const child = spawn(command, [], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin을 ignore로 변경
      env: { ...process.env }
    });

    console.log('Process spawned, PID:', child.pid);

    // stdin이 pipe인 경우 즉시 닫기
    if (child.stdin) {
      child.stdin.end();
    }

    child.stdout.on('data', (data) => {
      const chunk = data.toString('utf8');
      console.log('stdout:', chunk);
      output += chunk;
      mainWindow.webContents.send('claude-stream', chunk);
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString('utf8');
      console.error('stderr:', chunk);
      errorOutput += chunk;
      mainWindow.webContents.send('claude-stream', `[stderr] ${chunk}`);
    });

    child.on('close', (code) => {
      console.log('Process closed with code:', code);
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: errorOutput || `Exit code: ${code}` });
      }
    });

    child.on('error', (err) => {
      console.error('Process error:', err);
      reject({ success: false, error: err.message });
    });
  });
});
