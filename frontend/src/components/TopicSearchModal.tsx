import { useState, useCallback, useMemo } from 'react';
import type { SearchResultPaper } from '../api/paperApi';

interface TopicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchResults: SearchResultPaper[];
  loading: boolean;
  onRegisterSelected: (paperIds: string[]) => Promise<void>;
}

export default function TopicSearchModal({
  isOpen,
  onClose,
  searchResults,
  loading,
  onRegisterSelected,
}: TopicSearchModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 등록 가능한 논문만 필터링 (이미 등록된 것 제외)
  const registrablePapers = useMemo(
    () => searchResults.filter(p => !p.already_registered),
    [searchResults]
  );

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(registrablePapers.map(p => p.paper_id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [registrablePapers]);

  const handleSelectOne = useCallback((paperId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(paperId);
      else newSet.delete(paperId);
      return newSet;
    });
  }, []);

  const handleRegister = async () => {
    if (selectedIds.size === 0) return;
    await onRegisterSelected(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const isAllSelected = registrablePapers.length > 0 &&
    selectedIds.size === registrablePapers.length;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="topic-search-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>검색 결과 ({searchResults.length}개)</h3>
          <button onClick={handleClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-content">
          {searchResults.length === 0 ? (
            <p className="no-results">검색 결과가 없습니다.</p>
          ) : (
            <table className="search-results-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={registrablePapers.length === 0}
                    />
                  </th>
                  <th>제목</th>
                  <th>저자</th>
                  <th>연도</th>
                  <th>인용수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((paper) => (
                  <tr
                    key={paper.paper_id}
                    className={paper.already_registered ? 'already-registered' : ''}
                  >
                    <td className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(paper.paper_id)}
                        onChange={(e) => handleSelectOne(paper.paper_id, e.target.checked)}
                        disabled={paper.already_registered}
                      />
                    </td>
                    <td className="paper-title" title={paper.abstract || ''}>
                      <a
                        href={`https://arxiv.org/abs/${paper.paper_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {paper.title || '제목 없음'}
                      </a>
                    </td>
                    <td className="paper-authors">
                      {paper.authors.slice(0, 3).join(', ')}
                      {paper.authors.length > 3 && ' ...'}
                    </td>
                    <td>{paper.year || '-'}</td>
                    <td>{paper.citation_count.toLocaleString()}</td>
                    <td>
                      {paper.already_registered ? (
                        <span className="status-registered">등록됨</span>
                      ) : (
                        <span className="status-new">신규</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <span className="selection-info">
            {selectedIds.size}개 선택됨
            (등록 가능: {registrablePapers.length}개)
          </span>
          <div className="modal-actions">
            <button onClick={handleClose} className="cancel-btn">
              닫기
            </button>
            <button
              onClick={handleRegister}
              disabled={loading || selectedIds.size === 0}
              className="register-btn"
            >
              {loading ? '등록 중...' : `선택한 ${selectedIds.size}개 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
