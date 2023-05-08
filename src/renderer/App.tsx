import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

import Home from './home/home.js';
import File from './file/file.js';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/file" element={<File />} />
      </Routes>
    </Router>
  );
}
