const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Claude에 질문하기
  askClaude: (question) => ipcRenderer.invoke('ask-claude', question),

  // 실시간 스트리밍 응답 받기
  onStream: (callback) => {
    ipcRenderer.on('claude-stream', (event, chunk) => callback(chunk));
  },

  // 스트리밍 리스너 제거
  removeStreamListener: () => {
    ipcRenderer.removeAllListeners('claude-stream');
  }
});
