import { useState, useEffect } from 'react';
import { useUserSession } from '../contexts/UserSessionContext';
import { getUsers, createUser } from '../api/accessApi';

export default function UserLoginModal() {
  const { login } = useUserSession();
  const [selectedUser, setSelectedUser] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DB에서 등록된 사용자 목록 로드
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getUsers();
        setUserOptions(users);
      } catch {
        setError('사용자 목록을 불러오는데 실패했습니다.');
      }
    };

    loadUsers();
  }, []);

  const handleAddNewUser = async () => {
    const trimmedName = newUserName.trim();
    if (!trimmedName) return;

    if (userOptions.includes(trimmedName)) {
      setError('이미 존재하는 이름입니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // DB에 새 사용자 등록
      await createUser(trimmedName);

      // 목록 업데이트
      const newOptions = [...userOptions, trimmedName].sort((a, b) => a.localeCompare(b, 'ko'));
      setUserOptions(newOptions);
      setSelectedUser(trimmedName);
      setNewUserName('');
      setShowAddNew(false);
    } catch {
      setError('사용자 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const username = selectedUser.trim();
    if (!username) {
      setError('이름을 선택하거나 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username);
    } catch {
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showAddNew) {
        handleAddNewUser();
      } else {
        handleLogin();
      }
    }
  };

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        <h2>논문 검색 시스템</h2>
        <p className="login-description">사용자를 선택하거나 새로 등록해주세요.</p>

        {error && <div className="login-error">{error}</div>}

        <div className="login-form">
          <label htmlFor="userSelect">사용자 선택:</label>
          <select
            id="userSelect"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            disabled={loading}
          >
            <option value="">-- 선택 --</option>
            {userOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAddNew(!showAddNew)}
            className="toggle-add-btn"
          >
            {showAddNew ? '취소' : '새 사용자 추가'}
          </button>

          {showAddNew && (
            <div className="add-user-section">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="새 사용자 이름 입력"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleAddNewUser}
                disabled={!newUserName.trim() || loading}
              >
                추가
              </button>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={!selectedUser || loading}
            className="login-btn"
          >
            {loading ? '로그인 중...' : '시작하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
