import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrendingPaper, PeriodType } from '../api/paperApi';
import { getTrendingPapers, registerNewPaper } from '../api/paperApi';

const KEYWORDS_STORAGE_KEY = 'dailyPapers_filterKeywords';

// ISO 주차 계산 함수
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// 주차 문자열에서 마지막 날짜 계산
function getLastDayOfWeek(weekStr: string): string {
  const [year, week] = weekStr.split('-W').map(Number);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (week - 1) * 7 + 6); // 일요일
  return targetDate.toISOString().split('T')[0];
}

// 월 문자열에서 마지막 날짜 계산
function getLastDayOfMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0);
  return lastDay.toISOString().split('T')[0];
}

export default function DailyPapersPage() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<TrendingPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const weekNum = getISOWeekNumber(today);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [period, setPeriod] = useState<PeriodType>('day');
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  // 키워드 필터 상태
  const [filterKeywords, setFilterKeywords] = useState<string[]>(() => {
    const saved = localStorage.getItem(KEYWORDS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [filterEnabled, setFilterEnabled] = useState(true);

  const fetchPapers = async (date?: string, periodType: PeriodType = 'day') => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrendingPapers(date, periodType);
      setPapers(response.papers);
    } catch (err) {
      setError('Failed to fetch trending papers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 현재 기간에 맞는 날짜 가져오기
  const getDateForPeriod = (): string => {
    if (period === 'week') {
      return getLastDayOfWeek(selectedWeek);
    } else if (period === 'month') {
      return getLastDayOfMonth(selectedMonth);
    }
    return selectedDate;
  };

  useEffect(() => {
    fetchPapers(getDateForPeriod(), period);
  }, [selectedDate, selectedWeek, selectedMonth, period]);

  const handleRegister = async (paperId: string) => {
    setRegisteringId(paperId);
    try {
      await registerNewPaper(paperId);
      alert(`논문 ${paperId} 등록 완료!`);
    } catch (err) {
      console.error('Registration failed:', err);
      alert('논문 등록에 실패했습니다.');
    } finally {
      setRegisteringId(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const today = new Date();
    if (date <= today) {
      setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  // 키워드 추가
  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !filterKeywords.includes(trimmed)) {
      const updated = [...filterKeywords, trimmed];
      setFilterKeywords(updated);
      localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(updated));
    }
    setNewKeyword('');
  };

  // 키워드 삭제
  const removeKeyword = (keyword: string) => {
    const updated = filterKeywords.filter((k) => k !== keyword);
    setFilterKeywords(updated);
    localStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(updated));
  };

  // 키워드 입력 핸들러 (Enter 키 지원)
  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  // HuggingFace URL 생성
  const getHuggingFaceUrl = () => {
    if (period === 'week') {
      return `https://huggingface.co/papers/week/${selectedWeek}`;
    } else if (period === 'month') {
      return `https://huggingface.co/papers/month/${selectedMonth}`;
    }
    return `https://huggingface.co/papers?date=${selectedDate}`;
  };

  // 필터링된 논문 목록
  const filteredPapers = useMemo(() => {
    if (!filterEnabled || filterKeywords.length === 0) {
      return papers;
    }
    return papers.filter((paper) => {
      const searchText = [
        paper.title,
        paper.summary,
        paper.ai_summary,
        ...(paper.ai_keywords || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return filterKeywords.some((keyword) => searchText.includes(keyword));
    });
  }, [papers, filterKeywords, filterEnabled]);

  return (
    <div className="daily-papers-page">
      <header className="daily-papers-header">
        <div className="header-left">
          <button onClick={() => navigate('/')} className="back-button">
            ← 돌아가기
          </button>
          <h1>Trending Papers</h1>
          <span className="header-subtitle">HuggingFace 인기 논문</span>
        </div>
        <div className="header-right">
          <div className="period-tabs">
            <button
              className={`period-tab ${period === 'day' ? 'active' : ''}`}
              onClick={() => setPeriod('day')}
            >
              Daily
            </button>
            <button
              className={`period-tab ${period === 'week' ? 'active' : ''}`}
              onClick={() => setPeriod('week')}
            >
              Weekly
            </button>
            <button
              className={`period-tab ${period === 'month' ? 'active' : ''}`}
              onClick={() => setPeriod('month')}
            >
              Monthly
            </button>
          </div>
          {/* Daily: 날짜 선택 */}
          {period === 'day' && (
            <div className="date-selector-large">
              <button onClick={goToPreviousDay} className="date-nav-btn-large">◀</button>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                max={new Date().toISOString().split('T')[0]}
                className="date-input-large"
              />
              <button onClick={goToNextDay} className="date-nav-btn-large">▶</button>
            </div>
          )}
          {/* Weekly: 주차 선택 */}
          {period === 'week' && (
            <div className="date-selector-large">
              <button
                onClick={() => {
                  const [year, week] = selectedWeek.split('-W').map(Number);
                  const newWeek = week - 1;
                  if (newWeek < 1) {
                    setSelectedWeek(`${year - 1}-W52`);
                  } else {
                    setSelectedWeek(`${year}-W${String(newWeek).padStart(2, '0')}`);
                  }
                }}
                className="date-nav-btn-large"
              >◀</button>
              <input
                type="week"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                max={`${new Date().getFullYear()}-W${String(getISOWeekNumber(new Date())).padStart(2, '0')}`}
                className="date-input-large"
              />
              <button
                onClick={() => {
                  const [year, week] = selectedWeek.split('-W').map(Number);
                  const currentWeek = getISOWeekNumber(new Date());
                  const currentYear = new Date().getFullYear();
                  const newWeek = week + 1;
                  if (year < currentYear || (year === currentYear && newWeek <= currentWeek)) {
                    if (newWeek > 52) {
                      setSelectedWeek(`${year + 1}-W01`);
                    } else {
                      setSelectedWeek(`${year}-W${String(newWeek).padStart(2, '0')}`);
                    }
                  }
                }}
                className="date-nav-btn-large"
              >▶</button>
            </div>
          )}
          {/* Monthly: 월 선택 */}
          {period === 'month' && (
            <div className="date-selector-large">
              <button
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const newMonth = month - 1;
                  if (newMonth < 1) {
                    setSelectedMonth(`${year - 1}-12`);
                  } else {
                    setSelectedMonth(`${year}-${String(newMonth).padStart(2, '0')}`);
                  }
                }}
                className="date-nav-btn-large"
              >◀</button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                className="date-input-large"
              />
              <button
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number);
                  const currentMonth = new Date().getMonth() + 1;
                  const currentYear = new Date().getFullYear();
                  const newMonth = month + 1;
                  if (year < currentYear || (year === currentYear && newMonth <= currentMonth)) {
                    if (newMonth > 12) {
                      setSelectedMonth(`${year + 1}-01`);
                    } else {
                      setSelectedMonth(`${year}-${String(newMonth).padStart(2, '0')}`);
                    }
                  }
                }}
                className="date-nav-btn-large"
              >▶</button>
            </div>
          )}
        </div>
      </header>

      <main className="daily-papers-content">
        {/* 키워드 필터 섹션 */}
        <div className="keyword-filter-section">
          <div className="keyword-filter-header">
            <h3>관심 키워드 필터</h3>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={filterEnabled}
                onChange={(e) => setFilterEnabled(e.target.checked)}
              />
              <span>필터 적용</span>
            </label>
          </div>
          <div className="keyword-input-row">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              placeholder="키워드 입력 (예: robot, imitation learning)"
              className="keyword-input"
            />
            <button onClick={addKeyword} className="keyword-add-btn">
              추가
            </button>
          </div>
          {filterKeywords.length > 0 && (
            <div className="keyword-tags">
              {filterKeywords.map((keyword) => (
                <span key={keyword} className="keyword-filter-tag">
                  {keyword}
                  <button
                    onClick={() => removeKeyword(keyword)}
                    className="keyword-remove-btn"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {loading && <div className="loading-indicator">Loading...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && (
          <>
            <div className="papers-count">
              {filterEnabled && filterKeywords.length > 0
                ? `필터된 논문 ${filteredPapers.length}개 / 전체 ${papers.length}개`
                : `총 ${papers.length}개의 논문`}
              <a
                href={getHuggingFaceUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hf-external-link"
              >
                HuggingFace에서 보기 →
              </a>
            </div>

            {filteredPapers.length === 0 ? (
              <div className="no-papers-large">
                {papers.length === 0
                  ? '해당 날짜에 논문이 없습니다.'
                  : '필터 조건에 맞는 논문이 없습니다.'}
              </div>
            ) : (
              <div className="daily-papers-grid">
                {filteredPapers.map((paper) => (
                  <div key={paper.paper_id} className="daily-paper-card">
                    <div className="card-header">
                      <div className="upvotes-large">
                        <span className="upvote-icon-large">🔥</span>
                        <span className="upvote-count-large">{paper.upvotes}</span>
                      </div>
                      <button
                        onClick={() => handleRegister(paper.paper_id)}
                        disabled={registeringId === paper.paper_id}
                        className="register-btn-large"
                      >
                        {registeringId === paper.paper_id ? '등록 중...' : '등록'}
                      </button>
                    </div>

                    <a
                      href={`https://arxiv.org/abs/${paper.paper_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card-title"
                    >
                      {paper.title}
                    </a>

                    <div className="card-meta">
                      <span className="paper-id-tag">{paper.paper_id}</span>
                      {paper.github_repo && (
                        <a
                          href={paper.github_repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="github-badge"
                        >
                          GitHub {paper.github_stars && `⭐ ${paper.github_stars}`}
                        </a>
                      )}
                    </div>

                    {paper.ai_keywords && paper.ai_keywords.length > 0 && (
                      <div className="card-keywords">
                        {paper.ai_keywords.slice(0, 6).map((kw, idx) => (
                          <span key={idx} className="keyword-tag-large">{kw}</span>
                        ))}
                      </div>
                    )}

                    {(paper.ai_summary || paper.summary) && (
                      <p className="card-summary">{paper.ai_summary || paper.summary}</p>
                    )}

                    {paper.authors && paper.authors.length > 0 && (
                      <div className="card-authors">
                        {paper.authors.slice(0, 5).join(', ')}
                        {paper.authors.length > 5 && ` 외 ${paper.authors.length - 5}명`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
