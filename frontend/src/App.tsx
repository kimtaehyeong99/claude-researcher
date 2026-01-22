import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import PaperView from './pages/PaperView';
import DailyPapersPage from './pages/DailyPapersPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/paper/:paperId" element={<PaperView />} />
        <Route path="/daily-papers" element={<DailyPapersPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
