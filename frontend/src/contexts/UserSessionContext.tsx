import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logLogin } from '../api/accessApi';

const SESSION_STORAGE_KEY = 'user_session';

export interface UserSession {
  username: string;
  loginTime: string;  // ISO 형식
}

interface UserSessionContextType {
  session: UserSession | null;
  isLoading: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

// localStorage에서 세션 로드
const loadSession = (): UserSession | null => {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('세션 로드 실패:', e);
  }
  return null;
};

// localStorage에 세션 저장
const saveSession = (session: UserSession | null) => {
  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
};

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 컴포넌트 마운트 시 세션 로드
  useEffect(() => {
    const savedSession = loadSession();
    setSession(savedSession);
    setIsLoading(false);
  }, []);

  const login = async (username: string) => {
    try {
      // 백엔드에 로그인 기록
      const response = await logLogin(username);

      const newSession: UserSession = {
        username: response.username,
        loginTime: response.login_time,
      };

      setSession(newSession);
      saveSession(newSession);
    } catch (error) {
      console.error('로그인 기록 실패:', error);
      // 백엔드 실패해도 프론트엔드 세션은 저장
      const fallbackSession: UserSession = {
        username,
        loginTime: new Date().toISOString(),
      };
      setSession(fallbackSession);
      saveSession(fallbackSession);
    }
  };

  const logout = () => {
    setSession(null);
    saveSession(null);
  };

  return (
    <UserSessionContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (context === undefined) {
    throw new Error('useUserSession must be used within a UserSessionProvider');
  }
  return context;
}
