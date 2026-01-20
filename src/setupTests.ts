import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Electron IPC Mock
global.window = global.window || ({} as any);
global.window.electron = {
  invoke: vi.fn(),
  on: vi.fn(() => () => {}),
};

// localStorage Mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Performance Mock
global.performance = {
  now: () => Date.now(),
} as any;

// Console 경고 억제 (테스트 중 불필요한 경고 제거)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
