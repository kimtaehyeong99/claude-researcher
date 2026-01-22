interface SearchStageButtonsProps {
  currentStage: number;
  onSimpleSearch: () => void;
  onDeepSearch: () => void;
  loading?: boolean;
}

export default function SearchStageButtons({
  currentStage,
  onSimpleSearch,
  onDeepSearch,
  loading,
}: SearchStageButtonsProps) {
  return (
    <div className="stage-buttons">
      <button
        onClick={onSimpleSearch}
        disabled={loading}
        className={`stage-button ${currentStage >= 2 ? 'completed' : ''}`}
        title={currentStage >= 2 ? '초록 요약 다시 실행' : 'Abstract를 한국어로 요약'}
      >
        {currentStage >= 2 ? '초록 요약 ✓' : '초록 요약'}
      </button>
      <button
        onClick={onDeepSearch}
        disabled={loading || currentStage < 2}
        className={`stage-button ${currentStage >= 3 ? 'completed' : ''}`}
        title={currentStage >= 3 ? '상세 분석 다시 실행' : 'arXiv HTML 전체를 한국어로 상세 분석 (초록 요약 후 가능)'}
      >
        {currentStage >= 3 ? '상세 분석 ✓' : '상세 분석'}
      </button>
    </div>
  );
}
