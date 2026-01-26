import { useState } from 'react';
import { useUserSession } from '../contexts/UserSessionContext';
import TopicSearchModal from './TopicSearchModal';
import { searchByTopic, registerBulk, previewCitingPapers, type SearchResultPaper, type BulkPaperInfo } from '../api/paperApi';

interface RegisterFormProps {
  onRegisterNew: (paperId: string, registeredBy?: string) => Promise<void>;
  onBulkRegisterComplete?: () => void;
  loading?: boolean;
}

export default function RegisterForm({
  onRegisterNew,
  onBulkRegisterComplete,
  loading,
}: RegisterFormProps) {
  const { session } = useUserSession();
  const [paperId, setPaperId] = useState('');
  const [mode, setMode] = useState<'new' | 'citations' | 'topic'>('new');

  // Topic 모드 상태
  const [topicQuery, setTopicQuery] = useState('');
  const [topicLimit, setTopicLimit] = useState(50);
  const [topicSort, setTopicSort] = useState<'publicationDate' | 'citationCount' | 'relevance'>('publicationDate');
  const [yearFrom, setYearFrom] = useState<number | ''>('');

  // Citations 모드 상태
  const [citationLimit, setCitationLimit] = useState(50);
  const [citationSort, setCitationSort] = useState<'citationCount' | 'publicationDate'>('citationCount');
  const [citationYearFrom, setCitationYearFrom] = useState<number | ''>('');

  // 공통 상태
  const [searchResults, setSearchResults] = useState<SearchResultPaper[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  const registeredBy = session?.username;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'topic') {
      // 주제 검색 실행
      if (!topicQuery.trim()) return;

      setSearchLoading(true);
      try {
        const result = await searchByTopic({
          query: topicQuery.trim(),
          limit: topicLimit,
          sort: topicSort,
          year_from: yearFrom || undefined,
        });
        setSearchResults(result.papers);
        setIsModalOpen(true);
      } catch (err) {
        console.error('검색 실패:', err);
        alert('검색에 실패했습니다.');
      } finally {
        setSearchLoading(false);
      }
    } else if (mode === 'citations') {
      // 인용 논문 미리보기
      if (!paperId.trim()) return;

      setSearchLoading(true);
      try {
        const result = await previewCitingPapers({
          paper_id: paperId.trim(),
          limit: citationLimit,
          sort: citationSort,
          year_from: citationYearFrom || undefined,
        });
        setSearchResults(result.papers);
        setIsModalOpen(true);
      } catch (err) {
        console.error('인용 논문 검색 실패:', err);
        alert('인용 논문 검색에 실패했습니다.');
      } finally {
        setSearchLoading(false);
      }
    } else {
      // 새 논문 등록
      if (!paperId.trim()) return;
      await onRegisterNew(paperId.trim(), registeredBy);
      setPaperId('');
    }
  };

  const handleRegisterSelected = async (paperIds: string[]) => {
    setRegisterLoading(true);
    try {
      // 선택된 논문의 인용수 정보 포함
      const papersToRegister: BulkPaperInfo[] = paperIds.map(id => {
        const paper = searchResults.find(p => p.paper_id === id);
        return {
          paper_id: id,
          citation_count: paper?.citation_count ?? 0,
        };
      });
      const result = await registerBulk(papersToRegister, registeredBy);
      alert(result.message);
      setIsModalOpen(false);
      setSearchResults([]);
      setTopicQuery('');
      setYearFrom('');
      onBulkRegisterComplete?.();
    } catch (err) {
      console.error('등록 실패:', err);
      alert('등록에 실패했습니다.');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="register-form">
        <h3>논문 등록</h3>

        <div className="mode-selector">
          <label>
            <input
              type="radio"
              value="new"
              checked={mode === 'new'}
              onChange={() => setMode('new')}
            />
            새 논문 등록
          </label>
          <label>
            <input
              type="radio"
              value="citations"
              checked={mode === 'citations'}
              onChange={() => setMode('citations')}
            />
            인용 논문 등록
          </label>
          <label>
            <input
              type="radio"
              value="topic"
              checked={mode === 'topic'}
              onChange={() => setMode('topic')}
            />
            주제 검색
          </label>
        </div>

        {mode === 'topic' ? (
          <>
            <div className="input-group">
              <label htmlFor="topicQuery">검색 주제/키워드:</label>
              <input
                id="topicQuery"
                type="text"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                placeholder="예: robot manipulation, LLM reasoning"
                disabled={loading || searchLoading}
              />
            </div>

            <div className="input-row">
              <div className="input-group half">
                <label htmlFor="topicLimit">최대 검색 수:</label>
                <input
                  id="topicLimit"
                  type="number"
                  value={topicLimit}
                  onChange={(e) => setTopicLimit(Number(e.target.value))}
                  min={1}
                  max={100}
                  disabled={loading || searchLoading}
                />
              </div>

              <div className="input-group half">
                <label htmlFor="yearFrom">연도 필터:</label>
                <input
                  id="yearFrom"
                  type="number"
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value ? Number(e.target.value) : '')}
                  placeholder="예: 2020"
                  min={2000}
                  max={new Date().getFullYear()}
                  disabled={loading || searchLoading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="topicSort">정렬 기준:</label>
              <select
                id="topicSort"
                value={topicSort}
                onChange={(e) => setTopicSort(e.target.value as typeof topicSort)}
                disabled={loading || searchLoading}
              >
                <option value="publicationDate">최신순</option>
                <option value="citationCount">인용수순</option>
                <option value="relevance">관련도순</option>
              </select>
            </div>
          </>
        ) : mode === 'citations' ? (
          <>
            <div className="input-group">
              <label htmlFor="paperId">arXiv 논문 번호:</label>
              <input
                id="paperId"
                type="text"
                value={paperId}
                onChange={(e) => setPaperId(e.target.value)}
                placeholder="예: 2306.02437"
                disabled={loading || searchLoading}
              />
            </div>

            <div className="input-row">
              <div className="input-group half">
                <label htmlFor="citationLimit">최대 검색 수:</label>
                <input
                  id="citationLimit"
                  type="number"
                  value={citationLimit}
                  onChange={(e) => setCitationLimit(Number(e.target.value))}
                  min={1}
                  max={100}
                  disabled={loading || searchLoading}
                />
              </div>

              <div className="input-group half">
                <label htmlFor="citationYearFrom">연도 필터:</label>
                <input
                  id="citationYearFrom"
                  type="number"
                  value={citationYearFrom}
                  onChange={(e) => setCitationYearFrom(e.target.value ? Number(e.target.value) : '')}
                  placeholder="예: 2020"
                  min={2000}
                  max={new Date().getFullYear()}
                  disabled={loading || searchLoading}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="citationSort">정렬 기준:</label>
              <select
                id="citationSort"
                value={citationSort}
                onChange={(e) => setCitationSort(e.target.value as typeof citationSort)}
                disabled={loading || searchLoading}
              >
                <option value="citationCount">인용수순</option>
                <option value="publicationDate">최신순</option>
              </select>
            </div>
          </>
        ) : (
          <div className="input-group">
            <label htmlFor="paperId">arXiv 논문 번호:</label>
            <input
              id="paperId"
              type="text"
              value={paperId}
              onChange={(e) => setPaperId(e.target.value)}
              placeholder="예: 2306.02437"
              disabled={loading}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading || searchLoading ||
            (mode === 'topic' ? !topicQuery.trim() : !paperId.trim())
          }
          className="submit-button"
        >
          {searchLoading ? '검색 중...' :
           loading ? '처리 중...' :
           mode === 'topic' ? '검색' :
           mode === 'citations' ? '검색' : '등록'}
        </button>

        <p className="form-description">
          {mode === 'new' && '입력한 논문을 데이터베이스에 등록합니다.'}
          {mode === 'citations' && '입력한 논문을 인용하는 논문들을 검색하고 선택하여 등록합니다.'}
          {mode === 'topic' && '주제/키워드로 논문을 검색하고 선택하여 등록합니다.'}
        </p>
      </form>

      <TopicSearchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        searchResults={searchResults}
        loading={registerLoading}
        onRegisterSelected={handleRegisterSelected}
      />
    </>
  );
}
