import { useState, useEffect } from 'react';
import type { TrendingPaper } from '../api/paperApi';
import { getTrendingPapers, registerNewPaper } from '../api/paperApi';

interface TrendingPapersProps {
  onPaperRegistered?: () => void;
}

export default function TrendingPapers({ onPaperRegistered }: TrendingPapersProps) {
  const [papers, setPapers] = useState<TrendingPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  const fetchPapers = async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTrendingPapers(date);
      setPapers(response.papers);
    } catch (err) {
      setError('Failed to fetch trending papers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPapers(selectedDate);
  }, [selectedDate]);

  const handleRegister = async (paperId: string) => {
    setRegisteringId(paperId);
    try {
      await registerNewPaper(paperId);
      alert(`논문 ${paperId} 등록 완료!`);
      onPaperRegistered?.();
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

  return (
    <div className="trending-papers">
      <div className="trending-header">
        <h3>Daily Papers (HuggingFace)</h3>
        <div className="date-selector">
          <button onClick={goToPreviousDay} className="date-nav-btn">&lt;</button>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
          />
          <button onClick={goToNextDay} className="date-nav-btn">&gt;</button>
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="trending-list">
          {papers.length === 0 ? (
            <div className="no-papers">해당 날짜에 논문이 없습니다.</div>
          ) : (
            papers.map((paper) => (
              <div key={paper.paper_id} className="trending-item">
                <div className="upvotes">
                  <span className="upvote-icon">🔥</span>
                  <span className="upvote-count">{paper.upvotes}</span>
                </div>
                <div className="paper-info">
                  <a
                    href={`https://arxiv.org/abs/${paper.paper_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-title"
                  >
                    {paper.title}
                  </a>
                  {paper.ai_keywords && paper.ai_keywords.length > 0 && (
                    <div className="keywords">
                      {paper.ai_keywords.slice(0, 5).map((kw, idx) => (
                        <span key={idx} className="keyword-tag">{kw}</span>
                      ))}
                    </div>
                  )}
                  {paper.github_repo && (
                    <a
                      href={paper.github_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="github-link"
                    >
                      GitHub {paper.github_stars && `(⭐ ${paper.github_stars})`}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleRegister(paper.paper_id)}
                  disabled={registeringId === paper.paper_id}
                  className="register-btn"
                >
                  {registeringId === paper.paper_id ? '...' : '등록'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="trending-footer">
        <span className="total-count">총 {papers.length}개</span>
        <a
          href={`https://huggingface.co/papers/date/${selectedDate}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hf-link"
        >
          HuggingFace에서 보기 →
        </a>
      </div>
    </div>
  );
}
