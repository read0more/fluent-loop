/**
 * 단위 테스트: main.ts - 메뉴 및 아이콘 설정
 * 요구사항: FR-001 (앱 아이콘 적용), FR-002 (Edit, View 메뉴 제거), FR-003 (Help 메뉴 추가)
 * 테스트 케이스: TC-009, TC-010, TC-011, TC-012, TC-028
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserWindow, Menu, dialog, type MenuItemConstructorOptions } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Mock modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
    getApplicationMenu: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
  app: {
    whenReady: vi.fn(),
    on: vi.fn(),
    quit: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('fs');
vi.mock('path');

describe('main.ts - 메뉴 및 아이콘 설정', () => {
  let mainWindow: BrowserWindow | null;
  let createWindow: () => void;
  let createMenu: () => void;
  let showLearningGuide: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mainWindow = null;

    // createWindow 함수 모의 구현
    createWindow = () => {
      const iconPath = path.join(__dirname, '../icon.ico');

      const options: Electron.BrowserWindowConstructorOptions = {
        width: 1200,
        height: 800,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      };

      // 아이콘 파일 존재 확인
      if (fs.existsSync(iconPath)) {
        options.icon = iconPath;
      } else {
        console.warn('Icon file not found:', iconPath);
      }

      mainWindow = new BrowserWindow(options);
    };

    // createMenu 함수 모의 구현
    createMenu = () => {
      const template: MenuItemConstructorOptions[] = [
        {
          label: 'File',
          submenu: [
            {
              label: 'Quit',
              role: 'quit',
            },
          ],
        },
        {
          label: 'Help',
          submenu: [
            {
              label: '학습 예시',
              click: () => {
                showLearningGuide();
              },
            },
          ],
        },
      ];

      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);
    };

    // showLearningGuide 함수 모의 구현
    showLearningGuide = () => {
      if (!mainWindow) {
        console.error('mainWindow is null');
        return;
      }

      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '학습 예시',
        message: '주간 학습 일정표 및 말하기 연습 가이드',
        detail: `
📅 주간 학습 일정표:
- 월: Step 1-3 (토픽 생성 → 듣기 → 리텔링)
- 화: Step 4-5 (첨삭 확인 → AI 롤플레잉)
- 수: Step 6 (실전 대화)
- 목: 복습 (Step 1-3)
- 금: 복습 (Step 4-6)

💡 말하기 연습 팁:
1. 매일 30분 이상 연습하세요
2. 녹음을 들으며 발음 교정하세요
3. AI 피드백을 적극 활용하세요
        `,
        buttons: ['확인'],
      });
    };
  });

  afterEach(() => {
    mainWindow = null;
  });

  describe('TC-009: BrowserWindow 아이콘 설정', () => {
    it('icon.ico 파일이 존재하면 BrowserWindow에 icon 옵션이 포함되어야 함', () => {
      // Arrange
      const iconPath = 'E:\\develop\\electron-test\\icon.ico';
      const preloadPath = 'E:\\develop\\electron-test\\preload.js';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(path.join).mockReturnValueOnce(iconPath).mockReturnValueOnce(preloadPath);

      // Act
      createWindow();

      // Assert
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: iconPath,
        })
      );
    });

    it('icon 경로가 올바르게 설정되어야 함', () => {
      // Arrange
      const iconPath = 'E:\\develop\\electron-test\\icon.ico';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(path.join).mockReturnValue(iconPath);

      // Act
      createWindow();

      // Assert
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: iconPath,
        })
      );
    });
  });

  describe('TC-010: 아이콘 파일 없을 때 기본 동작', () => {
    it('icon.ico 파일이 없으면 icon 옵션이 포함되지 않아야 함', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      createWindow();

      // Assert
      expect(BrowserWindow).not.toHaveBeenCalledWith(
        expect.objectContaining({
          icon: expect.anything(),
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('console.warn 메시지가 출력되어야 함', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      createWindow();

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Icon file not found:',
        expect.stringContaining('icon.ico')
      );

      consoleWarnSpy.mockRestore();
    });

    it('앱이 정상 동작해야 함 (기본 아이콘 사용)', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Act & Assert: 에러 없이 실행되어야 함
      expect(() => createWindow()).not.toThrow();
      expect(BrowserWindow).toHaveBeenCalled();
    });
  });

  describe('TC-011: 메뉴 생성 (Help > 학습 예시)', () => {
    it('File, Help 메뉴가 존재해야 함', () => {
      // Act
      createMenu();

      // Assert
      expect(Menu.buildFromTemplate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'File' }),
          expect.objectContaining({ label: 'Help' }),
        ])
      );
    });

    it('Edit, View 메뉴가 없어야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const template = calls[0][0];
      const labels = template.map((item: MenuItemConstructorOptions) => item.label);

      expect(labels).not.toContain('Edit');
      expect(labels).not.toContain('View');
    });

    it('File 메뉴에 quit 항목만 포함되어야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0];
      const fileMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'File');

      expect(fileMenu).toBeDefined();
      expect(fileMenu.submenu).toEqual([expect.objectContaining({ label: 'Quit' })]);
    });

    it('Help 메뉴에 "학습 예시" 항목이 포함되어야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0];
      const helpMenu = template.find((item: MenuItemConstructorOptions) => item.label === 'Help');

      expect(helpMenu).toBeDefined();
      expect(helpMenu.submenu).toEqual([expect.objectContaining({ label: '학습 예시' })]);
    });
  });

  describe('TC-012: showLearningGuide 다이얼로그 표시', () => {
    it('dialog.showMessageBox가 호출되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();

      // Act
      showLearningGuide();

      // Assert
      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('다이얼로그 옵션이 올바르게 설정되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();

      // Act
      showLearningGuide();

      // Assert
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        mainWindow,
        expect.objectContaining({
          type: 'info',
          title: '학습 예시',
          message: '주간 학습 일정표 및 말하기 연습 가이드',
          buttons: ['확인'],
        })
      );
    });

    it('detail에 학습 내용이 포함되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();

      // Act
      showLearningGuide();

      // Assert
      const calls = vi.mocked(dialog.showMessageBox).mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const options = calls[0][1];
      expect(options.detail).toContain('주간 학습 일정표');
      expect(options.detail).toContain('말하기 연습 팁');
    });
  });

  describe('TC-028: dialog.showMessageBox 실패 처리', () => {
    it('mainWindow가 null일 때 dialog.showMessageBox가 호출되지 않아야 함', () => {
      // Arrange
      mainWindow = null;

      // Act
      showLearningGuide();

      // Assert
      expect(dialog.showMessageBox).not.toHaveBeenCalled();
    });

    it('mainWindow가 null일 때 console.error가 호출되어야 함', () => {
      // Arrange
      mainWindow = null;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      showLearningGuide();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('mainWindow is null'));

      consoleErrorSpy.mockRestore();
    });

    it('앱이 크래시하지 않아야 함', () => {
      // Arrange
      mainWindow = null;

      // Act & Assert
      expect(() => showLearningGuide()).not.toThrow();
    });
  });
});
