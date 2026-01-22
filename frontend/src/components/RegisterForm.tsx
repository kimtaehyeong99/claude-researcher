import { useState, useEffect } from 'react';

interface RegisterFormProps {
  onRegisterNew: (paperId: string, registeredBy?: string) => Promise<void>;
  onRegisterCitations: (paperId: string, limit: number, registeredBy?: string) => Promise<void>;
  loading?: boolean;
}

const REGISTERED_BY_STORAGE_KEY = 'registeredBy_options';

// 환경 변수 + localStorage에서 등록자 이름 목록 읽기
const getRegisteredByOptions = (): string[] => {
  // 환경변수에서 기본값 로드
  const envValue = import.meta.env.VITE_REGISTERED_BY_OPTIONS;
  const envOptions = envValue ? envValue.split(',').map((name: string) => name.trim()) : [];

  // localStorage에서 추가된 등록자 로드
  const savedOptions = localStorage.getItem(REGISTERED_BY_STORAGE_KEY);
  const localOptions = savedOptions ? JSON.parse(savedOptions) : [];

  // 중복 제거 후 합치기
  const combined = [...new Set([...envOptions, ...localOptions])];
  // 한글 가나다순 정렬
  return combined.filter(name => name.length > 0).sort((a, b) => a.localeCompare(b, 'ko'));
};

// localStorage에 등록자 저장
const saveRegisteredByOptions = (options: string[]) => {
  localStorage.setItem(REGISTERED_BY_STORAGE_KEY, JSON.stringify(options));
};

export default function RegisterForm({
  onRegisterNew,
  onRegisterCitations,
  loading,
}: RegisterFormProps) {
  const [paperId, setPaperId] = useState('');
  const [citationLimit, setCitationLimit] = useState(50);
  const [registeredBy, setRegisteredBy] = useState('');
  const [mode, setMode] = useState<'new' | 'citations'>('new');
  const [registeredByOptions, setRegisteredByOptions] = useState<string[]>([]);
  const [newRegistrant, setNewRegistrant] = useState('');
  const [showEditPanel, setShowEditPanel] = useState(false);

  // 컴포넌트 마운트 시 등록자 목록 로드
  useEffect(() => {
    setRegisteredByOptions(getRegisteredByOptions());
  }, []);

  const handleAddRegistrant = () => {
    const trimmedName = newRegistrant.trim();
    if (!trimmedName) return;

    if (registeredByOptions.includes(trimmedName)) {
      alert('이미 존재하는 등록자입니다.');
      return;
    }

    const savedOptions = localStorage.getItem(REGISTERED_BY_STORAGE_KEY);
    const localOptions = savedOptions ? JSON.parse(savedOptions) : [];
    const newLocalOptions = [...localOptions, trimmedName];
    saveRegisteredByOptions(newLocalOptions);

    setRegisteredByOptions(getRegisteredByOptions());
    setNewRegistrant('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRegistrant();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId.trim()) return;

    if (mode === 'new') {
      await onRegisterNew(paperId.trim(), registeredBy || undefined);
    } else {
      await onRegisterCitations(paperId.trim(), citationLimit, registeredBy || undefined);
    }

    setPaperId('');
  };

  return (
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
      </div>

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

      <div className="input-group">
        <label htmlFor="registeredBy">등록자:</label>
        <div className="registrant-selector">
          <select
            id="registeredBy"
            value={registeredBy}
            onChange={(e) => setRegisteredBy(e.target.value)}
            disabled={loading}
          >
            <option value="">선택하지 않음</option>
            {registeredByOptions.map((name: string) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowEditPanel(!showEditPanel)}
            className="edit-registrant-btn"
          >
            {showEditPanel ? '닫기' : '편집'}
          </button>
        </div>

        {showEditPanel && (
          <div className="registrant-edit-panel">
            <div className="registrant-add-section">
              <input
                type="text"
                value={newRegistrant}
                onChange={(e) => setNewRegistrant(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="새 등록자 이름"
                className="add-registrant-input"
              />
              <button
                type="button"
                onClick={handleAddRegistrant}
                className="add-registrant-confirm-btn"
                disabled={!newRegistrant.trim()}
              >
                추가
              </button>
            </div>
          </div>
        )}
      </div>

      {mode === 'citations' && (
        <div className="input-group">
          <label htmlFor="citationLimit">최대 등록 수 (인용수 상위):</label>
          <input
            id="citationLimit"
            type="number"
            value={citationLimit}
            onChange={(e) => setCitationLimit(Number(e.target.value))}
            min={1}
            max={100}
            disabled={loading}
          />
        </div>
      )}

      <button type="submit" disabled={loading || !paperId.trim()} className="submit-button">
        {loading ? '처리 중...' : mode === 'new' ? '등록' : '인용 논문 등록'}
      </button>

      <p className="form-description">
        {mode === 'new'
          ? '입력한 논문을 데이터베이스에 등록합니다.'
          : '입력한 논문을 인용하는 논문들을 인용수 기준 상위 N개 등록합니다.'}
      </p>
    </form>
  );
}
