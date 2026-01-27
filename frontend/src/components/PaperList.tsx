import { useState, useCallback, memo } from 'react';
import type { Paper } from '../api/paperApi';
import FavoriteButton from './FavoriteButton';

interface PaperListProps {
  papers: Paper[];
  onPaperClick: (paperId: string) => void;
  onToggleFavorite: (paperId: string) => void;
  onToggleNotInterested: (paperId: string) => void;
  onUpdateCitation: (paperId: string) => void;
  onDelete: (paperId: string) => void;
  onBulkNotInterested?: (paperIds: string[]) => void;
  onBulkDelete?: (paperIds: string[]) => void;
  onBulkRestore?: (paperIds: string[]) => void;
  loading?: boolean;
  isNotInterestedTab?: boolean;
}

// 개별 논문 행 컴포넌트 (memo로 최적화)
interface PaperRowProps {
  paper: Paper;
  isSelected: boolean;
  isNotInterestedTab: boolean;
  loading?: boolean;
  onPaperClick: (paperId: string) => void;
  onToggleFavorite: (paperId: string) => void;
  onToggleNotInterested: (paperId: string) => void;
  onUpdateCitation: (paperId: string) => void;
  onDelete: (paperId: string) => void;
  onSelect: (paperId: string, checked: boolean) => void;
}

const getStageLabel = (stage: number) => {
  switch (stage) {
    case 1:
      return <span className="stage-badge stage-1">미분석</span>;
    case 2:
      return <span className="stage-badge stage-2">개요 분석</span>;
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

const PaperRow = memo(function PaperRow({
  paper,
  isSelected,
  isNotInterestedTab,
  loading,
  onPaperClick,
  onToggleFavorite,
  onToggleNotInterested,
  onUpdateCitation,
  onDelete,
  onSelect,
}: PaperRowProps) {
  return (
    <tr className={`${paper.is_not_interested ? 'not-interested' : ''} ${isSelected ? 'selected' : ''}`}>
      <td className="checkbox-col">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(paper.paper_id, e.target.checked)}
        />
      </td>
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
        <span className="title-text">
          {paper.is_shared && (
            <span className="shared-badge" title={paper.shared_by ? `${paper.shared_by}님이 공유` : '공유됨'}>📤</span>
          )}
          {paper.title || '제목 없음'}
        </span>
        {paper.matched_keywords && paper.matched_keywords.length > 0 && (
          <span className="matched-keywords">
            {paper.matched_keywords.map((kw) => (
              <span key={kw} className="keyword-tag">{kw}</span>
            ))}
          </span>
        )}
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
              onClick={() => onDelete(paper.paper_id)}
              className="delete-button"
              disabled={loading}
              title="삭제"
            >
              🗑️
            </button>
            <button
              onClick={() => onToggleNotInterested(paper.paper_id)}
              className="not-interested-button"
              disabled={loading}
              title="관심없음 표시"
            >
              🚫
            </button>
          </>
        )}
      </td>
    </tr>
  );
});

export default function PaperList({
  papers,
  onPaperClick,
  onToggleFavorite,
  onToggleNotInterested,
  onUpdateCitation,
  onDelete,
  onBulkNotInterested,
  onBulkDelete,
  onBulkRestore,
  loading,
  isNotInterestedTab = false,
}: PaperListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(papers.map((p) => p.paper_id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [papers]);

  const handleSelectOne = useCallback((paperId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(paperId);
      } else {
        newSet.delete(paperId);
      }
      return newSet;
    });
  }, []);

  const handleBulkNotInterested = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 논문을 관심없음으로 처리하시겠습니까?`)) return;
    onBulkNotInterested?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onBulkNotInterested]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 논문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    onBulkDelete?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onBulkDelete]);

  const handleBulkRestore = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}개 논문을 복원하시겠습니까?`)) return;
    onBulkRestore?.(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, onBulkRestore]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = papers.length > 0 && selectedIds.size === papers.length;
  const hasSelection = selectedIds.size > 0;

  if (papers.length === 0) {
    return <div className="empty-list">등록된 논문이 없습니다.</div>;
  }

  return (
    <div className="paper-list">
      {/* 일괄 작업 툴바 */}
      {hasSelection && (
        <div className="bulk-actions-bar">
          <span className="selection-count">{selectedIds.size}개 선택됨</span>
          {isNotInterestedTab ? (
            <button
              onClick={handleBulkRestore}
              className="bulk-action-btn restore"
              disabled={loading}
            >
              ↩️ 일괄 복원
            </button>
          ) : (
            <button
              onClick={handleBulkNotInterested}
              className="bulk-action-btn not-interested"
              disabled={loading}
            >
              🚫 일괄 관심없음
            </button>
          )}
          <button
            onClick={handleBulkDelete}
            className="bulk-action-btn delete"
            disabled={loading}
          >
            🗑️ 일괄 삭제
          </button>
          <button
            onClick={clearSelection}
            className="bulk-action-btn cancel"
          >
            선택 해제
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th className="checkbox-col">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            </th>
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
            <PaperRow
              key={paper.id}
              paper={paper}
              isSelected={selectedIds.has(paper.paper_id)}
              isNotInterestedTab={isNotInterestedTab}
              loading={loading}
              onPaperClick={onPaperClick}
              onToggleFavorite={onToggleFavorite}
              onToggleNotInterested={onToggleNotInterested}
              onUpdateCitation={onUpdateCitation}
              onDelete={onDelete}
              onSelect={handleSelectOne}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
