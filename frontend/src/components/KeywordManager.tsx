import { useState, useEffect, useMemo } from 'react';
import type { UserKeyword } from '../api/paperApi';
import { getKeywords, createKeyword, deleteKeyword } from '../api/paperApi';

interface KeywordManagerProps {
  onKeywordsChange?: () => void;
}

// 카테고리별 자동 색상 매핑용 색상 팔레트
const CATEGORY_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
];

// 카테고리명을 해시해서 일관된 색상 인덱스 반환
const getCategoryColorIndex = (category: string): number => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CATEGORY_COLORS.length;
};

// 카테고리에 따른 색상 반환
const getColorForCategory = (category: string | null): string => {
  if (!category) return '#9ca3af'; // 미분류는 회색
  return CATEGORY_COLORS[getCategoryColorIndex(category)];
};

export default function KeywordManager({ onKeywordsChange }: KeywordManagerProps) {
  const [keywords, setKeywords] = useState<UserKeyword[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchKeywords = async () => {
    try {
      const response = await getKeywords();
      setKeywords(response.keywords);
      setCategories(response.categories || []);
    } catch (err) {
      console.error('키워드 로드 실패:', err);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, []);

  const handleAddKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const category = newCategory.trim() || null;
      // 카테고리에 따라 자동으로 색상 결정
      const color = getColorForCategory(category);
      const newKw = await createKeyword(trimmed, category, color);
      // 낙관적 업데이트: 로컬 상태에 즉시 추가 (전체 재조회 대신)
      setKeywords(prev => [...prev, newKw]);
      // 새 카테고리면 카테고리 목록에도 추가
      if (category && !categories.includes(category)) {
        setCategories(prev => [...prev, category]);
      }
      setNewKeyword('');
      onKeywordsChange?.();
    } catch (err: any) {
      setError(err.response?.data?.detail || '키워드 추가 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKeyword = async (keywordId: number) => {
    // 낙관적 업데이트: 로컬 상태에서 즉시 제거
    const deletedKeyword = keywords.find(kw => kw.id === keywordId);
    setKeywords(prev => prev.filter(kw => kw.id !== keywordId));

    try {
      await deleteKeyword(keywordId);
      onKeywordsChange?.();
    } catch (err) {
      console.error('키워드 삭제 실패:', err);
      // 실패 시 롤백
      if (deletedKeyword) {
        setKeywords(prev => [...prev, deletedKeyword]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // 카테고리별로 키워드 그룹화 (useMemo로 최적화)
  const groupedKeywords = useMemo(() => {
    return keywords.reduce((acc, kw) => {
      const category = kw.category || '미분류';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(kw);
      return acc;
    }, {} as Record<string, UserKeyword[]>);
  }, [keywords]);

  // 카테고리 정렬 (미분류는 마지막) (useMemo로 최적화)
  const sortedCategories = useMemo(() => {
    return Object.keys(groupedKeywords).sort((a, b) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b, 'ko');
    });
  }, [groupedKeywords]);

  return (
    <div className="keyword-manager">
      <div
        className="keyword-manager-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>관심 키워드 ({keywords.length})</span>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="keyword-manager-content">
          <div className="keyword-list">
            {keywords.length === 0 ? (
              <p className="no-keywords">등록된 키워드가 없습니다.</p>
            ) : (
              sortedCategories.map((category) => (
                <div key={category} className="keyword-category-group">
                  <div className="category-label">{category}</div>
                  <div className="category-keywords">
                    {groupedKeywords[category].map((kw) => (
                      <div key={kw.id} className="keyword-item">
                        <span
                          className="keyword-badge"
                          style={{ backgroundColor: kw.color }}
                        >
                          {kw.keyword}
                        </span>
                        <button
                          className="keyword-delete-btn"
                          onClick={() => handleDeleteKeyword(kw.id)}
                          title="삭제"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="keyword-add-section">
            <div className="keyword-input-row">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="키워드"
                className="keyword-input"
                disabled={loading}
              />
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="카테고리 (선택)"
                className="category-input"
                list="category-list"
                disabled={loading}
              />
              <datalist id="category-list">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              <button
                className="keyword-add-btn"
                onClick={handleAddKeyword}
                disabled={loading || !newKeyword.trim()}
              >
                {loading ? '...' : '추가'}
              </button>
            </div>
          </div>

          {error && <p className="keyword-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
