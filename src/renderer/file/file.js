import { useState, useEffect, useRef } from 'react';

import { Link, useLocation } from 'react-router-dom';

import { SnackbarProvider, enqueueSnackbar } from 'notistack';

import './file.css';
import { Menu, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

import prettyMilliseconds from 'pretty-ms';
import ReactMarkdown from 'react-markdown';

import E from '../common/errors.js';

const jsdiff = require('diff');

export default function File() {
  const location = useLocation();
  const [filePath, setFilePath] = useState(location.state.filePath);
  const [changes, setChanges] = useState([]);
  const [trackedFiles, setTrackedFiles] = useState([]);

  async function fetchData() {
    const rows = await electron.eAPI.getChanges(filePath);
    setChanges(() => rows);
  }

  const handleFileChanged = async (filePath) => {
    console.log(`detected ${filePath} has changed`);

    setTrackedFiles((prevTrackedFiles) => [...prevTrackedFiles]);

    await fetchData();

    enqueueSnackbar(`File ${filePath} has changed.`, {
      variant: 'info',
    });
  };

  useEffect(() => {
    let mounted = true;

    electron.eAPI.removeListener();

    electron.eAPI
      .getTrackedFiles()
      .then(async (result) => {
        const vFiles = result.verifiedFiles;
        const nfFiles = result.notFoundFiles;

        const check =
          nfFiles.length === 0 &&
          vFiles.length === trackedFiles.length &&
          trackedFiles.every((e, i) => e.filePath === vFiles[i].filePath);

        if (check) {
          console.log('getTrackedFiles passed check');
          console.log('trackedFiles:', trackedFiles);
          return;
        }

        console.log(
          `
        verified tracked files:

        `,
          vFiles
        );

        console.log(
          `
        not Found files:

        `,
          nfFiles
        );

        setTrackedFiles(vFiles);

        if (mounted) {
          let delay = 0;

          if (nfFiles.length > 0) {
            console.log(
              `Some tracked files were not found on your file system. They may have been deleted.`
            );

            delay = 0;

            for (const nff of nfFiles) {
              setTimeout(() => {
                enqueueSnackbar(
                  `File not found: ${nff.filePath}. Removed from tracked files.`,
                  {
                    variant: 'warning',
                  }
                );
              }, delay);

              delay += 3000;
            }
          }
        }
      })
      .catch((err) => {
        const emsg = `
          Error: API : getTrackedFiles

          ${err}

          `;
        console.log(E(emsg));
      });

    electron.eAPI.onFileChanged(handleFileChanged);

    return () => {
      mounted = false;
    };
  }, [trackedFiles]);

  useEffect(() => {
    fetchData();
  }, [filePath]);

  function toggleContent(index) {
    setChanges((prevChanges) => {
      const newChanges = [...prevChanges];
      newChanges[index].showContent = !newChanges[index].showContent;
      return newChanges;
    });
  }

  function generateDiff(index) {
    const currentChange = changes[index];
    if (index < changes.length - 1 && !currentChange.diff) {
      const currentFileContent = currentChange.fileContent;
      const nextFileContent = changes[index + 1].fileContent;
      const diff = jsdiff.diffLines(nextFileContent, currentFileContent);
      const diffString = diff
        .map((part) => {
          const className = part.added
            ? 'added'
            : part.removed
            ? 'removed'
            : 'normal';
          return `<span class=${className}>${part.value}</span>`;
        })
        .join('');
      setChanges((prevChanges) => {
        const newChanges = [...prevChanges];
        newChanges[index].diff = diffString;
        return newChanges;
      });
    } else {
      setChanges((prevChanges) => {
        const newChanges = [...prevChanges];
        newChanges[index].diff = null;
        return newChanges;
      });
    }
  }

  const getCharDiff = (change, index, changes) => {
    const diff =
      change.fileContent.length - changes[index + 1].fileContent.length;
    const color = diff < 0 ? 'red' : 'green';
    return (
      <small>
        {diff} characters{' '}
        <span style={{ color }}>{diff < 0 ? 'less' : 'more'}</span>{' '}
      </small>
    );
  };

  return (
    <div>
      <SnackbarProvider autoHideDuration={2000} />
      <Menu mode="horizontal">
        <Menu.Item key="home" icon={<HomeOutlined />}>
          <Link to="/">Home</Link>
        </Menu.Item>
        <Menu.Item key="file" disabled>
          <span className="fpath">{filePath}</span>
        </Menu.Item>
      </Menu>
      <div id="totalChanges">{changes.length} changes recorded..</div>
      {changes.map((change, index) => (
        <div className="change" key={index}>
          <div>
            <div className="prettydt">
              {prettyMilliseconds(Date.now() - new Date(change.modifiedTime), {
                compact: true,
                verbose: true,
              })}{' '}
              ago..
            </div>
            <div className="normaldt">
              {new Date(change.modifiedTime).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
              })}
            </div>
            <div className="chars">
              <span className="flength">
                {change.fileContent.length} chars{' '}
              </span>
              {index < changes.length - 1 &&
                getCharDiff(change, index, changes)}
            </div>
            <Button onClick={() => toggleContent(index)}>
              {change.showContent ? 'Hide' : 'Show'} Content
            </Button>
            {index < changes.length - 1 && (
              <Button onClick={() => generateDiff(index)}>
                {change.diff ? 'Hide' : 'Generate Diff'}
              </Button>
            )}
          </div>
          {change.showContent && (
            <ReactMarkdown>{change.fileContent}</ReactMarkdown>
          )}
          {change.diff && (
            <div
              className="diff"
              dangerouslySetInnerHTML={{ __html: change.diff }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
