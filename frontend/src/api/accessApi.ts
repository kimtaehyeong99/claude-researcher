import axios from 'axios';

// 환경 변수에서 API URL을 가져오거나, 현재 호스트를 기본값으로 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface AccessLog {
  id: number;
  username: string;
  login_time: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface LoginResponse {
  status: string;
  login_time: string;
  username: string;
}

/**
 * 로그인 기록 저장
 */
export const logLogin = async (username: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/access-logs/login', { username });
  return response.data;
};

/**
 * 관리자 비밀번호 확인
 */
export const verifyAdmin = async (password: string): Promise<boolean> => {
  try {
    await api.post('/access-logs/verify-admin', { password });
    return true;
  } catch {
    return false;
  }
};

/**
 * 접속 로그 조회 (관리자 전용)
 */
export const getAccessLogs = async (adminPassword: string, limit: number = 100, username?: string): Promise<AccessLog[]> => {
  const params: Record<string, string | number> = { limit };
  if (username) {
    params.username = username;
  }
  const response = await api.get<AccessLog[]>('/access-logs/logs', {
    params,
    headers: { 'X-Admin-Password': adminPassword }
  });
  return response.data;
};

/**
 * 등록된 사용자 목록 조회 (활성 사용자만)
 */
export const getUsers = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/access-logs/users');
  return response.data;
};

/**
 * 새 사용자 등록
 */
export const createUser = async (username: string): Promise<void> => {
  await api.post('/access-logs/users', { username });
};

// 하위 호환성을 위한 별칭
export const getAccessUsers = getUsers;
