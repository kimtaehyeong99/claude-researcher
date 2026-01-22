import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import './App.css';

// Lazy loading으로 초기 번들 크기 감소
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PaperView = lazy(() => import('./pages/PaperView'));
const DailyPapersPage = lazy(() => import('./pages/DailyPapersPage'));

// 로딩 컴포넌트
function LoadingFallback() {
  return (
    <div className="loading-fallback">
      <div className="loading-spinner"></div>
      <p>페이지 로딩중...</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/paper/:paperId" element={<PaperView />} />
          <Route path="/daily-papers" element={<DailyPapersPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
