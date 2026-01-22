import { useState, lazy, Suspense } from 'react';
import type { PaperDetail as PaperDetailType } from '../api/paperApi';
import SearchStageButtons from './SearchStageButtons';
import FavoriteButton from './FavoriteButton';

// Markdown 관련 라이브러리 (~500KB) 동적 로딩
const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

interface PaperDetailProps {
  paper: PaperDetailType;
  onSimpleSearch: () => void;
  onDeepSearch: () => void;
  onToggleFavorite: () => void;
  onUpdateCitation: () => void;
  onBack: () => void;
  loading?: boolean;
}

export default function PaperDetail({
  paper,
  onSimpleSearch,
  onDeepSearch,
  onToggleFavorite,
  onUpdateCitation,
  onBack,
  loading,
}: PaperDetailProps) {
  const [expandedSections, setExpandedSections] = useState<{
    abstract: boolean;
    analysis: boolean;
  }>({
    abstract: true,
    analysis: true,
  });

  const toggleSection = (section: 'abstract' | 'analysis') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <div className="paper-detail">
      <div className="detail-header">
        <button onClick={onBack} className="back-button">
          ← 목록으로
        </button>
        <FavoriteButton
          isFavorite={paper.is_favorite}
          onClick={onToggleFavorite}
          disabled={loading}
        />
      </div>

      <div className="detail-meta">
        <span className="paper-id">arXiv: {paper.paper_id}</span>
        <span className="paper-date">등록일: {formatDate(paper.arxiv_date)}</span>
        <span className="paper-citations">
          인용수: {paper.citation_count.toLocaleString()}
          {paper.citation_count === 0 && (
            <button
              onClick={onUpdateCitation}
              disabled={loading}
              className="update-citation-btn"
              title="인용수 업데이트"
            >
              🔄
            </button>
          )}
        </span>
        <span className={`stage-badge stage-${paper.search_stage}`}>
          {paper.search_stage === 1 ? '미분석' : paper.search_stage === 2 ? '개요 분석' : '상세 분석'}
        </span>
      </div>

      <h1 className="paper-title">{paper.title || '제목 없음'}</h1>

      {paper.figure_url && (
        <section className="paper-figure">
          <img
            src={paper.figure_url}
            alt="Paper figure"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </section>
      )}

      <SearchStageButtons
        currentStage={paper.search_stage}
        onSimpleSearch={onSimpleSearch}
        onDeepSearch={onDeepSearch}
        loading={loading}
      />

      {loading && <div className="loading-indicator">처리 중...</div>}

      {paper.search_stage >= 2 && paper.abstract_ko && (
        <section className="content-section abstract-section">
          <div className="section-header" onClick={() => toggleSection('abstract')}>
            <h2>초록 요약</h2>
            <span className="toggle-icon">
              {expandedSections.abstract ? '▼' : '▶'}
            </span>
          </div>
          {expandedSections.abstract && (
            <Suspense fallback={<div className="markdown-loading">내용 로딩중...</div>}>
              <MarkdownRenderer
                content={paper.abstract_ko}
                className="content-text markdown abstract-content"
              />
            </Suspense>
          )}
        </section>
      )}

      {paper.search_stage >= 3 && paper.detailed_analysis_ko && (
        <section className="content-section analysis-section">
          <div className="section-header" onClick={() => toggleSection('analysis')}>
            <h2>상세 분석</h2>
            <span className="toggle-icon">
              {expandedSections.analysis ? '▼' : '▶'}
            </span>
          </div>
          {expandedSections.analysis && (
            <Suspense fallback={<div className="markdown-loading">내용 로딩중...</div>}>
              <MarkdownRenderer
                content={paper.detailed_analysis_ko}
                className="content-text markdown analysis-content"
              />
            </Suspense>
          )}
        </section>
      )}

      <div className="external-links">
        <a
          href={`https://arxiv.org/abs/${paper.paper_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          arXiv 보기 →
        </a>
        <a
          href={`https://arxiv.org/pdf/${paper.paper_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          PDF 보기 →
        </a>
      </div>
    </div>
  );
}
