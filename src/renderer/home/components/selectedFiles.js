
import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import Button from '@mui/material/Button';

import DeleteIcon from '@mui/icons-material/Delete';
import { Select, Table } from 'antd';

import prettyMilliseconds from 'pretty-ms';

import './css/selectedFiles.css';

function humanFileSize(bytes, si=false, dp=1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si 
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] 
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10**dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}

function SelectedTable({ trackedFiles, removeTrackedFile }) {

  const navigate = useNavigate();

  const columns = [
  {
    title: 'Analyze Changes',
    dataIndex: 'filePath',
    key: 'filePath',
      render: (filePath) => (
        <Button onClick={() => navigate('/file', { state: { filePath } })}>
          GO
        </Button>
      )
  },
  {
    title: 'Tracked File',
    dataIndex: 'filePath',
    key: 'filePath',
    render: (fpath) => (
      <button className="tf" onClick={() => {
        eAPI.openDirectory(fpath);
      }}>
        <div className="open_msg">open folder</div>
        <div className="tf_fpath">{fpath}</div>
        <div className="tf_fname">{fpath.split('/').pop()}</div>
      </button>
    )
  },
  {
    title: 'Last modified',
    dataIndex: 'modifiedAt',
    key: 'filePath',
    render: (dt) => {
      var st = new Date(dt);
      var ms = Date.now() - st.getTime();
      return (<>
        <div className="prettydt">{prettyMilliseconds(ms)} ago..</div>
        <div className="normaldt">{st.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </>)
    }
  },
  {
    title: 'Remove',
    dataIndex: 'filePath',
    key: 'filePath',
    render: (d) => (
      <Button startIcon={<DeleteIcon />} onClick={() => removeTrackedFile(d)} />
    )
  },
];

  return (
    <Table
      columns={columns}
      dataSource={trackedFiles}
      rowKey="filePath"
      rowClassName="animated-row"
    />
  );

}

export default function SelectedFiles({ trackedFiles, removeTrackedFile }) {
  return (
    <div id="selectedFilesw">
      <SelectedTable trackedFiles={trackedFiles} removeTrackedFile={removeTrackedFile} />
    </div>
  )
}