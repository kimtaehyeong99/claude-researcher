import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import './App.css';
import { UserSessionProvider, useUserSession } from './contexts/UserSessionContext';
import UserLoginModal from './components/UserLoginModal';

// Lazy loading으로 초기 번들 크기 감소
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PaperView = lazy(() => import('./pages/PaperView'));
const DailyPapersPage = lazy(() => import('./pages/DailyPapersPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// 로딩 컴포넌트
function LoadingFallback() {
  return (
    <div className="loading-fallback">
      <div className="loading-spinner"></div>
      <p>페이지 로딩중...</p>
    </div>
  );
}

// 로그인 가드: 세션 없으면 로그인 모달 표시
function LoginGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useUserSession();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!session) {
    return <UserLoginModal />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <UserSessionProvider>
      <BrowserRouter>
        <LoginGuard>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/paper/:paperId" element={<PaperView />} />
              <Route path="/daily-papers" element={<DailyPapersPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </LoginGuard>
      </BrowserRouter>
    </UserSessionProvider>
  );
}

export default App;
