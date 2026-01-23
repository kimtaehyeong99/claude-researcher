import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAdmin, getAccessLogs } from '../api/accessApi';
import type { AccessLog } from '../api/accessApi';

const ADMIN_SESSION_KEY = 'admin_authenticated';

export default function AdminPage() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 세션 확인
  useEffect(() => {
    const savedPassword = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (savedPassword) {
      setAdminPassword(savedPassword);
      setIsAuthenticated(true);
    }
  }, []);

  // 인증 후 로그 로드
  useEffect(() => {
    if (isAuthenticated && adminPassword) {
      loadLogs();
    }
  }, [isAuthenticated, adminPassword]);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await getAccessLogs(adminPassword, 100);
      setLogs(data);
    } catch {
      setError('로그를 불러오는데 실패했습니다.');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isValid = await verifyAdmin(password);
    if (isValid) {
      setAdminPassword(password);
      sessionStorage.setItem(ADMIN_SESSION_KEY, password);
      setIsAuthenticated(true);
    } else {
      setError('비밀번호가 틀렸습니다.');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuthenticated(false);
    setAdminPassword('');
    setLogs([]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <div className="admin-login-container">
          <h2>관리자 인증</h2>
          <p>접속 기록을 보려면 관리자 비밀번호를 입력하세요.</p>

          {error && <div className="admin-error">{error}</div>}

          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !password}>
              {loading ? '확인 중...' : '확인'}
            </button>
          </form>

          <button onClick={() => navigate('/')} className="back-link">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>접속 기록 관리</h1>
        <div className="admin-actions">
          <button onClick={loadLogs} disabled={logsLoading}>
            {logsLoading ? '로딩...' : '새로고침'}
          </button>
          <button onClick={handleLogout} className="logout-btn">
            관리자 로그아웃
          </button>
          <button onClick={() => navigate('/')} className="back-btn">
            메인으로
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="logs-summary">
          <span>총 {logs.length}개의 접속 기록</span>
        </div>

        {logsLoading ? (
          <div className="loading">로딩 중...</div>
        ) : (
          <table className="access-logs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>사용자</th>
                <th>접속 시간</th>
                <th>IP 주소</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.username}</td>
                  <td>{formatDate(log.login_time)}</td>
                  <td>{log.ip_address || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="no-data">접속 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
