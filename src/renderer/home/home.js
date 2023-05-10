import { useState, useEffect, useCallback } from 'react';

import Button from '@mui/material/Button';

import { SnackbarProvider, enqueueSnackbar } from 'notistack';

import E from '../common/errors.js';
import { J } from '../common/utils.js';

import SelectedFiles from './components/selectedFiles.js';

import './home.css';

import img1 from '../static/1.png';
import img2 from '../static/2.png';
import img3 from '../static/3.png';
// import img4 from '../static/4.png';

function About() {
  return (
    <div id="about">
      <span id="logo">AuthorGuard</span> automatically saves and tracks changes
      made to selected document type files, allowing you to easily prove
      ownership of your work, to counter the limitations of some AI plagiarism
      detectors.
    </div>
  );
}

function HowToUse() {
  const [selectedImage, setSelectedImage] = useState(img1);

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  return (
    <center>
      <div id="howToUsew">
        <div id="imageMenu">
          <img
            src={img1}
            alt="how to use 1"
            onClick={() => handleImageClick(img1)}
          />
          <img
            src={img2}
            alt="how to use 2"
            onClick={() => handleImageClick(img2)}
          />
          <img
            src={img3}
            alt="how to use 3"
            onClick={() => handleImageClick(img3)}
          />
        </div>
        {selectedImage && (
          <div id="selectedImage">
            <img src={selectedImage} alt="currently displayed how to use" />
          </div>
        )}
      </div>
    </center>
  );
}

export default function Home() {
  const [trackedFiles, setTrackedFiles] = useState([]);

  const handleFileChanged = useCallback(
    async (filePath) => {
      console.log(`
      detected ${filePath} has changed
      trackedFiles: ${J(trackedFiles)}
    `);
      // Find the index of the trackedFile with the matching filePath
      const index = trackedFiles.findIndex(
        (file) => file.filePath === filePath
      );
      // If found, create a copy of the trackedFile and update its modifiedAt value
      if (index !== -1) {
        const updatedFile = {
          ...trackedFiles[index],
          modifiedAt: new Date().toISOString(),
        };
        // Create a copy of the trackedFiles array and replace the old file with the updated one
        const updatedFiles = [...trackedFiles];
        updatedFiles[index] = updatedFile;
        // Set the state with the updated array
        setTrackedFiles(() => updatedFiles);
      }
      enqueueSnackbar(`File ${filePath} has changed.`, {
        variant: 'info',
      });
    },
    [trackedFiles]
  );

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
  }, [handleFileChanged, trackedFiles]);

  async function selectFile() {
    console.log('selecting new file to track...');

    try {
      const { error, newTrackedFiles } = await electron.eAPI.openFile([
        'txt',
        'md',
        'docx',
      ]);

      if (error) {
        console.log(error);
        enqueueSnackbar(error, {
          variant: 'warning',
        });
        return;
      }

      setTrackedFiles(newTrackedFiles);

      const fn = newTrackedFiles[0].fileName;
      enqueueSnackbar(`Now tracking file: ${fn}`, {
        variant: 'success',
      });

      console.log(`
        selected file and added it to tracked_files

        ${J(newTrackedFiles)}
      `);
    } catch (error) {
      const emsg = `
        Error: API : selectFile

        Failed to choose a file to track.

        ${error}

        `;
      console.log(E(emsg));

      enqueueSnackbar(`Failed to choose a file to track.`, {
        variant: 'warning',
      });
    }
  }

  const removeTrackedFile = (filePath) => {
    // Remove the file from the tracked files array
    const updatedTrackedFiles = trackedFiles.filter(
      (file) => file.filePath !== filePath
    );
    setTrackedFiles(updatedTrackedFiles);

    // Call the eAPI function to remove the file
    electron.eAPI
      .removeTrackedFile(filePath)
      .then(() => {
        enqueueSnackbar(`File ${filePath} removed from tracking`, {
          variant: 'success',
        });
      })
      .catch((error) => {
        console.error(`Error removing ${filePath} from tracking`, error);
        enqueueSnackbar(`Error removing ${filePath} from tracking`, {
          variant: 'error',
        });
      });
  };

  const selectedFileProps = {
    trackedFiles,
    removeTrackedFile,
  };

  return (
    <>
      <SnackbarProvider autoHideDuration={2000} />
      <div className="main">
        <About />
        <div id="selectFilew">
          <Button variant="contained" onClick={selectFile}>
            Select new file to track
          </Button>
        </div>
        <SelectedFiles {...selectedFileProps} />
        <HowToUse />
      </div>
    </>
  );
}
