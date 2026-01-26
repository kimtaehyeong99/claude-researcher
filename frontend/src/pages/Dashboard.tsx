import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Paper, PaperFilters } from '../api/paperApi';
import { useUserSession } from '../contexts/UserSessionContext';
import {
  getPapers,
  registerNewPaper,
  registerCitingPapers,
  toggleFavorite,
  toggleNotInterested,
  updateCitationCount,
  deletePaper,
  bulkNotInterested,
  bulkDeletePapers,
  bulkRestorePapers,
  getCategories,
  getRegisteredByList,
} from '../api/paperApi';
import PaperList from '../components/PaperList';
import RegisterForm from '../components/RegisterForm';
import SearchBar from '../components/SearchBar';
import KeywordManager from '../components/KeywordManager';

type TabType = 'all' | 'stage1' | 'stage2' | 'stage3' | 'favorites' | 'not_interested';

const PAGE_SIZE = 10;

// localStorage에서 대시보드 상태 로드 (배치 저장 방식)
const loadDashboardState = () => {
  try {
    const saved = localStorage.getItem('dashboard_state');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('대시보드 상태 로드 실패:', e);
  }
  return {};
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { session, logout } = useUserSession();

  // 저장된 대시보드 상태 로드 (배치 방식)
  const savedState = loadDashboardState();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(savedState.activeTab || 'all');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<string>(savedState.sortBy || 'created_at');
  const [sortOrder, setSortOrder] = useState<string>(savedState.sortOrder || 'desc');
  const [currentPage, setCurrentPage] = useState<number>(savedState.currentPage || 1);
  // 카테고리 필터 상태
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>(savedState.categoryFilter || '');
  // 등록자 필터 상태
  const [registeredByList, setRegisteredByList] = useState<string[]>([]);
  const [registeredByFilter, setRegisteredByFilter] = useState<string>(savedState.registeredByFilter || '');

  // 필터 데이터 병렬 조회 (카테고리 + 등록자 목록)
  const fetchFilterData = useCallback(async () => {
    try {
      const [categoriesData, registeredByData] = await Promise.all([
        getCategories(),
        getRegisteredByList(),
      ]);
      setCategories(categoriesData || []);
      setRegisteredByList(registeredByData || []);
    } catch (err) {
      console.error('필터 데이터 로드 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  const fetchPapers = useCallback(async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const filters: PaperFilters = {
        keyword: keyword || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };

      // Add tab-specific filters
      switch (activeTab) {
        case 'stage1':
          filters.stage = 1;
          filters.hide_not_interested = true;
          break;
        case 'stage2':
          filters.stage = 2;
          filters.hide_not_interested = true;
          break;
        case 'stage3':
          filters.stage = 3;
          filters.hide_not_interested = true;
          break;
        case 'favorites':
          filters.favorite = true;
          filters.hide_not_interested = false;
          break;
        case 'not_interested':
          filters.not_interested = true;
          filters.hide_not_interested = false;
          break;
        default:
          filters.hide_not_interested = true;
      }

      // 카테고리 필터 적용
      if (categoryFilter === '__no_match__') {
        filters.no_category_match = true;
      } else if (categoryFilter) {
        filters.matched_category = categoryFilter;
      }

      // 등록자 필터 적용
      if (registeredByFilter) {
        filters.registered_by = registeredByFilter;
      }

      const response = await getPapers(filters);
      setPapers(response.papers);
      setTotal(response.total);
    } catch (err) {
      setError('논문 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, keyword, sortBy, sortOrder, currentPage, categoryFilter, registeredByFilter]);

  // 단일 useEffect로 통합 (중복 호출 방지)
  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleRegisterNew = async (paperId: string, registeredBy?: string) => {
    setLoading(true);
    setError(null);
    try {
      await registerNewPaper(paperId, registeredBy);
      await fetchPapers();
    } catch (err: any) {
      setError(err.response?.data?.detail || '논문 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCitations = async (paperId: string, limit: number, registeredBy?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await registerCitingPapers(paperId, limit, registeredBy);
      await fetchPapers();
      alert(`${result.length}개의 새로운 인용 논문이 등록되었습니다.`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '인용 논문 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (paperId: string) => {
    try {
      const updatedPaper = await toggleFavorite(paperId);
      // 로컬 상태만 업데이트 (전체 재조회 대신)
      setPapers(papers.map(p =>
        p.paper_id === paperId ? { ...p, is_favorite: updatedPaper.is_favorite } : p
      ));
    } catch (err) {
      console.error('즐겨찾기 토글 실패:', err);
    }
  };

  const handleToggleNotInterested = async (paperId: string) => {
    try {
      const updatedPaper = await toggleNotInterested(paperId);
      // 로컬 상태만 업데이트 (전체 재조회 대신)
      // 관심없음 탭이 아니면 목록에서 제거, 관심없음 탭이면 업데이트
      if (activeTab === 'not_interested') {
        setPapers(papers.map(p =>
          p.paper_id === paperId ? { ...p, is_not_interested: updatedPaper.is_not_interested } : p
        ));
      } else {
        // 관심없음으로 표시되면 현재 목록에서 제거
        if (updatedPaper.is_not_interested) {
          setPapers(papers.filter(p => p.paper_id !== paperId));
          setTotal(prev => prev - 1);
        } else {
          setPapers(papers.map(p =>
            p.paper_id === paperId ? { ...p, is_not_interested: updatedPaper.is_not_interested } : p
          ));
        }
      }
    } catch (err) {
      console.error('관심없음 토글 실패:', err);
    }
  };

  const handleUpdateCitation = async (paperId: string) => {
    try {
      const updatedPaper = await updateCitationCount(paperId);
      // 로컬 상태만 업데이트 (전체 재조회 대신)
      setPapers(papers.map(p =>
        p.paper_id === paperId ? { ...p, citation_count: updatedPaper.citation_count } : p
      ));
    } catch (err: any) {
      setError(err.response?.data?.detail || '인용수 업데이트 실패');
    }
  };

  const handleDelete = async (paperId: string) => {
    if (!confirm(`${paperId} 논문을 삭제하시겠습니까?`)) return;
    try {
      await deletePaper(paperId);
      await fetchPapers();
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  // 일괄 처리 핸들러
  const handleBulkNotInterested = async (paperIds: string[]) => {
    setLoading(true);
    try {
      const result = await bulkNotInterested(paperIds);
      alert(result.message);
      await fetchPapers();
    } catch (err) {
      console.error('일괄 관심없음 처리 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (paperIds: string[]) => {
    setLoading(true);
    try {
      const result = await bulkDeletePapers(paperIds);
      alert(result.message);
      await fetchPapers();
    } catch (err) {
      console.error('일괄 삭제 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRestore = async (paperIds: string[]) => {
    setLoading(true);
    try {
      const result = await bulkRestorePapers(paperIds);
      alert(result.message);
      await fetchPapers();
    } catch (err) {
      console.error('일괄 복원 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaperClick = (paperId: string) => {
    navigate(`/paper/${encodeURIComponent(paperId)}`);
  };

  // localStorage는 useEffect에서 자동 동기화됨 (중복 호출 제거)
  const handleSearch = (searchKeyword: string) => {
    setKeyword(searchKeyword);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleSortOrderChange = (value: string) => {
    setSortOrder(value);
    setCurrentPage(1);
  };

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleRegisteredByFilterChange = (value: string) => {
    setRegisteredByFilter(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 키워드 변경 시 카테고리 목록도 갱신
  const handleKeywordsChange = async () => {
    // 카테고리만 다시 조회 (등록자 목록은 키워드와 무관)
    try {
      const categoriesData = await getCategories();
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('카테고리 로드 실패:', err);
    }
    fetchPapers();
  };

  // localStorage 상태 동기화 - 배치 저장 (6개 개별 쓰기 → 1개 JSON 객체)
  useEffect(() => {
    const dashboardState = {
      sortBy,
      sortOrder,
      activeTab,
      currentPage,
      categoryFilter,
      registeredByFilter,
    };
    localStorage.setItem('dashboard_state', JSON.stringify(dashboardState));
  }, [sortBy, sortOrder, activeTab, currentPage, categoryFilter, registeredByFilter]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'stage1', label: '미분석' },
    { key: 'stage2', label: '개요 분석' },
    { key: 'stage3', label: '상세 분석' },
    { key: 'favorites', label: '즐겨찾기' },
    { key: 'not_interested', label: '관심없음' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-top">
          <button onClick={() => navigate('/admin')} className="admin-link">관리자 모드</button>
          <div className="header-title">
            <h1>Paper Researcher</h1>
            <p>논문 검색 사이트</p>
          </div>
          {session && (
            <div className="user-header">
              <span>현재 사용자: <strong>{session.username}</strong></span>
              <button onClick={logout} className="logout-btn">로그아웃</button>
            </div>
          )}
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <RegisterForm
            onRegisterNew={handleRegisterNew}
            onRegisterCitations={handleRegisterCitations}
            loading={loading}
          />
          <KeywordManager onKeywordsChange={handleKeywordsChange} />
          <button
            className="daily-papers-link"
            onClick={() => navigate('/daily-papers')}
          >
            📰 HuggingFace Daily Papers →
          </button>
        </aside>

        <main className="main-content">
          <div className="tabs-section">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="filters-section">
            <SearchBar onSearch={handleSearch} placeholder="제목으로 검색..." />
            <div className="sort-controls-box">
              <label>
                카테고리:
                <select value={categoryFilter} onChange={(e) => handleCategoryFilterChange(e.target.value)}>
                  <option value="">전체</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {categories.length > 0 && (
                    <option value="__no_match__">카테고리 미해당</option>
                  )}
                </select>
              </label>
              {registeredByList.length > 0 && (
                <label>
                  등록자:
                  <select value={registeredByFilter} onChange={(e) => handleRegisteredByFilterChange(e.target.value)}>
                    <option value="">전체</option>
                    {registeredByList.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                정렬:
                <select value={sortBy} onChange={(e) => handleSortByChange(e.target.value)}>
                  <option value="created_at">등록일</option>
                  <option value="arxiv_date">arXiv 등록일</option>
                  <option value="search_stage">분석 단계</option>
                  <option value="citation_count">인용수</option>
                </select>
              </label>
              <label>
                순서:
                <select value={sortOrder} onChange={(e) => handleSortOrderChange(e.target.value)}>
                  <option value="desc">높은순</option>
                  <option value="asc">낮은순</option>
                </select>
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="list-header">
            <span>총 {total}개 논문</span>
            <span className="page-info">
              {total > 0 && `(${currentPage} / ${Math.ceil(total / PAGE_SIZE)} 페이지)`}
            </span>
          </div>

          <PaperList
            papers={papers}
            onPaperClick={handlePaperClick}
            onToggleFavorite={handleToggleFavorite}
            onToggleNotInterested={handleToggleNotInterested}
            onUpdateCitation={handleUpdateCitation}
            onDelete={handleDelete}
            onBulkNotInterested={handleBulkNotInterested}
            onBulkDelete={handleBulkDelete}
            onBulkRestore={handleBulkRestore}
            loading={loading}
            isNotInterestedTab={activeTab === 'not_interested'}
          />

          {/* 페이지네이션 */}
          {total > PAGE_SIZE && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="page-btn"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="page-btn"
              >
                ‹
              </button>

              {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1)
                .filter(page => {
                  const totalPages = Math.ceil(total / PAGE_SIZE);
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 2) return true;
                  return false;
                })
                .map((page, idx, arr) => (
                  <span key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && <span className="page-ellipsis">...</span>}
                    <button
                      onClick={() => handlePageChange(page)}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                    >
                      {page}
                    </button>
                  </span>
                ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= Math.ceil(total / PAGE_SIZE)}
                className="page-btn"
              >
                ›
              </button>
              <button
                onClick={() => handlePageChange(Math.ceil(total / PAGE_SIZE))}
                disabled={currentPage >= Math.ceil(total / PAGE_SIZE)}
                className="page-btn"
              >
                »
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
