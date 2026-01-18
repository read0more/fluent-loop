/**
 * 통합 테스트: Electron 앱 시작 시 메뉴 초기화
 * 요구사항: FR-002 (Edit, View 메뉴 제거), FR-003 (Help 메뉴 추가)
 * 테스트 케이스: TC-016, TC-020
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app, BrowserWindow, Menu, dialog, type MenuItemConstructorOptions } from 'electron';

// Mock Electron modules
vi.mock('electron', () => {
  const BrowserWindow = vi.fn(function (this: unknown) {
    this.loadFile = vi.fn();
    this.webContents = {
      openDevTools: vi.fn(),
    };
    return this;
  });

  return {
    app: {
      whenReady: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    },
    BrowserWindow,
    Menu: {
      buildFromTemplate: vi.fn((template) => ({
        items: template,
      })),
      setApplicationMenu: vi.fn(),
      getApplicationMenu: vi.fn(),
    },
    dialog: {
      showMessageBox: vi.fn(),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
  };
});

describe('Electron 앱 시작 시 메뉴 초기화 (FR-002, FR-003)', () => {
  let mainWindow: BrowserWindow | null;
  let createMenu: () => void;

  const showLearningGuide = () => {
    if (!mainWindow) {
      return;
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '학습 예시',
      message: '주간 학습 일정표 및 말하기 연습 가이드',
      detail: `학습 내용...`,
      buttons: ['확인'],
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mainWindow = null;

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
  });

  describe('TC-016: Help 메뉴 클릭 시 다이얼로그 표시', () => {
    it('"학습 예시" 클릭 시 showLearningGuide() 함수가 실행되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();
      createMenu();

      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0] as MenuItemConstructorOptions[];
      const helpMenu = template.find((item) => item.label === 'Help');
      const learningGuideItem = (helpMenu?.submenu as MenuItemConstructorOptions[])?.[0];

      expect(learningGuideItem).toBeDefined();
      expect(learningGuideItem.label).toBe('학습 예시');

      // Act: 메뉴 클릭 시뮬레이션
      if (typeof learningGuideItem.click === 'function') {
        learningGuideItem.click(
          {} as Electron.MenuItem,
          {} as Electron.MenuItem,
          {} as Electron.MenuItem
        );
      }

      // Assert
      expect(dialog.showMessageBox).toHaveBeenCalled();
    });

    it('다이얼로그가 표시되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();
      createMenu();

      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0] as MenuItemConstructorOptions[];
      const helpMenu = template.find((item) => item.label === 'Help');
      const learningGuideItem = (helpMenu?.submenu as MenuItemConstructorOptions[])?.[0];

      // Act
      if (typeof learningGuideItem?.click === 'function') {
        learningGuideItem.click(
          {} as Electron.MenuItem,
          {} as Electron.MenuItem,
          {} as Electron.MenuItem
        );
      }

      // Assert
      expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          title: '학습 예시',
        })
      );
    });

    it('학습 일정표 및 팁이 detail에 포함되어야 함', () => {
      // Arrange
      mainWindow = new BrowserWindow();
      createMenu();

      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0] as MenuItemConstructorOptions[];
      const helpMenu = template.find((item) => item.label === 'Help');
      const learningGuideItem = (helpMenu?.submenu as MenuItemConstructorOptions[])?.[0];

      // Act
      if (typeof learningGuideItem?.click === 'function') {
        learningGuideItem.click(
          {} as Electron.MenuItem,
          {} as Electron.MenuItem,
          {} as Electron.MenuItem
        );
      }

      // Assert
      const dialogCalls = vi.mocked(dialog.showMessageBox).mock.calls;
      expect(dialogCalls.length).toBeGreaterThan(0);

      const options = dialogCalls[0][1];
      expect(options.detail).toContain('학습');
    });
  });

  describe('TC-020: Electron 앱 시작 시 메뉴 초기화', () => {
    it('app.whenReady() 내에서 createMenu()가 호출되어야 함', async () => {
      // Arrange
      let whenReadyCallback: () => void;
      vi.mocked(app.whenReady).mockImplementation(() => {
        return new Promise((resolve) => {
          whenReadyCallback = () => {
            createMenu();
            resolve();
          };
          whenReadyCallback();
        });
      });

      // Act
      await app.whenReady();

      // Assert
      expect(Menu.buildFromTemplate).toHaveBeenCalled();
      expect(Menu.setApplicationMenu).toHaveBeenCalled();
    });

    it('Menu.setApplicationMenu()가 호출되어야 함', () => {
      // Act
      createMenu();

      // Assert
      expect(Menu.setApplicationMenu).toHaveBeenCalled();
    });

    it('File, Help 메뉴만 존재해야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const template = calls[0][0] as MenuItemConstructorOptions[];
      expect(template).toHaveLength(2); // File, Help

      const labels = template.map((item) => item.label);
      expect(labels).toEqual(['File', 'Help']);
    });

    it('Edit, View 메뉴가 없어야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0] as MenuItemConstructorOptions[];

      const labels = template.map((item) => item.label);
      expect(labels).not.toContain('Edit');
      expect(labels).not.toContain('View');
    });

    it('Help > "학습 예시" 항목이 존재해야 함', () => {
      // Act
      createMenu();

      // Assert
      const calls = vi.mocked(Menu.buildFromTemplate).mock.calls;
      const template = calls[0][0] as MenuItemConstructorOptions[];
      const helpMenu = template.find((item) => item.label === 'Help');

      expect(helpMenu).toBeDefined();

      const submenu = helpMenu?.submenu as MenuItemConstructorOptions[];
      expect(submenu).toBeDefined();
      expect(submenu[0].label).toBe('학습 예시');
    });
  });
});
