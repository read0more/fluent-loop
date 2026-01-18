import { app, BrowserWindow, Menu, dialog, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerTopicHandlers } from './main/ipc/topicHandlers';
import { registerStep2Handlers } from './main/ipc/step2Handlers';
import { registerStep3Handlers } from './main/ipc/step3Handlers';
import { registerStep4Handlers } from './main/ipc/step4Handlers';
import { registerStep5Handlers } from './main/ipc/step5Handlers';
import { registerStep6Handlers } from './main/ipc/step6Handlers';
import { closeDatabase } from './main/database/db';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const iconPath = path.join(__dirname, '../icon.ico');

  // BrowserWindow 설정 객체 생성
  const windowConfig: Electron.BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // FR-001: 아이콘 파일 존재 여부 확인 후 설정
  if (fs.existsSync(iconPath)) {
    windowConfig.icon = iconPath;
  } else {
    console.warn('Icon file not found:', iconPath);
  }

  mainWindow = new BrowserWindow(windowConfig);

  // 개발 모드에서는 개발자 도구 자동 열기 (app.isPackaged로 패키지 여부 확인)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // 개발 환경에서만 F12 단축키로 DevTools 토글
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  mainWindow.loadFile('index.html');
}

// FR-002, FR-003: 커스텀 메뉴 생성
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: '종료',
          role: 'quit',
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        // 개발 환경에서만 개발자 도구 메뉴 표시
        ...(!app.isPackaged
          ? [
              {
                label: '개발자 도구',
                accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
                click: () => {
                  if (mainWindow) {
                    mainWindow.webContents.toggleDevTools();
                  }
                },
              },
              { type: 'separator' as const },
            ]
          : []),
        { label: '새로고침', accelerator: 'F5', role: 'reload' },
        { label: '강제 새로고침', accelerator: 'Ctrl+F5', role: 'forceReload' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: '학습 예시',
          click: () => showLearningGuide(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// FR-003: 학습 예시 다이얼로그 표시
function showLearningGuide(): void {
  if (!mainWindow) {
    console.error('mainWindow is null');
    return;
  }

  const learningGuideText = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 주간 학습 일정 예시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

요일   | 학습 내용
월     | 1~2단계
화     | 3~4단계
수     | 5~6단계
목     | 6단계 복습 후 3~4단계
금     | 5~6단계
토     | 5~6단계 (5분 초과 목표)
일     | 전체 복습

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 말하기 연습 팁
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 앱은 말하기 연습에만 집중한 앱입니다.

1. 단계2에서 충분히 듣기 연습
   - 최소 3회 이상 듣기
   - 발음과 억양에 주목

2. 단계3에서 자연스럽게 리텔링
   - 완벽한 문장보다 의미 전달 우선
   - 60초 시간 제한 활용

3. 단계4에서 첨삭 내용 숙지
   - 문법/어휘 오류 패턴 파악

4. 단계5에서 AI와 실전 대화
   - 자연스러운 대화 흐름 연습
   - 다양한 표현 시도

5. 단계6에서 피드백 반영
   - 개선 포인트 확인
   - 다음 학습에 적용

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '학습 예시',
    message: '주간 학습 일정표 및 말하기 연습 가이드',
    detail: learningGuideText,
    buttons: ['확인'],
  });
}

// 앱 준비 완료
app.whenReady().then(async () => {
  // IPC 핸들러 등록
  registerTopicHandlers();
  await registerStep2Handlers();
  registerStep3Handlers();
  registerStep4Handlers();
  registerStep5Handlers();
  registerStep6Handlers();

  // FR-002, FR-003: 메뉴 생성
  createMenu();

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
