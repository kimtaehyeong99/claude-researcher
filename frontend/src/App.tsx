import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PaperView from './pages/PaperView';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/paper/:paperId" element={<PaperView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
