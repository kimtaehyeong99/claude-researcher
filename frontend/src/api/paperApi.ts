import axios from 'axios';

// 환경 변수에서 API URL을 가져오거나, 현재 호스트를 기본값으로 사용
const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// X-Username 헤더 자동 추가 인터셉터
api.interceptors.request.use((config) => {
  const SESSION_STORAGE_KEY = 'user_session';
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      const session = JSON.parse(saved);
      if (session.username) {
        // 한글 등 non-ASCII 문자를 위해 URL 인코딩
        config.headers['X-Username'] = encodeURIComponent(session.username);
      }
    }
  } catch (e) {
    console.error('세션 읽기 실패:', e);
  }
  return config;
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
  is_shared: boolean;  // 논문 공유 상태
  shared_by: string | null;  // 공유한 사람
  shared_at: string | null;  // 공유 시점
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
  shared?: boolean;  // 공유 필터
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
  // axios의 params 옵션 사용 (자동 URL 인코딩)
  const params: Record<string, string | number | boolean> = {};

  if (filters.stage !== undefined) params.stage = filters.stage;
  if (filters.favorite !== undefined) params.favorite = filters.favorite;
  if (filters.not_interested !== undefined) params.not_interested = filters.not_interested;
  if (filters.hide_not_interested !== undefined) params.hide_not_interested = filters.hide_not_interested;
  if (filters.shared !== undefined) params.shared = filters.shared;
  if (filters.keyword) params.keyword = filters.keyword;
  if (filters.matched_category) params.matched_category = filters.matched_category;
  if (filters.no_category_match !== undefined) params.no_category_match = filters.no_category_match;
  if (filters.registered_by) params.registered_by = filters.registered_by;
  if (filters.sort_by) params.sort_by = filters.sort_by;
  if (filters.sort_order) params.sort_order = filters.sort_order;
  if (filters.skip !== undefined) params.skip = filters.skip;
  if (filters.limit !== undefined) params.limit = filters.limit;

  const response = await api.get<PaperListResponse>('/papers', { params });
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

// Topic search types
export interface SearchResultPaper {
  paper_id: string;
  title: string | null;
  authors: string[];
  year: number | null;
  citation_count: number;
  abstract: string | null;
  already_registered: boolean;
}

export interface TopicSearchResponse {
  papers: SearchResultPaper[];
  total: number;
  query: string;
}

export interface TopicSearchParams {
  query: string;
  limit?: number;
  sort?: 'publicationDate' | 'citationCount' | 'relevance';
  year_from?: number;
}

export interface CitationsPreviewParams {
  paper_id: string;
  limit?: number;
  sort?: 'citationCount' | 'publicationDate';
  year_from?: number;
}

export interface FailedPaperInfo {
  paper_id: string;
  reason: string;
}

export interface BulkRegisterResponse {
  registered: Paper[];
  skipped: string[];
  failed: FailedPaperInfo[];
  message: string;
}

// Search papers by topic
export const searchByTopic = async (params: TopicSearchParams): Promise<TopicSearchResponse> => {
  const response = await api.get<TopicSearchResponse>('/topic-search', { params });
  return response.data;
};

// Preview citing papers (before registration)
export const previewCitingPapers = async (params: CitationsPreviewParams): Promise<TopicSearchResponse> => {
  const response = await api.get<TopicSearchResponse>('/citations-preview', { params });
  return response.data;
};

// AI Search types
export interface AISearchParams {
  query: string;
  limit?: number;
  year_from?: number;
}

export interface AISearchResponse extends TopicSearchResponse {
  expanded_keywords: string[];
  search_intent: string;
}

// AI Search (Claude-powered intelligent search)
export const aiSearch = async (params: AISearchParams): Promise<AISearchResponse> => {
  const response = await api.post<AISearchResponse>('/topic-search/ai-search', params);
  return response.data;
};

// Bulk register papers (with citation counts)
export interface BulkPaperInfo {
  paper_id: string;
  citation_count: number;
}

export const registerBulk = async (papers: BulkPaperInfo[], registeredBy?: string): Promise<BulkRegisterResponse> => {
  const response = await api.post<BulkRegisterResponse>('/register/bulk', {
    papers,
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

// Toggle share
export const toggleShare = async (paperId: string): Promise<Paper> => {
  const response = await api.patch<Paper>(`/papers/${paperId}/share`);
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
