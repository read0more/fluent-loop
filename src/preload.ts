import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface ClaudeAPI {
  askClaude: (question: string) => Promise<unknown>;
  onStream: (callback: (chunk: string) => void) => void;
  removeStreamListener: () => void;
}

contextBridge.exposeInMainWorld('api', {
  askClaude: (question: string): Promise<unknown> => ipcRenderer.invoke('ask-claude', question),

  onStream: (callback: (chunk: string) => void): void => {
    ipcRenderer.on('claude-stream', (_event: IpcRendererEvent, chunk: string) => callback(chunk));
  },

  removeStreamListener: (): void => {
    ipcRenderer.removeAllListeners('claude-stream');
  },
} satisfies ClaudeAPI);
