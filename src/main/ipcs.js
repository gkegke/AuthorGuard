const { ipcMain, shell, dialog, BrowserWindow } = require('electron');

const fs = require('fs');
const path = require('path');

const chokidar = require('chokidar');
const mammoth = require('mammoth');
const Store = require('electron-store');
const sqlite3 = require('sqlite3').verbose();

import { J } from '../renderer/common/utils.js';

// LS => localStorage alternative since localStorage isn't supported well (i forget)
// by electron
const LS = InitLS();
let watchers = [];

function InitLS() {
  /*

      Simple kv store intilization, comparable to what would be localStorage
      typically on the browser.

    */

  const LS = new Store();

  const defaults = {
    tracked_files: [],
  };

  // set keys to default if store is new and empty
  for (let key in defaults) {
    if (!LS.has(key)) {
      LS.set(key, defaults[key]);
    }
  }

  return LS;
}

function stopWatchers() {
  watchers.forEach((watcher) => watcher.close());
  watchers = [];
}

function initializeDatabase(filepath) {
  const dbPath = `${filepath}.db`;

  console.log(`dbPath: ${dbPath}`);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`
      Error initializing SQLite database for file ${filepath}: ${err.message}`);
    } else {
      console.log(`Initialized SQLite database for file ${filepath}`);
      createChangesTable(db, filepath);
    }
  });

  return db;
}

function createChangesTable(db, filepath) {
  db.run(
    `CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filePath TEXT NOT NULL,
    modifiedTime DATETIME NOT NULL,
    fileContent BLOB NOT NULL
  )`,
    (err) => {
      if (err) {
        console.error(`Error creating changes table: ${err.message}`);
        console.error(err.stack);
        return;
      }

      console.log('Changes table created successfully');

      db.get('SELECT COUNT(*) AS count FROM changes', (err, row) => {
        if (err) {
          console.error(
            `Error checking for records in the changes table for file ${filepath}: ${err.message}`
          );
          console.error(err.stack);
          return;
        }

        const count = row.count;
        if (count === 0) {
          console.log(
            `No records found in the changes table for file ${filepath}, saving initial state`
          );
          saveInitialFileState(db, filepath);
        }
      });
    }
  );
}

function startWatcher(filepath) {
  const dbPath = `${filepath}.db`;

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(`
      Error initializing SQLite database for file ${filepath}: ${err.message}`);
    }
  });

  const watcher = chokidar.watch(filepath, {
    awaitWriteFinish: {
      stabilityThreshold: 2000, // wait 2 seconds after last write event
      pollInterval: 100, // check for write events every 100ms
    },
  });

  watcher.on('change', async (filepath) => {
    console.log(`File ${filepath} has changed`);
    try {
      handleFileChange(db, filepath);
    } catch (err) {
      console.log(`handleFileChange err ${err}`);
    }
  });

  return watcher;
}

function saveInitialFileState(db, filepath) {
  console.log('filepath: ', filepath);

  fs.stat(filepath, (err, stats) => {
    if (err) throw err;

    const modifiedTime = stats.mtime.toISOString(); // convert last modified time to ISO string

    readFileContent(filepath, modifiedTime, (content) => {
      // pass in modifiedTime to readFileContent
      insertChangeIntoDatabase(db, filepath, modifiedTime, content); // pass in modifiedTime to insertChangeIntoDatabase
    });

    console.log(`
      saved initial state of tracked file : ${filepath}
      `);
  });
}

function handleFileChange(db, filepath) {
  console.log(`handling ${filepath}`);

  fs.stat(filepath, (err, stats) => {
    if (err) {
      console.error(
        `Error retrieving file stats for file ${filepath}: ${err.message}`
      );
      return;
    }

    const modifiedTime = stats.mtime.toISOString(); // convert last modified time to ISO string

    // Get the reference to the window that contains the renderer process
    const win = BrowserWindow.getAllWindows();

    try {
      win[0].webContents.send('file-changed', filepath);
    } catch (err) {
      console.log(`file-changed: ${err}`);
    }

    readFileContent(filepath, modifiedTime, (content) => {
      // pass in modifiedTime to readFileContent
      insertChangeIntoDatabase(db, filepath, modifiedTime, content); // pass in modifiedTime to insertChangeIntoDatabase
    });
  });
}

function readFileContent(filepath, modifiedTime, callback) {
  // modifiedTime added as parameter
  console.log(`reading file from ${filepath}`);
  // get the file extension
  const ext = filepath.split('.').pop();
  // if the file is a docx, use mammoth to convert it to markdown
  if (ext === 'docx') {
    mammoth
      .convertToMarkdown({ path: filepath })
      .then(function (result) {
        const data = result.value; // The generated markdown
        callback(data, modifiedTime); // pass modifiedTime and data to callback
      })
      .done();
  } else {
    // otherwise, read the file as a string
    fs.readFile(filepath, 'utf8', (err, data) => {
      if (err) throw err;
      callback(data, modifiedTime); // pass modifiedTime and data to callback
    });
  }
}

function insertChangeIntoDatabase(db, filepath, modifiedTime, content) {
  // modifiedTime added as parameter
  const dbPath = `${filepath}.db`;
  console.log('inserting into: ', dbPath);
  db.run(
    `INSERT INTO changes (filePath, modifiedTime, fileContent) VALUES (?, ?, ?)`,
    [filepath, modifiedTime, content],
    (err) => {
      // pass in modifiedTime and content as parameters
      if (err) {
        console.error(
          `Error inserting change into SQLite database for file ${filepath}: ${err.message}`
        );
      } else {
        console.log(
          `Inserted change into SQLite database for file ${filepath}`
        );
      }
    }
  );
}

/*

  IPC handlers: allow interaction between main and renderer

*/

ipcMain.handle('getTrackedFiles', async () => {
  const trackedFiles = LS.get('tracked_files');

  const verifiedFiles = [];
  const notFoundFiles = [];

  // Check files still exist and save changes to relevant database
  for (const trackedFile of trackedFiles) {
    try {
      await fs.promises.access(trackedFile.filePath, fs.constants.F_OK);
      const fileStats = await fs.promises.stat(trackedFile.filePath);

      const d1 = new Date(fileStats.mtime).toISOString();
      const d2 = trackedFile.modifiedAt;

      console.log(`
      d1: ${d1}
      d2: ${d2}
      d1 === d2: ${d1 === d2}
      d1 > d2: ${d1 > d2}
      d1 < d2: ${d1 < d2}
      `);

      // Save modifications to the relevant database if the file has been modified since last check
      if (d1 > d2) {
        console.log(`
        file ${trackedFile.fileName} has been modified since the app was last
        open.

        ${d1}
        vs
        ${d2}
        `);

        trackedFile.modifiedAt = d1;
      }

      verifiedFiles.push(trackedFile);
    } catch (err) {
      console.log(`
      getTrackedFiles ${trackedFile}
      ${err}
      `);

      notFoundFiles.push(trackedFile);
    }
  }

  console.log('verifiedFiles', verifiedFiles);
  console.log('notFoundFiles', notFoundFiles);

  LS.set('tracked_files', verifiedFiles);

  stopWatchers();

  // Start new watchers for each file
  for (const fileData of verifiedFiles) {
    const watcher = startWatcher(fileData.filePath);
    watchers.push(watcher);
  }

  console.log(`finished setting up monitors

  `);

  return { verifiedFiles, notFoundFiles };
});

ipcMain.handle('removeTrackedFile', (event, filepath) => {
  // Find the index of the file to remove in the tracked_files list
  const trackedFiles = LS.get('tracked_files');
  const fileIndex = trackedFiles.findIndex(
    (file) => file.filePath === filepath
  );

  // If the file is being tracked, remove it from the list and stop its watcher
  if (fileIndex >= 0) {
    const fileData = trackedFiles[fileIndex];
    const watcherIndex = watchers.findIndex(
      (watcher) => watcher.path === filepath
    );
    if (watcherIndex >= 0) {
      const watcher = watchers[watcherIndex];
      watcher.close();
      watchers.splice(watcherIndex, 1);
    }
    trackedFiles.splice(fileIndex, 1);
    LS.set('tracked_files', trackedFiles);
  }

  return;
});

ipcMain.handle('getLastModified', async (event, filePath) => {
  try {
    const fileStats = await fs.promises.stat(filePath);
    const modifiedAt = fileStats.mtime.toISOString();

    console.log('getLastModified', modifiedAt);

    return { error: null, modifiedAt };
  } catch (error) {
    return { error: error.message, modifiedAt: null };
  }
});

ipcMain.handle('openFile', async (event, allowedTypes) => {
  console.log(`attempting to open file...`);

  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Allowed Types', extensions: allowedTypes }],
    });

    if (canceled) {
      console.log('canceled:', canceled);
      console.log('filePaths:', filePaths);
      console.log('allowedTypes:', allowedTypes);
      return { error: 'File selection was cancelled', newFileData: null };
    }

    const [filePath] = filePaths;
    const fileExtension = path.extname(filePath).toLowerCase().slice(1);

    if (!allowedTypes.includes(fileExtension)) {
      console.log('something something', fileExtension);
      return {
        error: `Selected file type "${fileExtension}" is not supported.`,
        newFileData: null,
      };
    }

    const fileStats = await fs.promises.stat(filePath);

    const newFile = {
      filePath,
      fileName: path.basename(filePath),
      modifiedAt: fileStats.mtime.toISOString(),
    };

    let trackedFiles = LS.get('tracked_files');
    const isAlreadyTracked = trackedFiles.some(
      (file) => file.filePath === newFile.filePath
    );

    if (!isAlreadyTracked) {
      trackedFiles = [newFile, ...trackedFiles];
      LS.set('tracked_files', trackedFiles);
    }

    initializeDatabase(filePath);

    console.log(`
    filePath : ${filePath}
    file : ${J(newFile)}
    trackedFiles : ${J(trackedFiles)}

    saved initial file state
    `);

    return { error: null, newTrackedFiles: trackedFiles };
  } catch (error) {
    return { error: error.message, newTrackedFiles: null };
  }
});

ipcMain.handle('addTrackedFile', (event, fpath_data) => {
  const trackedFiles = LS.get('tracked_files');

  const fileAlreadyTracked = trackedFiles.some(
    (file) => file.filePath === fpath_data.filePath
  );

  if (!fileAlreadyTracked) {
    trackedFiles.push(fpath_data);
    LS.set('tracked_files', trackedFiles);
  }

  return;
});

ipcMain.handle('openDirectory', async (event, dpath) => {
  console.log(`opening directory on path: ${dpath}`);

  shell.openExternal(`file://${path.dirname(dpath)}`);

  console.log('should have opened..');
});

ipcMain.handle('getChanges', async (event, path) => {
  const dbPath = `${path}.db`;
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error(
        `Error initializing SQLite database for file ${dbPath}: ${err.message}`
      );
      return { error: err.message, changes: null };
    }
  });

  const sql = 'SELECT * FROM changes ORDER BY modifiedTime desc';
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {
        console.error(`Error retrieving changes: ${err.message}`);
        console.error(err.stack);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});
