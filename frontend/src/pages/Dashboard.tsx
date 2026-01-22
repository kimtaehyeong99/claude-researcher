import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Paper, PaperFilters } from '../api/paperApi';
import {
  getPapers,
  registerNewPaper,
  registerCitingPapers,
  toggleFavorite,
  toggleNotInterested,
  updateCitationCount,
  deletePaper,
} from '../api/paperApi';
import PaperList from '../components/PaperList';
import RegisterForm from '../components/RegisterForm';
import SearchBar from '../components/SearchBar';

type TabType = 'all' | 'stage1' | 'stage2' | 'stage3' | 'favorites' | 'not_interested';

export default function Dashboard() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: PaperFilters = {
        keyword: keyword || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
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

      const response = await getPapers(filters);
      setPapers(response.papers);
      setTotal(response.total);
    } catch (err) {
      setError('논문 목록을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, keyword, sortBy, sortOrder]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers, activeTab]);

  const handleRegisterNew = async (paperId: string) => {
    setLoading(true);
    setError(null);
    try {
      await registerNewPaper(paperId);
      await fetchPapers();
    } catch (err: any) {
      setError(err.response?.data?.detail || '논문 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterCitations = async (paperId: string, limit: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await registerCitingPapers(paperId, limit);
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
      await toggleFavorite(paperId);
      await fetchPapers();
    } catch (err) {
      console.error('즐겨찾기 토글 실패:', err);
    }
  };

  const handleToggleNotInterested = async (paperId: string) => {
    try {
      await toggleNotInterested(paperId);
      await fetchPapers();
    } catch (err) {
      console.error('관심없음 토글 실패:', err);
    }
  };

  const handleUpdateCitation = async (paperId: string) => {
    try {
      await updateCitationCount(paperId);
      await fetchPapers();
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

  const handlePaperClick = (paperId: string) => {
    navigate(`/paper/${encodeURIComponent(paperId)}`);
  };

  const handleSearch = (searchKeyword: string) => {
    setKeyword(searchKeyword);
  };

  // 검색어 변경 시 자동 조회
  useEffect(() => {
    fetchPapers();
  }, [keyword, fetchPapers]);

  // 정렬 기준이나 순서 변경 시 자동 정렬
  useEffect(() => {
    fetchPapers();
  }, [sortBy, sortOrder, fetchPapers]);


  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'stage1', label: '미분석' },
    { key: 'stage2', label: '요약 완료' },
    { key: 'stage3', label: '상세 분석' },
    { key: 'favorites', label: '즐겨찾기' },
    { key: 'not_interested', label: '관심없음' },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Paper Researcher</h1>
        <p>논문 검색 툴</p>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <RegisterForm
            onRegisterNew={handleRegisterNew}
            onRegisterCitations={handleRegisterCitations}
            loading={loading}
          />
        </aside>

        <main className="main-content">
          <div className="tabs-section">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="filters-section">
            <SearchBar onSearch={handleSearch} placeholder="제목으로 검색..." />
            <div className="sort-controls">
              <label>
                정렬:
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="created_at">등록일</option>
                  <option value="arxiv_date">arXiv 등록일</option>
                  <option value="search_stage">분석 단계</option>
                  <option value="citation_count">인용수</option>
                </select>
              </label>
              <label>
                순서:
                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="desc">높은순</option>
                  <option value="asc">낮은순</option>
                </select>
              </label>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="list-header">
            <span>총 {total}개 논문</span>
          </div>

          <PaperList
            papers={papers}
            onPaperClick={handlePaperClick}
            onToggleFavorite={handleToggleFavorite}
            onToggleNotInterested={handleToggleNotInterested}
            onUpdateCitation={handleUpdateCitation}
            onDelete={handleDelete}
            loading={loading}
            isNotInterestedTab={activeTab === 'not_interested'}
          />
        </main>
      </div>
    </div>
  );
}
