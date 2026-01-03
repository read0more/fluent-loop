import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

interface ClaudeResponse {
  success: boolean;
  output?: string;
  error?: string;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

ipcMain.handle(
  'ask-claude',
  async (_event: IpcMainInvokeEvent, question: string): Promise<ClaudeResponse> => {
    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      console.log('Question:', question);

      const escapedQuestion = question.replace(/"/g, '\\"');
      const command = `claude -p "${escapedQuestion}" --model haiku`;

      console.log('Command:', command);

      const child = spawn(command, [], {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      console.log('Process spawned, PID:', child.pid);

      // stdin is 'ignore', so no need to close it

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString('utf8');
        console.log('stdout:', chunk);
        output += chunk;
        mainWindow?.webContents.send('claude-stream', chunk);
      });

      child.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString('utf8');
        console.error('stderr:', chunk);
        errorOutput += chunk;
        mainWindow?.webContents.send('claude-stream', `[stderr] ${chunk}`);
      });

      child.on('close', (code: number | null) => {
        console.log('Process closed with code:', code);
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, error: errorOutput || `Exit code: ${code}` });
        }
      });

      child.on('error', (err: Error) => {
        console.error('Process error:', err);
        reject({ success: false, error: err.message });
      });
    });
  }
);
