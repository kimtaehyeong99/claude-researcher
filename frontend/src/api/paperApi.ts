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
  analysis_status: 'simple_analyzing' | 'deep_analyzing' | null;  // 분석 상태
  is_favorite: boolean;
  is_not_interested: boolean;
  citation_count: number;
  registered_by: string | null;  // 등록자 이름
  figure_url: string | null;  // 논문 첫 Figure 이미지 URL
  matched_keywords: string[] | null;  // 매칭된 키워드 목록
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
  matched_category?: string;  // 카테고리 필터
  no_category_match?: boolean;  // 카테고리 미해당 필터
  registered_by?: string;  // 등록자 필터
  sort_by?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}

// Trending Papers types
export interface TrendingPaper {
  paper_id: string;
  title: string;
  summary: string;
  upvotes: number;
  ai_summary?: string;
  ai_keywords?: string[];
  published_at: string;
  github_repo?: string;
  github_stars?: number;
  num_comments: number;
  thumbnail?: string;
  authors?: string[];
}

export interface TrendingPapersResponse {
  papers: TrendingPaper[];
  date: string;
  total: number;
  period: 'day' | 'week' | 'month';
}

export type PeriodType = 'day' | 'week' | 'month';

// Get papers list with filters
export const getPapers = async (filters: PaperFilters = {}): Promise<PaperListResponse> => {
  const params = new URLSearchParams();
  if (filters.stage !== undefined) params.append('stage', filters.stage.toString());
  if (filters.favorite !== undefined) params.append('favorite', filters.favorite.toString());
  if (filters.not_interested !== undefined) params.append('not_interested', filters.not_interested.toString());
  if (filters.hide_not_interested !== undefined) params.append('hide_not_interested', filters.hide_not_interested.toString());
  if (filters.keyword) params.append('keyword', filters.keyword);
  if (filters.matched_category) params.append('matched_category', filters.matched_category);
  if (filters.no_category_match !== undefined) params.append('no_category_match', filters.no_category_match.toString());
  if (filters.registered_by) params.append('registered_by', filters.registered_by);
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
export const registerNewPaper = async (paperId: string, registeredBy?: string): Promise<Paper> => {
  const response = await api.post<Paper>('/register/new', {
    paper_id: paperId,
    registered_by: registeredBy,
  });
  return response.data;
};

// Register citing papers (Stage 1)
export const registerCitingPapers = async (paperId: string, limit: number = 50, registeredBy?: string): Promise<Paper[]> => {
  const response = await api.post<Paper[]>('/register/citations', {
    paper_id: paperId,
    limit,
    registered_by: registeredBy,
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

// Bulk operations
export interface BulkResponse {
  message: string;
  count: number;
}

// Bulk mark as not interested
export const bulkNotInterested = async (paperIds: string[]): Promise<BulkResponse> => {
  const response = await api.post<BulkResponse>('/papers/bulk/not-interested', paperIds);
  return response.data;
};

// Bulk delete papers
export const bulkDeletePapers = async (paperIds: string[]): Promise<BulkResponse> => {
  const response = await api.post<BulkResponse>('/papers/bulk/delete', paperIds);
  return response.data;
};

// Bulk restore from not interested
export const bulkRestorePapers = async (paperIds: string[]): Promise<BulkResponse> => {
  const response = await api.post<BulkResponse>('/papers/bulk/restore', paperIds);
  return response.data;
};

// Get trending papers from HuggingFace Daily Papers
export const getTrendingPapers = async (
  date?: string,
  period: PeriodType = 'day'
): Promise<TrendingPapersResponse> => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (period !== 'day') params.append('period', period);

  const queryString = params.toString();
  const url = queryString ? `/trending/daily?${queryString}` : '/trending/daily';
  const response = await api.get<TrendingPapersResponse>(url);
  return response.data;
};

// Keyword types
export interface UserKeyword {
  id: number;
  keyword: string;
  category: string | null;  // 카테고리
  color: string;
  created_at: string;
}

export interface KeywordListResponse {
  keywords: UserKeyword[];
  total: number;
  categories: string[];  // 사용 중인 카테고리 목록
}

// Get categories only (lightweight API for Dashboard filter)
export const getCategories = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/keywords/categories');
  return response.data;
};

// Get registered_by list for filtering
export const getRegisteredByList = async (): Promise<string[]> => {
  const response = await api.get<string[]>('/papers/registered-by');
  return response.data;
};

// Get all keywords
export const getKeywords = async (): Promise<KeywordListResponse> => {
  const response = await api.get<KeywordListResponse>('/keywords');
  return response.data;
};

// Create keyword
export const createKeyword = async (
  keyword: string,
  category: string | null = null,
  color: string = '#3b82f6'
): Promise<UserKeyword> => {
  const response = await api.post<UserKeyword>('/keywords', { keyword, category, color });
  return response.data;
};

// Delete keyword
export const deleteKeyword = async (keywordId: number): Promise<void> => {
  await api.delete(`/keywords/${keywordId}`);
};

// Update keyword
export const updateKeyword = async (keywordId: number, keyword: string, color: string): Promise<UserKeyword> => {
  const response = await api.patch<UserKeyword>(`/keywords/${keywordId}`, { keyword, color });
  return response.data;
};

// Batch update all paper keywords
export const batchUpdateKeywords = async (): Promise<BulkResponse> => {
  const response = await api.post<BulkResponse>('/keywords/batch-update');
  return response.data;
};

export default api;
