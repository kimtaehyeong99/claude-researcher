import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PaperDetail as PaperDetailType } from '../api/paperApi';
import {
  getPaper,
  simpleSearch,
  deepSearch,
  toggleFavorite,
  updateCitationCount,
} from '../api/paperApi';
import PaperDetail from '../components/PaperDetail';

// Polling 간격 (3초)
const POLLING_INTERVAL = 3000;

export default function PaperView() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<PaperDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPaper = useCallback(async (showLoading = true) => {
    if (!paperId) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getPaper(paperId);
      setPaper(data);
      return data;
    } catch (err) {
      setError('논문 정보를 불러오는데 실패했습니다.');
      console.error(err);
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [paperId]);

  // 분석 중일 때 polling 시작
  useEffect(() => {
    // 분석 중이면 polling 시작
    if (paper?.analysis_status) {
      pollingRef.current = setInterval(async () => {
        const updatedPaper = await fetchPaper(false);
        // 분석 완료되면 polling 중지
        if (updatedPaper && !updatedPaper.analysis_status) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [paper?.analysis_status, fetchPaper]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  const handleSimpleSearch = async () => {
    if (!paperId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await simpleSearch(paperId);
      setPaper(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '간단 서칭에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeepSearch = async () => {
    if (!paperId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await deepSearch(paperId);
      setPaper(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '딥 서칭에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!paperId) return;
    try {
      const updatedPaper = await toggleFavorite(paperId);
      // 로컬 상태만 업데이트 (전체 재조회 대신)
      setPaper(prev => prev ? { ...prev, is_favorite: updatedPaper.is_favorite } : null);
    } catch (err) {
      console.error('즐겨찾기 토글 실패:', err);
    }
  };

  const handleUpdateCitation = async () => {
    if (!paperId) return;
    setLoading(true);
    try {
      const updatedPaper = await updateCitationCount(paperId);
      // 로컬 상태만 업데이트 (전체 재조회 대신)
      setPaper(prev => prev ? { ...prev, citation_count: updatedPaper.citation_count } : null);
    } catch (err: any) {
      setError(err.response?.data?.detail || '인용수 업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading && !paper) {
    return <div className="loading-page">로딩 중...</div>;
  }

  if (error && !paper) {
    return (
      <div className="error-page">
        <p>{error}</p>
        <button onClick={handleBack}>목록으로 돌아가기</button>
      </div>
    );
  }

  if (!paper) {
    return null;
  }

  return (
    <div className="paper-view-page">
      {error && <div className="error-message">{error}</div>}
      <PaperDetail
        paper={paper}
        onSimpleSearch={handleSimpleSearch}
        onDeepSearch={handleDeepSearch}
        onToggleFavorite={handleToggleFavorite}
        onUpdateCitation={handleUpdateCitation}
        onBack={handleBack}
        loading={loading}
      />
    </div>
  );
}
