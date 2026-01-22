import type { Paper } from '../api/paperApi';
import FavoriteButton from './FavoriteButton';

interface PaperListProps {
  papers: Paper[];
  onPaperClick: (paperId: string) => void;
  onToggleFavorite: (paperId: string) => void;
  onToggleNotInterested: (paperId: string) => void;
  onUpdateCitation: (paperId: string) => void;
  onDelete: (paperId: string) => void;
  loading?: boolean;
  isNotInterestedTab?: boolean;
}

export default function PaperList({
  papers,
  onPaperClick,
  onToggleFavorite,
  onToggleNotInterested,
  onUpdateCitation,
  onDelete,
  loading,
  isNotInterestedTab = false,
}: PaperListProps) {
  const getStageLabel = (stage: number) => {
    switch (stage) {
      case 1:
        return <span className="stage-badge stage-1">미분석</span>;
      case 2:
        return <span className="stage-badge stage-2">요약 완료</span>;
      case 3:
        return <span className="stage-badge stage-3">상세 분석</span>;
      default:
        return <span className="stage-badge">-</span>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  if (papers.length === 0) {
    return <div className="empty-list">등록된 논문이 없습니다.</div>;
  }

  return (
    <div className="paper-list">
      <table>
        <thead>
          <tr>
            <th>즐겨찾기</th>
            <th>논문 번호</th>
            <th>제목</th>
            <th>등록일</th>
            <th>등록자</th>
            <th>인용수</th>
            <th>단계</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => (
            <tr key={paper.id} className={paper.is_not_interested ? 'not-interested' : ''}>
              <td>
                <FavoriteButton
                  isFavorite={paper.is_favorite}
                  onClick={() => onToggleFavorite(paper.paper_id)}
                  disabled={loading}
                />
              </td>
              <td className="paper-id">{paper.paper_id}</td>
              <td
                className="paper-title clickable"
                onClick={() => onPaperClick(paper.paper_id)}
                title={paper.title || '제목 없음'}
              >
                {paper.title || '제목 없음'}
              </td>
              <td>{formatDate(paper.arxiv_date)}</td>
              <td className="registered-by">{paper.registered_by || '-'}</td>
              <td>
                {paper.citation_count.toLocaleString()}
                <button
                  onClick={() => onUpdateCitation(paper.paper_id)}
                  className="update-citation-btn-small"
                  disabled={loading}
                  title="인용수 업데이트"
                >
                  🔄
                </button>
              </td>
              <td>{getStageLabel(paper.search_stage)}</td>
              <td className="action-buttons">
                {isNotInterestedTab ? (
                  <button
                    onClick={() => onToggleNotInterested(paper.paper_id)}
                    className="restore-button"
                    disabled={loading}
                    title="되돌리기"
                  >
                    ↩️ 되돌리기
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onToggleNotInterested(paper.paper_id)}
                      className="not-interested-button"
                      disabled={loading}
                      title="관심없음 표시"
                    >
                      🚫
                    </button>
                    <button
                      onClick={() => onDelete(paper.paper_id)}
                      className="delete-button"
                      disabled={loading}
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
