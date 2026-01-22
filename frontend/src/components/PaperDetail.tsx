import type { PaperDetail as PaperDetailType } from '../api/paperApi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import SearchStageButtons from './SearchStageButtons';
import FavoriteButton from './FavoriteButton';

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
          {paper.search_stage === 1 ? '미분석' : paper.search_stage === 2 ? '요약 완료' : '상세 분석'}
        </span>
      </div>

      <h1 className="paper-title">{paper.title || '제목 없음'}</h1>

      <SearchStageButtons
        currentStage={paper.search_stage}
        onSimpleSearch={onSimpleSearch}
        onDeepSearch={onDeepSearch}
        loading={loading}
      />

      {loading && <div className="loading-indicator">처리 중...</div>}

      {paper.search_stage >= 2 && paper.abstract_ko && (
        <section className="content-section">
          <h2>초록 요약</h2>
          <div className="content-text markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {paper.abstract_ko}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {paper.search_stage >= 3 && paper.detailed_analysis_ko && (
        <section className="content-section analysis">
          <h2>상세 분석</h2>
          <div className="content-text markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {paper.detailed_analysis_ko}
            </ReactMarkdown>
          </div>
        </section>
      )}

      <div className="external-links">
        <a
          href={`https://arxiv.org/abs/${paper.paper_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          arXiv에서 보기 →
        </a>
        <a
          href={`https://arxiv.org/pdf/${paper.paper_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          PDF 다운로드 →
        </a>
      </div>
    </div>
  );
}
