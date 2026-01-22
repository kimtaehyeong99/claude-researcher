import axios from 'axios';

// 환경 변수에서 API URL을 가져오거나, 현재 호스트를 기본값으로 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Paper {
  id: number;
  paper_id: string;
  arxiv_date: string | null;
  title: string | null;
  search_stage: number;
  is_favorite: boolean;
  is_not_interested: boolean;
  citation_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaperDetail extends Paper {
  abstract_ko?: string;  // 2단계: 초록 요약
  detailed_analysis_ko?: string;  // 3단계: 전체 논문 분석
}

export interface PaperListResponse {
  papers: Paper[];
  total: number;
}

export interface PaperFilters {
  stage?: number;
  favorite?: boolean;
  not_interested?: boolean;
  hide_not_interested?: boolean;
  keyword?: string;
  sort_by?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}

// Get papers list with filters
export const getPapers = async (filters: PaperFilters = {}): Promise<PaperListResponse> => {
  const params = new URLSearchParams();
  if (filters.stage !== undefined) params.append('stage', filters.stage.toString());
  if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
  if (filters.not_interested !== undefined) params.append('not_interested', filters.not_interested.toString());
  if (filters.hide_not_interested !== undefined) params.append('hide_not_interested', filters.hide_not_interested.toString());
  if (filters.keyword) params.append('keyword', filters.keyword);
  if (filters.sort_by) params.append('sort_by', filters.sort_by);
  if (filters.sort_order) params.append('sort_order', filters.sort_order);
  if (filters.skip !== undefined) params.append('skip', filters.skip.toString());
  if (filters.limit !== undefined) params.append('limit', filters.limit.toString());

  const response = await api.get<PaperListResponse>(`/papers?${params.toString()}`);
  return response.data;
};

// Get paper detail
export const getPaper = async (paperId: string): Promise<PaperDetail> => {
  const response = await api.get<PaperDetail>(`/papers/${paperId}`);
  return response.data;
};

// Register new paper (Stage 1)
export const registerNewPaper = async (paperId: string): Promise<Paper> => {
  const response = await api.post<Paper>('/register/new', { paper_id: paperId });
  return response.data;
};

// Register citing papers (Stage 1)
export const registerCitingPapers = async (paperId: string, limit: number = 50): Promise<Paper[]> => {
  const response = await api.post<Paper[]>('/register/citations', {
    paper_id: paperId,
    limit,
  });
  return response.data;
};

// Simple search (Stage 2)
export const simpleSearch = async (paperId: string): Promise<PaperDetail> => {
  const response = await api.post<PaperDetail>(`/search/simple/${paperId}`);
  return response.data;
};

// Deep search (Stage 3)
export const deepSearch = async (paperId: string): Promise<PaperDetail> => {
  const response = await api.post<PaperDetail>(`/search/deep/${paperId}`);
  return response.data;
};

// Toggle favorite
export const toggleFavorite = async (paperId: string): Promise<Paper> => {
  const response = await api.patch<Paper>(`/papers/${paperId}/favorite`);
  return response.data;
};

// Toggle not interested
export const toggleNotInterested = async (paperId: string): Promise<Paper> => {
  const response = await api.patch<Paper>(`/papers/${paperId}/not-interested`);
  return response.data;
};

// Update citation count
export const updateCitationCount = async (paperId: string): Promise<Paper> => {
  const response = await api.patch<Paper>(`/papers/${paperId}/update-citation`);
  return response.data;
};

// Delete paper
export const deletePaper = async (paperId: string): Promise<void> => {
  await api.delete(`/papers/${paperId}`);
};

export default api;
