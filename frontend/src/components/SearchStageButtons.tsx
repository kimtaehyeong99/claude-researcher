type AnalysisStatus = 'simple_analyzing' | 'deep_analyzing' | null;

interface SearchStageButtonsProps {
  currentStage: number;
  onSimpleSearch: () => void;
  onDeepSearch: () => void;
  loading?: boolean;
  analysisStatus?: AnalysisStatus;
}

export default function SearchStageButtons({
  currentStage,
  onSimpleSearch,
  onDeepSearch,
  loading,
  analysisStatus,
}: SearchStageButtonsProps) {
  const isAnalyzing = !!analysisStatus;

  return (
    <div className="stage-buttons">
      <button
        onClick={onSimpleSearch}
        disabled={loading || isAnalyzing}
        className={`stage-button ${currentStage >= 2 ? 'completed' : ''} ${analysisStatus === 'simple_analyzing' ? 'analyzing' : ''}`}
        title={currentStage >= 2 ? '초록 요약 다시 실행' : 'Abstract를 한국어로 요약'}
      >
        {analysisStatus === 'simple_analyzing' ? '요약 중...' : currentStage >= 2 ? '초록 요약 ✓' : '초록 요약'}
      </button>
      <button
        onClick={onDeepSearch}
        disabled={loading || currentStage < 2 || isAnalyzing}
        className={`stage-button ${currentStage >= 3 ? 'completed' : ''} ${analysisStatus === 'deep_analyzing' ? 'analyzing' : ''}`}
        title={currentStage >= 3 ? '상세 분석 다시 실행' : 'arXiv HTML 전체를 한국어로 상세 분석 (초록 요약 후 가능)'}
      >
        {analysisStatus === 'deep_analyzing' ? '분석 중...' : currentStage >= 3 ? '상세 분석 ✓' : '상세 분석'}
      </button>
    </div>
  );
}
