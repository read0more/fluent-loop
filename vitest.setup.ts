import '@testing-library/jest-dom';

// Setup global window object for renderer tests
if (typeof window !== 'undefined') {
  // Initialize window.electron for electron API mocking
  (window as any).electron = {
    invoke: () => Promise.resolve(),
    on: () => {},
    removeAllListeners: () => {},
  };

  // Polyfill for Blob.arrayBuffer() in jsdom
  if (typeof Blob.prototype.arrayBuffer === 'undefined') {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
}
