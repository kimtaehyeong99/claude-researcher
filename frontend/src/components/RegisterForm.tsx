import { useState } from 'react';

interface RegisterFormProps {
  onRegisterNew: (paperId: string) => Promise<void>;
  onRegisterCitations: (paperId: string, limit: number) => Promise<void>;
  loading?: boolean;
}

export default function RegisterForm({
  onRegisterNew,
  onRegisterCitations,
  loading,
}: RegisterFormProps) {
  const [paperId, setPaperId] = useState('');
  const [citationLimit, setCitationLimit] = useState(50);
  const [mode, setMode] = useState<'new' | 'citations'>('new');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperId.trim()) return;

    if (mode === 'new') {
      await onRegisterNew(paperId.trim());
    } else {
      await onRegisterCitations(paperId.trim(), citationLimit);
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
