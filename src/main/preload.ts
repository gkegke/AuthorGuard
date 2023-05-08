import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'getTrackedFiles'
  | 'updateTrackedFiles'
  | 'addTrackedFile'
  | 'removeTrackedFile'
  | 'openFile'
  | 'getLastModified'
  | 'openDirectory'
  | 'startFileMonitoring'
  | 'getChanges'
  | 'file-changed';

const electronHandler = {
  eAPI: {
    getTrackedFiles: () => ipcRenderer.invoke('getTrackedFiles'),
    updateTrackedFiles: (verified_files: string[]) =>
      ipcRenderer.invoke('updateTrackedFiles', verified_files),
    addTrackedFile: (fdata: { path: string; hash: string }) =>
      ipcRenderer.invoke('addTrackedFile', fdata),
    removeTrackedFile: (fpath: string) =>
      ipcRenderer.invoke('removeTrackedFile', fpath),
    openFile: (fpath: string) => ipcRenderer.invoke('openFile', fpath),
    getLastModified: (fpath: string) =>
      ipcRenderer.invoke('getLastModified', fpath),
    openDirectory: (fpath: string) =>
      ipcRenderer.invoke('openDirectory', fpath),
    startFileMonitoring: (filesToWatch: string[]) =>
      ipcRenderer.invoke('startFileMonitoring', filesToWatch),
    getChanges: (fpath: string) => ipcRenderer.invoke('getChanges', fpath),
    onFileChanged: (
      callback: (filePath: string) => void,
      filepath: string,
    ) => {
      ipcRenderer.on('file-changed', (event: IpcRendererEvent, filePath: string) => {
        callback(filePath);
      });
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('file-changed');
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
